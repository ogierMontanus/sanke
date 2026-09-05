#!/usr/bin/env python3
"""Convert the Google My Maps KMZ export into the JSON the website consumes.

    python3 scripts/convert-kmz.py

Reads   legacy/sankesteder odense.kmz   (the authoritative source dataset)
Writes  data/locations.json             (a build artifact — do not edit by hand)

The KMZ is a zip containing doc.kml plus the marker images. In the KML:

  * each <Folder> is a fruit category, named by the map's author;
  * each <Placemark> is one location, styled with an <IconStyle> that points at
    one of the images/icon-N.png files;
  * the "The Big Apple" folder holds three decorative polygons that trace an
    apple over the city rather than marking fruit.

Only the standard library is used, so the script runs anywhere Python does.
"""

import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

KML_NS = "http://www.opengis.net/kml/2.2"
NS = {"k": KML_NS}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KMZ_PATH = os.path.join(ROOT, "legacy", "sankesteder odense.kmz")
OUT_PATH = os.path.join(ROOT, "data", "locations.json")

# The map's author picked a Google My Maps icon per category. Those icons are
# emoji artwork, so each one maps back to the emoji it was drawn from — that is
# what the site uses as the marker. Verified by opening each PNG in the KMZ:
#
#   icon-1 red apple   icon-2 chestnut  icon-3 pear   icon-4 cherries
#   icon-5 blossom     icon-6 leaf      icon-7 berries
#
ICON_EMOJI = {
    "images/icon-1.png": "🍎",
    "images/icon-2.png": "🌰",
    "images/icon-3.png": "🍐",
    "images/icon-4.png": "🍒",
    "images/icon-5.png": "🌸",
    "images/icon-6.png": "🌿",
    "images/icon-7.png": "🫐",
}

# icon-6 (the leaf) is shared by two folders, which would give them identical
# markers on the map. Ramsløg keeps the leaf; the catch-all category gets the
# seedling so the two can be told apart. This is the only place where the
# site's emoji differs from the source icon.
EMOJI_OVERRIDE = {
    "Andet frugt og grønt / other edible plants": "🌱",
}

# Folder names carry a bilingual suffix that is noise in a Danish interface.
SHORT_NAME = {
    "Hyldeblomst / Elderberry": "Hyldeblomst",
    "Andet frugt og grønt / other edible plants": "Andet spiseligt",
    "Ramsløg / Wild garlic": "Ramsløg",
    "Bær / berries": "Bær",
}

DECORATIVE_FOLDER = "The Big Apple"

# KML colours are aabbggrr; the style id carries the plain rrggbb.
STYLE_COLOUR = re.compile(r"^(?:poly|line)-([0-9A-Fa-f]{6})")


class ConversionError(Exception):
    pass


def text(node, path):
    """Text of a child element, whitespace-collapsed, or '' when absent."""
    found = node.findtext(path, namespaces=NS)
    return " ".join(found.split()) if found else ""


def slug(value):
    out = value.lower()
    for a, b in (("æ", "ae"), ("ø", "oe"), ("å", "aa")):
        out = out.replace(a, b)
    out = re.sub(r"[^a-z0-9]+", "-", out).strip("-")
    return out or "kategori"


def parse_coordinates(raw):
    """KML coordinate lists are 'lon,lat[,alt]' tuples separated by whitespace."""
    points = []
    for chunk in (raw or "").split():
        parts = chunk.split(",")
        if len(parts) < 2:
            continue
        try:
            lon, lat = float(parts[0]), float(parts[1])
        except ValueError:
            continue
        # Anything outside Denmark means the tuple was misread — drop it rather
        # than put a marker in the sea.
        if not (7.0 <= lon <= 16.0 and 54.0 <= lat <= 58.0):
            continue
        points.append([round(lat, 7), round(lon, 7)])
    return points


def icon_map(document):
    """Style id (without the -normal/-highlight suffix) -> icon href."""
    icons = {}
    for style in document.findall("k:Style", NS):
        href = style.findtext(".//k:Icon/k:href", namespaces=NS)
        if href:
            icons[style.get("id", "")] = href
    return icons


def resolve_icon(style_url, icons):
    key = (style_url or "").lstrip("#")
    for candidate in (key + "-normal", key):
        if candidate in icons:
            return icons[candidate]
    return None


def style_colour(style_url, fallback):
    match = STYLE_COLOUR.match((style_url or "").lstrip("#"))
    return "#" + match.group(1).upper() if match else fallback


def polygon_is_filled(document, style_url):
    """A PolyStyle colour of 00xxxxxx means outline only — the apple's body."""
    key = (style_url or "").lstrip("#")
    for candidate in (key + "-normal", key):
        for style in document.findall("k:Style", NS):
            if style.get("id") != candidate:
                continue
            colour = style.findtext(".//k:PolyStyle/k:color", namespaces=NS) or ""
            if len(colour) == 8:
                return colour[:2].lower() != "00"
    return True


