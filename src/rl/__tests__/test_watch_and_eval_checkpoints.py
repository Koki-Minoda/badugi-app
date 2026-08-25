import json
from pathlib import Path

from rl.training.watch_and_eval_checkpoints import (
    _classify_terminal_reason,
    checkpoint_candidates,
    checkpoint_glob_pattern,
    eval_note_for,
    parse_train_log,
    summary_path_for,
    summary_reaches_target,
)


def test_sixmax_checkpoint_glob_detects_only_sixmax_checkpoints(tmp_path: Path):
    sixmax = tmp_path / "badugi_sixmax_dqn_0001000_20260607-000000.pt"
    hu = tmp_path / "badugi_dqn_0001000_20260607-000000.pt"
    sixmax.write_text("sixmax", encoding="utf8")
    hu.write_text("hu", encoding="utf8")

    assert checkpoint_glob_pattern("sixmax") == "badugi_sixmax_dqn_[0-9]*.pt"
    assert checkpoint_glob_pattern("hu") == "badugi_dqn_[0-9]*.pt"
    assert checkpoint_candidates(tmp_path, "sixmax") == [sixmax]
    assert checkpoint_candidates(tmp_path, "hu") == [hu]


def test_parse_train_log_supports_sixmax_and_legacy_episode_lines(tmp_path: Path):
    log_path = tmp_path / "train.log"
    log_path.write_text(
        "\n".join(
            [
                "[6max 0001000] avg=1.250 ε=0.123 buf=4096 loss=0.001 q=0.440",
                "[Episode 2000] avg_reward=2.500 epsilon=0.100 buffer=100 loss=0.200 mean_q=0.300",
            ]
        ),
        encoding="utf8",
    )

    entries = parse_train_log(log_path, mode="sixmax")

    assert entries[0]["episode"] == 1000
    assert entries[0]["avg_reward"] == 1.25
    assert entries[0]["epsilon"] == 0.123
    assert entries[0]["buffer"] == 4096
    assert entries[0]["mean_q"] == 0.44
    assert entries[1]["episode"] == 2000
    assert entries[1]["avg_reward"] == 2.5
    assert entries[1]["epsilon"] == 0.1
    assert entries[1]["buffer"] == 100


def test_sixmax_summary_path_is_used_for_target_completion(tmp_path: Path):
    hu_summary = tmp_path / "badugi_dqn_latest_summary.json"
    sixmax_summary = tmp_path / "badugi_sixmax_dqn_latest_summary.json"
    hu_summary.write_text(json.dumps({"episodes": 2000}), encoding="utf8")

    assert summary_path_for(tmp_path, "sixmax") == sixmax_summary
    assert summary_path_for(tmp_path, "hu") == hu_summary
    assert summary_reaches_target(tmp_path, "sixmax", 1000) is False
    assert summary_reaches_target(tmp_path, "hu", 1000) is True

    sixmax_summary.write_text(json.dumps({"episodes": 1000}), encoding="utf8")
    assert summary_reaches_target(tmp_path, "sixmax", 1000) is True


def test_terminal_reason_classification_uses_current_badugi_reasons():
    assert _classify_terminal_reason("hero_fold") == "fold"
    assert _classify_terminal_reason("fold_win") == "fold"
    assert _classify_terminal_reason("showdown") == "showdown"
    assert _classify_terminal_reason("player_fold") is None


def test_sixmax_eval_note_declares_smoke_eval_limitations():
    note = eval_note_for("sixmax")

    assert "SixMaxBadugiEnv" in note
    assert "smoke" in note
    assert "less representative" in note
