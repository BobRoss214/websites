#!/usr/bin/env python3
"""Compute ESA WorldCover 2021 (v200) land-cover shares for NC/SC counties,
places and ZCTAs.

Idempotent: tiles already present under data/raw/worldcover/ are not
re-downloaded; tiles that return 404 (ocean) get a `.missing` marker.
Output: data/raw/landcover.json

Usage: python3 scripts/data/landcover.py
"""
import datetime as dt
import json
import os
import subprocess
import sys
import time

import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.windows import Window
from shapely.geometry import shape, box

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw")
TILE_DIR = os.path.join(RAW, "worldcover")
OUT = os.path.join(RAW, "landcover.json")
BASE_URL = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"

DECIMATE = 10  # 10 m -> ~100 m
TILE_DEG = 3

CLASSES = {
    10: "tree", 20: "shrub", 30: "grass", 40: "crop", 50: "built",
    60: "bare", 70: "snow", 80: "water", 90: "wetland", 95: "mangrove", 100: "moss",
}

INPUTS = [
    ("c", os.path.join(RAW, "counties.geojson"), ("GEOID",)),
    ("p", os.path.join(RAW, "places.geojson"), ("GEOID",)),
    ("z", os.path.join(RAW, "zctas.geojson"), ("ZCTA5CE20", "GEOID20")),
]


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def tile_name(lat0, lon0):
    ns = "N" if lat0 >= 0 else "S"
    ew = "E" if lon0 >= 0 else "W"
    return f"{ns}{abs(lat0):02d}{ew}{abs(lon0):03d}"


def tiles_for_bounds(minx, miny, maxx, maxy):
    """3x3 degree tiles (named by SW corner) intersecting a bbox."""
    out = []
    lat = int(np.floor(miny / TILE_DEG)) * TILE_DEG
    while lat < maxy:
        lon = int(np.floor(minx / TILE_DEG)) * TILE_DEG
        while lon < maxx:
            out.append((lat, lon))
            lon += TILE_DEG
        lat += TILE_DEG
    return out


def ensure_tile(tile):
    path = os.path.join(TILE_DIR, f"ESA_WorldCover_10m_2021_v200_{tile}_Map.tif")
    missing = path + ".missing"
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    if os.path.exists(missing):
        return None
    url = BASE_URL.format(tile=tile)
    tmp = path + ".part"
    for attempt in range(4):
        log(f"  downloading {tile} (attempt {attempt + 1})")
        r = subprocess.run(
            ["curl", "-sS", "-L", "--fail-with-body", "--retry", "2", "-C", "-",
             "-o", tmp, "-w", "%{http_code}", url],
            capture_output=True, text=True,
        )
        code = r.stdout.strip()[-3:]
        if code == "404":
            log(f"  {tile}: 404 (no tile, likely ocean)")
            open(missing, "w").write(url + "\n")
            if os.path.exists(tmp):
                os.remove(tmp)
            return None
        if r.returncode == 0 and code in ("200", "206"):
            os.replace(tmp, path)
            log(f"  {tile}: {os.path.getsize(path) / 1e6:.1f} MB")
            return path
        if r.returncode == 0 and code == "416":  # already complete .part
            os.replace(tmp, path)
            return path
        log(f"  {tile}: curl rc={r.returncode} http={code} {r.stderr.strip()[:200]}")
        time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"failed to download {tile}")


def load_features():
    feats = []  # (id, shapely geom, geojson geom)
    for prefix, path, keys in INPUTS:
        with open(path) as f:
            gj = json.load(f)
        n = 0
        for ft in gj["features"]:
            props = ft["properties"]
            code = None
            for k in keys:
                if props.get(k):
                    code = str(props[k])
                    break
            if code is None:
                log(f"  WARNING: feature without id in {path}: {props}")
                continue
            geom = shape(ft["geometry"])
            if not geom.is_valid:
                geom = geom.buffer(0)
            feats.append((prefix + code, geom, ft["geometry"]))
            n += 1
        log(f"loaded {n} features from {os.path.basename(path)}")
    return feats


