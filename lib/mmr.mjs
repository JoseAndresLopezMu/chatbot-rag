function cosineSim(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

function normalize(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => (v - min) / range);
}

/**
 * Maximal Marginal Relevance: selecciona `k` candidatos que equilibran
 * relevancia (candidate.relevance) y diversidad (distancia entre candidate.embedding).
 * lambda=1 -> solo relevancia. lambda=0 -> solo diversidad.
 */
export function mmrSelect(candidates, { k = 5, lambda = 0.7 } = {}) {
  if (candidates.length <= k) return candidates;

  const relevances = normalize(candidates.map((c) => c.relevance));
  const pool = candidates.map((c, i) => ({ ...c, _relevance: relevances[i] }));

  const selected = [];
  const remaining = [...pool];

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const maxSimToSelected = selected.length === 0
        ? 0
        : Math.max(...selected.map((s) => cosineSim(candidate.embedding, s.embedding)));
      const score = lambda * candidate._relevance - (1 - lambda) * maxSimToSelected;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected.map(({ _relevance, ...rest }) => rest);
}
