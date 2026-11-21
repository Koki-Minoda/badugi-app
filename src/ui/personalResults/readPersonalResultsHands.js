import { getHandHistoryBufferSnapshot } from "../state/handHistoryStore.js";
import { mergeHandHistoryLists, readPersistedHandHistory } from "../utils/persistedHandHistory.js";

// Include saved and current completed hands at either entrance, counting each once.
export function readPersonalResultsHands() {
  return mergeHandHistoryLists(
    getHandHistoryBufferSnapshot() ?? [],
    readPersistedHandHistory({ limit: 2000 }),
  );
}
