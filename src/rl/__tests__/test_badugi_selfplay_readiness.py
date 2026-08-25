from pathlib import Path

import pytest
import torch

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
from rl.training.train_selfplay_badugi_dqn import (
    SelfPlayConfig,
    _atomic_save_agent,
    _validate_config,
    train_selfplay_badugi_dqn,
)
from rl.training.train_sixmax_selfplay_badugi_dqn import hero_position_name
from rl.training import train_sixmax_selfplay_badugi_dqn as sixmax_trainer
from rl.training.train_sixmax_selfplay_badugi_dqn import (
    SixMaxSelfPlayConfig,
    _effective_teacher_warmup_episodes,
    _episode_epsilon,
    _load_initial_opponent_agent,
    _margin_batch_size,
    _maybe_imitation_update,
    train_sixmax_selfplay_badugi_dqn,
)
from rl.training.sixmax_action_telemetry import SixMaxActionTelemetry


def test_selfplay_config_rejects_unbounded_update_cadence():
    cfg = SelfPlayConfig(opponent_update_interval=0)

    with pytest.raises(ValueError, match="opponent_update_interval"):
        _validate_config(cfg)


def test_sixmax_hero_position_name_maps_relative_to_dealer():
    expected = ["BTN", "SB", "BB", "UTG", "MP", "CO"]

    for dealer_seat in range(6):
        assert [
            hero_position_name((dealer_seat + offset) % 6, dealer_seat)
            for offset in range(6)
        ] == expected


def test_sixmax_resume_continuation_starts_from_resume_epsilon():
    cfg = SixMaxSelfPlayConfig(
        pretrained="rl/models/badugi_sixmax_1m_from_200k/badugi_sixmax_dqn_latest.pt",
        resume_continuation=True,
    )

    assert _episode_epsilon(cfg, 1) == pytest.approx(0.25)
    assert _effective_teacher_warmup_episodes(cfg) == 0


def test_sixmax_trainer_defaults_counter_vpip_plateau():
    cfg = SixMaxSelfPlayConfig()

    assert cfg.resume_epsilon == pytest.approx(0.25)
    assert cfg.resume_epsilon_decay_episodes == 200_000
    assert cfg.epsilon_end == pytest.approx(0.05)
    assert cfg.fold_margin == pytest.approx(0.20)
    assert cfg.fold_margin_weight == pytest.approx(0.40)
    assert cfg.fold_margin_interval == 4
    assert _margin_batch_size(cfg) == 32
    assert cfg.call_margin == pytest.approx(0.20)
    assert cfg.call_margin_weight == pytest.approx(0.40)


def test_sixmax_fold_margin_batch_size_scales_with_config_batch_size():
    cfg = SixMaxSelfPlayConfig(batch_size=256)

    assert _margin_batch_size(cfg) == 64


def test_sixmax_pretrained_without_resume_keeps_existing_epsilon_schedule():
    cfg = SixMaxSelfPlayConfig(
        pretrained="rl/models/badugi_sixmax_1m_from_200k/badugi_sixmax_dqn_latest.pt",
    )

    assert _episode_epsilon(cfg, 1) == pytest.approx(0.55, abs=0.001)
    assert _effective_teacher_warmup_episodes(cfg) == 5_000


def _fill_agent_weights(agent: DQNAgent, value: float):
    for network in (agent.q_network, agent.target_network):
        for parameter in network.parameters():
            parameter.data.fill_(value)


def _agents_have_equal_weights(left: DQNAgent, right: DQNAgent) -> bool:
    for left_state, right_state in (
        (left.q_network.state_dict(), right.q_network.state_dict()),
        (left.target_network.state_dict(), right.target_network.state_dict()),
    ):
        for key, left_tensor in left_state.items():
            if not torch.equal(left_tensor, right_state[key]):
                return False
    return True


