# Calculation methods

Astral calculates chart facts before generating an interpretation. A local guide or API language model explains those results. The calculations and the interpretation have different limits.

## Astronomy and birth inputs

A full profile needs the recorded local birth time, date, place, latitude, longitude, and IANA zone. Selecting a birthplace suggestion supplies its coordinates and IANA zone from the bundled GeoNames snapshot. A typed name must be selected or accompanied by manually entered location fields; editing a selection clears its old coordinates. The [Temporal polyfill](https://github.com/js-temporal/temporal-polyfill) applies historical offsets and rejects ambiguous or nonexistent daylight-saving times.

The snapshot contains 234,908 places across 246 country codes and 394 time zones. City and town coordinates identify the settlement, not an exact birth address. Check the region and country for duplicate names, and use manual coordinates and a verified IANA zone where needed. Coverage is limited by the snapshot and does not include every village or hospital. Search reads a local, read-only SQLite file and makes no external geocoding request. The [data notes](../server/data/README.md) describe sources, transformations, and GeoNames CC BY 4.0 attribution.

[Astronomy Engine](https://github.com/cosinekitty/astronomy) calculates geocentric positions for the Sun, Moon, Mercury, Venus, Mars, Jupiter, and Saturn. Sidereal positions use an approximate Lahiri ayanamsha: a mean anchor of 23.245524743° at TT Julian date 2435553.5 advanced with the IAU 2006/P03 precession polynomial associated with Capitaine, Wallace, and Chapront. Nutation adjusts the apparent planetary and ascendant frame. Mean Rahu uses the lunar-node polynomial described by Jean Meeus in *Astronomical Algorithms*; Ketu is opposite Rahu.

Coordinates and apparent sidereal time determine the eastern-horizon ascendant. The calculation selects the rising intersection at high latitudes and rejects undefined polar configurations. It supports 1900–2100, with births restricted to already occurred instants. Results within 0.05° of rashi, nakshatra, pada, or Navamsa boundaries carry warnings. This is an approximate analytical chart, not an exact panchang calculation.

## D1, D9, and periods

D1 uses equal sidereal signs and whole-sign houses from the ascendant. The computed Moon sign is Janma rashi. Moon longitude determines one of 27 equal nakshatras, its Vimshottari ruler, and one of four padas.

D9/Navamsa uses the unrounded natal longitude: normalize `longitude × 9` to 0–360°. Its houses use the D9 ascendant. Birth time and boundary positions can change D9 placements. D9 is shown as additional context but is not scored by the marriage-window method.

Vimshottari follows Ketu 7, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, and Mercury 17 years. Progress through the birth nakshatra sets the elapsed mahadasha and remaining balance. Antardashas begin from the true mahadasha start, which may precede birth. The year is 365.2425 days; other traditional conventions give different dates.

Current transits use the stated server as-of instant and natal whole-sign houses.

## Marriage windows

The public endpoint searches ten calendar years ahead and returns up to three ranked adult windows:

1. Determine the D1 seventh house, its traditional ruler, and natal Venus.
2. Keep actual mahadasha/antardasha intervals where either ruler is the seventh-house lord or Venus. Clip to the future horizon and eighteenth birthday.
3. Sample each calendar-month interval at its midpoint. Require Jupiter to occupy or traditionally aspect the natal sign of the seventh house, its ruler, or Venus. Jupiter's aspects are fifth, seventh, and ninth signs from itself.
4. Use Saturn occupation or third, seventh, and tenth sign aspects as corroboration. Saturn alone cannot create a window.
5. Join contiguous supported months within an antardasha. Rank by dasha support, then Jupiter support, then Saturn support, with earlier windows breaking ties.

Dasha weighting favors the seventh ruler as antardasha lord, then mahadasha lord, then Venus as antardasha lord, then mahadasha lord. This rank is a heuristic, not a probability.

The response gives dates, completed-age ranges, and reasons. February 29 birthdays use March 1 in non-leap years. Monthly sampling makes window boundaries approximate. No window means no qualifying period was found in the horizon, not that marriage is impossible.

This method does not assess D9 strength, yogas, afflictions, shadbala, or birth-time rectification. It does not establish a single wedding age, and its predictive accuracy has not been validated. Marriage can occur outside a window or not occur; choice, consent, and circumstances matter.

## Career windows

Career timing looks three calendar years ahead. It combines the D1 tenth house and its ruler with qualifying Vimshottari periods involving that ruler, Mercury, or Saturn. Monthly midpoint Jupiter samples must occupy or traditionally aspect the natal tenth-house sign or its ruler's sign. Actual period boundaries are preserved, with ages below 18 excluded.

Up to three windows are ranked by dasha links, Jupiter support, and earlier start. They describe conditional opportunity periods, not a probability or a job offer, promotion, salary, or hiring date. D10/Dashamsa and planetary strength are not calculated.

## Difficult periods and Saturn phases

This topic tracks Saturn relative to the natal Moon across a ten-year horizon. Sade Sati uses the twelfth, first, and second signs from the Moon; Ashtama Shani uses the eighth. Saturn is sampled at the assessment instant and the first day of each future month. Up to six marked passages are shown chronologically, along with the current configuration, any first sampled exit found, and the next calculated antardasha change. Moving between the three Sade Sati passages does not end the broader classification.

A current passage starts at the assessment date in these results; its historical onset is not calculated. Horizon-clipped ends do not imply an exit. Retrograde motion can bring later re-entries, and monthly sampling can miss short passages. A configuration ending is not a calculated end to hardship: difficulty or wellbeing can occur independently of these markers.

## Married life and other topics

Each topic uses the following D1 houses and conventional significators:

| Topic | Houses | Additional significators |
| --- | --- | --- |
| Married life | 2, 4, 7 | Venus |
| Education | 5, 9 | Mercury, Jupiter |
| Finances | 2, 11 | Jupiter |
| Family | 2, 4 | Moon |
| Travel | 9, 12 | None |
| Wellbeing | 6, 12 | None |

Periods qualify when their mahadasha or antardasha lord rules or occupies a topic house, or is a listed significator. General life has no house filter; it describes current and upcoming period lords and their actual placements. Results include factors, themes, and up to three chronological antardasha windows clipped to the current instant and three-year horizon. These are interpretive periods rather than dated event promises.

Married life also shows the D9 ascendant, seventh house, its ruler and occupants, and Venus when D9 is available. That context does not select or rank the D1-linked windows.

It does not determine a partner's behavior, relationship success, wealth, an exam result, travel permission, illness, or treatment. Wellbeing remains reflection on routines and support; financial themes do not establish investment returns. D9 context does not amount to a strength score or a complete relationship assessment.

## Notes and AI

`server/vedic-knowledge.mjs` contains original concise notes on methods, houses, grahas, nakshatras, and question topics. Selection follows the chart and question. Chat references identify these application notes, not classical-text quotations or verse citations.

The local guide uses rules. Chat gives a short answer to the question first, with full topic results and supporting references available under **Calculation details**. Live AI uses an existing OpenAI model, default `gpt-4.1-mini`, with derived chart facts, selected notes, recent conversation, and computed timing windows. Raw profile fields are excluded from structured model context. The prompt asks for concise explanations that preserve supplied values and ranges and avoid invented factors. Model mistakes remain possible.

This is contextual grounding, not custom training on every Vedic text or technique. True nodes, other divisional charts, detailed yogas, strength scores, exact muhurta, and kundli matching are outside the implementation.

## Verification

Chart tests compare natal positions and ascendants with independent numeric fixtures for Hyderabad, Delhi, and London, using a 0.05° tolerance. Cases also cover historical Kolkata offsets, high-latitude rising points, division boundaries, D9 rules, and Vimshottari continuity. These checks verify calculations for the tested cases, not real-life predictions.

Reference fixtures were obtained using Swiss Ephemeris in an isolated validation tool. The app does not import or distribute Swiss Ephemeris code or require it to run. Production calculations use MIT-licensed Astronomy Engine and the ISC-licensed Temporal polyfill.

Timing tests cover clipping, calendar ages, adulthood, transit support, ranking, no-window behavior, and actual ephemeris integration. Life-topic tests check house and ruler selection and period-based themes. API and knowledge tests cover server recomputation, topic routing, input limits, privacy filtering, reference selection, and provider failures. Provider responses are controlled in tests; live access needs a securely configured account key.
