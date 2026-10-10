import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import BirthplaceAutocomplete from './BirthplaceAutocomplete';
import type { Birthplace } from './BirthplaceAutocomplete';
import './KundaliMatching.css';

type SavedProfile = { name: string; birthDate: string; birthTime?: string; birthPlace?: string; latitude?: number; longitude?: number; timeZone?: string };
type BirthProfile = Required<SavedProfile>;
type Person = 'male' | 'female';
type Draft = { name: string; birthDate: string; birthTime: string; birthPlace: string; latitude: string; longitude: string; timeZone: string; selected: boolean };
type Moon = { rashi: string; longitude: number; nakshatra: { name: string; index: number }; pada: number; signLord: string };
type Koota = { id: string; name: string; description: string; score: number; max: number; status: 'full' | 'partial' | 'zero'; maleValue: string; femaleValue: string; method: string; explanation: string };
type Match = {
  system: string; total: number; max: number; kootas: Koota[];
  counts: { fullyMatched: number; partiallyMatched: number; notMatched: number; withPoints: number; totalCategories: number };
  benchmark: { id: string; label: string; minimum: number; meetsMinimum: boolean; explanation: string };
  benchmarks: { id: string; label: string; min: number; max: number }[];
  moons: { male: Moon; female: Moon }; profiles: { male: BirthProfile; female: BirthProfile };
  method: { name: string; version: string; displayName: string; tradition: string; calculationBasis: string; chartBasis: string; roleConvention: string; cancellations: string; sources: { title: string; url: string }[] };
  cautions: string[]; calculation: { ayanamsha: string; ephemeris: string; warnings: string[] };
};

const emptyDraft = (): Draft => ({ name: '', birthDate: '', birthTime: '', birthPlace: '', latitude: '', longitude: '', timeZone: '', selected: false });
const personLabel: Record<Person, string> = { male: 'Male', female: 'Female' };
const statusLabel = { full: 'Fully matched', partial: 'Partially matched', zero: 'No points' };

function draftFromProfile(profile: SavedProfile): Draft {
  let selected = Boolean(profile.birthPlace?.trim() && profile.timeZone?.trim()
    && Number.isFinite(profile.latitude) && Math.abs(profile.latitude!) <= 90
    && Number.isFinite(profile.longitude) && Math.abs(profile.longitude!) <= 180);
  if (selected) {
    try { new Intl.DateTimeFormat('en', { timeZone: profile.timeZone }); }
    catch { selected = false; }
  }
  return {
    name: profile.name, birthDate: profile.birthDate, birthTime: profile.birthTime || '', birthPlace: profile.birthPlace || '',
    latitude: Number.isFinite(profile.latitude) ? String(profile.latitude) : '', longitude: Number.isFinite(profile.longitude) ? String(profile.longitude) : '',
    timeZone: profile.timeZone || '', selected,
  };
}

function profileFromDraft(value: Draft, person: Person): BirthProfile {
  const label = personLabel[person];
  if (!value.name.trim()) throw new Error(`Add the ${label.toLowerCase()} person’s name.`);
  if (!value.birthDate || !value.birthTime) throw new Error(`Add the ${label.toLowerCase()} person’s birth date and recorded local birth time.`);
  if (!value.selected) throw new Error(`Choose the ${label.toLowerCase()} person’s birth place from the suggestions.`);
  if (!value.birthPlace.trim() || !value.timeZone.trim() || !value.latitude.trim() || !value.longitude.trim()) throw new Error(`Search and select the ${label.toLowerCase()} person’s birth place again.`);
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new Error(`Search and select the ${label.toLowerCase()} person’s birth place again.`);
  try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone.trim() }); }
  catch { throw new Error(`Search and select the ${label.toLowerCase()} person’s birth place again.`); }
  return { name: value.name.trim(), birthDate: value.birthDate, birthTime: value.birthTime, birthPlace: value.birthPlace.trim(), latitude, longitude, timeZone: value.timeZone.trim() };
}

function dateLabel(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function MatchingOrbit() {
  return <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="43" /><ellipse cx="50" cy="50" rx="19" ry="43" transform="rotate(42 50 50)" /><ellipse cx="50" cy="50" rx="19" ry="43" transform="rotate(-42 50 50)" /><circle className="kundali-orbit-dot" cx="20" cy="19" r="4" /><circle className="kundali-orbit-dot jade" cx="79" cy="82" r="4" /><path d="M50 36v28M36 50h28M40 40l20 20M40 60l20-20" /></svg>;
}

function MatchingIcon({ download = false }: { download?: boolean }) {
  return <svg className="kundali-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{download ? <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M4 16v4h16v-4" /></> : <><path d="M6 18 18 6M6 6h12v12" /></>}</svg>;
}

