import pytest
import numpy as np

import rl.training.watch_sixmax_checkpoints as watch_sixmax_checkpoints
from rl.training.sixmax_action_telemetry import (
    SixMaxActionTelemetry,
    blind_pre_draw_pressure_opportunity,
    conservative_steal_opportunity,
    conservative_three_bet_opportunity,
    pre_draw_no_voluntary_action_before_hero,
)
from rl.training.watch_sixmax_checkpoints import _parse_log


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


def test_vpip_negative_paths_and_voluntary_actions_only():
    telemetry = SixMaxActionTelemetry()

    for action, expected_vpip in [(1, False), (0, False), (2, True), (3, True), (4, True)]:
        telemetry.start_episode(position="BB")
        telemetry.record_bet(action, facing_bet=action in (0, 2, 4), position="BB", betting_round="preDraw", is_pre_draw=True)
        telemetry.record_episode(reward=0.0, length=1, terminal_reason="showdown", position="BB")
        assert bool(telemetry._episode_vpip) is expected_vpip

    assert telemetry.rates()["vpip"] == pytest.approx(3 / 5)


def test_pfr_negative_paths_and_predraw_bet_raise_only():
    telemetry = SixMaxActionTelemetry()

    actions = [2, 1, 3, 4]
    for action in actions:
        telemetry.start_episode(position="CO")
        telemetry.record_bet(action, facing_bet=action in (2, 4), position="CO", betting_round="preDraw", is_pre_draw=True)
        telemetry.record_episode(reward=0.0, length=1, terminal_reason="showdown", position="CO")

    rates = telemetry.rates()

    assert rates["vpip"] == pytest.approx(3 / 4)
    assert rates["pfr"] == pytest.approx(2 / 4)


def test_conservative_three_bet_approximation_contract():
    assert conservative_three_bet_opportunity(
        draw_round=0,
        facing_bet=False,
        raise_legal=True,
        raise_count=1,
    ) is False
    assert conservative_three_bet_opportunity(
        draw_round=0,
        facing_bet=True,
        raise_legal=True,
        raise_count=0,
    ) is False
    assert conservative_three_bet_opportunity(
        draw_round=0,
        facing_bet=True,
        raise_legal=False,
        raise_count=1,
    ) is False
    assert conservative_three_bet_opportunity(
        draw_round=1,
        facing_bet=True,
        raise_legal=True,
        raise_count=1,
    ) is False
    assert conservative_three_bet_opportunity(
        draw_round=0,
        facing_bet=True,
        raise_legal=True,
        raise_count=1,
    ) is True
    # By design, this conservative approximation may include later 4bet/cap spots.
    assert conservative_three_bet_opportunity(
        draw_round=0,
        facing_bet=True,
        raise_legal=True,
        raise_count=2,
    ) is True


def test_steal_opportunity_and_attempts_for_late_positions_only():
    telemetry = SixMaxActionTelemetry()

    for position, action in [("BTN", 3), ("CO", 4), ("SB", 3)]:
        telemetry.record_bet(
            action,
            facing_bet=action == 4,
            position=position,
            betting_round="preDraw",
            is_pre_draw=True,
            steal_opportunity=True,
        )

    for action in (0, 1, 2):
        telemetry.record_bet(
            action,
            facing_bet=action in (0, 2),
            position="BTN",
            betting_round="preDraw",
            is_pre_draw=True,
            steal_opportunity=True,
        )

    summary = telemetry.summary()

    assert summary["stealOpportunityCount"] == 6
    assert summary["stealAttemptCount"] == 3
    assert summary["stealSuccessCount"] == 0
    assert summary["steal_opportunity_count"] == 6
    assert summary["steal_attempt_count"] == 3
    assert summary["steal_success_count"] == 0
    assert summary["stealRate"] == pytest.approx(0.5)
    assert summary["stealSuccessRate"] == pytest.approx(0.0)
    assert summary["positionStats"]["BTN"]["stealOpportunityCount"] == 4
    assert summary["positionStats"]["BTN"]["stealAttemptCount"] == 1
    assert summary["positionStats"]["BTN"]["stealSuccessCount"] == 0
    assert summary["positionStats"]["BTN"]["steal_opportunity_count"] == 4
    assert summary["positionStats"]["BTN"]["steal_attempt_count"] == 1
    assert summary["positionStats"]["BTN"]["steal_success_count"] == 0
    assert summary["positionStats"]["BTN"]["stealRate"] == pytest.approx(0.25)
    assert summary["positionStats"]["CO"]["stealRate"] == 1.0
    assert summary["positionStats"]["SB"]["stealRate"] == 1.0


