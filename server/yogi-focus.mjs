import { buildPredictionOutlook } from './prediction-outlook.mjs';

/** Keep one calculated window in Yogi's answer while retaining its real label. */
export function focusYogiPrediction(prediction) {
  if (!prediction || prediction.support?.kind !== 'relative' || !Array.isArray(prediction.windows) || !prediction.windows.length) return prediction;
  const top = prediction.windows.filter(window => window.support?.kind === 'relative' && ['unique-top', 'tied-top'].includes(window.support.comparison));
  const selected = [...(top.length ? top : prediction.windows)].sort((a, b) => a.start.localeCompare(b.start))[0];
  const focused = { ...prediction, windows: [selected] };
  return { ...focused, outlook: buildPredictionOutlook(focused) };
}
