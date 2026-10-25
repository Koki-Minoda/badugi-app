from collections import Counter
import pytest
from rl.env.badugi_env_selfplay import _draw_toward_badugi


@pytest.mark.parametrize('hand', [
    [(0, 0), (1, 1), (2, 2), (3, 3)],
    [(0, 0), (0, 1), (2, 2), (3, 3)],
    [(0, 0), (1, 0), (2, 0), (3, 0)],
])
@pytest.mark.parametrize('count', range(4))
def test_exact_draw_preserves_four_cards_and_inventory(hand, count):
    deck = [(r, s) for r in range(13) for s in range(4) if (r, s) not in hand]
    original = Counter(hand + deck)
    size = len(deck)
    result, discarded = _draw_toward_badugi(hand, count, deck)
    assert len(result) == 4
    assert len(discarded) == count
    assert len(deck) == size - count
    assert len(set(result)) == 4
    assert Counter(result + discarded + deck) == original
    assert not set(result) & set(discarded)


def test_deck_shortage_fails_before_mutating_cards():
    hand = [(0, 0), (1, 1), (2, 2), (3, 3)]
    deck = [(4, 0)]
    with pytest.raises(ValueError, match='deck'):
        _draw_toward_badugi(hand, 3, deck)
    assert len(hand) == 4 and deck == [(4, 0)]


def test_sixmax_recycles_only_muck_and_preserves_all_52_cards():
    from rl.env.badugi_env_sixmax_selfplay import SixMaxBadugiEnv
    env = SixMaxBadugiEnv(); env.reset(seed=186)
    for round_index in range(3):
        env.draw_round = round_index
        for seat in range(6):
            before = set(env.players[seat]['hand'])
            env._apply_draw(seat, 3)
            hands = [card for p in env.players for card in p['hand']]
            assert all(len(p['hand']) == 4 for p in env.players)
            assert len(set(hands)) == 24
            inventory = hands + env.deck + env.draw_muck
            assert len(inventory) == len(set(inventory)) == 52
            assert len(before & set(env.players[seat]['hand'])) == 1
    env.reset(seed=187)
    assert env.draw_muck == []