def test_steal_success_counts_are_episode_scoped_by_position():
    telemetry = SixMaxActionTelemetry()

    telemetry.start_episode(position="BTN")
    telemetry.record_bet(
        3,
        facing_bet=False,
        position="BTN",
        betting_round="preDraw",
        is_pre_draw=True,
        steal_opportunity=True,
    )
    telemetry.record_episode(reward=1.0, length=2, terminal_reason="fold_win", position="BTN")

    telemetry.start_episode(position="CO")
    telemetry.record_bet(
        4,
        facing_bet=True,
        position="CO",
        betting_round="preDraw",
        is_pre_draw=True,
        steal_opportunity=True,
    )
    telemetry.record_episode(reward=-1.0, length=4, terminal_reason="showdown", position="CO")

    summary = telemetry.summary()

    assert summary["stealOpportunityCount"] == 2
    assert summary["stealAttemptCount"] == 2
    assert summary["stealSuccessCount"] == 1
    assert summary["stealSuccessRate"] == pytest.approx(0.5)
    assert summary["positionStats"]["BTN"]["stealSuccessCount"] == 1
    assert summary["positionStats"]["CO"]["stealSuccessCount"] == 0


def test_conservative_steal_opportunity_contract_and_false_positive_guards():
    assert conservative_steal_opportunity(
        position="BTN",
        betting_round="preDraw",
        no_voluntary_action_before_hero=True,
        bet_legal=False,
        raise_legal=True,
    ) is True
    assert conservative_steal_opportunity(
        position="UTG",
        betting_round="preDraw",
        no_voluntary_action_before_hero=True,
        bet_legal=True,
        raise_legal=False,
    ) is False
    assert conservative_steal_opportunity(
        position="MP",
        betting_round="preDraw",
        no_voluntary_action_before_hero=True,
        bet_legal=True,
        raise_legal=False,
    ) is False
    assert conservative_steal_opportunity(
        position="BB",
        betting_round="preDraw",
        no_voluntary_action_before_hero=True,
        bet_legal=True,
        raise_legal=True,
    ) is False
    assert conservative_steal_opportunity(
        position="CO",
        betting_round="afterDraw1",
        no_voluntary_action_before_hero=True,
        bet_legal=True,
        raise_legal=False,
    ) is False
    assert conservative_steal_opportunity(
        position="SB",
        betting_round="preDraw",
        no_voluntary_action_before_hero=False,
        bet_legal=False,
        raise_legal=True,
    ) is False
    assert conservative_steal_opportunity(
        position="BTN",
        betting_round="preDraw",
        no_voluntary_action_before_hero=True,
        bet_legal=False,
        raise_legal=False,
    ) is False


def test_pre_draw_first_in_helper_detects_prior_voluntary_calls():
    players = [
        {"bet": 0, "folded": False, "opened_current_round": False},
        {"bet": 1, "folded": False, "opened_current_round": False},
        {"bet": 2, "folded": False, "opened_current_round": False},
        {"bet": 0, "folded": True, "opened_current_round": False},
        {"bet": 0, "folded": False, "opened_current_round": False},
        {"bet": 0, "folded": False, "opened_current_round": False},
    ]

    assert pre_draw_no_voluntary_action_before_hero(
        players=players,
        dealer_seat=0,
        hero_seat=5,
    ) is True

    players[4]["bet"] = 2
    assert pre_draw_no_voluntary_action_before_hero(
        players=players,
        dealer_seat=0,
        hero_seat=5,
    ) is False

    players[4]["bet"] = 0
    players[3]["folded"] = False
    players[3]["opened_current_round"] = True
    assert pre_draw_no_voluntary_action_before_hero(
        players=players,
        dealer_seat=0,
        hero_seat=5,
    ) is False


