import { validateProfile } from './astrology.mjs';
import { calculateVedicChart } from './vedic-chart.mjs';

const RASHIS = ['Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)', 'Karka (Cancer)', 'Simha (Leo)', 'Kanya (Virgo)', 'Tula (Libra)', 'Vrischika (Scorpio)', 'Dhanu (Sagittarius)', 'Makara (Capricorn)', 'Kumbha (Aquarius)', 'Meena (Pisces)'];
const STARS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
const SIGN_LORDS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
const VARNA = ['Kshatriya', 'Vaishya', 'Shudra', 'Brahmin', 'Kshatriya', 'Vaishya', 'Shudra', 'Brahmin', 'Kshatriya', 'Vaishya', 'Shudra', 'Brahmin'];
const VARNA_ORDER = ['Shudra', 'Vaishya', 'Kshatriya', 'Brahmin'];
const VASHYA_CLASSES = ['Chatushpada (quadruped)', 'Manava (human)', 'Jalachara (water)', 'Vanachara (forest)', 'Keeta (insect)'];
// These traditional tables use female rows and male columns. Their direction
// matters for Vashya and Gana; the other category scores are symmetric.
const VASHYA_SCORES = [
  [2, 0.5, 1, 0, 2], [0.5, 2, 0, 0, 0], [1, 0, 2, 2, 2],
  [0, 0, 2, 2, 0], [1, 0, 1, 0, 2],
];
const GANA_CLASSES = ['Deva', 'Manushya', 'Rakshasa'];
const GANA_BY_STAR = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0];
const GANA_SCORES = [[6, 6, 0], [5, 6, 0], [1, 0, 6]];
const NADI_CLASSES = ['Adi', 'Madhya', 'Antya'];
const NADI_BY_STAR = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2];
const YONI_CLASSES = ['Horse', 'Elephant', 'Sheep', 'Snake', 'Dog', 'Cat', 'Rat', 'Cow', 'Buffalo', 'Tiger', 'Deer', 'Monkey', 'Mongoose', 'Lion'];
const YONI_BY_STAR = [0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0, 13, 7, 1];
const YONI_SCORES = [
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 1, 3, 2, 1],
  [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0],
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],
  [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2],
  [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1],
  [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1],
  [1, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1],
  [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2],
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2],
  [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
];
const NATURAL_RELATIONS = {
  Sun: { friends: ['Moon', 'Mars', 'Jupiter'], enemies: ['Venus', 'Saturn'] },
  Moon: { friends: ['Sun', 'Mercury'], enemies: [] },
  Mars: { friends: ['Sun', 'Moon', 'Jupiter'], enemies: ['Mercury'] },
  Mercury: { friends: ['Sun', 'Venus'], enemies: ['Moon'] },
  Jupiter: { friends: ['Sun', 'Moon', 'Mars'], enemies: ['Mercury', 'Venus'] },
  Venus: { friends: ['Mercury', 'Saturn'], enemies: ['Sun', 'Moon'] },
  Saturn: { friends: ['Mercury', 'Venus'], enemies: ['Sun', 'Moon', 'Mars'] },
};
const TARA_CLASSES = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyari', 'Sadhaka', 'Naidhana', 'Mitra', 'Param Mitra'];
const GOOD_TARAS = new Set([2, 4, 6, 8, 9]);
const BENCHMARKS = [
  { id: 'below-minimum', label: 'Below the traditional minimum', min: 0, max: 18 },
  { id: 'acceptable', label: 'Traditionally acceptable', min: 18, max: 25 },
  { id: 'good', label: 'Traditionally good', min: 25, max: 33 },
  { id: 'excellent', label: 'Traditionally excellent', min: 33, max: 36 },
];

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function vashyaIndex(sign, degree) {
  if ([0, 1].includes(sign) || (sign === 8 && degree >= 15) || (sign === 9 && degree < 15)) return 0;
  if ([2, 5, 6, 10].includes(sign) || (sign === 8 && degree < 15)) return 1;
  if ([3, 11].includes(sign) || (sign === 9 && degree >= 15)) return 2;
  return sign === 4 ? 3 : 4;
}

