"""Guard the public-only bootstrap action mapping used before D03 RL."""

import unittest
import tempfile
from collections import Counter
from pathlib import Path

import numpy as np
import torch

from rl.training.train_badugi_controller_v2_draft import (
    FrozenOnnxPolicy, observable_reference_action, run_hand,
    sample_reference_demonstrations,
    training_opponent_profile,
)
from rl.training.export_badugi_controller_v2_mode_ensemble import ModeEnsemble
from rl.training.export_badugi_controller_v2_candidate import check_parity
from rl.training.export_badugi_controller_v2_phase_candidate import PhaseEnsemble
from rl.training.validate_badugi_controller_v2_draft import (
    FoldGuardedPhaseAgent, OnnxAgent, PhaseRoutedAgent, opening_context,
)
from rl.env.badugi_env import evaluate_badugi


def decision(phase, made, high, round_index, to_call_bb, mask):
    observation = [0.0] * 96
    observation[9] = round_index / 3
    observation[18] = to_call_bb / 20
    observation[24] = made / 4
    observation[25] = high / 12
    observation[32:38] = mask
    return {"phase": phase, "observation": observation, "legalMask": mask}


class BootstrapPolicyTests(unittest.TestCase):
    def test_opening_context_records_hero_cards_and_rejects_shape_mismatch(self):
        cards = [(0, 0), (2, 1), (4, 2), (6, 3)]
        count, ranks = evaluate_badugi(cards)
        obs = [0.0] * 96
        for index, (rank, suit) in enumerate(cards):
            obs[2 * index:2 * index + 2] = [rank / 12, suit / 3]
        obs[24], obs[25] = count / 4, max(ranks) / 12
        obs[12], obs[14], obs[18], obs[20] = 0.5, 0.1, 0.15, 0.25
        context = opening_context(obs, 2)
        self.assertEqual(context['cards'], cards)
        self.assertEqual((context['madeCards'], context['actionIndex'], context['raiseCount']),
                         (4, 2, 1))
        self.assertAlmostEqual(context['toCallBb'], 3)
        obs[24] = 0.5
        with self.assertRaisesRegex(ValueError, 'card evaluation'):
            opening_context(obs, 2)

    def test_fp32_export_rounding_requires_unchanged_action(self):
        expected = np.asarray([[0.1, 0.5, 0.2], [0.5, 0.1, 0.2]], dtype=np.float32)
        rounded = expected.copy()
        rounded[0, 1] += 1.52587890625e-5
        self.assertEqual(check_parity(expected, rounded)[1], 0)
        with self.assertRaises(ValueError):
            check_parity(expected, np.asarray([[0.1, 0.49, 0.5], [0.5, 0.1, 0.2]],
                                                   dtype=np.float32))

    def test_fresh_session_profile_covers_pressure_at_first_hand(self):
        bootstrap = Counter(training_opponent_profile(index, index, True)
                            for index in range(100))
        rl = Counter(training_opponent_profile(index, index, True)
                     for index in range(20))
        self.assertEqual(bootstrap['pressure'], 25)
        self.assertEqual(rl['pressure'], 5)
        legacy_bootstrap_first_hands = Counter(
            training_opponent_profile(index * 20, index)
            for index in range(5))
        self.assertEqual(legacy_bootstrap_first_hands['pressure'], 1)

    def test_phase_ensemble_uses_public_phase_flag(self):
        class Scores(torch.nn.Module):
            def __init__(self, index):
                super().__init__()
                self.index = index

            def forward(self, observation):
                output = observation.new_zeros((observation.shape[0], 6))
                output[:, self.index] = 1
                return output

        model = PhaseEnsemble(Scores(2), Scores(3)).eval()
        observation = torch.zeros(3, 96)
        observation[:, 8] = torch.tensor([0, 1, 0])
        self.assertEqual(model(observation).argmax(dim=1).tolist(), [2, 3, 2])

    def test_phase_ensemble_fold_guardian_respects_legal_mask(self):
        class Scores(torch.nn.Module):
            def __init__(self, values):
                super().__init__()
                self.values = values

            def forward(self, observation):
                return observation.new_tensor(self.values).expand(observation.shape[0], -1)

        model = PhaseEnsemble(Scores([0, 0, 4, 0, 0, 0]),
                              Scores([8, 1, 3, 0, 0, 0]), fold_guardian=True).eval()
        observation = torch.zeros(4, 96)
        observation[0, 32:38] = torch.tensor([1, 0, 1, 0, 0, 0])
        observation[1, 32:38] = torch.tensor([0, 1, 1, 0, 0, 0])
        observation[2, 32:38] = torch.tensor([1, 0, 1, 0, 0, 0])
        observation[2, 8] = 1
        observation[3, 32:38] = torch.tensor([1, 1, 1, 0, 0, 0])
        # On BET, Standard FOLD wins only when legal; DRAW always uses Standard.
        scores = model(observation)
        self.assertEqual(scores[0].argmax().item(), 0)
        self.assertEqual(scores[1].argmax().item(), 2)
        self.assertEqual(scores[2].argmax().item(), 0)
        self.assertEqual(scores[3].argmax().item(), 0)
        legal_actions = torch.where(observation[:, 32:38] > 0.5, scores, -1e9).argmax(dim=1)
        self.assertEqual(legal_actions.tolist(), [0, 2, 0, 0])

    def test_phase_ensemble_heads_up_cash_fallback_uses_public_slots_only(self):
        class Scores(torch.nn.Module):
            def __init__(self, action):
                super().__init__()
                self.action = action

            def forward(self, observation):
                scores = observation.new_zeros((observation.shape[0], 6))
                scores[:, self.action] = 1
                return scores

        model = PhaseEnsemble(Scores(4), Scores(2),
                              heads_up_cash_standard_bet=True).eval()
        observation = torch.zeros(4, 96)
        observation[:, 10] = torch.tensor([2 / 6, 2 / 6, 3 / 6, 2 / 6])
        observation[:, 21] = torch.tensor([0, 1, 0, 0])
        observation[3, 8] = 1
        self.assertEqual(model(observation).argmax(dim=1).tolist(), [2, 4, 4, 2])

    def test_phase_ensemble_heads_up_all_modes_fallback(self):
        class Scores(torch.nn.Module):
            def __init__(self, action):
                super().__init__()
                self.action = action

            def forward(self, observation):
                scores = observation.new_zeros((observation.shape[0], 6))
                scores[:, self.action] = 1
                return scores

        model = PhaseEnsemble(Scores(4), Scores(2), heads_up_standard_bet=True).eval()
        observation = torch.zeros(5, 96)
        observation[:, 10] = torch.tensor([2 / 6, 2 / 6, 3 / 6, 3 / 6, 2 / 6])
        observation[:, 21] = torch.tensor([0, 1, 0, 1, 1])
        observation[4, 8] = 1
        self.assertEqual(model(observation).argmax(dim=1).tolist(), [2, 2, 4, 4, 2])

    def test_phase_ensemble_six_seat_mtt_fallback_uses_public_table_and_mode(self):
        class Scores(torch.nn.Module):
            def __init__(self, action):
                super().__init__()
                self.action = action

            def forward(self, observation):
                scores = observation.new_zeros((observation.shape[0], 6))
                scores[:, self.action] = 1
                return scores

        model = PhaseEnsemble(Scores(4), Scores(2),
                              six_seat_mtt_standard_bet=True).eval()
        observation = torch.zeros(6, 96)
        observation[:, 10] = torch.tensor([2 / 6, 3 / 6, 1, 1, 1, 1])
        observation[:, 21] = torch.tensor([1, 1, 0, 1, 1, 1])
        observation[4, 11] = 2 / 6  # Folds do not switch the table-size route.
        observation[5, 8] = 1      # DRAW remains the Standard branch.
        self.assertEqual(model(observation).argmax(dim=1).tolist(),
                         [4, 4, 4, 2, 2, 2])

    def test_phase_route_reads_only_public_phase_slot(self):
        class FixedAgent:
            def __init__(self, action):
                self.action = action

            def act(self, obs, epsilon, action_mask):
                self.asserted = (epsilon, action_mask.copy())
                return self.action

        bet = FixedAgent(2)
        draw = FixedAgent(3)
        agent = PhaseRoutedAgent(bet, draw)
        obs = np.zeros(96, dtype=np.float32)
        mask = np.ones(6, dtype=np.float32)
        self.assertEqual(agent.act(obs, 0.0, mask), 2)
        obs[8] = 1
        self.assertEqual(agent.act(obs, 0.0, mask), 3)
        obs[8] = 0.5
        with self.assertRaises(ValueError):
            agent.act(obs, 0.0, mask)

    def test_fold_guardian_preserves_standard_bet_fold_and_draw(self):
        class Agent:
            def __init__(self, action):
                self.action = action

            def act(self, obs, epsilon, action_mask):
                return self.action

        standard = Agent(0)
        guarded = FoldGuardedPhaseAgent(Agent(2), standard)
        obs = np.zeros(96, dtype=np.float32)
        mask = np.ones(6, dtype=np.float32)
        self.assertEqual(guarded.act(obs, 0.0, mask), 0)
        standard.action = 1
        self.assertEqual(guarded.act(obs, 0.0, mask), 2)
        obs[8] = 1
        self.assertEqual(guarded.act(obs, 0.0, mask), 1)

    def test_fold_anchor_balances_only_bet_folds_and_uses_distinct_states(self):
        demonstrations = [(np.full(96, i, dtype=np.float32), 0, "DRAW")
                          for i in range(40)]
        demonstrations += [(np.full(96, i + 40, dtype=np.float32), 0, "BET")
                           for i in range(10)]
        demonstrations += [(np.full(96, i + 50, dtype=np.float32), 2, "BET")
                           for i in range(80)]
        sample = sample_reference_demonstrations(demonstrations, 64, 8)
        self.assertEqual(len(sample), 64)
        self.assertEqual(len({int(item[0][0]) for item in sample}), 64)
        self.assertEqual(sum(item[2] == "BET" and item[1] == 0 for item in sample), 8)
        with self.assertRaises(ValueError):
            sample_reference_demonstrations(demonstrations[:46], 64, 8)
        with self.assertRaises(ValueError):
            sample_reference_demonstrations(demonstrations[:45] + demonstrations[50:], 64, 8)

    def test_action_anchor_preserves_phase_specific_raise_and_draw_three(self):
        demonstrations = ([(np.full(96, i, dtype=np.float32), 0, "BET")
                           for i in range(20)] +
                          [(np.full(96, i + 20, dtype=np.float32), 4, "BET")
                           for i in range(20)] +
                          [(np.full(96, i + 40, dtype=np.float32), 3, "DRAW")
                           for i in range(20)] +
                          [(np.full(96, i + 60, dtype=np.float32), 1, "DRAW")
                           for i in range(70)])
        sample = sample_reference_demonstrations(demonstrations, 64, 8, 8, 4)
        self.assertEqual(len({int(item[0][0]) for item in sample}), 64)
        for phase, action, quota in (("BET", 0, 8), ("BET", 4, 8), ("DRAW", 3, 4)):
            self.assertGreaterEqual(sum(item[2] == phase and item[1] == action for item in sample), quota)
        with self.assertRaises(ValueError):
            sample_reference_demonstrations(demonstrations, 64, 60, 8, 4)

    def test_unanchored_reference_sample_has_requested_size(self):
        demonstrations = [(np.full(96, i, dtype=np.float32), 2, "BET")
                          for i in range(80)]
        sample = sample_reference_demonstrations(demonstrations, 64)
        self.assertEqual(len(sample), 64)
        self.assertEqual(len({int(item[0][0]) for item in sample}), 64)

    def test_bet_only_training_routes_draw_to_reference_and_excludes_it_from_replay(self):
        class Agent:
            def __init__(self, action):
                self.action = action
                self.calls = 0

            def act(self, obs, epsilon, action_mask):
                self.calls += 1
                return self.action

        class Buffer:
            def __init__(self):
                self.rows = []

            def add(self, *args, **kwargs):
                self.rows.append((args, kwargs))

            def __len__(self):
                return len(self.rows)

        class Bridge:
            def __init__(self, draw):
                self.draw = draw
                self.actions = []

            def send(self, command):
                self.actions.append(command["actionIndex"])
                return self.draw if len(self.actions) == 1 else {
                    "type": "hand_end", "chipDeltaBySeat": [20, -20]}

        bet = decision("BET", 3, 7, 0, 0, [0, 1, 0, 1, 0, 0])
        draw = decision("DRAW", 3, 7, 0, 0, [1, 1, 1, 1, 1, 0])
        for row in (bet, draw):
            row.update({"type": "decision", "schemaVersion": "badugi-controller-observation-v2-draft",
                        "seat": 0, "seatCount": 2, "occupiedSeatCount": 2,
                        "isTournament": False, "activeBigBlind": 20})
        learner, reference, buffer = Agent(1), Agent(2), Buffer()
        bridge = Bridge(draw)
        outcome = run_hand(bridge, bet, learner, None, 0, "passive", 0.1,
                           2, 2, False, buffer=buffer, warmup=512,
                           reference_draw_agent=reference, bet_only_replay=True)
        self.assertEqual(bridge.actions, [1, 2])
        self.assertEqual((learner.calls, reference.calls), (1, 1))
        self.assertEqual(len(buffer.rows), 1)
        self.assertEqual(outcome["heroDecisions"], 1)
        self.assertEqual(outcome["heroActualDecisions"], 2)
        self.assertEqual(outcome["heroChipBb"], 1)

    def test_pro_reference_policy_uses_onnx_scores_and_legal_mask(self):
        class FixedScores(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.register_buffer('values', torch.tensor([0, 0, 5, 0, 10, 0],
                                                            dtype=torch.float32))

            def forward(self, observation):
                return self.values.unsqueeze(0) + observation[:, :1] * 0.001

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'reference.onnx'
            torch.onnx.export(FixedScores(), torch.zeros(1, 96), str(path),
                              input_names=['observation'], output_names=['q_values'],
                              dynamic_axes={'observation': {0: 'batch'}, 'q_values': {0: 'batch'}},
                              opset_version=17, dynamo=False)
            policy = FrozenOnnxPolicy(path)
            observation = np.zeros(96, dtype=np.float32)
            self.assertEqual(policy.act(observation, 0.0, np.array([1, 1, 1, 0, 1, 0])), 4)
            self.assertEqual(policy.act(observation, 0.0, np.array([1, 1, 1, 0, 0, 0])), 2)
            with self.assertRaises(ValueError):
                policy.act(observation, 0.1, np.ones(6))

    def test_mode_onnx_uses_public_flag_and_legal_mask(self):
        class FixedScores(torch.nn.Module):
            def __init__(self, scores):
                super().__init__()
                self.register_buffer('scores', torch.tensor(scores, dtype=torch.float32))

            def forward(self, observation):
                return self.scores.unsqueeze(0).expand(observation.shape[0], -1)

        model = ModeEnsemble(FixedScores([9, 1, 0, 0, 0, 0]),
                             FixedScores([0, 1, 9, 0, 0, 0])).eval()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'mode.onnx'
            torch.onnx.export(model, torch.zeros(1, 96), str(path),
                              input_names=['observation'], output_names=['q_values'],
                              opset_version=17, dynamo=False)
            agent = OnnxAgent(path)
            observation = np.zeros(96, dtype=np.float32)
            mask = np.asarray([1, 1, 1, 0, 0, 0], dtype=np.float32)
            self.assertEqual(agent.act(observation, epsilon=0.0, action_mask=mask), 0)
            observation[21] = 1.0
            self.assertEqual(agent.act(observation, epsilon=0.0, action_mask=mask), 2)
            mask[2] = 0
            self.assertEqual(agent.act(observation, epsilon=0.0, action_mask=mask), 1)

    def test_heads_up_mtt_uses_public_table_size_not_opponent_profile(self):
        class Scores(torch.nn.Module):
            def __init__(self, index):
                super().__init__()
                self.index = index

            def forward(self, observation):
                output = observation.new_zeros((observation.shape[0], 6))
                output[:, self.index] = 1
                return output

        model = ModeEnsemble(Scores(0), Scores(1), Scores(2)).eval()
        observation = torch.zeros(4, 96)
        observation[:, 10] = torch.tensor([2 / 6, 3 / 6, 2 / 6, 3 / 6])
        observation[:, 21] = torch.tensor([1, 1, 0, 0])
        self.assertEqual(model(observation).argmax(dim=1).tolist(), [2, 1, 0, 0])

    def test_standard_bootstrap_uses_frozen_beginner_actions(self):
        class FrozenBeginner:
            def act(self, obs, epsilon, action_mask):
                self_called.append((epsilon, int(action_mask[0])))
                return 0

        class Learner:
            def act(self, *args, **kwargs):
                raise AssertionError("learner must not choose bootstrap actions")

        class Bridge:
            def send(self, command):
                self.assert_command = command
                return {"type": "hand_end", "chipDeltaBySeat": [20, -20]}

        self_called = []
        bridge = Bridge()
        first = decision("BET", 2, 10, 3, 0, [1, 1, 0, 0, 0, 0])
        first.update({"type": "decision", "schemaVersion": "badugi-controller-observation-v2-draft",
                      "seat": 0, "seatCount": 2, "occupiedSeatCount": 2,
                      "isTournament": False, "activeBigBlind": 20})
        demos = []
        outcome = run_hand(bridge, first, Learner(), None, 0, "passive", 0.1,
                           2, 2, False, bootstrap=True, demonstrations=demos,
                           bootstrap_agent=FrozenBeginner())
        self.assertEqual(bridge.assert_command["actionIndex"], 0)
        self.assertEqual(outcome["heroChipBb"], 1)
        self.assertEqual(demos[0][1], 0)
        self.assertEqual(self_called, [(0.0, 1)])

    def test_draws_only_missing_badugi_cards(self):
        self.assertEqual(observable_reference_action(decision("DRAW", 4, 7, 1, 0, [1, 1, 1, 1, 1, 0])), 0)
        self.assertEqual(observable_reference_action(decision("DRAW", 3, 7, 1, 0, [1, 1, 1, 1, 1, 0])), 1)
        self.assertEqual(observable_reference_action(decision("DRAW", 2, 7, 1, 0, [1, 1, 1, 1, 1, 0])), 2)

    def test_folds_weak_hand_to_pressure_and_checks_for_free(self):
        self.assertEqual(observable_reference_action(decision("BET", 2, 10, 3, 2, [1, 0, 1, 0, 1, 0])), 0)
        self.assertEqual(observable_reference_action(decision("BET", 2, 10, 3, 0, [0, 1, 0, 1, 0, 0])), 1)

    def test_raises_strong_made_hand_when_legal(self):
        self.assertEqual(observable_reference_action(decision("BET", 4, 7, 3, 2, [1, 0, 1, 0, 1, 0])), 4)

    def test_respects_short_stack_mask(self):
        self.assertEqual(observable_reference_action(decision("BET", 4, 7, 3, 2, [1, 0, 1, 0, 0, 0])), 2)


if __name__ == '__main__':
    unittest.main()
