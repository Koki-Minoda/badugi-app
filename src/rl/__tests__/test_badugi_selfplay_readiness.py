from pathlib import Path

import pytest

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
from rl.training.train_selfplay_badugi_dqn import (
    SelfPlayConfig,
    _atomic_save_agent,
    _validate_config,
    train_selfplay_badugi_dqn,
)
from rl.training.train_sixmax_selfplay_badugi_dqn import hero_position_name


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
