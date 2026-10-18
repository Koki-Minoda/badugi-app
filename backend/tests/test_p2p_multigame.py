import pytest
from app.p2p.manager import P2PRoomManager, P2PError, low_rank
from app.p2p.persistence import room_from_snapshot, room_to_snapshot


def room_for(count, variant):
    manager = P2PRoomManager()
    room = manager.create_room(user_id='p0', display_name='Player 0', max_players=count, variant_id=variant)
    for i in range(1,count):
        manager.join_room(room.code,user_id=f'p{i}',display_name=f'Player {i}')
    for i in range(count):
        manager.ready(room.code,user_id=f'p{i}')
    return manager, room


@pytest.mark.parametrize('count', [2,3,4,5,6])
@pytest.mark.parametrize('variant', ['badugi','ace_to_five_triple_draw','deuce_to_seven_triple_draw'])
def test_full_draws_preserve_chips_cards_and_private_hands(count, variant):
    manager, room = room_for(count,variant)
    draws = 0
    for _ in range(200):
        if room.phase == 'showdown': break
        actor = room.current_actor_id
        assert actor
        private = manager.public_state(room,viewer_id=actor)
        assert private['hand'] == room.players[actor].hand
        assert all('hand' not in p for p in private['players'])
        if room.phase.startswith('draw'):
            n = len(room.players[actor].hand)
            manager.draw(room.code,user_id=actor,card_indexes=list(range(n)))
            draws += 1
        else:
            legal = manager.legal_actions(room,actor)
            manager.act(room.code,user_id=actor,action='check' if 'check' in legal else 'call')
        all_cards = room.deck + room.discard + [card for p in room.players.values() for card in p.hand]
        assert len(all_cards) == 52
        assert len(set(all_cards)) == 52
        assert room.pot + sum(p.stack for p in room.players.values()) == 2000 * count
    assert room.phase == 'showdown'
    assert draws == 3 * count
    restored = room_from_snapshot(room_to_snapshot(room))
    assert manager.public_state(restored,viewer_id='p0') == manager.public_state(room,viewer_id='p0')


def test_side_pot_is_won_by_eligible_player_and_folded_cards_stay_hidden():
    manager, room = room_for(4,'ace_to_five_triple_draw')
    amounts = [40,100,100,100]
    hands = [['As','2h','3d','4c','5s'],['2s','3h','4d','5c','6s'],['3s','4h','5d','6c','7s'],['Ah','2d','3c','4s','5h']]
    for i,p in enumerate(room.players.values()):
        p.committed = amounts[i]; p.bet = 0; p.stack = 2000-amounts[i]; p.hand=hands[i]
    room.players['p3'].folded=True
    room.pot=sum(amounts)
    manager._finish_showdown(room)
    assert room.showdown['awards'] == {'p0':160,'p1':180,'p2':0,'p3':0}
    assert 'p3' not in room.showdown['hands']
    assert sum(p.stack for p in room.players.values()) == 8000


def test_fixed_limit_cap_and_big_bet_after_second_draw():
    manager,room=room_for(3,'badugi')
    for _ in range(3):
        actor=room.current_actor_id
        manager.act(room.code,user_id=actor,action='raise',amount=100000)
    assert room.current_bet == 80
    assert 'raise' not in manager.legal_actions(room,room.current_actor_id)
    for _ in range(100):
        if room.phase=='bet_2': break
        actor=room.current_actor_id
        if room.phase.startswith('draw'): manager.draw(room.code,user_id=actor,card_indexes=[])
        else: manager.act(room.code,user_id=actor,action='check' if 'check' in manager.legal_actions(room,actor) else 'call')
    assert manager.public_state(room,viewer_id=room.current_actor_id)['betUnit']==40


def test_leaving_mid_hand_does_not_give_pot_to_one_of_several_opponents():
    manager,room=room_for(4,'badugi')
    manager.leave_room(room.code,user_id=room.current_actor_id)
    assert room.phase != 'showdown'
    assert room.players['p3'].folded
    assert room.pot==30
    for _ in range(100):
        if room.phase=='showdown': break
        actor=room.current_actor_id
        if room.phase.startswith('draw'): manager.draw(room.code,user_id=actor,card_indexes=[])
        else: manager.act(room.code,user_id=actor,action='check' if 'check' in manager.legal_actions(room,actor) else 'call')
    assert room.phase=='showdown'
    assert sum(p.stack for p in room.players.values())==8000


def test_lowball_rules_distinguish_ace_and_straights():
    wheel=['As','2h','3d','4c','5s']; seven=['2s','3h','4d','5c','7s']; pair=['2s','2h','3d','4c','7s']
    assert low_rank(wheel,'ace_to_five_triple_draw') > low_rank(seven,'ace_to_five_triple_draw')
    assert low_rank(seven,'deuce_to_seven_triple_draw') > low_rank(wheel,'deuce_to_seven_triple_draw')
    assert low_rank(seven,'deuce_to_seven_triple_draw') > low_rank(pair,'deuce_to_seven_triple_draw')
