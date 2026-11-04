// Evaluation-only entry; the frozen browser audit loads this URL by test route.
import { createBadugiControllerV2Inference } from '../badugiControllerV2Inference.js';

const isolated = createBadugiControllerV2Inference({
  id: 'isolated-d03-v2-beginner-candidate',
  onnx: '/__d03_v2_candidate.onnx',
  tier: 'beginner',
  featureSet: 'badugi-controller-observation-v2-draft',
  inputShape: [96], outputShape: [6],
});

export const inferBadugiControllerV2CandidateBet = isolated.inferBet;
export const inferBadugiControllerV2CandidateDraw = isolated.inferDraw;
