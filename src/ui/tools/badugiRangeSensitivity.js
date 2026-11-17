const epsilon = 1e-10;
const approximateGap = 0.02;

function leaders(actions, weight) {
  const scores = actions.map(action => ({ action, equity: action.a + weight * (action.b - action.a) }));
  const max = Math.max(...scores.map(score => score.equity));
  return scores.filter(score => max - score.equity < epsilon).map(({ action }) => action.id);
}

export function analyzeRangeSensitivity(actions) {
  const approximate = actions.some(action => action.approximate);
  const best = side => {
    const sorted = [...actions].sort((left, right) => right[side] - left[side]);
    const gap = sorted[0][side] - sorted[1][side];
    return { id: sorted[0].id, clear: gap > (approximate ? approximateGap : epsilon), gap };
  };
  const endpoints = [best('a'), best('b')];
  const points = [0, 1];
  for (const [index, first] of actions.entries()) {
    for (const second of actions.slice(index + 1)) {
      const deltaA = first.a - second.a;
      const deltaB = first.b - second.b;
      const weight = deltaA / (deltaA - deltaB);
      if (weight > epsilon && weight < 1 - epsilon) points.push(weight);
    }
  }
  points.sort((a, b) => a - b);
  const transitions = [];
  if (endpoints.every(endpoint => endpoint.clear)) {
    let previous = [endpoints[0].id];
    for (let index = 1; index < points.length; index += 1) {
      if (points[index] - points[index - 1] < epsilon) continue;
      const next = leaders(actions, (points[index - 1] + points[index]) / 2);
      if (next.length === 1 && previous.length === 1 && next[0] !== previous[0]) {
        transitions.push({ weight: points[index - 1], from: previous[0], to: next[0] });
      }
      previous = next;
    }
  }
  return { endpoints, transitions, approximate };
}