def test_blind_pre_draw_pressure_fallback_and_exact_steal_rates_are_null():
    telemetry = SixMaxActionTelemetry()

    telemetry.record_bet(
        0,
        facing_bet=True,
        position="BB",
        betting_round="preDraw",
        is_pre_draw=True,
        blind_pressure_opportunity=True,
    )
    telemetry.record_bet(
        2,
        facing_bet=True,
        position="SB",
        betting_round="preDraw",
        is_pre_draw=True,
        blind_pressure_opportunity=True,
    )

    summary = telemetry.summary()

    assert summary["foldBbToStealRate"] is None
    assert summary["foldSbToStealRate"] is None
    assert summary["bbFoldToPreDrawPressureRate"] == pytest.approx(1.0)
    assert summary["sbFoldToPreDrawPressureRate"] == pytest.approx(0.0)
    assert summary["blindPreDrawPressureCounts"]["BB"] == {"opportunities": 1, "folds": 1}
    assert summary["blindPreDrawPressureCounts"]["SB"] == {"opportunities": 1, "folds": 0}
    assert summary["positionStats"]["BB"]["foldToPreDrawPressureRate"] == pytest.approx(1.0)
    assert summary["positionStats"]["SB"]["foldToPreDrawPressureRate"] == pytest.approx(0.0)


def test_blind_pressure_opportunity_contract():
    assert blind_pre_draw_pressure_opportunity(
        position="BB",
        betting_round="preDraw",
        facing_bet=True,
        fold_legal=True,
    ) is True
    assert blind_pre_draw_pressure_opportunity(
        position="SB",
        betting_round="preDraw",
        facing_bet=True,
        fold_legal=True,
    ) is True
    assert blind_pre_draw_pressure_opportunity(
        position="BTN",
        betting_round="preDraw",
        facing_bet=True,
        fold_legal=True,
    ) is False
    assert blind_pre_draw_pressure_opportunity(
        position="BB",
        betting_round="afterDraw1",
        facing_bet=True,
        fold_legal=True,
    ) is False
    assert blind_pre_draw_pressure_opportunity(
        position="BB",
        betting_round="preDraw",
        facing_bet=True,
        fold_legal=False,
    ) is False


def test_steal_summary_safe_when_no_opportunities_exist():
    telemetry = SixMaxActionTelemetry()

    telemetry.record_bet(3, facing_bet=False, position="UTG", betting_round="preDraw", is_pre_draw=True)
    telemetry.record_bet(3, facing_bet=False, position="BTN", betting_round="afterDraw1", is_pre_draw=False)

    summary = telemetry.summary()

    assert summary["stealOpportunityCount"] == 0
    assert summary["stealAttemptCount"] == 0
    assert summary["stealSuccessCount"] == 0
    assert summary["stealRate"] is None
    assert summary["stealSuccessRate"] is None
    assert summary["positionStats"]["BTN"]["stealRate"] is None
    assert summary["bbFoldToPreDrawPressureRate"] is None
    assert summary["sbFoldToPreDrawPressureRate"] is None


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


