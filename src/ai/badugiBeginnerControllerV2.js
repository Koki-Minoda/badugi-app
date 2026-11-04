import { getModelEntry } from './modelRouter.js';
import { createBadugiControllerV2Inference } from './badugiControllerV2Inference.js';

const MODEL_ID = 'model-badugi-beginner-controller-v2-20261104';
const entry = getModelEntry(MODEL_ID);
const inference = createBadugiControllerV2Inference(entry);

export const inferBadugiBeginnerControllerV2Bet = inference.inferBet;
export const inferBadugiBeginnerControllerV2Draw = inference.inferDraw;
