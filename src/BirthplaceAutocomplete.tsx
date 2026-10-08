import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import './BirthplaceAutocomplete.css';

export type Birthplace = {
  id: string;
  name: string;
  label: string;
  country: string;
  region?: string;
  latitude: number;
  longitude: number;
  timeZone: string;
};

type PlaceResponse = { places: Birthplace[]; attribution: { label: string; url: string } };
type SearchState = 'idle' | 'loading' | 'success' | 'error';
type CachedPlaces = PlaceResponse & { expiresAt: number };

export default function BirthplaceAutocomplete({ value, selected, onQueryChange, onSelect, inputId = 'profile-place' }: {
  value: string;
  selected: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (place: Birthplace) => void;
  inputId?: string;
}) {
  const listId = useId();
  const statusId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const requestRef = useRef(0);
  const cacheRef = useRef(new Map<string, CachedPlaces>());
  const previousRetryRef = useRef(0);
  const outsidePointerRef = useRef<number | null>(null);
  const outsideCloseTimerRef = useRef<number | undefined>(undefined);
  const [focused, setFocused] = useState(false);
  const [places, setPlaces] = useState<Birthplace[]>([]);
  const [state, setState] = useState<SearchState>('idle');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retry, setRetry] = useState(0);
  const [attribution, setAttribution] = useState({ label: 'Place names from GeoNames', url: 'https://www.geonames.org/' });
  const query = value.trim();
  const searchReady = (query.match(/\p{L}/gu)?.length || 0) >= 2;
  const open = focused && !selected && searchReady;

  useEffect(() => {
    const requestId = ++requestRef.current;
    setPlaces([]);
    setActiveIndex(-1);
    if (!open) { setState('idle'); return; }
    const retrying = retry !== previousRetryRef.current;
    previousRetryRef.current = retry;
    const cached = cacheRef.current.get(query);
    if (!retrying && cached && cached.expiresAt > Date.now()) {
      setPlaces(cached.places);
      setAttribution(cached.attribution);
      setState('success');
      return;
    }
    const controller = new AbortController();
    let requestTimeout: number | undefined;
    let timedOut = false;
    setState('loading');
    const debounce = window.setTimeout(async () => {
      requestTimeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 10_000);
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Place search unavailable');
        const data = await response.json() as PlaceResponse;
        if (!Array.isArray(data.places)) throw new Error('Unexpected place search response');
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        const validPlaces = data.places.filter(place => typeof place.id === 'string' && typeof place.label === 'string' && place.label.length > 0
          && Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90
          && Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180
          && typeof place.timeZone === 'string' && place.timeZone.length > 0).slice(0, 8);
        setPlaces(validPlaces);
        setActiveIndex(-1);
        const source = typeof data.attribution?.label === 'string' && /^https:\/\//.test(data.attribution?.url)
          ? data.attribution : { label: 'Place names from GeoNames', url: 'https://www.geonames.org/' };
        setAttribution(source);
        cacheRef.current.delete(query);
        cacheRef.current.set(query, { places: validPlaces, attribution: source, expiresAt: Date.now() + 5 * 60_000 });
        if (cacheRef.current.size > 24) cacheRef.current.delete(cacheRef.current.keys().next().value!);
        setState('success');
      } catch {
        if (requestId === requestRef.current && (!controller.signal.aborted || timedOut)) setState('error');
      } finally {
        if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
      }
    }, 180);
    return () => {
      ++requestRef.current;
      window.clearTimeout(debounce);
      if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
      controller.abort();
    };
  }, [open, query, retry]);

  useEffect(() => {
    const list = listRef.current;
    const option = activeIndex >= 0 ? list?.children[activeIndex] : null;
    if (!list || !(option instanceof HTMLElement)) return;
    const listBounds = list.getBoundingClientRect();
    const optionBounds = option.getBoundingClientRect();
    if (optionBounds.top < listBounds.top) list.scrollTop -= listBounds.top - optionBounds.top;
    else if (optionBounds.bottom > listBounds.bottom) list.scrollTop += optionBounds.bottom - listBounds.bottom;
  }, [activeIndex]);

  useEffect(() => {
    if (open && places.length && containerRef.current?.closest('dialog[open]')) {
      listRef.current?.firstElementChild?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }, [open, places.length]);

  useEffect(() => {
    const clearCloseTimer = () => {
      if (outsideCloseTimerRef.current !== undefined) window.clearTimeout(outsideCloseTimerRef.current);
      outsideCloseTimerRef.current = undefined;
    };
    const beginOutsidePress = (event: PointerEvent) => {
      clearCloseTimer();
      outsidePointerRef.current = containerRef.current?.contains(event.target as Node) ? null : event.pointerId;
    };
    const finishOutsidePress = (event: PointerEvent) => {
      if (outsidePointerRef.current !== event.pointerId) return;
      outsidePointerRef.current = null;
      clearCloseTimer();
      // Let the outside button receive its click before the list changes the layout.
      outsideCloseTimerRef.current = window.setTimeout(() => {
        outsideCloseTimerRef.current = undefined;
        if (!containerRef.current?.contains(document.activeElement)) setFocused(false);
      }, 0);
    };
    document.addEventListener('pointerdown', beginOutsidePress, true);
    document.addEventListener('pointerup', finishOutsidePress, true);
    document.addEventListener('pointercancel', finishOutsidePress, true);
    return () => {
      clearCloseTimer();
      outsidePointerRef.current = null;
      document.removeEventListener('pointerdown', beginOutsidePress, true);
      document.removeEventListener('pointerup', finishOutsidePress, true);
      document.removeEventListener('pointercancel', finishOutsidePress, true);
    };
  }, []);

  function choose(place: Birthplace) {
    ++requestRef.current;
    setFocused(false);
    setPlaces([]);
    setActiveIndex(-1);
    onSelect(place);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setFocused(false);
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !selected && searchReady) {
      event.preventDefault();
      setFocused(true);
      if (places.length) setActiveIndex(index => event.key === 'ArrowDown'
        ? (index + 1) % places.length
        : index <= 0 ? places.length - 1 : index - 1);
    } else if (event.key === 'Enter' && !selected) {
      event.preventDefault();
      if (open && places.length) choose(places[activeIndex >= 0 ? activeIndex : 0]);
      else setFocused(true);
    }
  }

  const status = !query ? 'Search a city, town or village, then choose a result.'
    : selected ? 'Birth place confirmed.'
      : !searchReady ? 'Type at least 2 letters to search.'
        : !open ? 'Choose a suggestion to confirm your birth place.'
          : state === 'loading' ? 'Searching places…'
            : state === 'error' ? 'Place search is unavailable. Please try again.'
              : state === 'success' && !places.length ? 'No places found. Try a nearby town or a different spelling.'
                : state === 'success' ? `${places.length} ${places.length === 1 ? 'place' : 'places'} found. Choose your birth place.`
                  : 'Searching places…';

  return <div className={`form-field birthplace-search${selected ? ' birthplace-confirmed' : ''}`} ref={containerRef}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && outsidePointerRef.current === null) setFocused(false); }}>
    <label htmlFor={inputId}>Place of birth</label>
    <input id={inputId} type="text" value={value} maxLength={120} required autoComplete="off" spellCheck={false}
      placeholder="Search your birth place"
      role="combobox" aria-autocomplete="list" aria-expanded={open && places.length > 0} aria-controls={listId}
      aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      aria-describedby={statusId} aria-busy={open && state === 'loading'}
      onFocus={() => setFocused(true)} onKeyDown={handleKeyDown}
      onChange={event => { ++requestRef.current; setPlaces([]); setActiveIndex(-1); setFocused(true); onQueryChange(event.target.value); }} />
    <div className={`birthplace-search-status ${state === 'error' && open ? 'birthplace-search-error' : ''}`} id={statusId} role="status" aria-live="polite">
      {selected && <span className="birthplace-check" aria-hidden="true">✓</span>}<span>{status}</span>
      {open && state === 'error' && <button type="button" className="birthplace-search-retry" onClick={() => setRetry(value => value + 1)}>Try again</button>}
    </div>
    {open && places.length > 0 && <ul className="birthplace-results" id={listId} role="listbox" aria-label="Birth place suggestions" ref={listRef}>
      {places.map((place, index) => <li key={place.id} id={`${listId}-${index}`} role="option" aria-selected={activeIndex === index}>
        <button type="button" tabIndex={-1} className={activeIndex === index ? 'birthplace-result active' : 'birthplace-result'}
          onPointerDown={event => event.preventDefault()} onClick={() => choose(place)} onMouseEnter={() => setActiveIndex(index)}>
          <span>{place.label}</span><small>{place.timeZone}</small>
        </button>
      </li>)}
    </ul>}
    <small className="birthplace-attribution"><a href={attribution.url} target="_blank" rel="noreferrer">{attribution.label}</a>.</small>
  </div>;
}
