/**
 * DeckManager
 * - 52
 * - draw(n)discardPile
 * - reset()
 */
const SUITS = ["S", "H", "D", "C"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const SNAPSHOT_KEYS = ["deck","discard","burn","seat0","seat1","seat2","seat3","seat4","seat5"];

function normalizeCardId(card) {
  if (!card) return null;
  if (typeof card === "string") return card;
  if (typeof card === "object") {
    if (typeof card.raw === "string") return card.raw;
    if (typeof card.card === "string") return card.card;
    if (typeof card.rank === "string" && typeof card.suit === "string") {
      return `${card.rank}${card.suit}`;
    }
  }
  return String(card);
}

export class DeckManager {
  constructor(options = {}) {
    const normalized =
      typeof options === "boolean" ? { debug: options } : options ?? {};
    this.debug = Boolean(normalized.debug);
    this.seedDeck = Array.isArray(normalized.seedDeck)
      ? [...normalized.seedDeck]
      : null;
    this.fullDeck = this.#createDeck();
    this.deck = this.#shuffle([...this.fullDeck]);
    this.discardPile = [];
    this.burnPile = [];
    this.drawCount = 0;
    this.inPlaySet = new Set();
  }

  #createDeck() {
    const deck = [];
    if (Array.isArray(this.seedDeck) && this.seedDeck.length) {
      return [...this.seedDeck];
    }
    for (const s of SUITS) {
      for (const r of RANKS) deck.push(`${r}${s}`);
    }
    return deck;
  }

  #shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  #removeCardFromDeck(card) {
    if (!card || !Array.isArray(this.deck) || !this.deck.length) return;
    const idx = this.deck.indexOf(card);
    if (idx >= 0) {
      this.deck.splice(idx, 1);
    }
  }

  get size() {
    return this.deck.length;
  }

  reset() {
    const source = this.#createDeck();
    this.fullDeck = [...source];
    this.deck = this.#shuffle([...source]);
    this.discardPile = [];
    this.burnPile = [];
    this.drawCount = 0;
    if (this.inPlaySet) {
      this.inPlaySet.clear();
    } else {
      this.inPlaySet = new Set();
    }
    if (this.debug) console.log(`[DeckManager] reset`);
    this.logState("[RESET]");
  }

  shuffle() {
    this.deck = this.#shuffle([...this.deck]);
    this.logState("[SHUFFLE]");
    return this.deck.length;
  }

  shuffle() {
    this.deck = this.#shuffle([...this.deck]);
    return this.deck.length;
  }

  recycleNow(extra = [], options = {}) {
    this.logState("[RECYCLE][BEFORE]", {
      discardSnapshot: [...this.discardPile],
      burnSnapshot: [...this.burnPile],
    });
    if (extra && extra.length) {
      const normalizedExtra = normalizeCardList(extra);
      if (normalizedExtra.length) {
        normalizedExtra.forEach((card) => this.inPlaySet?.delete(card));
        this.discardPile.push(...normalizedExtra);
      }
    }

    if (this.discardPile.length === 0 && this.burnPile.length === 0) {
      return this.deck.length;
    }

    const activeSet = buildActiveSet({
      provided: options?.activeCards,
      inPlaySet: this.inPlaySet,
    });

    const { recyclable: discardRecyclable, kept: discardKept } = partitionPile(
      this.discardPile,
      activeSet,
    );
    const { recyclable: burnRecyclable, kept: burnKept } = partitionPile(
      this.burnPile,
      activeSet,
    );

    const recyclable = [...discardRecyclable, ...burnRecyclable];
    this.discardPile = discardKept;
    this.burnPile = burnKept;

    if (recyclable.length === 0) {
      if (this.debug) {
        console.warn("[DeckManager] recycleNow skipped (no recyclable cards)", {
          blockedDiscard: discardKept.length,
          blockedBurn: burnKept.length,
        });
      }
      this.logState("[RECYCLE][AFTER][SKIP]", {
        discardedBlocked: discardKept.length,
        burnedBlocked: burnKept.length,
      });
      return this.deck.length;
    }

    this.deck = this.#shuffle([...this.deck, ...recyclable]);
    if (this.debug) {
      console.log(
        `[DeckManager] recycleNow: deck=${this.deck.length} discardAfter=${this.discardPile.length} burnAfter=${this.burnPile.length}`,
      );
    }
    this.logState("[RECYCLE][AFTER]", {
      recycledCount: recyclable.length,
      discardAfter: [...this.discardPile],
      burnAfter: [...this.burnPile],
    });
    return this.deck.length;
  }

  recycleIfNeeded(minRemaining = 0, options = {}) {
    if (this.deck.length >= minRemaining) return this.deck.length;
    if (this.discardPile.length === 0) return this.deck.length;
    return this.recycleNow([], options);
  }

  draw(n = 1, { allowPartial = false, activeCards = [] } = {}) {
    if (n <= 0) return [];
    this.logState(`[DRAW][BEFORE][n=${n}]`);
    this.recycleIfNeeded(n, { activeCards });
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (this.deck.length === 0) {
        if (this.discardPile.length === 0) {
          if (!allowPartial) {
            console.warn(
              `[DeckManager] Unable to draw ${n} cards (deck exhausted, returning ${drawn.length}).`
            );
          }
          break;
        }
        this.recycleNow([], { activeCards });
      }
      const card = this.deck.pop();
      if (card) {
        if (this.inPlaySet?.has(card) && this.debug) {
          console.error("[DeckManager] draw detected duplicate in-play card", { card });
        }
        this.inPlaySet?.add(card);
        drawn.push(card);
        this.drawCount++;
      }
    }
    if (this.debug) {
      console.log(
        `[DeckManager] draw(${n}) ${drawn.join(", ") || "(none)"} [remain=${this.deck.length}]`,
      );
    }
    this.logState(`[DRAW][AFTER][n=${n}]`, { drawn });
    return drawn;
  }

  burnTopCards(count = 1) {
    if (!this.deck.length || count <= 0) return [];
    this.logState(`[BURN][BEFORE][count=${count}]`);
    const burned = [];
    for (let i = 0; i < count; i += 1) {
      if (this.deck.length === 0) break;
      const card = this.deck.pop();
      if (!card) break;
      this.inPlaySet?.add(card);
      this.burnPile.push(card);
      burned.push(card);
    }
    if (this.debug && burned.length) {
      console.log(`[DeckManager] burnTopCards ${burned.join(", ")}`);
    }
    this.logState(`[BURN][AFTER][count=${count}]`, { burned });
    return burned;
  }

  discard(cards) {
    if (!cards || !cards.length) return;
    const normalized = normalizeCardList(cards);
    if (!normalized.length) return;
    this.logState("[DISCARD][BEFORE]", { cards });
    normalized.forEach((card) => {
      this.inPlaySet?.delete(card);
      this.#removeCardFromDeck(card);
    });
    this.discardPile.push(...normalized);
    if (this.debug)
      console.log(`[DeckManager] discard +${cards.length} total=${this.discardPile.length}`);
    this.logState("[DISCARD][AFTER]", { cards });
  }

  burn(cards) {
    if (!cards || !cards.length) return;
    const normalized = normalizeCardList(cards);
    if (!normalized.length) return;
    this.logState("[BURN:EXTERNAL][BEFORE]", { cards });
    normalized.forEach((card) => {
      this.inPlaySet?.delete(card);
      this.#removeCardFromDeck(card);
    });
    this.burnPile.push(...normalized);
    this.logState("[BURN:EXTERNAL][AFTER]", { cards });
  }

  getState() {
    return {
      deck: [...this.deck],
      discardPile: [...this.discardPile],
      burnPile: [...this.burnPile],
    };
  }

  snapshot() {
    return {
      deck: [...this.deck],
      discard: [...this.discardPile],
      burn: [...this.burnPile],
    };
  }

  logState(label, extra = {}) {
    if (typeof console === "undefined" || typeof console.log !== "function") return;
    try {
      console.log("[DECK][STATE]", {
        label,
        deck: [...this.deck],
        discard: [...this.discardPile],
        burn: [...this.burnPile],
        ...extra,
      });
    } catch (err) {
      if (typeof console !== "undefined" && typeof console.error === "function") {
        console.error("[DECK][STATE][ERROR]", err);
      }
    }
  }

  logDebugSnapshot(context) {
    this.logState(context);
  }
}