def test_sixmax_pretrained_opponent_loads_separate_checkpoint(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
):
    hero = DQNAgent(
        obs_dim=96,
        n_actions=6,
        hidden_dim=8,
        hyperparams=DQNHyperParams(batch_size=2),
    )
    saved_opponent = DQNAgent(
        obs_dim=96,
        n_actions=6,
        hidden_dim=8,
        hyperparams=DQNHyperParams(batch_size=2),
    )
    _fill_agent_weights(hero, 1.0)
    _fill_agent_weights(saved_opponent, 2.0)
    checkpoint = tmp_path / "opponent.pt"
    saved_opponent.save(str(checkpoint))
    cfg = SixMaxSelfPlayConfig(pretrained_opponent=str(checkpoint), batch_size=2)

    opponent = _load_initial_opponent_agent(cfg, hero, device="cpu")
    captured = capsys.readouterr().out

    assert _agents_have_equal_weights(opponent, saved_opponent)
    assert not _agents_have_equal_weights(opponent, hero)
    assert f"[6max-SelfPlay] Opponent checkpoint: {checkpoint}" in captured


def test_sixmax_pretrained_opponent_missing_falls_back_to_hero_copy(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
):
    hero = DQNAgent(
        obs_dim=96,
        n_actions=6,
        hidden_dim=8,
        hyperparams=DQNHyperParams(batch_size=2),
    )
    _fill_agent_weights(hero, 3.0)
    missing_checkpoint = tmp_path / "missing.pt"
    cfg = SixMaxSelfPlayConfig(pretrained_opponent=str(missing_checkpoint), batch_size=2)

    opponent = _load_initial_opponent_agent(cfg, hero, device="cpu")
    captured = capsys.readouterr().out

    assert opponent is not hero
    assert _agents_have_equal_weights(opponent, hero)
    assert "[6max-SelfPlay] Opponent checkpoint not found, using hero copy" in captured


def test_sixmax_without_pretrained_opponent_keeps_hero_copy_behavior(
    capsys: pytest.CaptureFixture[str],
):
    hero = DQNAgent(
        obs_dim=96,
        n_actions=6,
        hidden_dim=8,
        hyperparams=DQNHyperParams(batch_size=2),
    )
    _fill_agent_weights(hero, 4.0)
    cfg = SixMaxSelfPlayConfig(batch_size=2)

    opponent = _load_initial_opponent_agent(cfg, hero, device="cpu")
    captured = capsys.readouterr().out

    assert opponent is not hero
    assert _agents_have_equal_weights(opponent, hero)
    assert "[6max-SelfPlay] Opponent checkpoint: hero copy" in captured


def test_sixmax_resume_continuation_skips_teacher_warmup(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
):
    checkpoint = tmp_path / "pretrained.pt"
    agent = DQNAgent(
        obs_dim=96,
        n_actions=6,
        hidden_dim=8,
        hyperparams=DQNHyperParams(batch_size=2),
    )
    agent.save(str(checkpoint))

    def fail_teacher_warmup(*_args, **_kwargs):
        raise AssertionError("teacher warm-up should be skipped for resume continuation")

    monkeypatch.setattr(sixmax_trainer, "_teacher_warmup", fail_teacher_warmup)
    output_dir = tmp_path / "sixmax"
    cfg = SixMaxSelfPlayConfig(
        total_episodes=0,
        pretrained=str(checkpoint),
        resume_continuation=True,
        output_dir=str(output_dir),
        save_interval=0,
        log_interval=0,
        hidden_dim=8,
        batch_size=2,
        buffer_capacity=8,
    )

    summary = train_sixmax_selfplay_badugi_dqn(cfg=cfg, device="cpu")
    captured = capsys.readouterr().out

    assert summary["resume_continuation"] is True
    assert summary["epsilon_start_effective"] == pytest.approx(0.25)
    assert summary["teacher_warmup_episodes"] == 0
    assert summary["teacher_warmup_skipped"] is True
    assert "Continuation mode: on epsilon_start=0.250 teacher_warmup_episodes=0" in captured
    assert "Teacher warm-up skipped for continuation" in captured


class _FakeExpertBuffer:
    def __init__(self, size: int):
        self.size = size
        self.sample_calls = 0

    def __len__(self):
        return self.size

    def sample(self, batch_size: int):
        self.sample_calls += 1
        return {"batch_size": batch_size}


