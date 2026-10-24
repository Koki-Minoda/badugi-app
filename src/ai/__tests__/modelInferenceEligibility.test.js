import {describe,expect,it,vi} from 'vitest';
import {selectModelForVariant} from '../modelRouter.js';
import {inferBetActionWithOnnx,inferDrawDecisionWithOnnx} from '../onnxPolicyAdapter.js';
import {getOrCreateSession} from '../onnxExecutor.js';
vi.mock('../onnxExecutor.js',()=>({getOrCreateSession:vi.fn(async()=>null),getOrt:vi.fn()}));

describe('inference model eligibility',()=>{
 it.each([
  {variantId:'UNKNOWN',tierId:'standard'},
  {variantId:'D04',tierId:'standard'},
  {variantId:'S02',tierId:'standard'},
  {variantId:'D03',tierId:'standard',modelId:'model-27draw-selfplay-v1'},
  {variantId:'D03',tierId:'standard',modelId:'model-27draw-standard-dqn-v1'},
 ])('rejects unassigned or pending model requests: %j',request=>{
  expect(selectModelForVariant({...request,requireVariantMatch:true})).toBeNull();
 });
 it.each([
  ['D03','standard','model-badugi-sixmax-standard-e11'],
  ['D01','pro','model-d01-td-pro-dqn-025000'],
  ['S02','pro','model-s02-sd-pro-dqn-v2-025000'],
 ])('preserves the supported model for %s %s',(variantId,tierId,id)=>{
  expect(selectModelForVariant({variantId,tierId,requireVariantMatch:true})?.id).toBe(id);
 });
 it.each([inferBetActionWithOnnx,inferDrawDecisionWithOnnx])('records no configured model without initializing a session',async infer=>{
  vi.mocked(getOrCreateSession).mockClear();
  const onInferenceTrace=vi.fn();
  expect(await infer({variantId:'D04',tierId:'standard',onInferenceTrace})).toBeNull();
  expect(getOrCreateSession).not.toHaveBeenCalled();
  expect(onInferenceTrace).toHaveBeenCalledWith(expect.objectContaining({status:'not-configured',reason:'model-not-configured',selectedModelId:null,usedModelId:null}));
 });
});
