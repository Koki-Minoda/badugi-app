from collections import Counter
import pytest
from rl.env.draw_lowball_env import DrawLowballEnv, discard_indexes_for_family, build_deck
from rl.env.draw_lowball_env_sixmax_selfplay import SixMaxDrawLowballEnv

HANDS = [('low-27', [(7, 0), (5, 1), (4, 2), (3, 3), (2, 0)]),
         ('low-a5', [(14, 0), (2, 1), (3, 2), (4, 3), (5, 0)])]


@pytest.mark.parametrize('family,hand', HANDS)
@pytest.mark.parametrize('count', range(6))
def test_explicit_count_overrides_pat_recommendation(family, hand, count):
    assert discard_indexes_for_family(hand, family) == []
    assert len(discard_indexes_for_family(hand, family, target_count=count)) == count


@pytest.mark.parametrize('family,hand', HANDS)
@pytest.mark.parametrize('count', range(6))
def test_hu_cards_and_history_match_requested_draw(family, hand, count):
    env = DrawLowballEnv(family=family); env.reset(seed=199)
    env.hero_hand = hand.copy()
    env.deck = [card for card in build_deck() if card not in hand]
    original = Counter(hand + env.deck)
    env._draw_for('hero', count)
    assert len(env.hero_hand) == 5
    assert len(set(hand) & set(env.hero_hand)) == 5 - count
    assert env.hero_last_draw_count == count
    assert len(env.hero_discarded_cards) == count
    assert Counter(env.hero_hand + env.deck + env.hero_discarded_cards) == original


@pytest.mark.parametrize('family,hand', HANDS)
@pytest.mark.parametrize('count', range(6))
def test_sixmax_cards_and_history_match_requested_draw(family, hand, count):
    env = SixMaxDrawLowballEnv(family=family); env.reset(seed=199)
    seat = env.hero_seat; env.players[seat]['hand'] = hand.copy()
    env.deck = [card for card in build_deck() if card not in hand]
    original = Counter(hand + env.deck)
    env._apply_draw(seat, count)
    player = env.players[seat]
    assert len(player['hand']) == 5
    assert len(set(hand) & set(player['hand'])) == 5 - count
    assert player['last_draw'] == player['total_draws'] == count
    assert len(player['discarded']) == count
    assert Counter(player['hand'] + env.deck + env.discard_pile) == original