def read_kml(kmz_path):
    if not os.path.exists(kmz_path):
        raise ConversionError("KMZ not found: %s" % kmz_path)
    try:
        with zipfile.ZipFile(kmz_path) as archive:
            names = [n for n in archive.namelist() if n.lower().endswith(".kml")]
            if not names:
                raise ConversionError("no .kml inside %s" % kmz_path)
            return archive.read(names[0])
    except zipfile.BadZipFile as exc:
        raise ConversionError("%s is not a readable KMZ: %s" % (kmz_path, exc))


def convert():
    data = read_kml(KMZ_PATH)
    try:
        document = ET.fromstring(data).find("k:Document", NS)
    except ET.ParseError as exc:
        raise ConversionError("malformed KML: %s" % exc)
    if document is None:
        raise ConversionError("KML has no <Document>")

    icons = icon_map(document)
    categories, locations, decorations = [], [], []
    skipped = []
    next_id = 1

    for folder in document.findall("k:Folder", NS):
        folder_name = text(folder, "k:name")
        placemarks = folder.findall("k:Placemark", NS)

        if folder_name == DECORATIVE_FOLDER:
            for placemark in placemarks:
                ring = placemark.findtext(
                    ".//k:Polygon//k:LinearRing/k:coordinates", namespaces=NS)
                points = parse_coordinates(ring)
                if len(points) < 3:
                    skipped.append((folder_name, text(placemark, "k:name"), "polygon uden punkter"))
                    continue
                style = text(placemark, "k:styleUrl")
                decorations.append({
                    "navn": text(placemark, "k:name"),
                    "beskrivelse": text(placemark, "k:description"),
                    "farve": style_colour(style, "#558B2F"),
                    "fyld": polygon_is_filled(document, style),
                    "punkter": points,
                })
            continue

        category_id = slug(SHORT_NAME.get(folder_name, folder_name))
        emoji = EMOJI_OVERRIDE.get(folder_name)
        count = 0

        for placemark in placemarks:
            name = text(placemark, "k:name")
            style = text(placemark, "k:styleUrl")

            if emoji is None:
                icon = resolve_icon(style, icons)
                if icon in ICON_EMOJI:
                    emoji = ICON_EMOJI[icon]

            point = placemark.find("k:Point", NS)
            line = placemark.find("k:LineString", NS)

            if point is not None:
                coords = parse_coordinates(point.findtext("k:coordinates", namespaces=NS))
                geometry, shape = ("punkt", None)
            elif line is not None:
                coords = parse_coordinates(line.findtext("k:coordinates", namespaces=NS))
                geometry, shape = ("linje", coords)
            else:
                skipped.append((folder_name, name, "ukendt geometri"))
                continue

            if not coords:
                skipped.append((folder_name, name, "ingen brugbare koordinater"))
                continue

            # A line is placed in the list by its midpoint, so distance sorting
            # and the popup work the same way for both shapes.
            mid = coords[len(coords) // 2] if geometry == "linje" else coords[0]

            entry = {
                "id": "p%03d" % next_id,
                "navn": name or SHORT_NAME.get(folder_name, folder_name),
                "kategori": category_id,
                "lat": mid[0],
                "lon": mid[1],
                "geometri": geometry,
            }
            beskrivelse = text(placemark, "k:description")
            if beskrivelse:
                entry["beskrivelse"] = beskrivelse
            if shape:
                entry["linje"] = shape
            locations.append(entry)
            next_id += 1
            count += 1

        if count:
            categories.append({
                "id": category_id,
                "navn": SHORT_NAME.get(folder_name, folder_name),
                "kildenavn": folder_name,
                "emoji": emoji or "🌿",
                "antal": count,
            })

    if not locations:
        raise ConversionError("no usable placemarks found — is the KMZ the right export?")

    categories.sort(key=lambda c: -c["antal"])

    output = {
        "kilde": {
            "navn": text(document, "k:name"),
            "beskrivelse": text(document, "k:description"),
            "fil": os.path.relpath(KMZ_PATH, ROOT).replace(os.sep, "/"),
            "kort": "https://www.google.com/maps/d/u/0/viewer?hl=da&mid=1_CKAv9kG5AE8ovzdb8dSOD524jkJopmK",
            "genereret_af": "scripts/convert-kmz.py",
        },
        "kategorier": categories,
        "steder": locations,
        "dekoration": decorations,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(output, handle, ensure_ascii=False, indent=1, sort_keys=False)
        handle.write("\n")

    print("%d steder i %d kategorier -> %s"
          % (len(locations), len(categories), os.path.relpath(OUT_PATH, ROOT)))
    print("%d dekorative polygoner (The Big Apple)" % len(decorations))
    for folder_name, name, why in skipped:
        print("  sprunget over [%s] %s: %s" % (folder_name, name or "(uden navn)", why),
              file=sys.stderr)


if __name__ == "__main__":
    try:
        convert()
    except ConversionError as exc:
        print("Konvertering mislykkedes: %s" % exc, file=sys.stderr)
        sys.exit(1)