function moonIdentity(chart) {
  const longitude = chart?.moon?.longitude;
  const nakshatraIndex = chart?.moon?.nakshatra?.index;
  if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360 || !Number.isInteger(nakshatraIndex) || nakshatraIndex < 0 || nakshatraIndex > 26) {
    throw badRequest('Two calculated Vedic Moon records are required for Jathakam matching.');
  }
  // The chart keeps the star classification before rounding the longitude.
  // Permit only the tiny rounding difference at a star boundary.
  const starSize = 360 / 27;
  if (longitude < nakshatraIndex * starSize - 0.000001 || longitude > (nakshatraIndex + 1) * starSize + 0.000001) {
    throw badRequest('The calculated Moon longitude and birth star must agree.');
  }
  const recordedSign = chart?.planets?.find(planet => planet.name === 'Moon')?.signIndex
    ?? (chart?.moon?.rashi ? RASHIS.indexOf(chart.moon.rashi) : Math.floor(longitude / 30));
  if (!Number.isInteger(recordedSign) || recordedSign < 0 || recordedSign > 11
    || longitude < recordedSign * 30 - 0.000001 || longitude > (recordedSign + 1) * 30 + 0.000001) {
    throw badRequest('The calculated Moon longitude and sign must agree.');
  }
  const signIndex = recordedSign;
  const degree = Math.max(0, Math.min(29.999999, longitude - signIndex * 30));
  const inferredPada = Math.min(4, Math.max(1, Math.floor((longitude - nakshatraIndex * starSize) / (starSize / 4)) + 1));
  const pada = chart?.moon?.pada ?? inferredPada;
  if (!Number.isInteger(pada) || pada < 1 || pada > 4
    || longitude < nakshatraIndex * starSize + (pada - 1) * starSize / 4 - 0.000001
    || longitude > nakshatraIndex * starSize + pada * starSize / 4 + 0.000001) {
    throw badRequest('The calculated Moon longitude and pada must agree.');
  }
  const vashya = vashyaIndex(signIndex, degree);
  return {
    rashi: RASHIS[signIndex], signIndex, longitude,
    nakshatra: { name: STARS[nakshatraIndex], index: nakshatraIndex },
    pada, signLord: SIGN_LORDS[signIndex], varna: VARNA[signIndex],
    vashya: VASHYA_CLASSES[vashya], yoni: YONI_CLASSES[YONI_BY_STAR[nakshatraIndex]],
    gana: GANA_CLASSES[GANA_BY_STAR[nakshatraIndex]], nadi: NADI_CLASSES[NADI_BY_STAR[nakshatraIndex]],
  };
}

function category(id, name, description, score, max, maleValue, femaleValue, method, explanation, details = {}) {
  return { id, name, description, score, max, status: score === max ? 'full' : score === 0 ? 'zero' : 'partial', maleValue, femaleValue, method, explanation, details };
}

function taraDirection(from, to) {
  const count = (to - from + 27) % 27 + 1;
  const position = (count - 1) % 9 + 1;
  const favourable = GOOD_TARAS.has(position);
  return { count, position, name: TARA_CLASSES[position - 1], favourable, score: favourable ? 1.5 : 0 };
}

function naturalRelation(from, to) {
  if (from === to) return 'same lord';
  if (NATURAL_RELATIONS[from].friends.includes(to)) return 'friend';
  if (NATURAL_RELATIONS[from].enemies.includes(to)) return 'enemy';
  return 'neutral';
}

function maitriScore(male, female) {
  if (male === female) return { score: 5, maleToFemale: 'same lord', femaleToMale: 'same lord' };
  const maleToFemale = naturalRelation(male, female);
  const femaleToMale = naturalRelation(female, male);
  const pair = [maleToFemale, femaleToMale].sort().join('/');
  const scores = { 'friend/friend': 5, 'friend/neutral': 4, 'neutral/neutral': 3, 'enemy/friend': 1, 'enemy/neutral': 0.5, 'enemy/enemy': 0 };
  return { score: scores[pair], maleToFemale, femaleToMale };
}

export function kundaliBenchmark(total) {
  if (!Number.isFinite(total) || total < 0 || total > 36) throw badRequest('The Guna total must be between 0 and 36.');
  const band = BENCHMARKS.find(({ min, max }) => total >= min && (total < max || max === 36));
  return {
    id: band.id, label: band.label, minimum: 18, meetsMinimum: total >= 18,
    explanation: '18 out of 36 is a commonly used North Indian minimum. This is a traditional screening benchmark; it does not determine whether two people should marry.',
  };
}

