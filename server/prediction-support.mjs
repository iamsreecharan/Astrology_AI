const RELATIVE_NOTE = 'These labels compare calculated traditional support among the shown windows. They are not measured chances of marriage or employment.';
const INTERPRETATION = Object.freeze({
  kind: 'interpretation', label: 'Traditional interpretation',
  explanation: 'This reading describes traditional chart and period themes. No likelihood of a personal outcome has been calculated.',
});
const CALCULATED_PHASE = Object.freeze({
  kind: 'calculated-phase', label: 'Calculated phase',
  explanation: 'This is a sampled Saturn transit classification, not a probability of hardship or a date when difficulties will end.',
});
const PLANNING = Object.freeze({
  kind: 'planning', label: 'Planning suggestion',
  explanation: 'This is a traditional prompt for applications, interviews, or networking. It is not a probable hiring date.',
});
const UNCOMPARED = Object.freeze({
  kind: 'unavailable', label: 'Support not compared',
  explanation: 'Comparable calculated support factors are unavailable. No likelihood or relative ranking is supplied.',
});

function timingFactors(window, topic) {
  const source = window?.supportFactors;
  if (!source || !Number.isInteger(source.dashaWeight) || source.dashaWeight < 1 || source.dashaWeight > 7
    || !Number.isFinite(source.jupiterTargetAverage) || source.jupiterTargetAverage < 1 - 1e-9
    || source.jupiterTargetAverage > (topic === 'marriage' ? 3 : 2) + 1e-9) return null;
  if (topic === 'marriage' && (!Number.isFinite(source.saturnTargetAverage)
    || source.saturnTargetAverage < 0 || source.saturnTargetAverage > 3 + 1e-9)) return null;
  return {
    dashaWeight: source.dashaWeight,
    jupiterTargetAverage: source.jupiterTargetAverage,
    ...(topic === 'marriage' ? { saturnTargetAverage: source.saturnTargetAverage } : {}),
  };
}

function difference(a, b) {
  return Math.abs(a - b) <= 1e-9 ? 0 : a - b;
}

// Keep the engines' existing dasha-first ordering. Transit counts are
// duration-weighted averages of sampled target signs, not outcome scores.
function compare(a, b) {
  return b.dashaWeight - a.dashaWeight
    || difference(b.jupiterTargetAverage, a.jupiterTargetAverage)
    || difference(b.saturnTargetAverage || 0, a.saturnTargetAverage || 0);
}

function attachPlanning(prediction) {
  return {
    ...prediction,
    ...(Array.isArray(prediction.searchWindows) ? {
      searchWindows: prediction.searchWindows.map(window => ({ ...window, support: { ...PLANNING } })),
    } : {}),
    ...(prediction.planningDates ? {
      planningDates: {
        ...prediction.planningDates, support: { ...PLANNING },
        ...(Array.isArray(prediction.planningDates.dates) ? {
          dates: prediction.planningDates.dates.map(day => ({ ...day, support: { ...PLANNING } })),
        } : {}),
      },
    } : {}),
  };
}

/** Add display guidance from calculated evidence without changing any dates. */
export function attachPredictionSupport(prediction) {
  if (!prediction || typeof prediction !== 'object') throw new TypeError('A calculated prediction is required.');
  const windows = Array.isArray(prediction.windows) ? prediction.windows : [];
  const base = attachPlanning(prediction);
  if (prediction.status === 'no-window' || (!windows.length && prediction.status === 'estimated')) return {
    ...base, windows: windows.map(window => ({ ...window, support: { ...UNCOMPARED } })),
    support: {
      kind: 'unavailable', label: 'No timing window found',
      explanation: 'This method found no qualifying timing window in the selected horizon. It does not establish that a life event is impossible.',
    },
  };
  if (prediction.topic === 'difficult-periods') return {
    ...base, support: { ...CALCULATED_PHASE },
    windows: windows.map(window => ({ ...window, support: { ...CALCULATED_PHASE } })),
  };
  if (prediction.status === 'interpreted') return {
    ...base, support: { ...INTERPRETATION },
    windows: windows.map(window => ({ ...window, support: { ...INTERPRETATION } })),
  };
  if (prediction.status !== 'estimated' || !['marriage', 'career'].includes(prediction.topic)) return {
    ...base, support: { ...UNCOMPARED },
    windows: windows.map(window => ({ ...window, support: { ...UNCOMPARED } })),
  };
  const factors = windows.map(window => timingFactors(window, prediction.topic));
  if (factors.some(value => !value)) return {
    ...base, support: { ...UNCOMPARED },
    windows: windows.map(window => ({ ...window, support: { ...UNCOMPARED } })),
  };
  const ranked = factors.map((value, index) => ({ value, index })).sort((a, b) => compare(a.value, b.value));
  const top = ranked[0].value;
  const tiedWindows = ranked.filter(entry => compare(entry.value, top) === 0).length;
  const comparedWindows = windows.length;
  return {
    ...base,
    support: { kind: 'relative', label: 'Relative astrological support', explanation: RELATIVE_NOTE, comparedWindows },
    windows: windows.map((window, index) => {
      const isTop = compare(factors[index], top) === 0;
      const rank = 1 + ranked.filter(entry => compare(entry.value, factors[index]) < 0).length;
      const comparison = comparedWindows === 1 ? 'single' : !isTop ? 'lower' : tiedWindows > 1 ? 'tied-top' : 'unique-top';
      const label = comparison === 'unique-top' ? 'Most supported' : comparison === 'tied-top' ? 'Joint most supported' : 'Supported';
      const explanation = comparison === 'single'
        ? 'One qualifying window is shown. It meets the traditional dasha and Jupiter rules; there is no second shown window to compare.'
        : comparison === 'tied-top'
          ? `${tiedWindows} shown windows share the strongest calculated support under this method. No tied window is assigned a higher outcome likelihood.`
          : comparison === 'unique-top'
            ? 'This window has the strongest calculated traditional support among the shown windows. That ranking is not an outcome probability.'
            : 'This window meets the traditional dasha and Jupiter rules, with lower relative support than the strongest shown window.';
      return { ...window, support: { kind: 'relative', label, explanation, comparison, rank, comparedWindows, ...(comparison === 'tied-top' ? { tiedWindows } : {}) } };
    }),
  };
}