export function assertNoDuplicateCards(contextLabel, bucketsInput = {}) {
  const { buckets: normalizedBuckets } = normalizeBuckets(bucketsInput);
  const snapshot = buildBucketSnapshot(bucketsInput, normalizedBuckets);
  const seen = new Map();

  for (const [label, bucket] of Object.entries(normalizedBuckets)) {
    if (!bucket) continue;
    const cards = Array.isArray(bucket) ? bucket : [bucket];
    for (const card of cards) {
      const id = normalizeCardId(card);
      if (!id) continue;
      let entry = seen.get(id);
      if (!entry) {
        entry = { locations: new Set() };
        seen.set(id, entry);
      }
      entry.locations.add(label);
      if (entry.locations.size > 1) {
        const detail = {
          context: contextLabel,
          card: id,
          locations: Array.from(entry.locations),
          snapshot,
        };
        console.error("[DECK][DUPLICATE_DETECTED]", detail);
        throw new Error(`Duplicate card detected (${contextLabel}): ${id}`);
      }
    }
  }

  if (seen.size > 52) {
    throw new Error(
      `Deck overflow detected (${contextLabel}): ${seen.size} unique cards`
    );
  }

  return true;
}

function normalizeBuckets(buckets) {
  if (!buckets) {
    return { buckets: {} };
  }
  const entries = Array.isArray(buckets)
    ? buckets.map((bucket, idx) => [`bucket${idx}`, bucket])
    : Object.entries(buckets);

  const normalized = {};
  const refTracker = typeof WeakMap === "function" ? new WeakMap() : null;

  for (const [label, bucket] of entries) {
    if (bucket === null || bucket === undefined) continue;
    if (refTracker && typeof bucket === "object") {
      if (refTracker.has(bucket)) continue;
      refTracker.set(bucket, label);
    }
    normalized[label] = bucket;
  }
  return { buckets: normalized };
}