/** Compare two calculated sidereal Moons using a disclosed base Ashta Koota variant. */
export function calculateAshtaKoota(maleChart, femaleChart) {
  const male = moonIdentity(maleChart);
  const female = moonIdentity(femaleChart);
  const maleStar = male.nakshatra.index;
  const femaleStar = female.nakshatra.index;
  const varnaScore = VARNA_ORDER.indexOf(male.varna) >= VARNA_ORDER.indexOf(female.varna) ? 1 : 0;
  const vashyaScore = VASHYA_SCORES[VASHYA_CLASSES.indexOf(female.vashya)][VASHYA_CLASSES.indexOf(male.vashya)];
  const maleToFemale = taraDirection(maleStar, femaleStar);
  const femaleToMale = taraDirection(femaleStar, maleStar);
  const taraScore = maleToFemale.score + femaleToMale.score;
  const yoniScore = YONI_SCORES[YONI_BY_STAR[femaleStar]][YONI_BY_STAR[maleStar]];
  const maitri = maitriScore(male.signLord, female.signLord);
  const ganaScore = GANA_SCORES[GANA_BY_STAR[femaleStar]][GANA_BY_STAR[maleStar]];
  const signDistance = (female.signIndex - male.signIndex + 12) % 12 + 1;
  const reverseDistance = (male.signIndex - female.signIndex + 12) % 12 + 1;
  const bhakootScore = [2, 5, 6, 8, 9, 12].includes(signDistance) ? 0 : 7;
  const nadiScore = male.nadi === female.nadi ? 0 : 8;
  const kootas = [
    category('varna', 'Varna', 'Traditional classification', varnaScore, 1, male.varna, female.varna,
      'Water, fire, earth and air Moon signs map respectively to Brahmin, Kshatriya, Vaishya and Shudra; the male class must be equal or higher in this historical ordering for 1 point.',
      `${male.varna} / ${female.varna} gives ${varnaScore} of 1 point under the selected role convention. These historical labels do not describe a person’s caste, value or abilities.`),
    category('vashya', 'Vashya', 'Traditional mutual influence', vashyaScore, 2, male.vashya, female.vashya,
      'The Moon signs form five groups; Sagittarius and Capricorn split at exactly 15°. A fixed directional five-by-five table, with female rows and male columns, awards 0–2 points.',
      `${male.vashya} / ${female.vashya} gives ${vashyaScore} of 2 points in the chosen table. The categories are symbolic and do not imply control over a partner.`,
      { row: 'female', column: 'male', splitDegrees: 15 }),
    category('tara', 'Tara', 'Birth-star compatibility', taraScore, 3, male.nakshatra.name, female.nakshatra.name,
      'Count the 27 birth stars inclusively in both directions, then cycle the count through nine Taras. Sampat, Kshema, Sadhaka, Mitra and Param Mitra each earn 1.5 points per favourable direction; Janma earns 0 in this variant.',
      `Male to female: count ${maleToFemale.count}, ${maleToFemale.name}, ${maleToFemale.score} points; female to male: count ${femaleToMale.count}, ${femaleToMale.name}, ${femaleToMale.score} points.`,
      { maleToFemale, femaleToMale }),
    category('yoni', 'Yoni', 'Symbolic physical compatibility', yoniScore, 4, male.yoni, female.yoni,
      'Each birth star maps to one of 14 symbolic animals. A symmetric animal-pair table gives 0–4 points, with the same animal receiving 4.',
      `${male.yoni} / ${female.yoni} gives ${yoniScore} of 4 points. This is a traditional symbol, not an assessment of actual intimacy or consent.`),
    category('graha-maitri', 'Graha Maitri', 'Traditional mental compatibility', maitri.score, 5, male.signLord, female.signLord,
      'Compare the natural friendship of the two Moon-sign lords in both directions: same lord or mutual friends 5; friend/neutral 4; neutral/neutral 3; friend/enemy 1; neutral/enemy 0.5; mutual enemies 0.',
      `${male.signLord} regards ${female.signLord} as ${maitri.maleToFemale}; ${female.signLord} regards ${male.signLord} as ${maitri.femaleToMale}. This pair earns ${maitri.score} of 5 points.`,
      maitri),
    category('gana', 'Gana', 'Symbolic temperament', ganaScore, 6, male.gana, female.gana,
      'Birth stars map to Deva, Manushya or Rakshasa. The directional three-by-three table, with female rows and male columns, gives 6 for equal groups and 0, 1, 5 or 6 for differing groups.',
      `${male.gana} / ${female.gana} gives ${ganaScore} of 6 points under this role convention. These are symbolic temperaments, not moral labels.`,
      { row: 'female', column: 'male' }),
    category('bhakoot', 'Bhakoot', 'Traditional family and emotional harmony', bhakootScore, 7, male.rashi, female.rashi,
      'Count Moon signs inclusively in both directions. The 2/12, 5/9 and 6/8 pairs receive 0; other pairs receive 7, without cancellation upgrades.',
      `The sign counts are ${signDistance} / ${reverseDistance}, giving ${bhakootScore} of 7 points. This base score does not predict the outcome of a relationship.`,
      { maleToFemale: signDistance, femaleToMale: reverseDistance, cancellationApplied: false }),
    category('nadi', 'Nadi', 'Traditional constitutional grouping', nadiScore, 8, male.nadi, female.nadi,
      'The 27 birth stars map to Adi, Madhya or Antya Nadi. Different groups receive 8 and the same group receives 0, without cancellation upgrades.',
      `${male.nadi} / ${female.nadi} gives ${nadiScore} of 8 points. Nadi cannot establish health, fertility, genetics or future children.`,
      { sameGroup: male.nadi === female.nadi, cancellationApplied: false }),
  ];
  const total = kootas.reduce((sum, koota) => sum + koota.score, 0);
  return {
    system: 'Ashta Koota Milan', total, max: 36, kootas,
    counts: {
      fullyMatched: kootas.filter(({ status }) => status === 'full').length,
      partiallyMatched: kootas.filter(({ status }) => status === 'partial').length,
      notMatched: kootas.filter(({ status }) => status === 'zero').length,
      withPoints: kootas.filter(({ score }) => score > 0).length, totalCategories: 8,
    },
    benchmark: kundaliBenchmark(total), benchmarks: BENCHMARKS.map((band) => ({ ...band })),
    moons: { male, female },
    method: {
      name: 'North Indian Ashta Koota — base score', version: '1',
      displayName: 'Ashta Koota Guna Milan (36-point Kundali matching)',
      tradition: 'North Indian base-score convention',
      calculationBasis: 'Eight weighted kootas compare both sidereal Moon signs (rashis) and birth stars (nakshatras), adding up to a maximum of 36 gunas.',
      chartBasis: 'Birth date, recorded local time and selected place establish each Moon position using an approximate Lahiri sidereal chart; names do not affect the score.',
      roleConvention: 'Male and female follow the historical groom/bride roles. Varna, Vashya and Gana can change when the roles are reversed; the remaining category scores are symmetric.',
      cancellations: 'No Bhakoot or Nadi cancellation, same-star exception, Manglik assessment or South Indian ten-porutham adjustment is applied. Different traditions may give different scores.',
      sources: [
        { title: 'Saravali: Ashta Koota tables', url: 'https://www.saravali.de/articles/ashtakoota.html' },
        { title: 'Published reference tables: PyJHora compatibility, pinned revision', url: 'https://github.com/naturalstupid/PyJHora/blob/48e57d29b47a3143519910a24866758116467485/src/jhora/horoscope/match/compatibility.py' },
      ],
    },
    cautions: [
      'This score follows one traditional calculation convention; it is not a measured probability of a happy or successful marriage.',
      'Birth time and historical time zone determine the Moon’s actual position. Near a sign, star or 15° Vashya boundary, verify the birth record and ephemeris before relying on the score.',
      'A full Jathakam review may also consider Mars, the seventh house, D9 and dasha periods. Those checks are outside this 36-point score.',
      'Consent, communication, shared values and real-life circumstances belong in any marriage decision. A score cannot determine health, fertility or whether a couple should marry.',
    ],
  };
}

