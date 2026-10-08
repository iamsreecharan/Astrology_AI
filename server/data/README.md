# Birth-place search data

`places.sqlite` contains 234,908 cities, towns, and other populated places from GeoNames, covering 246 country codes. It includes coordinates, time zones, and alternate names in several languages. Small settlements absent from this snapshot can still be entered with their coordinates and time zone in the app.

The data comes from the `cities500.json` and `countries.json` files in [geonamescache 3.0.2](https://pypi.org/project/geonamescache/3.0.2/). First-level region names come from the [world-cities dataset](https://github.com/datasets/world-cities/tree/9aed79dc1401599172fe61a8b9a1bdea414acb49). We joined those names to the same GeoNames identifiers, then used a region name for other places with the same country and administrative code only when the source names agreed. Conflicting or missing region names stay blank.

GeoNames data is licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Credit: [GeoNames geographical database](https://www.geonames.org/). We normalized alternate names for search, added country and region labels, and converted the data into a SQLite FTS5 index. `places-metadata.json` records the source checksums, counts, and database checksum. The source snapshot is bundled so autocomplete needs no API key or external request.

## Rebuilding

Python 3 and SQLite with FTS5 are needed to rebuild the file. The app itself uses Node's built-in SQLite reader. Rebuilding is optional; deployment uses the checked-in database.

Download the pinned wheel and region CSV, then extract the wheel:

```bash
mkdir -p /tmp/astral-places
python3 -m pip download --no-deps geonamescache==3.0.2 -d /tmp/astral-places
python3 -m zipfile -e /tmp/astral-places/geonamescache-3.0.2-py3-none-any.whl /tmp/astral-places/source
curl -fL https://raw.githubusercontent.com/datasets/world-cities/9aed79dc1401599172fe61a8b9a1bdea414acb49/data/world-cities.csv -o /tmp/astral-places/world-cities.csv
```

Run this from the repository root:

```bash
python3 scripts/build-places.py \
  --cities /tmp/astral-places/source/geonamescache/data/cities500.json \
  --countries /tmp/astral-places/source/geonamescache/data/countries.json \
  --region-source /tmp/astral-places/world-cities.csv
```

The generator checks each input against its pinned SHA-256, derives the region map, and checks both SQLite and FTS integrity before replacing the database. An `--output` path can be supplied to build elsewhere.

Search text uses Unicode NFKD normalization, removes combining marks, keeps letters and numbers, and folds case. The city, alternate-name, country, and region fields are indexed without storing duplicate content. Place facts remain in the `places` table, keyed by GeoNames id.
