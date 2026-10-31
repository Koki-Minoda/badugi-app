"""Exercise the first optimizer update in each betting-family trainer."""

import pytest

from rl.agents.dqn_agent import DQNAgent
from rl.training.train_board_dqn import BoardTrainConfig, train_board_dqn
from rl.training.train_stud_dqn import StudTrainConfig, train_stud_dqn


@pytest.mark.parametrize(
    ("trainer", "config_type", "family"),
    [
        (train_board_dqn, BoardTrainConfig, "nlh"),
        (train_stud_dqn, StudTrainConfig, "stud"),
    ],
)
def test_betting_trainer_completes_optimizer_update(
    trainer, config_type, family, tmp_path, monkeypatch
):
    update_count = 0
    original_update = DQNAgent.update

    def counted_update(self, *args, **kwargs):
        nonlocal update_count
        update_count += 1
        return original_update(self, *args, **kwargs)

    monkeypatch.setattr(DQNAgent, "update", counted_update)
    output_dir = tmp_path / family
    config = config_type(
        family=family,
        tier="standard",
        total_episodes=4,
        teacher_warmup_episodes=4,
        imitation_pretrain_steps=1,
        fixture_replay_copies=1,
        batch_size=2,
        warmup_steps=1,
        train_every_steps=2,
        output_dir=str(output_dir),
        **({"long_horizon": True, "max_steps_per_episode": 4} if family == "nlh" else {}),
    )

    summary = trainer(cfg=config, device="cpu")

    assert update_count >= 1
    assert summary["episodes"] == 4
    assert (output_dir / f"{family}_standard_{'board' if family == 'nlh' else 'stud'}_dqn_latest.pt").is_file()
