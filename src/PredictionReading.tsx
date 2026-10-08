import { memo } from 'react';
import CareerTiming from './CareerTiming';
import type { CareerPlanningDates, CareerSearchWindow } from './CareerTiming';
import './PredictionReading.css';

export type PredictionOutlook = {
  summary: string;
  timing: { label: string; text: string; date?: string } | null;
  actions: string[];
  periods: { label: string; text: string; start: string; end: string; current: boolean }[];
};

type Support = { kind: string; label: string; explanation: string; comparison?: string };
type Window = { start: string; end: string; ageRange?: { min: number; max: number }; label?: string; reasons?: string[]; themes?: string[]; support?: Support };
type Prediction = {
  topic?: string;
  status?: string;
  asOf?: string;
  horizonEnd?: string;
  outlook?: PredictionOutlook;
  support?: Support;
  seventhHouse?: { rashi: string; lord: string };
  windows?: Window[];
  searchWindows?: CareerSearchWindow[];
  searchHorizonEnd?: string;
  planningDates?: CareerPlanningDates;
  factors?: string[];
  themes?: string[];
  currentPhase?: { name: string; description: string };
  method?: string[];
  limitations?: string[];
};

function nonempty(items?: string[]): string[] {
  return (items || []).filter(item => typeof item === 'string' && item.trim().length > 0);
}

