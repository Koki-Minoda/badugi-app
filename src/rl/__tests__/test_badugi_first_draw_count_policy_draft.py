"""The experimental first-draw change never alters an ineligible decision."""
import copy

import pytest

from rl.training.badugi_first_draw_count_policy_draft import first_draw_count_action


def decision(*, phase="DRAW", draw_round=0, made=2, active=3, legal=True):
    return {
        "phase": phase,
        "drawRoundIndex": draw_round,
        "legalMask": [1, 1, int(legal), 1, 1],
        "beliefEvidence": {
            "actorHandProgress": {"current": {"madeCards": made}},
            "currentPublicDrawContext": {"activePlayers": active},
        },
    }


def test_first_draw_two_card_change_from_made_two_with_three_active():
    state = decision()
    before = copy.deepcopy(state)
    assert first_draw_count_action(state, 1) == (2, True)
    assert state == before


@pytest.mark.parametrize("state,action,used", [
    (decision(active=2), 1, False),
    (decision(phase="BET"), 1, False),
    (decision(draw_round=1), 1, False),
    (decision(made=3), 1, False),
    (decision(), 0, False),
    (decision(), 2, False),
    (decision(), 1, True),
])
def test_ineligible_decision_keeps_model_action(state, action, used):
    assert first_draw_count_action(state, action, already_overridden=used) == (action, False)


def test_two_card_draw_must_be_legal():
    assert first_draw_count_action(decision(legal=False), 1) == (1, False)


def test_missing_public_context_fails_closed():
    state = decision()
    del state["beliefEvidence"]["currentPublicDrawContext"]
    with pytest.raises(ValueError, match="incomplete"):
        first_draw_count_action(state, 1)


def test_invalid_action_and_override_flag_are_rejected():
    with pytest.raises(TypeError):
        first_draw_count_action(decision(), True)
    with pytest.raises(TypeError):
        first_draw_count_action(decision(), 1, already_overridden=1)
