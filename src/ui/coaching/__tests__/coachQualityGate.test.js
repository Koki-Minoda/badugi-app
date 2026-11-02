import { describe, expect, it } from 'vitest';
import { evaluateCoachQuality } from '../coachQualityGate.js';
const request={variantId:'badugi',playerCount:6,betting:'fixed-limit',mode:'cash',street:'draw2',action:'pat'};
// Synthetic contract fixture, never a real model qualification.
function contractFixture(){return {schemaVersion:1,modelVersion:'test-model',evaluatorVersion:'test-eval',implementer:'builder',
  evidence:{path:'test-only.json',sha256:'a'.repeat(64)},evidenceVerified:true,
  scope:{variantId:'badugi',playerCounts:[6],betting:['fixed-limit'],modes:['cash'],streets:['draw2'],actions:['pat']},
  checks:Object.fromEntries(['runtimeSemantics','legalActions','noPrivateInformation','heldoutSeparation','baselineCompatibility','replayLinkage','abstention','rollback'].map(k=>[k,true])),
  quality:{heldoutDecisions:200,acceptableActionAgreementLower95:.96,expectedCalibrationError:.08,majorIncorrectAdvice:0,explanationGroundingRate:1},
  independentReview:{status:'approved',reviewer:'other-person',reviewerType:'human',evidence:{path:'review-test-only.json',sha256:'b'.repeat(64)}},
  confidence:'Medium Confidence',baselineType:'validated-empirical'};}
describe('Strategy Score release contract',()=>{
  it('abstains without evidence instead of fabricating a score',()=>{
    expect(evaluateCoachQuality({},request)).toMatchObject({eligible:false,score:null,confidence:'保留'});
  });
  it('accepts a fully qualified scoped contract without computing a score',()=>{
    expect(evaluateCoachQuality(contractFixture(),request)).toMatchObject({eligible:true,score:null,scoreName:'MGX Strategy Score'});
  });
  it.each([{variantId:'nlh'},{playerCount:2},{betting:'no-limit'},{mode:'tournament'},{street:'draw3'},{action:'raise'}])('rejects scope drift %j',patch=>{
    expect(evaluateCoachQuality(contractFixture(),{...request,...patch}).eligible).toBe(false);
  });
  it.each(['NaN','missing','experimental','self-review','ai-review','unverified','high-without-solver','major-error','small-sample','wrong-schema'])('fails closed for %s',reason=>{
    const c=contractFixture();
    if(reason==='NaN')c.quality.expectedCalibrationError=NaN;
    if(reason==='missing')delete c.checks.noPrivateInformation;
    if(reason==='experimental')c.confidence='Experimental';
    if(reason==='self-review')c.independentReview.reviewer='builder';
    if(reason==='ai-review')c.independentReview.reviewerType='ai';
    if(reason==='unverified')c.evidenceVerified=false;
    if(reason==='high-without-solver')c.confidence='High Confidence';
    if(reason==='major-error')c.quality.majorIncorrectAdvice=1;
    if(reason==='small-sample')c.quality.heldoutDecisions=199;
    if(reason==='wrong-schema')c.schemaVersion=2;
    expect(evaluateCoachQuality(c,request).eligible).toBe(false);
  });
});
