// Isolated browser audit only. This model is absent from the public registry.
import { createBadugiControllerV2Inference } from '../badugiControllerV2Inference.js';

const isolated = createBadugiControllerV2Inference({
  id: 'isolated-d03-v2-pro-guarded-candidate',
  onnx: '/__d03_v2_pro_guarded_candidate.onnx',
  tier: 'pro',
  featureSet: 'badugi-controller-observation-v2-draft',
  inputShape: [96], outputShape: [6],
});

export const inferBadugiControllerV2ProGuardedCandidateBet = isolated.inferBet;
export const inferBadugiControllerV2ProGuardedCandidateDraw = isolated.inferDraw;
