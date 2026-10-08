import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export const PLACE_ATTRIBUTION = Object.freeze({
  label: 'Place names from GeoNames',
  url: 'https://www.geonames.org/',
});

let database;
let search;

function searchStatement() {
  if (search) return search;
  database = new DatabaseSync(fileURLToPath(new URL('./data/places.sqlite', import.meta.url)), {
    readOnly: true,
    allowExtension: false,
  });
  database.exec('PRAGMA query_only = ON; PRAGMA cache_size = -2048; PRAGMA temp_store = MEMORY;');
  search = database.prepare(`
    SELECT p.id, p.name, p.label, p.country, p.region, p.latitude, p.longitude,
           p.time_zone AS timeZone
    FROM place_search
    JOIN places AS p ON p.id = place_search.rowid
    WHERE place_search MATCH ?
    ORDER BY CASE
      WHEN p.search_name = ? THEN 0
      WHEN instr(p.search_name, ?) = 1 THEN 1
      WHEN instr(p.search_name, ?) = 1 THEN 2
      ELSE 3
    END, p.population DESC, p.name, p.id
    LIMIT 8
  `);
  return search;
}

export function searchPlaces(query) {
  if (typeof query !== 'string' || query.length > 120) {
    throw Object.assign(new Error('Enter a place name with at most 120 characters.'), { status: 400 });
  }
  if ((query.match(/\p{L}/gu) || []).length < 2) return [];
  // Match the database's normalization and quote each token as literal FTS text.
  const normalized = query.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const tokens = normalized.split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const match = tokens.map(token => `"${token}"*`).join(' AND ');
  return searchStatement().all(match, normalized, normalized, tokens[0]).map(place => ({
    ...place,
    id: String(place.id),
  }));
}
