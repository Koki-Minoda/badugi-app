/**
 * DeckManager
 * - 52枚デッキを1インスタンスで管理
 * - draw(n)で安全にカードを引き、残りが尽きたら discardPile＋回収分を再シャッフル
 * - reset()で完全リセット
 */
export class DeckManager {
  constructor(debug = false) {
    this.debug = debug;
    this.fullDeck = this.#createDeck();
    this.deck = this.#shuffle([...this.fullDeck]);
    this.discardPile = []; // 捨て札（交換された古カード）
    this.drawCount = 0;
  }

  #createDeck() {
    const suits = ["♠", "♥", "♦", "♣"];
    const ranks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
    const deck = [];
    for (const s of suits) {
      for (const r of ranks) deck.push(`${r}${s}`);
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

  get size() {
    return this.deck.length;
  }

  reset() {
    this.fullDeck = this.#createDeck();
    this.deck = this.#shuffle([...this.fullDeck]);
    this.discardPile = [];
    this.drawCount = 0;
    if (this.debug) console.log(`[DeckManager] reset`);
  }

  /** 捨て札を即リサイクルして山へ戻す */
  recycleNow(extra = []) {
    if (extra && extra.length) this.discardPile.push(...extra);
    if (this.discardPile.length > 0) {
      this.deck = this.#shuffle([...this.deck, ...this.discardPile]);
      if (this.debug)
        console.log(`[DeckManager] recycleNow: deck=${this.deck.length} (discard cleared)`);
      this.discardPile = [];
    }
  }

  /** カードをn枚引く（必要なら再シャッフル） */
  draw(n = 1) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (this.deck.length === 0) {
        if (this.discardPile.length === 0) {
          console.warn("[DeckManager] Deck empty, no discard to recycle → returning partial draw");
          break;
        }
        this.recycleNow();
      }
      const card = this.deck.pop();
      if (card) {
        drawn.push(card);
        this.drawCount++;
      }
    }
    if (this.debug) {
      console.log(`[DeckManager] draw(${n}) → ${drawn.join(", ") || "(none)"} [remain=${this.deck.length}]`);
    }
    return drawn;
  }

  /** 捨て札登録 */
  discard(cards) {
    if (!cards || !cards.length) return;
    this.discardPile.push(...cards);
    if (this.debug)
      console.log(`[DeckManager] discard +${cards.length} → total=${this.discardPile.length}`);
  }
}