function dateLabel(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function ageLabel(age: { min: number; max: number }): string {
  const format = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${format(age.min)}${age.min !== age.max ? `–${format(age.max)}` : ''}`;
}

function DateRange({ start, end }: { start: string; end: string }) {
  return <p className="reading-period-dates"><time dateTime={start.slice(0, 10)}>{dateLabel(start)}</time><span aria-hidden="true"> – </span><span className="sr-only"> through </span><time dateTime={end.slice(0, 10)}>{dateLabel(end)}</time></p>;
}

function SupportBadge({ support }: { support?: Support }) {
  if (!support) return null;
  const leading = support.comparison === 'unique-top' || support.comparison === 'tied-top';
  return <span className={`prediction-support-badge prediction-support-${support.kind} ${leading ? 'is-leading' : ''}`}>{support.label}</span>;
}

function List({ items, className }: { items?: string[]; className?: string }) {
  const values = nonempty(items);
  return values.length ? <ul className={className}>{values.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : null;
}

const PredictionReading = memo(function PredictionReading({ prediction, compact = false, focusStrongest = false }: { prediction: Prediction; compact?: boolean; focusStrongest?: boolean }) {
  const outlook = prediction.outlook;
  const windows = prediction.windows || [];
  const isMarriage = prediction.topic === 'marriage';
  const hasRelativeSupport = prediction.support?.kind === 'relative';
  const actions = nonempty(outlook?.actions);
  const allPeriods = outlook?.periods || [];
  const uniqueTop = windows.find(window => window.support?.kind === 'relative' && window.support.comparison === 'unique-top');
  const tiedTop = windows.filter(window => window.support?.kind === 'relative' && window.support.comparison === 'tied-top').sort((a, b) => a.start.localeCompare(b.start))[0];
  const focusedWindow = uniqueTop || tiedTop || windows.find(window => window.support?.comparison === 'single') || windows[0];
  const focusedPeriod = hasRelativeSupport
    ? allPeriods.find(period => period.start === focusedWindow?.start.slice(0, 10) && period.end === focusedWindow?.end.slice(0, 10))
    : allPeriods.find(period => period.current) || allPeriods[0];
  const periods = focusStrongest ? focusedPeriod ? [focusedPeriod] : [] : allPeriods;

  return <div className={`prediction-reading marriage-results prediction-results${compact ? ' compact' : ''}`}>
    {outlook && <section className="prediction-overview" aria-label="Your outlook in everyday language">
      <div className="prediction-meaning"><h3>What this means for you</h3><p>{outlook.summary}</p></div>
      {outlook.timing && !(focusStrongest && hasRelativeSupport) && <div className="prediction-timing"><h3>{outlook.timing.label || 'When things may shift'}</h3><p>{outlook.timing.text}</p></div>}
      {actions.length > 0 && <div className="prediction-actions"><h3>What you can do</h3><List items={actions} /></div>}
    </section>}

    {prediction.topic === 'career' && <CareerTiming planningDates={prediction.planningDates} searchWindows={prediction.searchWindows} searchHorizonEnd={prediction.searchHorizonEnd} compact={compact} />}

    {periods.length > 0 && <section className="reading-periods-section" aria-label="Your current and upcoming periods">
      <h3>{prediction.topic === 'career' ? focusStrongest ? 'A broader career period' : 'Broader career periods, in date order' : isMarriage ? focusStrongest ? 'A marriage window to consider' : 'Marriage windows to consider' : 'A little context for the dates'}</h3>
      <div className="reading-periods">{periods.map((period, index) => {
        const window = windows.find(item => item.start.slice(0, 10) === period.start && item.end.slice(0, 10) === period.end);
        const leading = window?.support?.comparison === 'unique-top' || window?.support?.comparison === 'tied-top';
        return <article className={`reading-period${period.current ? ' is-current' : ''}${leading ? ' window-most-supported' : ''}`} key={`${period.start}-${period.end}-${index}`}>
          <span className="reading-period-state">{period.current ? 'Now' : 'Upcoming'}</span>
          {isMarriage && window?.ageRange && <p className="reading-period-age">Age <strong>{ageLabel(window.ageRange)}</strong></p>}
          <h4>{period.label}</h4>
          {window?.support?.kind === 'relative' && <SupportBadge support={window.support} />}
          <DateRange start={period.start} end={period.end} />
          <p className="reading-period-explanation">{period.text}</p>
        </article>;
      })}</div>
    </section>}
    {hasRelativeSupport && periods.length > 0 && <p className="reading-support-caption">Support labels compare astrological support, not measured chances.</p>}

    <details className="prediction-reasoning">
      <summary>Why this reading?</summary>
      <div className="prediction-technical">
        {(prediction.asOf || prediction.horizonEnd) && <p className="reading-calculated-date">{prediction.asOf && <>Calculated as of <time dateTime={prediction.asOf}>{dateLabel(prediction.asOf)}</time>.</>}{prediction.horizonEnd && <> The guide looks through <time dateTime={prediction.horizonEnd}>{dateLabel(prediction.horizonEnd)}</time>.</>}</p>}
        {prediction.support && <p className="reading-support-explanation"><strong>{prediction.support.label}.</strong> {prediction.support.explanation}</p>}
        {prediction.seventhHouse && <p>Seventh house: {prediction.seventhHouse.rashi} · lord: {prediction.seventhHouse.lord}.</p>}
        {prediction.currentPhase && <section className="reading-technical-section"><h4>{prediction.currentPhase.name}</h4><p>{prediction.currentPhase.description}</p></section>}
        {nonempty(prediction.themes).length > 0 && <section className="reading-technical-section"><h4>Traditional themes</h4><List items={prediction.themes} /></section>}
        {nonempty(prediction.factors).length > 0 && <section className="reading-technical-section"><h4>Chart factors</h4><List items={prediction.factors} /></section>}
        {windows.length > 0 && <section className="reading-technical-section reading-technical-windows"><h4>Calculated period details</h4>{windows.map((window, index) => <section className="reading-technical-window" key={`${window.start}-${window.end}-${index}`}>
          <h5>{window.label || `Period ${index + 1}`}</h5>
          <DateRange start={window.start} end={window.end} />
          {isMarriage && window.ageRange && <p>Estimated age: {ageLabel(window.ageRange)} years.</p>}
          {window.support && <p><strong>{window.support.label}.</strong> {window.support.explanation}</p>}
          <List items={window.themes} className="window-themes" />
          <List items={window.reasons} className="window-reasons" />
        </section>)}</section>}
        {prediction.status === 'no-window' && <p>No timing window met these rules in this horizon. This does not rule out real-life opportunities.</p>}
        {nonempty(prediction.method).length > 0 && <section className="reading-technical-section"><h4>How this was calculated</h4><List items={prediction.method} /></section>}
        {nonempty(prediction.limitations).length > 0 && <section className="reading-technical-section"><h4>Keep in mind</h4><List items={prediction.limitations} /></section>}
      </div>
    </details>
  </div>;
});

export default PredictionReading;