def process_tile(tile, path, feats, counts):
    with rasterio.open(path) as src:
        h = src.height // DECIMATE
        w = src.width // DECIMATE
        t0 = time.time()
        arr = src.read(1, out_shape=(h, w), resampling=rasterio.enums.Resampling.nearest)
        tr = src.transform * src.transform.scale(src.width / w, src.height / h)
        bounds = src.bounds
        log(f"  read {tile} decimated to {w}x{h} in {time.time() - t0:.1f}s")
    tile_box = box(*bounds)
    px = tr.a  # pixel width (deg), positive
    py = -tr.e  # pixel height (deg), positive
    n_hit = 0
    for fid, geom, gj in feats:
        if not geom.intersects(tile_box):
            continue
        minx, miny, maxx, maxy = geom.bounds
        # pixel window of the polygon bbox, clipped to the tile
        c0 = max(0, int(np.floor((minx - bounds.left) / px)))
        c1 = min(w, int(np.ceil((maxx - bounds.left) / px)) + 1)
        r0 = max(0, int(np.floor((bounds.top - maxy) / py)))
        r1 = min(h, int(np.ceil((bounds.top - miny) / py)) + 1)
        if c1 <= c0 or r1 <= r0:
            continue
        sub_tr = tr * tr.translation(c0, r0)
        mask = rasterize(
            [(gj, 1)], out_shape=(r1 - r0, c1 - c0), transform=sub_tr,
            fill=0, dtype="uint8", all_touched=False,
        ).astype(bool)
        if not mask.any():
            continue
        vals = arr[r0:r1, c0:c1][mask]
        bc = np.bincount(vals, minlength=256)
        counts[fid] = counts.get(fid, np.zeros(256, dtype=np.int64)) + bc
        n_hit += 1
    log(f"  {tile}: {n_hit} polygons with pixels")
    del arr


def main():
    t_start = time.time()
    os.makedirs(TILE_DIR, exist_ok=True)
    feats = load_features()

    # union bbox -> candidate tiles
    allb = np.array([g.bounds for _, g, _ in feats])
    minx, miny = allb[:, 0].min(), allb[:, 1].min()
    maxx, maxy = allb[:, 2].max(), allb[:, 3].max()
    log(f"bbox: {minx:.3f} {miny:.3f} {maxx:.3f} {maxy:.3f}")
    tiles = [tile_name(la, lo) for la, lo in tiles_for_bounds(minx, miny, maxx, maxy)]
    log(f"candidate tiles: {tiles}")

    counts = {}
    used, missing = [], []
    for tile in tiles:
        path = ensure_tile(tile)
        if path is None:
            missing.append(tile)
            continue
        used.append(tile)
        process_tile(tile, path, feats, counts)

    areas = {}
    class_codes = list(CLASSES.keys())
    for fid, _, _ in feats:
        bc = counts.get(fid)
        if bc is None:
            areas[fid] = {"pixels": 0}
            continue
        total = int(sum(int(bc[c]) for c in class_codes))
        if total == 0:
            areas[fid] = {"pixels": 0}
            continue
        rec = {}
        for c in class_codes:
            rec[CLASSES[c]] = round(int(bc[c]) / total, 4)
        rec["pixels"] = total
        areas[fid] = rec

    method = (
        f"ESA WorldCover 2021 v200 10 m COG tiles {', '.join(used)}"
        + (f" (no tile exists for {', '.join(missing)})" if missing else "")
        + f", read with rasterio out_shape at 1/{DECIMATE} resolution (nearest-neighbour, served from the COG internal overviews; ~100 m pixels, "
        f"3600x3600 per 3-degree tile). Each polygon (WGS84, pixel-centre-in-polygon rasterization) "
        f"was burned onto the decimated grid of every tile it intersects; class pixel counts were summed "
        f"across tiles. Shares are class pixels / all classified pixels (classes 10-100, including water); "
        f"'pixels' is that classified total. Unclassified (0) pixels are ignored. Polygons too small to "
        f"contain a pixel centre get pixels: 0 with no shares."
    )
    out = {
        "meta": {
            "source": "ESA WorldCover 2021 v200 (10 m), © ESA WorldCover project 2021 / Contains modified "
                      "Copernicus Sentinel data (2021) processed by ESA WorldCover consortium, CC BY 4.0",
            "url": "https://esa-worldcover.org/",
            "method": method,
            "computedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "areas": areas,
    }
    tmp = OUT + ".tmp"
    with open(tmp, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    os.replace(tmp, OUT)

    # report
    for kind in "cpz":
        ids = [k for k in areas if k[0] == kind]
        nz = sum(1 for k in ids if areas[k]["pixels"] > 0)
        log(f"{kind}: {nz}/{len(ids)} ids with pixels > 0")
    for fid in ("c37183", "c37095", "c37119"):
        log(fid, {k: v for k, v in areas.get(fid, {}).items() if k == "pixels" or v >= 0.005})
    log(f"wrote {OUT} ({os.path.getsize(OUT) / 1e3:.0f} kB) in {time.time() - t_start:.0f}s")


if __name__ == "__main__":
    main()
