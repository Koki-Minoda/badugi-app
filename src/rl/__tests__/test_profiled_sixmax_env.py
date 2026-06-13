import numpy as np
import pytest

from rl.env.badugi_env import BADUGI_OBSERVATION_VECTOR_SIZE
from rl.env.badugi_env_sixmax_profiled import ProfiledSixMaxBadugiEnv
from rl.env.badugi_env_sixmax_selfplay import SixMaxBadugiEnv


def _first_legal_action(mask: np.ndarray) -> int:
    legal = np.where(mask > 0)[0]
    assert len(legal) > 0
    return int(legal[0])


def test_profiled_sixmax_env_accepts_opp_epsilon():
    env = ProfiledSixMaxBadugiEnv(
        opponent_profile="draw_heavy",
        seed=17,
        opp_epsilon=0.25,
    )

    assert env.opp_epsilon == pytest.approx(0.25)


def test_profiled_sixmax_env_batched_opponent_action_is_legal():
    env = ProfiledSixMaxBadugiEnv(opponent_profile="loose_passive", seed=23, opp_epsilon=0.0)
    env.reset(seed=23)
    seats = [seat for seat in range(6) if seat != env.hero_seat and not env.players[seat]["folded"]]
    assert seats

    action = env._get_opp_actions_batched([seats[0]], env.phase)[0]

    if env.phase == "BET":
        assert env._mask_for(seats[0])[action] > 0
    else:
        assert action in {0, 1, 2, 3}


def test_profiled_sixmax_env_step_shapes_match_sixmax_env():
    profiled = ProfiledSixMaxBadugiEnv(opponent_profile="loose_aggressive", seed=31, opp_epsilon=0.0)
    selfplay = SixMaxBadugiEnv(seed=31, opp_epsilon=0.0)

    profiled_obs, _ = profiled.reset(seed=31)
    selfplay_obs, _ = selfplay.reset(seed=31)
    profiled_mask = profiled.legal_action_mask()
    selfplay_mask = selfplay.legal_action_mask()

    action = _first_legal_action(profiled_mask)
    next_obs, reward, terminated, truncated, info = profiled.step(action)

    assert profiled_obs.shape == selfplay_obs.shape == (BADUGI_OBSERVATION_VECTOR_SIZE,)
    assert profiled_mask.shape == selfplay_mask.shape == (6,)
    assert next_obs.shape == (BADUGI_OBSERVATION_VECTOR_SIZE,)
    assert isinstance(float(reward), float)
    assert isinstance(bool(terminated), bool)
    assert isinstance(bool(truncated), bool)
    assert isinstance(info, dict)
