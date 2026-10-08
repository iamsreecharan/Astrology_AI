# Performance notes

Forecast sampling now calculates only the planets needed by each rule. It does not calculate retrograde motion for every sampled date when the rule only uses a sign or longitude. Full birth charts and displayed transits retain all nine planets and their motion calculations.

Before-and-after checks at the same fixed instant produced identical chart, marriage, career, Saturn-phase, report-model and Kundali results. These local Node measurements used ten samples per calculation; they describe calculation time, rather than total request or model response time.

| Calculation | Previous median | Current median |
| --- | ---: | ---: |
| Marriage windows | 12.68 ms | 2.25 ms |
| Career windows and planning dates | 53.85 ms | 12.83 ms |
| Challenging-period phases | 33.21 ms | 2.06 ms |
| Full horoscope report model | 78.72 ms | 23.03 ms |

The report-model measurement excludes PDF rendering. No private chart or conversation cache was added; each server calculation uses the submitted birth record and current calculation instant.

The production build creates smaller Brotli and gzip representations of text files. In a direct HTTP check, the main JavaScript, main stylesheet and lazy Three.js library together transferred **237,349 bytes with Brotli**, compared with **966,537 uncompressed bytes** in the previous release. That is about 75% fewer transfer bytes. Files with content hashes can be reused from the browser cache for a year. HTML revalidates, and personal API responses keep `Cache-Control: no-store`. Missing build assets return 404 so an old JavaScript URL cannot silently receive the app's HTML.

The Today page no longer precomputes hidden chart and forecast results. Production browser checks confirmed five startup API requests became three on desktop and phone. Charts load on the first Birth chart visit for that profile and stay available on subsequent tab visits. That first visit pays the calculation delay; later visits need no new chart requests. Changing the profile invalidates those results. Editing it from Today no longer starts two hidden recalculations. Obsolete browser requests are aborted, and request identifiers also prevent late responses from replacing a newer selection or conversation.

Birthplace suggestions use a 180 ms debounce and a bounded, five-minute cache of public place results in each autocomplete widget. Retry bypasses that cache. Profile and chat data are not included in it.

With the same controlled 40 ms place-search response, first suggestions appeared in 366 → 255 ms on desktop and 370 → 239 ms on phone. Refocusing a cached query took 455 → 136 ms and 408 → 63 ms respectively, with zero additional search requests. These are local browser checks, rather than worldwide network timings.

AI Yogi recognizes a small set of complete English questions locally, including familiar job, marriage and challenging-period questions. Those need one model answer request instead of classification followed by an answer. Other personal questions retain model classification, including follow-ups, multiple topics and other languages. The existing current-turn language checks and single correction attempt still apply.

Yogi's avatar shares sphere geometry and batches its necklace beads. Production browser measurements found approximately 66% fewer geometry buffer bytes and 174 → 151 draw calls per frame. It pauses outside the viewport and while the page is hidden. Under reduced motion, audio-level changes do not redraw an unchanged pose. The planetary welcome retains its animation and pause controls.

Actual hosted latency also depends on the visitor's connection, device, model provider and hosting service. A Render free service may take time to wake after inactivity; these changes do not remove that hosting delay.
