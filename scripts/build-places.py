#!/usr/bin/env python3
"""Build the birth-place search index from the pinned GeoNames snapshot."""

import argparse
from collections import defaultdict
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import sqlite3
import unicodedata


INPUT_SHA256 = {
    "cities": "1523be8c6f083eeee946e1c27a0916474d0f0de4361a15104fcc70218bc4d55e",
    "countries": "41c01b0843461207e71ba7530434738a4e7a7c84efd72aba03f547f450ca1ba4",
    "regions": "d86e14473219e92e85d7360da93d7ac36892e12cf6acd08d8e301a96e4550aec",
    "region_source": "2dd022b636b2edf3226e4d52065d9f2f10c1373e1865f50e91518510a2ead9a3",
}


def normalize(value):
    text = unicodedata.normalize("NFKD", value)
    text = "".join(char for char in text if not unicodedata.category(char).startswith("M"))
    text = text.lower()
    text = "".join(char if unicodedata.category(char)[0] in "LN" else " " for char in text)
    return " ".join(text.split())


def checked_bytes(path, kind):
    raw = path.read_bytes()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != INPUT_SHA256[kind]:
        raise ValueError(f"{kind} source checksum differs: {actual}")
    return raw


def make_label(name, region, country):
    parts = []
    seen = set()
    for part in (name, region, country):
        key = normalize(part)
        if key and key not in seen:
            parts.append(part)
            seen.add(key)
    label = ", ".join(parts)
    if len(label) <= 120:
        return label
    shortened = label[:119].rsplit(" ", 1)[0]
    return (shortened or label[:119]).rstrip(", ") + "…"


def derive_regions(raw, cities):
    candidates = defaultdict(set)
    for row in csv.DictReader(io.StringIO(raw.decode("utf-8"))):
        city = cities.get(row["geonameid"])
        region = row["subcountry"].strip()
        if city and region:
            candidates[f"{city['countrycode']}.{city['admin1code']}"].add(region)
    regions = {key: next(iter(names)) for key, names in candidates.items() if len(names) == 1}
    serialized = json.dumps(regions, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if hashlib.sha256(serialized).hexdigest() != INPUT_SHA256["regions"]:
        raise ValueError("Derived region names differ from the pinned source")
    return regions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cities", type=Path, required=True)
    parser.add_argument("--countries", type=Path, required=True)
    parser.add_argument("--region-source", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "server/data/places.sqlite")
    args = parser.parse_args()

    cities = json.loads(checked_bytes(args.cities, "cities"))
    countries = json.loads(checked_bytes(args.countries, "countries"))
    regions = derive_regions(checked_bytes(args.region_source, "region_source"), cities)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".building.sqlite")
    temporary.unlink(missing_ok=True)

    db = sqlite3.connect(temporary)
    db.executescript("""
        PRAGMA journal_mode = OFF;
        PRAGMA synchronous = OFF;
        PRAGMA temp_store = MEMORY;
        PRAGMA user_version = 1;
        CREATE TABLE places (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            label TEXT NOT NULL,
            country TEXT NOT NULL,
            country_code TEXT NOT NULL,
            region TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            time_zone TEXT NOT NULL,
            population INTEGER NOT NULL,
            search_name TEXT NOT NULL
        );
        CREATE VIRTUAL TABLE place_search USING fts5(
            name, aliases, country, region,
            content='', tokenize='unicode61 remove_diacritics 2'
        );
    """)

    place_rows = []
    search_rows = []
    alias_count = 0
    region_count = 0
    country_codes = set()
    time_zones = set()
    for key in sorted(cities, key=int):
        city = cities[key]
        country_code = city["countrycode"]
        country = countries[country_code]["name"]
        region = regions.get(f"{country_code}.{city['admin1code']}", "")
        name = city["name"].strip()
        latitude, longitude = float(city["latitude"]), float(city["longitude"])
        time_zone = city["timezone"]
        if not name or not time_zone or not math.isfinite(latitude) or not math.isfinite(longitude):
            raise ValueError(f"Incomplete place: {key}")
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            raise ValueError(f"Invalid coordinates: {key}")
        search_name = normalize(name)
        aliases = sorted({normalize(alias) for alias in city.get("alternatenames", [])} - {"", search_name})
        alias_count += len(aliases)
        region_count += bool(region)
        country_codes.add(country_code)
        time_zones.add(time_zone)
        place_rows.append((
            int(key), name, make_label(name, region, country), country, country_code,
            region, latitude, longitude, time_zone, int(city["population"]), search_name,
        ))
        search_rows.append((int(key), search_name, " ".join(aliases), normalize(country), normalize(region)))

    with db:
        db.executemany("INSERT INTO places VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", place_rows)
        db.executemany("INSERT INTO place_search(rowid, name, aliases, country, region) VALUES (?, ?, ?, ?, ?)", search_rows)
        db.execute("INSERT INTO place_search(place_search) VALUES ('optimize')")
    db.execute("VACUUM")
    if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise ValueError("SQLite integrity check failed")
    db.execute("INSERT INTO place_search(place_search) VALUES ('integrity-check')")
    db.close()
    temporary.replace(args.output)

    database_bytes = args.output.read_bytes()
    metadata = {
        "schemaVersion": 1,
        "placeCount": len(place_rows),
        "countryCount": len(country_codes),
        "timeZoneCount": len(time_zones),
        "regionNameCount": len(regions),
        "placesWithRegion": region_count,
        "normalizedAlternateNameCount": alias_count,
        "databaseBytes": len(database_bytes),
        "databaseSha256": hashlib.sha256(database_bytes).hexdigest(),
        "license": "CC BY 4.0",
        "attribution": "GeoNames geographical database, https://www.geonames.org/",
        "sources": {
            "cities": {
                "snapshot": "geonamescache 3.0.2 cities500.json",
                "url": "https://pypi.org/project/geonamescache/3.0.2/",
                "wheelSha256": "b830e8942f2d58c7e68782dcf4dff2ffe8c4104a35ee881ed1ad4023cefcdba4",
                "citiesSha256": INPUT_SHA256["cities"],
                "countriesSha256": INPUT_SHA256["countries"],
            },
            "regions": {
                "url": "https://github.com/datasets/world-cities",
                "commit": "9aed79dc1401599172fe61a8b9a1bdea414acb49",
                "csvSha256": INPUT_SHA256["region_source"],
                "derivedRegionsSha256": INPUT_SHA256["regions"],
            },
        },
        "changes": "Normalized alternate names and built a SQLite FTS5 index. Region names were joined by GeoNames id and extended to a country/admin1 code only where the source names agreed.",
        "coverage": "Populated places in the GeoNames cities500 snapshot. This is a city and town search, not a street-address directory.",
    }
    metadata_path = args.output.with_name("places-metadata.json")
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), **{key: metadata[key] for key in ("placeCount", "databaseBytes", "databaseSha256")}}))


if __name__ == "__main__":
    main()
