import { GAME_VARIANTS } from '../../games/core/variants.js';
import { canLaunchVariant } from '../../games/config/canLaunchVariant.js';
import { normalizeAppVariantId } from '../game/appVariantRouting.js';

// Cash MIX uses the same controllers and release gate as ordinary ring games.
export function isMixedVariantPlayable(id) {
  const variant = normalizeAppVariantId(id, null);
  return Boolean(variant && !['chinese_poker', 'ofc'].includes(variant)
    && GAME_VARIANTS[variant]?.controllerFactory && canLaunchVariant(variant).canLaunch);
}
