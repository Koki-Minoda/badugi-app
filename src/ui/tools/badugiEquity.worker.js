import { compareBadugiDrawChoices } from './badugiEquity.js';

self.onmessage = ({ data }) => {
  self.postMessage(compareBadugiDrawChoices(data));
};