export default function KundaliMatching({ savedProfile, active = true }: { savedProfile: SavedProfile | null; active?: boolean }) {
  const [drafts, setDrafts] = useState<Record<Person, Draft>>({ male: emptyDraft(), female: emptyDraft() });
  const [match, setMatch] = useState<Match | null>(null);
  const [matchedProfiles, setMatchedProfiles] = useState<{ male: BirthProfile; female: BirthProfile } | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportError, setReportError] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const reportRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const resultRef = useRef<HTMLElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const downloadUrlsRef = useRef(new Map<string, number>());
  const today = new Date().toLocaleDateString('en-CA');

  useEffect(() => () => {
    ++requestIdRef.current;
    requestRef.current?.abort();
    reportRef.current?.abort();
    for (const [url, timeout] of downloadUrlsRef.current) { window.clearTimeout(timeout); URL.revokeObjectURL(url); }
    downloadUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (active) return;
    ++requestIdRef.current;
    requestRef.current?.abort();
    reportRef.current?.abort();
    requestRef.current = null;
    reportRef.current = null;
    setLoading(false);
    setReportLoading(false);
  }, [active]);

  function clearCalculation() {
    ++requestIdRef.current;
    requestRef.current?.abort();
    reportRef.current?.abort();
    requestRef.current = null;
    reportRef.current = null;
    setLoading(false);
    setReportLoading(false);
    setMatch(null);
    setMatchedProfiles(null);
    setError('');
    setReportError('');
  }

  function change(person: Person, patch: Partial<Draft>) {
    clearCalculation();
    setDrafts(previous => ({ ...previous, [person]: { ...previous[person], ...patch } }));
  }

  function choosePlace(person: Person, place: Birthplace) {
    change(person, { birthPlace: place.label, latitude: String(place.latitude), longitude: String(place.longitude), timeZone: place.timeZone, selected: true });
  }

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearCalculation();
    let profiles: { male: BirthProfile; female: BirthProfile };
    try { profiles = { male: profileFromDraft(drafts.male, 'male'), female: profileFromDraft(drafts.female, 'female') }; }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Check both sets of birth details.');
      window.requestAnimationFrame(() => formErrorRef.current?.focus());
      return;
    }
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 45_000);
    setLoading(true);
    try {
      const response = await fetch('/api/kundali-match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profiles), signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'The matching calculation could not be completed. Please try again.');
      if (!data || !Number.isFinite(data.total) || data.max !== 36 || !Array.isArray(data.kootas) || data.kootas.length !== 8 || !data.moons || !data.profiles) throw new Error('The matching response was incomplete. Please try again.');
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setMatch(data as Match);
      setMatchedProfiles(profiles);
      window.requestAnimationFrame(() => { if (requestId !== requestIdRef.current) return; resultRef.current?.focus({ preventScroll: true }); resultRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); });
    } catch (cause) {
      if (requestId !== requestIdRef.current || controller.signal.aborted && !timedOut) return;
      setError(timedOut ? 'This calculation is taking longer than expected. Please try again.' : cause instanceof TypeError ? 'We couldn’t reach Astral. Check your connection and try again.' : cause instanceof Error ? cause.message : 'The matching calculation could not be completed.');
      window.requestAnimationFrame(() => formErrorRef.current?.focus());
    } finally {
      window.clearTimeout(timeout);
      if (requestId === requestIdRef.current) { requestRef.current = null; setLoading(false); }
    }
  }

  async function downloadReport() {
    if (!match || !matchedProfiles || reportRef.current) return;
    const controller = new AbortController();
    const requestId = requestIdRef.current;
    reportRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 60_000);
    setReportLoading(true);
    setReportError('');
    try {
      const response = await fetch('/api/kundali-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(matchedProfiles), signal: controller.signal });
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || 'The PDF could not be prepared. Please try again.'); }
      if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The report response was unexpected. Please try again.');
      const blob = await response.blob();
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get('content-disposition') || '';
      const filename = disposition.match(/filename="([^"]+)"/i)?.[1];
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename?.replace(/[\\/\x00-\x1f]/g, '-') || 'Astral-Kundali-Matching.pdf';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      downloadUrlsRef.current.set(url, window.setTimeout(() => { URL.revokeObjectURL(url); downloadUrlsRef.current.delete(url); }, 1_000));
    } catch (cause) {
      if (requestId !== requestIdRef.current || controller.signal.aborted && !timedOut) return;
      setReportError(timedOut ? 'The report is taking longer than expected. Please try again.' : cause instanceof TypeError ? 'We couldn’t download the report. Check your connection and try again.' : cause instanceof Error ? cause.message : 'The report could not be downloaded.');
    } finally {
      window.clearTimeout(timeout);
      if (requestId === requestIdRef.current) { reportRef.current = null; setReportLoading(false); }
    }
  }

  function personFields(person: Person) {
    const value = drafts[person];
    const prefix = `kundali-${person}`;
    return <fieldset className={`kundali-person kundali-person-${person}`}>
      <legend><span className="kundali-person-marker" aria-hidden="true">{person === 'male' ? '01' : '02'}</span>{personLabel[person]} birth details</legend>
      {savedProfile && <button type="button" className="kundali-use-profile" onClick={() => { clearCalculation(); setDrafts(previous => ({ ...previous, [person]: draftFromProfile(savedProfile) })); }}>Use my saved details here <MatchingIcon /></button>}
      <div className="form-field"><label htmlFor={`${prefix}-name`}>Name</label><input id={`${prefix}-name`} value={value.name} onChange={event => change(person, { name: event.target.value })} maxLength={60} required autoComplete="off" placeholder="Name for this report" /></div>
      <div className="kundali-date-time"><div className="form-field"><label htmlFor={`${prefix}-date`}>Date of birth</label><input id={`${prefix}-date`} type="date" value={value.birthDate} onChange={event => change(person, { birthDate: event.target.value })} min="1900-01-01" max={today} required /></div><div className="form-field"><label htmlFor={`${prefix}-time`}>Birth time (local)</label><input id={`${prefix}-time`} type="time" step={60} value={value.birthTime} onChange={event => change(person, { birthTime: event.target.value })} required /></div></div>
      <BirthplaceAutocomplete inputId={`${prefix}-place`} value={value.birthPlace} selected={value.selected} onQueryChange={birthPlace => change(person, { birthPlace, selected: false, latitude: '', longitude: '', timeZone: '' })} onSelect={place => choosePlace(person, place)} />
    </fieldset>;
  }

  return <div className="kundali-matching">
    <div className="kundali-introduction"><MatchingOrbit /><div><span className="eyebrow">JATHAKAM MATCHING · 36 GUNAS</span><h2>Two birth charts.<br />Eight traditional measures.</h2><p className="kundali-introduction-method">Ashta Koota Guna Milan (36-point Kundali matching)</p><p>We follow the North Indian base-score convention, comparing both Moon signs and birth stars across eight weighted kootas. Add the recorded birth details to see the scores and their calculation.</p></div></div>
    <form onSubmit={event => void calculate(event)} className="kundali-form" aria-busy={loading}>
      <p className="kundali-birth-note">Add both people’s birth details, then search and select their birth places. Use the local time recorded at birth.</p>
      <div className="kundali-people-grid">{personFields('male')}{personFields('female')}</div>
      <div className="kundali-form-bottom"><p>Use a recorded birth time. If it’s unknown, this form can’t calculate a reliable birth-star match.</p><button className="primary-button kundali-calculate" type="submit" disabled={loading}>{loading ? 'Calculating the eight kootas…' : 'Calculate the 36-point match'}<MatchingIcon /></button></div>
      {error && <div className="kundali-error" role="alert" tabIndex={-1} ref={formErrorRef}>{error}</div>}
      <p className="kundali-privacy">These details are used for this calculation and PDF. They aren’t added to your saved profile or sent to the chat model.</p>
    </form>
    {match && <section className="kundali-results" ref={resultRef} tabIndex={-1} aria-label="Calculated Kundali matching results">
      <div className="kundali-score-panel"><div className="kundali-score-medallion" aria-label={`${match.total} out of ${match.max} gunas`}><span className="kundali-score-number">{match.total}<small> / {match.max}</small></span><span className="kundali-score-unit">GUNAS</span></div><div className="kundali-score-story"><span className="eyebrow">{match.profiles.male.name} + {match.profiles.female.name}</span><h2>{match.benchmark.label}</h2><p>{match.benchmark.explanation}</p><div className={`kundali-threshold ${match.benchmark.meetsMinimum ? 'meets' : 'below'}`}><span aria-hidden="true">{match.benchmark.meetsMinimum ? '✓' : '◇'}</span>{match.benchmark.meetsMinimum ? 'Meets' : 'Below'} the common traditional benchmark of {match.benchmark.minimum}/36.</div><p className="kundali-score-perspective">A traditional score, rather than a percentage chance of a happy marriage. It is one part of the conversation.</p></div></div>
      <section className="kundali-method-summary" aria-label="The matching method followed"><span className="eyebrow">{match.method.tradition}</span><h3>{match.method.displayName}</h3><p>{match.method.calculationBasis}</p><p>{match.method.chartBasis}</p></section>
      <div className="kundali-matched-counts" aria-label="How many categories matched"><div><strong>{match.counts.fullyMatched}</strong><span>Fully matched</span></div><div><strong>{match.counts.partiallyMatched}</strong><span>Partially matched</span></div><div><strong>{match.counts.notMatched}</strong><span>No points</span></div><p>Across {match.counts.totalCategories} kootas. {match.counts.withPoints} received points; a partial match earns some of its category’s maximum.</p></div>
      <section className="kundali-moon-section" aria-label="Calculated Moon signs and birth stars"><div className="kundali-section-heading"><span className="eyebrow">THE CALCULATED STARTING POINT</span><h3>Your Moon signs and birth stars.</h3></div><div className="kundali-moon-grid">{(['male', 'female'] as const).map(person => <article key={person} className="kundali-moon-card"><span className="kundali-moon-role">{personLabel[person]}</span><h4>{match.profiles[person].name}</h4><p>{dateLabel(match.profiles[person].birthDate)} · {match.profiles[person].birthTime} local<br />{match.profiles[person].birthPlace}</p><dl><div><dt>Moon sign · Rashi</dt><dd>{match.moons[person].rashi}</dd></div><div><dt>Birth star · Nakshatra</dt><dd>{match.moons[person].nakshatra.name} · Pada {match.moons[person].pada}</dd></div><div><dt>Moon longitude</dt><dd>{match.moons[person].longitude.toFixed(3)}° sidereal</dd></div><div><dt>Sign lord</dt><dd>{match.moons[person].signLord}</dd></div></dl></article>)}</div></section>
      <section className="kundali-koota-section" aria-label="All eight Ashta Koota scores"><div className="kundali-section-heading"><span className="eyebrow">EVERY GUNA, EXPLAINED</span><h3>How the eight measures add up.</h3><p>Each category has its own maximum. The eight earned scores together make the total out of 36.</p></div><div className="kundali-koota-grid">{match.kootas.map((koota, index) => <article key={koota.id} className={`kundali-koota-card kundali-koota-${koota.status}`}><div className="kundali-koota-heading"><span className="kundali-koota-index">{String(index + 1).padStart(2, '0')}</span><div><h4>{koota.name}</h4><span className="kundali-koota-status">{statusLabel[koota.status]}</span></div><strong>{koota.score}<small>/{koota.max}</small></strong></div><div className="kundali-score-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, koota.score / koota.max * 100))}%` }} /></div><p className="kundali-koota-description">{koota.description}</p><div className="kundali-koota-values"><span><small>MALE</small>{koota.maleValue}</span><span><small>FEMALE</small>{koota.femaleValue}</span></div><p className="kundali-koota-explanation">{koota.explanation}</p><details className="kundali-koota-method"><summary>How this score is calculated</summary><p>{koota.method}</p></details></article>)}</div></section>
      <section className="kundali-benchmark-section" aria-label="Traditional score benchmarks"><span className="eyebrow">THE COMMON TRADITIONAL SCALE</span><h3>What does the total mean?</h3><div className="kundali-benchmark-grid">{match.benchmarks.map(band => <div key={band.id} className={band.id === match.benchmark.id ? 'active' : ''}><strong>{band.min === 0 ? 'Below 18' : band.min === 18 ? '18 to below 25' : band.min === 25 ? '25 to below 33' : '33–36'}</strong><span>{band.label}</span>{band.id === match.benchmark.id && <small>Your calculated band</small>}</div>)}</div><p>18/36 is a common minimum in North Indian Ashta Koota tradition. Families and astrologers may use different thresholds and examine other chart factors.</p></section>
      <div className="kundali-report-panel"><div><span className="eyebrow">KEEP THE WHOLE PICTURE</span><h3>A clear report for the conversation.</h3><p>Download an English PDF with both birth records, the eight scores, their calculations, and the traditional benchmarks.</p></div><button type="button" className="primary-button" disabled={reportLoading} onClick={() => void downloadReport()}>{reportLoading ? 'Preparing your PDF…' : 'Download matching PDF'}<MatchingIcon download /></button>{reportError && <p className="kundali-report-error" role="alert">{reportError}</p>}</div>
      <details className="kundali-method-notes"><summary>Method, sources and things to keep in mind</summary><p><strong>{match.method.name}</strong> · {match.method.version}</p><p>{match.method.roleConvention}</p><p>{match.method.cancellations}</p><p>{match.calculation.ayanamsha} · {match.calculation.ephemeris}</p><ul>{[...match.calculation.warnings, ...match.cautions].map((note, index) => <li key={index}>{note}</li>)}</ul>{match.method.sources.length > 0 && <ul className="kundali-sources">{match.method.sources.map(source => <li key={source.url}>{/^https:\/\//.test(source.url) ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}</li>)}</ul>}</details>
      <p className="kundali-closing-note">A relationship also needs consent, kindness, shared values and honest communication. This score does not decide whether two people should marry.</p>
    </section>}
  </div>;
}
