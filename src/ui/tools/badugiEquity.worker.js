import { compareBadugiDrawChoices, compareBadugiFinalBet, compareBadugiRangePair } from './badugiEquity.js';

import { generateBadugiRangePresets } from './badugiRangePresets.js';

self.onmessage = ({ data }) => {
  if (data.presets) self.postMessage({ presets: generateBadugiRangePresets(data.presets) });
  else if (data.comparison) self.postMessage(compareBadugiRangePair(data.comparison.base, data.comparison.ranges, data.comparison.count));
  else if (Array.isArray(data.pair)) self.postMessage({ pair: data.pair.map(compareBadugiFinalBet) });
  else self.postMessage(data.settings ? compareBadugiFinalBet(data) : compareBadugiDrawChoices(data));
};
