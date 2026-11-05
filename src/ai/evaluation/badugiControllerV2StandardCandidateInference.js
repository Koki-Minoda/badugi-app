// Evaluation-only entry. This candidate is not registered or published.
import { createBadugiControllerV2Inference } from '../badugiControllerV2Inference.js';

const isolated = createBadugiControllerV2Inference({
  id: 'isolated-d03-v2-standard-mode-candidate',
  onnx: '/__d03_v2_standard_candidate.onnx',
  tier: 'standard',
  featureSet: 'badugi-controller-observation-v2-draft',
  inputShape: [96], outputShape: [6],
});

export const inferBadugiControllerV2StandardCandidateBet = isolated.inferBet;
export const inferBadugiControllerV2StandardCandidateDraw = isolated.inferDraw;
