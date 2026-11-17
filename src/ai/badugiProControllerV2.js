import { getModelEntry } from './modelRouter.js';
import { createBadugiControllerV2Inference } from './badugiControllerV2Inference.js';

const MODEL_ID = 'model-badugi-pro-controller-v2-20261105';
const entry = getModelEntry(MODEL_ID);
const inference = createBadugiControllerV2Inference(entry);

export const inferBadugiProControllerV2Bet = inference.inferBet;
export const inferBadugiProControllerV2Draw = inference.inferDraw;
