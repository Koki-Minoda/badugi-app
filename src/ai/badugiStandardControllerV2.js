import { getModelEntry } from './modelRouter.js';
import { createBadugiControllerV2Inference } from './badugiControllerV2Inference.js';

const MODEL_ID = 'model-badugi-standard-controller-v2-20261105';
const entry = getModelEntry(MODEL_ID);
const inference = createBadugiControllerV2Inference(entry);

export const inferBadugiStandardControllerV2Bet = inference.inferBet;
export const inferBadugiStandardControllerV2Draw = inference.inferDraw;
