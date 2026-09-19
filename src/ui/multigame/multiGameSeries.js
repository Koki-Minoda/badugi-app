import { buildTournamentConfigFromStage } from '../../config/tournamentStages.js';
import { getVariantProfile } from '../../games/config/variantProfiles.js';
import { PUBLIC_RING_PLAYABLE_VARIANTS } from '../../games/config/variantAvailability.js';
const KEY = 'mgx.multiGameSeries.v1';
const allowed = new Set(PUBLIC_RING_PLAYABLE_VARIANTS.map(v => v.availabilityKey));
export const MULTI_FORMATS = Object.freeze({
  stage: { name: 'Stage Relay', description: '6人で3種目の大会を順にプレイ。各大会の順位点（6 / 4 / 3 / 2 / 1 / 0点）を合計します。' },
  survival: { name: 'Survival Mix', description: '18人・3卓で開始。卓ごとに異なる種目を3ハンドずつプレイし、人数が減ると席を移動して最後の1人を決めます。' },
  championship: { name: 'Championship Relay', description: '18人のMIX大会。決勝の6人卓では、選んだDealer’s Choiceの種目順で1ハンドずつ交代します。' },
});
export function loadMultiGameSeries(storage = globalThis.localStorage) { try { const s=JSON.parse(storage?.getItem(KEY)||'null'); return s?.version===1 && MULTI_FORMATS[s.format] ? s : null; } catch { return null; } }
const persist = (s, storage) => { storage?.setItem(KEY, JSON.stringify(s)); return s; };
export function createMultiGameSeries(format, sequence, finalSequence = sequence, storage = globalThis.localStorage) {
  if (!MULTI_FORMATS[format] || sequence.length !== 3 || sequence.some(id=>!allowed.has(id)) || !finalSequence.length || finalSequence.some(id=>!allowed.has(id))) throw Error('Choose three supported games');
  return persist({ version:1, id:globalThis.crypto?.randomUUID?.() ?? `series-${Date.now()}-${Math.random().toString(36).slice(2)}`, format, sequence:[...sequence], finalSequence:[...finalSequence], results:[], standings:{}, completed:false, createdAt:Date.now() }, storage);
}
export function buildMultiGameConfig(series) {
  if (!series || series.completed || !MULTI_FORMATS[series.format]) throw Error('No pending event');
  const stageIndex=series.results.length;
  const sequence=series.format==='stage' ? [series.sequence[stageIndex]] : series.sequence;
  const tables=series.format==='stage'?1:3;
  const base=buildTournamentConfigFromStage('store');
  return { ...base, id:`${series.id}:${stageIndex}`, name:`${MULTI_FORMATS[series.format].name}${series.format==='stage'?` · ${stageIndex+1}/3`:''}`, tables, seatsPerTable:6, totalPlayers:tables*6, startingStack:500, buyIn:0, entryFee:0, prizeTable:[], payouts:[], rewards:[], prizePoolTotal:0, gameId:getVariantProfile(sequence[0])?.id, gameVariant:sequence[0], gameRotation:sequence, rotationPolicy:'fixed', multiGame:{ seriesId:series.id, format:series.format, stageIndex, sequence, finalSequence:series.finalSequence, handsPerGame:3 } };
}
export { multiGameVariantForTable } from '../../games/config/multiGameTournament.js';
export function recordMultiGameResult(state, placements, storage=globalThis.localStorage) {
  const meta=state?.config?.multiGame;
  const s=loadMultiGameSeries(storage);
  if(!meta || !s || s.id!==meta.seriesId || !state.isFinished || !state.championId || s.results.some(r=>r.runId===state.tournamentRunId)) return s;
  if(meta.stageIndex!==s.results.length) return s;
  const result={runId:state.tournamentRunId,stageIndex:meta.stageIndex,variant:state.config.gameVariant,placements,completedAt:Date.now()};
  s.results.push(result);
  for(const p of placements){const points=[6,4,3,2,1,0][p.place-1]??0;const prior=s.standings[p.id]??{id:p.id,name:p.name,points:0};s.standings[p.id]={...prior,points:prior.points+points};}
  s.completed=s.results.length >= (s.format==='stage'?3:1);
  return persist(s,storage);
}
