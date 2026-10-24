import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import registry from '../src/config/ai/modelRegistry.json' with {type:'json'};
import { GAME_VARIANTS } from '../src/games/config/variantCatalog.js';
import { getVariantAvailability } from '../src/games/config/variantAvailability.js';
import { listTierIds, resolveTierModelInfo } from '../src/ai/tierManager.js';
import { selectModelForVariant } from '../src/ai/modelRouter.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {values} = parseArgs({options:{output:{type:'string'}}});
const git = args => execFileSync('git', args, {cwd:root,encoding:'utf8'}).trim();
const assetCache = new Map();
async function auditAsset(entry) {
  if (!entry?.onnx) return {status:'not-declared'};
  const publicRoot = resolve(root, 'public');
  const assetPath = resolve(publicRoot, entry.onnx);
  const localPath = relative(publicRoot, assetPath);
  if (localPath === '..' || localPath.startsWith(`..${sep}`)) {
    return {status:'invalid-path',declaredPath:entry.onnx};
  }
  if (!assetCache.has(assetPath)) {
    try {
      const bytes = await readFile(assetPath);
      assetCache.set(assetPath,{exists:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    } catch(error) {
      if(error.code !== 'ENOENT') throw error;
      assetCache.set(assetPath,{exists:false});
    }
  }
  const asset = assetCache.get(assetPath);
  return {...asset,declaredPath:entry.onnx,expectedSha256:entry.checksumSha256??null,
    checksumMatches:asset.exists && entry.checksumSha256 ? asset.sha256===entry.checksumSha256 : null};
}
const goalTiers = ['beginner','standard','pro','iron','worldmaster'];
const configuredTiers = listTierIds();
const tiers = [...new Set([...goalTiers,...configuredTiers])];
const rows=[];
for(const variant of GAME_VARIANTS) {
  for(const tier of tiers) {
    const selected=resolveTierModelInfo({variantId:variant.id,tierId:tier});
    const entry=registry.find(model=>model.id===selected?.modelId);
    const adapterEntry=selectModelForVariant({variantId:variant.id,tierId:tier});
    rows.push({
      variantId:variant.id,name:variant.name,engineKey:variant.engineKey,category:variant.category,
      betting:variant.betting,drawRounds:variant.drawRounds,tier,
      roadmapTier:goalTiers.includes(tier),configuredTier:configuredTiers.includes(tier),
      availability:getVariantAvailability(variant.id).availability,
      selectedModelId:entry?.id??null,
      selectedModelMatchesVariant:entry?.variantIds?.includes(variant.id)??false,
      selectedModelMatchesTier:entry?.tier===tier,
      declaredModels:registry.filter(model=>model.variantIds?.includes(variant.id)&&model.tier===tier).map(model=>model.id),
      trainingStatus:entry?.trainingStatus??null,trainingRun:entry?.trainingRun??null,
      trainingCheckpoint:entry?.trainingCheckpoint??null,asset:await auditAsset(entry),
      selectionSource:'src/ai/tierManager.js:resolveTierModelInfo (not proof of controller use)',
      onnxAdapterSelection:{
        source:'src/ai/modelRouter.js:selectModelForVariant; used by onnxPolicyAdapter when called',
        modelId:adapterEntry?.id??null,variantMatches:adapterEntry?.variantIds?.includes(variant.id)??false,
        tierMatches:adapterEntry?.tier===tier,trainingStatus:adapterEntry?.trainingStatus??null,
        asset:await auditAsset(adapterEntry),
      },
      runtimeUsage:'not-observed-by-this-inventory',supportedModes:'requires-controller-and-runtime-audit',
      strengthEvidence:'not-verified-by-this-inventory',physicalQA:'not-verified-by-this-inventory',
      promotionEvidenceVerified:false,
    });
  }
}
const goalRows=rows.filter(row=>row.roadmapTier);
const selectionSummary={
  tierManagerVariantMismatches:goalRows.filter(row=>row.selectedModelId&&!row.selectedModelMatchesVariant).length,
  adapterVariantMismatches:goalRows.filter(row=>row.onnxAdapterSelection.modelId&&!row.onnxAdapterSelection.variantMatches).length,
  adapterSelectedMissingAssets:goalRows.filter(row=>row.onnxAdapterSelection.asset.exists===false).length,
  adapterSelectedPendingModels:goalRows.filter(row=>row.onnxAdapterSelection.trainingStatus==='pending').length,
  note:'Selection diagnostics only; absent assets or variant mismatches do not imply these routes are used by every controller.',
};
const report={selectionSummary,generatedAt:new Date().toISOString(),sourceCommit:git(['rev-parse','HEAD']),
  trackedChanges:git(['status','--porcelain','--untracked-files=no']),
  scope:'Source registry and local assets only. Model selection does not prove inference, strength, or release completion.',
  variantCount:GAME_VARIANTS.length,roadmapTiers:goalTiers,configuredTiers,rowCount:rows.length,
  roadmapRowCount:rows.filter(row=>row.roadmapTier).length,
  productionRequiredAssets:await Promise.all(registry.filter(model=>model.productionRequired).map(async model=>({modelId:model.id,...await auditAsset(model)}))),rows};
const json=JSON.stringify(report,null,2)+'\n';
if(values.output){const target=resolve(values.output);await mkdir(dirname(target),{recursive:true});await writeFile(target,json);}
else process.stdout.write(json);