class _FakeHero:
    def __init__(self):
        self.imitation_calls = 0

    def imitation_update(self, batch, loss_weight: float):
        self.imitation_calls += 1
        return 1.25, 0.75


def test_sixmax_resume_continuation_skips_imitation_update():
    cfg = SixMaxSelfPlayConfig(
        resume_continuation=True,
        batch_size=10,
        expert_replay_ratio=0.5,
    )
    hero = _FakeHero()
    expert = _FakeExpertBuffer(size=10)

    loss, accuracy, ran = _maybe_imitation_update(cfg=cfg, hero=hero, expert=expert)

    assert (loss, accuracy, ran) == (None, None, False)
    assert hero.imitation_calls == 0
    assert expert.sample_calls == 0


def test_sixmax_fresh_training_allows_imitation_update():
    cfg = SixMaxSelfPlayConfig(
        resume_continuation=False,
        batch_size=10,
        expert_replay_ratio=0.5,
    )
    hero = _FakeHero()
    expert = _FakeExpertBuffer(size=10)

    loss, accuracy, ran = _maybe_imitation_update(cfg=cfg, hero=hero, expert=expert)

    assert ran is True
    assert loss == pytest.approx(1.25)
    assert accuracy == pytest.approx(0.75)
    assert hero.imitation_calls == 1
    assert expert.sample_calls == 1


def test_sixmax_action_telemetry_separates_bet_raise_and_facing_bet():
    telemetry = SixMaxActionTelemetry()
    telemetry.record_bet(0, facing_bet=True)
    telemetry.record_bet(1, facing_bet=False)
    telemetry.record_bet(2, facing_bet=True)
    telemetry.record_bet(3, facing_bet=False)
    telemetry.record_bet(4, facing_bet=True)
    telemetry.record_draw(2)
    telemetry.record_draw(0)

    rates = telemetry.rates(include_all_in=True, include_fold_to_bet=True, include_draw_average=True)

    assert rates["foldRate"] == 0.2
    assert rates["checkRate"] == 0.2
    assert rates["callRate"] == 0.2
    assert rates["betRate"] == 0.2
    assert rates["pureRaiseRate"] == 0.2
    assert rates["aggressionRate"] == 0.4
    assert rates["allInRate"] == 0.0
    assert rates["foldToBetRate"] == 1 / 3
    assert rates["drawAverage"] == 1.0


def test_atomic_save_agent_writes_readable_checkpoint(tmp_path: Path):
    checkpoint = tmp_path / "agent.pt"
    agent = DQNAgent(
        obs_dim=96,
        n_actions=6,
        hidden_dim=8,
        hyperparams=DQNHyperParams(batch_size=2),
    )

    duration = _atomic_save_agent(agent, checkpoint)
    loaded = DQNAgent.load(str(checkpoint), device="cpu")

    assert duration >= 0
    assert loaded.obs_dim == 96
    assert loaded.n_actions == 6
    assert not list(tmp_path.glob(".*.tmp"))


def test_tiny_selfplay_run_falls_back_from_corrupted_pretrained(tmp_path: Path):
    corrupted = tmp_path / "corrupted.pt"
    corrupted.write_text("not a torch checkpoint", encoding="utf8")
    output_dir = tmp_path / "out"
    cfg = SelfPlayConfig(
        total_episodes=1,
        max_steps_per_episode=4,
        buffer_capacity=8,
        warmup_steps=999,
        batch_size=2,
        teacher_warmup_episodes=0,
        imitation_pretrain_steps=0,
        hidden_dim=8,
        save_interval=0,
        log_interval=0,
        output_dir=str(output_dir),
        pretrained=str(corrupted),
        seed=7,
    )

    summary = train_selfplay_badugi_dqn(cfg=cfg, device="cpu")

    assert summary["episodes"] == 1
    assert summary["replay_size"] <= summary["replay_capacity"]
    assert summary["seed"] == 7
    assert Path(summary["checkpoint"]).exists()
    assert (output_dir / "badugi_selfplay_dqn_latest_summary.json").exists()
    assert not list(output_dir.glob(".*.tmp"))
