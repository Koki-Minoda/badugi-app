"""Compare learning winners with the independent production JS evaluator."""
import json
import random
import subprocess
from pathlib import Path

import pytest

from rl.env.badugi_env import build_deck, compare_badugi_scores, evaluate_badugi, _score_key
from rl.env.badugi_env_sixmax_selfplay import SixMaxBadugiEnv
from rl.env.badugi_env_selfplay import _best_badugi_keep
from rl.env.badugi_draw_policy import best_badugi_keep
from rl.training.badugi_starting_ranges import _score_key as range_score_key

ROOT = Path(__file__).resolve().parents[3]


def hand(ranks, suits=(0, 1, 2, 3)):
    return [(rank - 1, suit) for rank, suit in zip(ranks, suits)]


@pytest.mark.parametrize('winner,loser', [
    (hand([4, 5, 6, 7]), hand([1, 2, 3, 13])),
    (hand([1, 4, 5, 6]), hand([1, 2, 5, 8])),  # equal sums, different high cards
    (hand([3, 4, 5, 8]), hand([1, 2, 6, 8])),  # equal high, compare second high
])
def test_rank_order_and_percentile_match_high_card_first(winner, loser):
    winning, losing = evaluate_badugi(winner), evaluate_badugi(loser)
    assert compare_badugi_scores(winning, losing) == 1
    assert compare_badugi_scores(losing, winning) == -1
    assert _score_key(winning) > _score_key(losing)
    assert range_score_key(winning) > range_score_key(losing)
    env = SixMaxBadugiEnv()
    env.reset(seed=43)
    env.hero_seat = 0
    for player in env.players:
        player['folded'] = True
    env.players[0].update(hand=loser, folded=False)
    env.players[1].update(hand=winner, folded=False)
    assert env._showdown() < 0
    env.hero_seat = 1
    assert env._showdown() > 0


def test_equal_rank_ties_ignore_suits():
    left = hand([1, 3, 5, 7])
    right = hand([1, 3, 5, 7], (1, 2, 3, 0))
    assert compare_badugi_scores(evaluate_badugi(left), evaluate_badugi(right)) == 0


def test_seeded_hands_and_best_subsets_agree_with_production():
    rng = random.Random(182)
    pairs = [[rng.sample(build_deck(), 4), rng.sample(build_deck(), 4)] for _ in range(1000)]
    ranks, suits = 'A23456789TJQK', 'CDHS'
    encoded = [[[ranks[rank] + suits[suit] for rank, suit in cards] for cards in pair] for pair in pairs]
    script = '''
import {evaluateBadugi,compareBadugiEvaluations} from './src/games/badugi/utils/badugiEvaluator.js';
let input=''; for await (const chunk of process.stdin) input+=chunk;
const rows=JSON.parse(input).map(([a,b])=>{
 const left=evaluateBadugi(a),right=evaluateBadugi(b);
 return {left:{count:left.count,ranks:left.ranks},right:{count:right.count,ranks:right.ranks},winner:-Math.sign(compareBadugiEvaluations(left,right))};
});
process.stdout.write(JSON.stringify(rows));
'''
    result = subprocess.run(['node', '--input-type=module', '-e', script], input=json.dumps(encoded), cwd=ROOT, capture_output=True, text=True, check=True)
    expected = json.loads(result.stdout)
    for (left, right), oracle in zip(pairs, expected):
        a, b = evaluate_badugi(left), evaluate_badugi(right)
        assert (a[0], a[1]) == (oracle['left']['count'], oracle['left']['ranks'])
        assert (b[0], b[1]) == (oracle['right']['count'], oracle['right']['ranks'])
        assert compare_badugi_scores(a,b) == oracle['winner']
        for keep_policy in [_best_badugi_keep, best_badugi_keep]:
            kept = keep_policy(left)
            assert len(kept) == oracle['left']['count']
            assert sorted(rank for rank, _ in kept) == oracle['left']['ranks']
