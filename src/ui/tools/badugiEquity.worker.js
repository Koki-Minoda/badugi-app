import { compareBadugiDrawChoices, compareBadugiFinalBet } from './badugiEquity.js';

self.onmessage = ({ data }) => {
  if (Array.isArray(data.pair)) self.postMessage({ pair: data.pair.map(compareBadugiFinalBet) });
  else self.postMessage(data.settings ? compareBadugiFinalBet(data) : compareBadugiDrawChoices(data));
};
