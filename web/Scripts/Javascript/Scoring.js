/**
 * Similarity scoring.
 *
 * Each Earth site in data/locais.json may carry, per target id:
 *   notas[targetId][dimensionId] = 0..1   (similarity in that dimension)
 * The overall score is the weighted mean over the enabled dimensions.
 * If a site only has a precomputed overall score, it can use `nota_<targetId>` (0..1) instead.
 */
export function siteScore(site, targetId, weights) {
  const dims = site.notas?.[targetId];
  if (dims) {
    let sum = 0, wsum = 0;
    for (const [dim, w] of Object.entries(weights)) {
      const v = dims[dim];
      if (w > 0 && typeof v === 'number') { sum += v * w; wsum += w; }
    }
    if (wsum > 0) return sum / wsum;
  }
  const flat = site[`nota_${targetId}`];
  return typeof flat === 'number' ? flat : null;
}

export function rankSites(sites, targetId, weights) {
  return sites
    .map((s) => ({ site: s, score: siteScore(s, targetId, weights) }))
    .filter((r) => r.score !== null)
    .sort((a, b) => b.score - a.score);
}

/** red (low) -> amber -> green (high), tuned for the 0.35–0.9 range that analog scores live in. */
export function scoreColor(score) {
  const t = Math.max(0, Math.min(1, (score - 0.35) / 0.5));
  const hue = 8 + t * 140;
  return `hsl(${hue.toFixed(0)}, 75%, 55%)`;
}

export const pct = (x) => `${Math.round(x * 100)}%`;