def test_position_rewards_vpip_and_pfr_are_isolated():
    telemetry = SixMaxActionTelemetry()

    telemetry.start_episode(position="BTN")
    telemetry.record_bet(3, facing_bet=False, position="BTN", betting_round="preDraw", is_pre_draw=True)
    telemetry.record_episode(reward=2.0, length=2, terminal_reason="fold_win", position="BTN")

    telemetry.start_episode(position="BB")
    telemetry.record_bet(1, facing_bet=False, position="BB", betting_round="preDraw", is_pre_draw=True)
    telemetry.record_episode(reward=-1.0, length=2, terminal_reason="fold_win", position="BB")

    positions = telemetry.position_summaries()

    assert positions["BTN"]["rewardAvg"] == 2.0
    assert positions["BB"]["rewardAvg"] == -1.0
    assert positions["BTN"]["vpip"] == 1.0
    assert positions["BTN"]["pfr"] == 1.0
    assert positions["BB"]["vpip"] == 0.0
    assert positions["BB"]["pfr"] == 0.0


def test_position_ev_order_and_btn_below_utg_or_co_warning_are_reported():
    telemetry = SixMaxActionTelemetry()

    telemetry.start_episode(position="BTN")
    telemetry.record_episode(reward=-0.5, length=1, terminal_reason="showdown", position="BTN")
    telemetry.start_episode(position="CO")
    telemetry.record_episode(reward=0.0, length=1, terminal_reason="showdown", position="CO")
    telemetry.start_episode(position="UTG")
    telemetry.record_episode(reward=0.25, length=1, terminal_reason="showdown", position="UTG")

    summary = telemetry.summary()

    assert list(summary["positionEV"].keys()) == ["BTN", "CO", "MP", "UTG", "SB", "BB"]
    assert summary["positionEV"]["BTN"] == pytest.approx(-0.5)
    assert summary["positionEV"]["UTG"] == pytest.approx(0.25)
    assert summary["warnings"] == [
        "BTN_EV_BELOW_UTG:BTN=-0.500<UTG=0.250",
        "BTN_EV_BELOW_CO:BTN=-0.500<CO=0.000",
    ]


def test_street_action_buckets_are_independent():
    telemetry = SixMaxActionTelemetry()

    for action, street in [(0, "preDraw"), (1, "afterDraw1"), (2, "afterDraw2"), (3, "afterDraw3")]:
        telemetry.record_bet(action, facing_bet=action in (0, 2), betting_round=street)

    streets = telemetry.summary()["bettingRoundActionStats"]

    assert streets["preDraw"]["foldRate"] == 1.0
    assert streets["afterDraw1"]["checkRate"] == 1.0
    assert streets["afterDraw2"]["callRate"] == 1.0
    assert streets["afterDraw3"]["betRate"] == 1.0


def test_fold_win_terminal_reason_splits_by_reward_sign():
    telemetry = SixMaxActionTelemetry()

    telemetry.record_episode(reward=1.0, length=2, terminal_reason="fold_win")
    telemetry.record_episode(reward=-1.0, length=3, terminal_reason="fold_win")

    summary = telemetry.summary()

    assert summary["terminalCounts"]["fold_win"] == 1
    assert summary["terminalCounts"]["fold_loss"] == 1
    assert summary["foldWinRate"] == pytest.approx(0.5)
    assert summary["foldLossRate"] == pytest.approx(0.5)


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
        "steal%=33.0 stealOpp=12 stealAtt=4 stealSucc=3 "
        "BTNsteal%=40.0 BTNstealOpp=5 BTNstealAtt=2 BTNstealSucc=1 "
        "COsteal%=20.0 COstealOpp=4 COstealAtt=1 COstealSucc=1 "
        "SBsteal%=10.0 SBstealOpp=3 SBstealAtt=1 SBstealSucc=1 "
        "bbFtp%=55.0 sbFtp%=44.0 "
        "term=[sd:5 fw:3 fl:1 tr:1] epLen=8.0 drawDist=[0:1 1:2 2:3 3:4 4:0] "
        "opp_upd=0 spd=12.0ep/s ETA=0.0h\n",
        encoding="utf8",
    )

    stats = _parse_log(log_path, 100)

    assert stats["bet_pct"] == 15.0
    assert stats["raise_pct"] == 5.0
    assert stats["aggression_pct"] == 20.0
    assert stats["steal_pct"] == 33.0
    assert stats["steal_opportunity_count"] == 12.0
    assert stats["steal_attempt_count"] == 4.0
    assert stats["steal_success_count"] == 3.0
    assert stats["btn_steal_pct"] == 40.0
    assert stats["btn_steal_opportunity_count"] == 5.0
    assert stats["btn_steal_attempt_count"] == 2.0
    assert stats["btn_steal_success_count"] == 1.0
    assert stats["co_steal_pct"] == 20.0
    assert stats["co_steal_opportunity_count"] == 4.0
    assert stats["co_steal_attempt_count"] == 1.0
    assert stats["co_steal_success_count"] == 1.0
    assert stats["sb_steal_pct"] == 10.0
    assert stats["sb_steal_opportunity_count"] == 3.0
    assert stats["sb_steal_attempt_count"] == 1.0
    assert stats["sb_steal_success_count"] == 1.0
    assert stats["bb_ftp_pct"] == 55.0
    assert stats["sb_ftp_pct"] == 44.0


