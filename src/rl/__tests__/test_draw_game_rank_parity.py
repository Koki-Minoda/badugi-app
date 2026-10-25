"""Lowball learning winners must match the shipped game evaluator."""
import json
import random
import subprocess
from pathlib import Path

import pytest
from rl.env.draw_lowball_env import build_deck, compare_lowball

ROOT = Path(__file__).resolve().parents[3]


def hand(ranks):
    return [(rank, index % 4) for index, rank in enumerate(ranks)]


@pytest.mark.parametrize('family', ['low-27', 'low-a5'])
@pytest.mark.parametrize('winner,loser', [
    ([2,2,5,8,13], [3,3,5,8,9]),
    ([2,2,4,4,13], [2,2,5,5,9]),
    ([2,2,2,8,13], [3,3,3,8,9]),
    ([2,2,2,13,13], [3,3,3,8,8]),
    ([2,2,2,2,13], [3,3,3,3,9]),
])
def test_made_group_precedes_kicker(family, winner, loser):
    assert compare_lowball(hand(winner),hand(loser),family) == 1
    assert compare_lowball(hand(loser),hand(winner),family) == -1


@pytest.mark.parametrize('family', ['low-27', 'low-a5'])
def test_seeded_comparisons_match_production(family):
    rng = random.Random(183)
    pairs = [[rng.sample(build_deck(),5), rng.sample(build_deck(),5)] for _ in range(2000)]
    labels = {11:'J',12:'Q',13:'K',14:'A'}
    encoded = [[[str(labels.get(rank,rank))+'CDHS'[suit] for rank,suit in cards] for cards in pair] for pair in pairs]
    script = '''
import {evaluateLowHand} from './src/games/evaluators/low.js';
let input=''; for await(const chunk of process.stdin) input+=chunk;
const {pairs,variant}=JSON.parse(input);
process.stdout.write(JSON.stringify(pairs.map(([a,b])=>-Math.sign(evaluateLowHand({cards:a,lowType:variant}).rankPrimary-evaluateLowHand({cards:b,lowType:variant}).rankPrimary))));
'''
    result = subprocess.run(['node','--input-type=module','-e',script],cwd=ROOT,input=json.dumps({'pairs':encoded,'variant':'27' if family=='low-27' else 'a5'}),capture_output=True,text=True,check=True)
    for (left,right), expected in zip(pairs,json.loads(result.stdout)):
        assert compare_lowball(left,right,family) == expected, (family,left,right,expected)
