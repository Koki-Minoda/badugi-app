import { compareBadugiDrawChoices, compareBadugiFinalBet } from './badugiEquity.js';

self.onmessage = ({ data }) => {
  self.postMessage(data.settings ? compareBadugiFinalBet(data) : compareBadugiDrawChoices(data));
};