function buildBucketSnapshot(originalBuckets, normalizedBuckets) {
  const snapshot = {};
  const source = typeof originalBuckets === "object" && originalBuckets !== null ? originalBuckets : {};
  const keys = new Set([...SNAPSHOT_KEYS, ...Object.keys(source), ...Object.keys(normalizedBuckets)]);
  keys.forEach((key) => {
    snapshot[key] = source[key] ?? normalizedBuckets[key];
  });
  return snapshot;
}

function normalizeCardList(cards) {
  if (!Array.isArray(cards)) return [];
  return cards.map((card) => normalizeCardId(card)).filter(Boolean);
}

function buildActiveSet({ provided = [], inPlaySet }) {
  const activeSet = new Set(
    Array.isArray(provided)
      ? provided.map((card) => normalizeCardId(card)).filter(Boolean)
      : [],
  );
  if (inPlaySet && typeof inPlaySet.forEach === "function") {
    inPlaySet.forEach((card) => activeSet.add(card));
  }
  return activeSet;
}

function partitionPile(pile = [], activeSet = new Set()) {
  const recyclable = [];
  const kept = [];
  for (const card of pile) {
    if (!card) continue;
    if (activeSet.has(card)) {
      kept.push(card);
    } else {
      recyclable.push(card);
    }
  }
  return { recyclable, kept };
}

export { normalizeCardId };
