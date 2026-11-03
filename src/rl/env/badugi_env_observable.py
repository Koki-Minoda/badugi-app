"""Opt-in Badugi training environment without known profile-oracle inputs.

Opponent profiles still control simulated actions. This removes direct profile
priors from the learner's observation and its derived EV features; it does not
establish parity with the live controller's 96-slot encoder. Existing checkpoints
continue to use BadugiEnv and cannot be assumed compatible with this variant.
"""

from rl.env.badugi_env import BadugiEnv


class ObservableBadugiEnv(BadugiEnv):
  teacher_observable_only = True
  NEUTRAL_AGGRESSION = 0.35
  NEUTRAL_FOLDABILITY = 0.30
  NEUTRAL_BLUFF_FREQUENCY = 0.05

  def _opponent_aggression_rate(self) -> float:
    if self.opponent_action_count <= 0:
      return self.NEUTRAL_AGGRESSION
    return min(1.0, self.opponent_aggressive_action_count / self.opponent_action_count)

  def _opponent_passivity_rate(self) -> float:
    if self.opponent_action_count <= 0:
      return 1.0 - self.NEUTRAL_AGGRESSION
    return min(1.0, self.opponent_passive_action_count / self.opponent_action_count)

  def _opponent_foldability_estimate(self) -> float:
    # One neutral pseudo-action prevents a single observed fold from becoming
    # a certain read; both terms are reconstructible from public actions.
    return min(1.0, max(0.0,
      (self.opponent_fold_count + self.NEUTRAL_FOLDABILITY)
      / (self.opponent_action_count + 1)))

  def _opponent_exploit_opportunity(self) -> float:
    foldable = self._opponent_foldability_estimate()
    passive = self._opponent_passivity_rate()
    draw_heavy = min(1.0, self._opponent_average_draw_count() / 2.5)
    pat_safe = max(0.0, 1.0 - self._opponent_pat_pressure())
    aggression_safe = max(0.0, 1.0 - self._opponent_aggression_rate())
    opportunity = (
      foldable * 0.16
      + passive * 0.14
      + draw_heavy * 0.13
      + pat_safe * 0.05
      + aggression_safe * 0.05
    )
    if self._active_opponent_count() >= 3:
      opportunity -= 0.04
    return min(0.45, max(0.0, opportunity))

  def _get_obs(self):
    obs = super()._get_obs()
    obs[47] = self.NEUTRAL_BLUFF_FREQUENCY
    return obs
