"""Keep opt-in Python training observations aligned with live JS input."""

import json
import subprocess
from pathlib import Path

import numpy as np

from rl.env.draw_lowball_env import DRAW_ACTIONS, DrawLowballEnv


PROJECT_ROOT = Path(__file__).resolve().parents[3]
SUITS = "CDHS"
RANKS = {11: "J", 12: "Q", 13: "K", 14: "A"}


def _card_string(card):
    rank, suit = card
    return f"{RANKS.get(rank, str(rank))}{SUITS[suit]}"


def _browser_input(env):
    return {
        "state": {
            "variantId": "S01" if env.max_draws == 1 else (
                "D02" if env.family == "low-a5" else "D01"
            ),
            "street": env.phase,
            "drawRoundIndex": env.draw_round,
            "pot": env.pot,
            "currentBet": env.current_bet,
            "raiseCount": env.raise_count,
            "actingPlayerIndex": 0,
            "players": [
                {"hand": [_card_string(card) for card in env.hero_hand],
                 "stack": env.hero_stack, "bet": env.hero_bet},
                {"hand": [_card_string(card) for card in env.opp_hand],
                 "stack": env.opp_stack, "bet": env.opp_bet},
            ],
        },
        "seatIndex": 0,
        "legalActions": [DRAW_ACTIONS[index] for index in np.flatnonzero(env.legal_action_mask())],
    }


def test_browser_v1_observation_matches_live_js_across_phases_and_families():
    cases = []
    for family, max_draws, phase, hand in (
        ("low-27", 3, "BET", [(2, 0), (3, 1), (4, 2), (5, 3), (7, 0)]),
        ("low-27", 3, "DRAW", [(2, 0), (3, 1), (4, 2), (5, 3), (6, 0)]),
        ("low-a5", 3, "BET", [(14, 0), (2, 0), (3, 0), (4, 0), (5, 0)]),
        ("low-27", 1, "DRAW", [(8, 1), (8, 2), (10, 3), (12, 0), (14, 1)]),
    ):
        env = DrawLowballEnv(family=family, max_draws=max_draws,
                             seed=212, observation_schema="browser-v1")
        env.hero_hand = hand
        env.phase = phase
        env.draw_round = 1 if max_draws == 3 else 0
        env.pot = 27
        env.hero_stack = 76
        env.opp_stack = 69
        env.hero_bet = 2
        env.current_bet = 4
        env.raise_count = 1
        cases.append((_browser_input(env), env._observation().tolist()))

    script = """
        import fs from 'node:fs';
        import { buildDrawObservationPayload, buildDrawObservationVector }
          from './src/rl/drawObservationSchema.js';
        const cases = JSON.parse(fs.readFileSync(0, 'utf8'));
        process.stdout.write(JSON.stringify(cases.map(input =>
          buildDrawObservationVector(buildDrawObservationPayload(input)))));
    """
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=PROJECT_ROOT,
        input=json.dumps([item[0] for item in cases]),
        text=True,
        capture_output=True,
        check=True,
    )
    js_vectors = json.loads(result.stdout)
    for (_input, python_vector), js_vector in zip(cases, js_vectors):
        np.testing.assert_allclose(python_vector, js_vector, atol=1e-6)


def test_browser_v1_observation_has_no_hidden_opponent_profile():
    env = DrawLowballEnv(seed=113, observation_schema="browser-v1")
    first = env._observation()
    env.set_opponent_profile("aggressive")
    np.testing.assert_array_equal(first, env._observation())
