import './CareerTiming.css';

export type CareerSearchWindow = {
  start: string;
  end: string;
  label?: string;
  reasons?: string[];
};

type CareerPlanningDate = {
  date: string;
  displayDate: string;
  weekday: string;
  timeZone: string;
  nakshatra: { index: number; name: string };
  tithi: { index: number; name: string; paksha: 'Shukla' | 'Krishna'; dayInPaksha: number };
  tara: { index: number; name: string; countFromBirthStar: number };
  moonRelativeHouse: number;
  reasons: string[];
  warnings: string[];
  sampleLocal: string;
  sampleUtc: string;
};

export type CareerPlanningDates = {
  status: 'available' | 'no-dates' | 'under-age' | 'uncertain-natal';
  sampledAt: string;
  horizon: { start: string; end: string; endExclusive: string; days: number; timeZone: string };
  natal: { nakshatra: { index: number; name: string }; moonSignIndex: number };
  dates: CareerPlanningDate[];
  evaluatedDays: number;
  qualifyingDays: number;
  excludedBoundaryDays: number;
  method: string[];
  limits: string[];
};

type CareerTimingProps = {
  planningDates?: CareerPlanningDates;
  searchWindows?: CareerSearchWindow[];
  searchHorizonEnd?: string;
  compact?: boolean;
};

function dayMonthYear(date: string) {
  const day = date.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : day;
}

function emptyDatesMessage(status: CareerPlanningDates['status']) {
  if (status === 'under-age') return 'Daily job-search dates aren’t shown for this age.';
  if (status === 'uncertain-natal') return 'The natal Moon position needs more certainty before daily dates can be listed. Check your birth details.';
  return 'No dates matched these traditional planning rules in this range. Keep applying based on actual opportunities.';
}

export default function CareerTiming({ planningDates, searchWindows, searchHorizonEnd, compact = false }: CareerTimingProps) {
  if (!planningDates && !searchWindows) return null;
  const hasDailyDates = planningDates?.status === 'available' && Boolean(planningDates.dates.length);

  return (
    <div className={`career-timing${compact ? ' career-timing--compact' : ''}`}>
      {planningDates?.status !== 'under-age' && <p className="career-timing-action">Apply and prepare now. Use these dates around real openings and interview availability.</p>}

      {planningDates && <section className="career-planning-dates" aria-label="Dates to consider for your job search">
        <h3>Dates to consider for your job search</h3>
        <p className="career-timing-context">{dayMonthYear(planningDates.horizon.start)} – {dayMonthYear(planningDates.horizon.end)} · application and interview planning.</p>
        {hasDailyDates ? <ul className="career-date-list">
          {planningDates.dates.map(date => <li key={date.date}>
            <div className="career-date-heading"><time dateTime={date.date}>{date.displayDate || dayMonthYear(date.date)}</time><span>{date.weekday}</span></div>
            <p className="career-date-star"><span aria-hidden="true">✧</span>{date.nakshatra.name} nakshatra</p>
            <details className="career-timing-disclosure">
              <summary>Why this date</summary>
              <ul>{date.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
              <dl className="career-date-facts">
                <div><dt>Birth-star relation</dt><dd>{date.tara.name} · Tara {date.tara.index}</dd></div>
                <div><dt>Lunar day</dt><dd>{date.tithi.paksha} {date.tithi.name}</dd></div>
                <div><dt>Moon position</dt><dd>House {date.moonRelativeHouse} from your natal Moon</dd></div>
              </dl>
              {date.warnings.map(warning => <p className="career-date-warning" key={warning}>{warning}</p>)}
            </details>
          </li>)}
        </ul> : <p className="career-timing-empty">{emptyDatesMessage(planningDates.status)}</p>}
        <p className="career-timing-sample">Daily checks use noon in <span>{planningDates.horizon.timeZone}</span>, your saved birth time zone. Conditions can change during the day; confirm your current location before scheduling. These are not offer dates.</p>
        {Boolean(planningDates.method.length || planningDates.limits.length) && <details className="career-timing-disclosure career-timing-method">
          <summary>How these dates are calculated</summary>
          {Boolean(planningDates.method.length) && <ul>{planningDates.method.map(method => <li key={method}>{method}</li>)}</ul>}
          {Boolean(planningDates.limits.length) && <ul>{planningDates.limits.map(limit => <li key={limit}>{limit}</li>)}</ul>}
        </details>}
      </section>}

      {searchWindows && <section className="career-search-windows" aria-label="Near-term job search windows">
        <h3>Near-term job search windows</h3>
        <p className="career-timing-context">For applications, interview preparation and networking{searchHorizonEnd ? ` · through ${dayMonthYear(searchHorizonEnd)}` : ''}.</p>
        {searchWindows.length ? <ul className="career-search-list">
          {searchWindows.map((window, index) => <li key={`${window.start}-${window.end}-${index}`}>
            <p className="career-search-range"><time dateTime={window.start}>{dayMonthYear(window.start)}</time><span aria-hidden="true"> – </span><span className="sr-only"> through </span><time dateTime={window.end}>{dayMonthYear(window.end)}</time></p>
            {window.label && <p className="career-search-label">{window.label}</p>}
            {Boolean(window.reasons?.length) && <details className="career-timing-disclosure"><summary>Why this window</summary><ul>{window.reasons?.map(reason => <li key={reason}>{reason}</li>)}</ul></details>}
          </li>)}
        </ul> : <p className="career-timing-empty">No near-term search window matched this transit rule. This doesn’t mean your job search has to wait.</p>}
      </section>}
    </div>
  );
}
