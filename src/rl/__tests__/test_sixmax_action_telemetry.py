import pytest

from rl.training.watch_sixmax_checkpoints import _parse_log
from rl.training.sixmax_action_telemetry import SixMaxActionTelemetry


def test_action_split_aggression_factor_and_draw_distribution_badugi_shape():
    telemetry = SixMaxActionTelemetry(max_draw_count=4)
    for action in (0, 1, 2, 3, 4):
        telemetry.record_bet(action, facing_bet=action in (0, 2, 4))
    telemetry.record_draw(0)
    telemetry.record_draw(3)
    telemetry.record_draw(4)

    rates = telemetry.rates(include_all_in=True, include_fold_to_bet=True, include_draw_average=True)

    assert rates["foldRate"] == pytest.approx(0.2)
    assert rates["checkRate"] == pytest.approx(0.2)
    assert rates["callRate"] == pytest.approx(0.2)
    assert rates["betRate"] == pytest.approx(0.2)
    assert rates["pureRaiseRate"] == pytest.approx(0.2)
    assert rates["aggressionRate"] == pytest.approx(0.4)
    assert rates["aggressionFactor"] == pytest.approx(2.0)
    assert rates["foldToBetRate"] == pytest.approx(1 / 3)
    assert telemetry.summary()["drawCountDistribution"] == {"0": 1, "1": 0, "2": 0, "3": 1, "4": 1}


def test_draw_lowball_distribution_supports_zero_through_five():
    telemetry = SixMaxActionTelemetry(action_count=11, max_draw_count=5)
    for draw_count in range(6):
        telemetry.record_draw(draw_count)

    assert telemetry.summary()["drawCountDistribution"] == {
        "0": 1,
        "1": 1,
        "2": 1,
        "3": 1,
        "4": 1,
        "5": 1,
    }
    assert telemetry.rates()["patRate"] == pytest.approx(1 / 6)


def test_vpip_pfr_three_bet_and_blind_only_hands():
    telemetry = SixMaxActionTelemetry()

    telemetry.start_episode(position="BTN")
    telemetry.record_bet(1, facing_bet=False, position="BTN", betting_round="preDraw", is_pre_draw=True)
    telemetry.record_episode(reward=0.0, length=1, terminal_reason="fold_win", position="BTN")

    telemetry.start_episode(position="CO")
    telemetry.record_bet(2, facing_bet=True, position="CO", betting_round="preDraw", is_pre_draw=True)
    telemetry.record_episode(reward=-1.0, length=2, terminal_reason="fold_win", position="CO")

    telemetry.start_episode(position="MP")
    telemetry.record_bet(
        4,
        facing_bet=True,
        position="MP",
        betting_round="preDraw",
        is_pre_draw=True,
        three_bet_opportunity=True,
    )
    telemetry.record_episode(reward=1.0, length=3, terminal_reason="showdown", position="MP")

    rates = telemetry.rates()

    assert rates["vpip"] == pytest.approx(2 / 3)
    assert rates["pfr"] == pytest.approx(1 / 3)
    assert rates["threeBetRate"] == pytest.approx(1.0)
    assert telemetry.position_summaries()["BTN"]["vpip"] == 0.0
    assert telemetry.position_summaries()["CO"]["vpip"] == 1.0
    assert telemetry.position_summaries()["MP"]["pfr"] == 1.0


def test_terminal_reason_rates_and_position_actions_are_separate():
    telemetry = SixMaxActionTelemetry()

    telemetry.start_episode(position="BTN")
    telemetry.record_bet(3, facing_bet=False, position="BTN", betting_round="preDraw", is_pre_draw=True)
    telemetry.record_episode(reward=1.2, length=7, terminal_reason="showdown", position="BTN")

    telemetry.start_episode(position="SB")
    telemetry.record_bet(0, facing_bet=True, position="SB", betting_round="preDraw", is_pre_draw=True)
    telemetry.record_episode(reward=-1.0, length=3, terminal_reason="fold_win", position="SB")

    telemetry.start_episode(position="BB")
    telemetry.record_episode(reward=0.0, length=80, terminal_reason="truncated", truncated=True, max_step_hit=True, position="BB")

    summary = telemetry.summary()

    assert summary["showdownRate"] == pytest.approx(1 / 3)
    assert summary["foldLossRate"] == pytest.approx(1 / 3)
    assert summary["truncationRate"] == pytest.approx(1 / 3)
    assert summary["showdownWinRate"] == pytest.approx(1.0)
    assert summary["avgEpisodeLength"] == pytest.approx(30.0)
    assert summary["positionStats"]["BTN"]["betRate"] == pytest.approx(1.0)
    assert summary["positionStats"]["SB"]["foldRate"] == pytest.approx(1.0)
    assert summary["positionStats"]["BB"]["hands"] == 1


def test_history_storage_is_bounded():
    telemetry = SixMaxActionTelemetry(history_maxlen=3)

    for idx in range(10):
        telemetry.start_episode(position="BTN")
        telemetry.record_episode(reward=float(idx), length=idx + 1, terminal_reason="showdown", position="BTN")
        telemetry.record_q(mean_q=float(idx))

    assert len(telemetry.episode_lengths) == 3
    assert list(telemetry.episode_lengths) == [8, 9, 10]
    assert len(telemetry.q_means) == 3
    assert list(telemetry.q_means) == [7.0, 8.0, 9.0]
    assert len(telemetry.positions["BTN"].rewards) == 3
    assert list(telemetry.positions["BTN"].rewards) == [7.0, 8.0, 9.0]


def test_watcher_parses_pure_raise_and_agg_separately(tmp_path):
    log_path = tmp_path / "train.log"
    log_path.write_text(
        "[6max      100] avg=  -0.100 ε=0.500 buf=    10 loss=0.00100 q=0.250 "
        "fold%=10.0 chk%=20.0 call%=30.0 bet%=15.0 raise%=5.0 ai%=0.0 agg%=20.0 "
        "ftb%=12.0 drawAvg=1.50 vpip%=70.0 pfr%=20.0 af=0.67 sd%=50.0 wsd%=25.0 "
        "term=[sd:5 fw:3 fl:1 tr:1] epLen=8.0 drawDist=[0:1 1:2 2:3 3:4 4:0] "
        "opp_upd=0 spd=12.0ep/s ETA=0.0h\n",
        encoding="utf8",
    )

    stats = _parse_log(log_path, 100)

    assert stats["bet_pct"] == 15.0
    assert stats["raise_pct"] == 5.0
    assert stats["aggression_pct"] == 20.0
