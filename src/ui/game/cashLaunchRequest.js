import { canLaunchVariant } from '../../games/config/canLaunchVariant.js';
import { normalizeAppVariantId } from './appVariantRouting.js';

export function getCashLaunchRequest({ pathname, search, state }) {
  if (pathname !== '/game' && pathname !== '/dev/game') return null;
  // Explicit learning/MIX/tournament launches carry their own identity.
  if (state?.learningVariant || state?.mixedProfileId || state?.multiGameConfig || state?.multiGameResume) return null;
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  if (mode && mode !== 'cash') return null;
  const variantId = normalizeAppVariantId(params.get('variant'), null);
  if (!variantId || !canLaunchVariant(variantId).canLaunch) return null;
  const tier = params.get('aiTier');
  const cashTierId = ['beginner', 'standard', 'pro'].includes(tier) ? tier : null;
  return { variantId, cashTierId };
}
