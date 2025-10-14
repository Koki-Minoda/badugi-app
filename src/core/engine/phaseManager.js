export class PhaseManager {
  constructor() {
    this.phases = [
      "DEAL",
      "BET0",
      "DRAW1", "BET1",
      "DRAW2", "BET2",
      "DRAW3", "BET3",
      "SHOWDOWN",
    ];
    this.index = 0;
  }
  get current() { return this.phases[this.index]; }
  next() { this.index = (this.index < this.phases.length - 1) ? this.index + 1 : 0; }
  reset() { this.index = 0; }

  isDeal()     { return this.current === "DEAL"; }
  isBet()      { return this.current.startsWith("BET"); }
  isDraw()     { return this.current.startsWith("DRAW"); }
  isShowdown() { return this.current === "SHOWDOWN"; }
}
