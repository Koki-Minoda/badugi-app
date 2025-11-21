export function createOpponentModel() {
  const seats = new Map();
  const global = {
    actions: 0,
    vpip: 0,
    pfr: 0,
    threeBet: 0,
    bluffs: 0,
    heroCalls: 0,
    limps: 0,
    coldCalls: 0,
    showdowns: 0,
    wins: 0,
    drawsTaken: 0,
    drawsTotal: 0,
  };

  function ensureSeat(seatIndex) {
    if (!seats.has(seatIndex)) {
      seats.set(seatIndex, {
        actions: 0,
        vpip: 0,
        pfr: 0,
        threeBet: 0,
        bluffs: 0,
        heroCalls: 0,
        limps: 0,
        coldCalls: 0,
        showdowns: 0,
        wins: 0,
        drawsTaken: 0,
        drawsTotal: 0,
      });
    }
    return seats.get(seatIndex);
  }

  function increment(entry, key, amount = 1) {
    entry[key] = (entry[key] ?? 0) + amount;
  }

  function shouldIgnoreSeat(seatIndex) {
    return seatIndex == null || seatIndex === 0;
  }

  return {
    recordBet({ seatIndex, action, betBefore, betAfter, toCall = 0, paid = 0, raiseCountTable = 0 }) {
      if (shouldIgnoreSeat(seatIndex)) return;
      const entry = ensureSeat(seatIndex);
      entry.actions += 1;
      global.actions += 1;
      const invested = paid > 0 || action === "RAISE" || action === "BET" || betAfter > betBefore;
      if (invested) {
        increment(entry, "vpip");
        increment(global, "vpip");
      }
      if (action === "RAISE") {
        increment(entry, "pfr");
        increment(global, "pfr");
        if (raiseCountTable >= 2) {
          increment(entry, "threeBet");
          increment(global, "threeBet");
        }
      }
      if (action === "CALL" && toCall === 0 && betBefore === 0) {
        increment(entry, "limps");
        increment(global, "limps");
      }
      if (action === "CALL" && toCall > 0 && betBefore > 0) {
        increment(entry, "coldCalls");
        increment(global, "coldCalls");
      }
      if (action === "CALL" && paid > 0 && toCall > 0) {
        increment(entry, "heroCalls");
        increment(global, "heroCalls");
      }
    },
    recordShowdown({ seatIndex, didWin }) {
      if (shouldIgnoreSeat(seatIndex)) return;
      const entry = ensureSeat(seatIndex);
      increment(entry, "showdowns");
      increment(global, "showdowns");
      if (didWin) {
        increment(entry, "wins");
        increment(global, "wins");
      }
    },
    recordDraw({ seatIndex, drawCount }) {
      if (shouldIgnoreSeat(seatIndex)) return;
      const entry = ensureSeat(seatIndex);
      increment(entry, "drawsTotal");
      increment(global, "drawsTotal");
      const count = Math.max(0, drawCount);
      entry.drawsTaken += count;
      global.drawsTaken += count;
    },
    getSnapshot(seatIndex) {
      return seats.get(seatIndex) ?? ensureSeat(seatIndex);
    },
    getAggregateStats() {
      const denom = global.actions || 1;
      const drawDenom = global.drawsTotal || 1;
      return {
        vpipRate: global.vpip / denom,
        pfrRate: global.pfr / denom,
        threeBetRate: global.threeBet / denom,
        heroCallRate: global.heroCalls / denom,
        limpRate: global.limps / denom,
        coldCallRate: global.coldCalls / denom,
        showdownRate: global.showdowns / denom,
        winRate: global.showdowns ? global.wins / global.showdowns : 0,
        drawCountAvg: global.drawsTaken / drawDenom,
        samples: {
          actions: global.actions,
          draws: global.drawsTotal,
          showdowns: global.showdowns,
        },
        raw: { ...global },
      };
    },
    reset() {
      seats.clear();
      Object.keys(global).forEach((key) => {
        global[key] = 0;
      });
    },
  };
}