def test_watcher_eval_sixmax_return_contract_uses_pure_raise_and_agg(monkeypatch):
    class FakeQ:
        def __init__(self):
            self.calls = 0

        def __call__(self, _tensor):
            action = 3 if self.calls % 2 == 0 else 4
            self.calls += 1
            q = np.zeros((1, 6), dtype=np.float32)
            q[0, action] = 10.0
            return FakeQResult(q)

    class FakeQResult:
        def __init__(self, array):
            self.array = array

        def detach(self):
            return self

        def numpy(self):
            return self.array

    class FakeAgent:
        def __init__(self):
            self.q_network = FakeQ()

    class FakeDQNAgent:
        @staticmethod
        def load(_path, device="cpu"):
            return FakeAgent()

    class FakeEnv:
        def __init__(self, seed=None):
            self._hero_seat_counter = 0
            self.players = [{"bet": 1} for _ in range(6)]

        def set_agents(self, _hero, _opp):
            return None

        def reset(self):
            self.hero_seat = self._hero_seat_counter % 6
            self.dealer_seat = self.hero_seat
            self.phase = "BET"
            self.draw_round = 0
            self.raise_count = 1
            self.current_bet = 2
            return np.zeros(96, dtype=np.float32), {}

        def legal_action_mask(self):
            return np.array([1, 0, 1, 1, 1, 0], dtype=np.float32)

        def step(self, action):
            reward = 1.0 if action == 3 else -1.0
            return (
                np.zeros(96, dtype=np.float32),
                reward,
                True,
                False,
                {"terminal_reason": "fold_win"},
            )

    monkeypatch.setattr(watch_sixmax_checkpoints, "DQNAgent", FakeDQNAgent)
    monkeypatch.setattr(watch_sixmax_checkpoints, "SixMaxBadugiEnv", FakeEnv)

    result = watch_sixmax_checkpoints._eval_sixmax("fake.pt", n_episodes=6)

    assert set([
        "fold_rate",
        "pure_raise_rate",
        "agg_rate",
        "raise_rate",
        "vpip",
        "pfr",
        "steal_rate",
        "steal_opportunity_count",
        "steal_attempt_count",
        "steal_success_count",
        "fold_bb_to_steal_rate",
        "fold_sb_to_steal_rate",
        "bb_fold_to_predraw_pressure_rate",
        "sb_fold_to_predraw_pressure_rate",
        "pos_rewards",
    ]).issubset(result)
    assert result["pure_raise_rate"] == pytest.approx(0.5)
    assert result["raise_rate"] == result["pure_raise_rate"]
    assert result["agg_rate"] == pytest.approx(1.0)
    assert result["pure_raise_rate"] != result["agg_rate"]
    assert result["vpip"] == pytest.approx(1.0)
    assert result["pfr"] == pytest.approx(1.0)
    assert result["steal_opportunity_count"] >= 0
    assert result["steal_attempt_count"] >= 0
    assert result["steal_success_count"] >= 0
    assert result["fold_bb_to_steal_rate"] is None
    assert result["fold_sb_to_steal_rate"] is None
