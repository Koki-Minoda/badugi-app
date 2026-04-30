const handHistoryAccessors = {
  readCurrent: () => null,
  readBuffer: () => [],
  findById: () => null,
};

export function setHandHistoryAccessors(accessors = {}) {
  if (typeof accessors.readCurrent === "function") {
    handHistoryAccessors.readCurrent = accessors.readCurrent;
  }
  if (typeof accessors.readBuffer === "function") {
    handHistoryAccessors.readBuffer = accessors.readBuffer;
  }
  if (typeof accessors.findById === "function") {
    handHistoryAccessors.findById = accessors.findById;
  }
}

export function getCurrentHandHistorySnapshot() {
  return handHistoryAccessors.readCurrent();
}

export function getHandHistoryBufferSnapshot() {
  return handHistoryAccessors.readBuffer();
}

export function findHandHistoryById(handId) {
  return handHistoryAccessors.findById(handId);
}
