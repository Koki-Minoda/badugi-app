import { localRecordId } from '../utils/localRecordId.js';
import { getVariantById, GAME_VARIANT_CATEGORIES } from '../../games/config/variantCatalog.js';
import { buildProfileFromPreset } from '../mixed/rotationUtils.js';
export function readSharedMix(token) {
  if (typeof token !== 'string' || token.length > 8000) throw new Error('Invalid shared MIX');
  const data = JSON.parse(decodeURIComponent(escape(atob(token))));
  if (data.version !== 1 || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 80 || !Array.isArray(data.games) || !data.games.length || data.games.length > 20 || data.games.some(id => typeof id !== 'string' || !getVariantById(id)) || !['FIXED','RANDOM','WEIGHTED','CATEGORY'].includes(data.mode) || !Number.isInteger(data.hands) || data.hands < 1 || data.hands > 30) throw new Error('Invalid shared MIX');
  const ids = list => Array.isArray(list) && list.length <= 37 && list.every(id => typeof id === 'string' && getVariantById(id));
  const validWeights = (table, keys) => table && typeof table === 'object' && !Array.isArray(table) && Object.entries(table).every(([key,value]) => keys.includes(key) && Number.isFinite(value) && value >= 0 && value <= 10000);
  if (data.weights && !validWeights(data.weights, data.games)) throw new Error('Invalid weights');
  if ([data.hardBans,data.softBans].some(list => list !== undefined && !ids(list))) throw new Error('Invalid exclusions');
  if (data.categories) {
    const keys = Object.values(GAME_VARIANT_CATEGORIES);
    if (!validWeights(data.categories.weights ?? {}, keys) || !data.categories.pools || typeof data.categories.pools !== 'object' || Object.entries(data.categories.pools).some(([key,list]) => !keys.includes(key) || !ids(list))) throw new Error('Invalid categories');
  }
  return buildProfileFromPreset({ id: `shared-${localRecordId()}`, name: data.name, selectedGameIds: data.games, handsPerGame: data.hands, selectionMode: data.mode, weightedTable: data.weights, categoryRules: data.categories, hardBans: data.hardBans, softBans: data.softBans });
}
export function sharedMixUrl(profile, origin = window.location.origin) {
  const data = { version: 1, name: profile.name, games: profile.selectedGameIds, hands: Number(profile.handsPerGame), mode: profile.selectionMode, weights: profile.weightedTable, categories: profile.categoryRules, hardBans: profile.hardBans, softBans: profile.softBans };
  const token = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  return `${origin}/shared-mix#${encodeURIComponent(token)}`;
}