/** Validate both complete birth records before calculating the shared JSON/PDF model. */
export function buildKundaliMatch(input, { today = new Date(), asOf = today } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('Please provide male and female birth profiles.');
  const male = validateProfile(input.male, { today });
  const female = validateProfile(input.female, { today });
  if (!male.birthTime || !female.birthTime) throw badRequest('Jathakam matching needs the birth time and selected birth place for both people.');
  const maleChart = calculateVedicChart(male, { asOf });
  const femaleChart = calculateVedicChart(female, { asOf });
  const result = calculateAshtaKoota(maleChart, femaleChart);
  const profileFields = ['name', 'birthDate', 'birthTime', 'birthPlace', 'latitude', 'longitude', 'timeZone'];
  const publicProfile = (profile) => Object.fromEntries(profileFields.map((field) => [field, profile[field]]));
  const warnings = [...new Set([
    ...maleChart.calculation.warnings.map((warning) => `Male chart: ${warning}`),
    ...femaleChart.calculation.warnings.map((warning) => `Female chart: ${warning}`),
  ])];
  for (const [role, moon] of Object.entries(result.moons)) {
    if ([8, 9].includes(moon.signIndex) && Math.abs(moon.longitude % 30 - 15) <= 0.05) {
      warnings.push(`${role === 'male' ? 'Male' : 'Female'} Moon is within 0.05° of the 15° Vashya boundary; its group and score may be uncertain.`);
    }
  }
  return {
    ...result, profiles: { male: publicProfile(male), female: publicProfile(female) }, generatedAt: asOf.toISOString(),
    calculation: { ayanamsha: maleChart.calculation.ayanamsha, ephemeris: maleChart.calculation.ephemeris, warnings },
  };
}
