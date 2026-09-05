# Frugt i Odense og omegn

Et kort over frugttræer og spiselige planter på offentligt tilgængelige
arealer i Odense og omegn. Statisk website — HTML, CSS, lidt JavaScript og
Leaflet. Ingen backend, ingen database, ingen brugerkonti.

Hvis Fyn er Danmarks have, er Odense *The Big Apple*. Ringvejens æbleform er
tegnet ind på kortet.

## 1. Hvad projektet er

100 steder fordelt på otte kategorier — æbler, pærer, kirsebær,
hasselnødder, hyldeblomst, bær, ramsløg og et par enkeltstående ting.
Brugeren åbner kortet, filtrerer efter frugt, kan slå sin egen placering til
og se, hvad der er tættest på.

Kortet er ikke et officielt register og er på ingen måde dækkende. Se
**Om**-siden på websitet.

## 2. Hvor kildedataene ligger

    legacy/sankesteder odense.kmz

Det er en eksport af et Google My Maps-kort og er projektets **autoritative
datakilde**. Rediger kortet i Google My Maps, eksportér en ny KMZ, læg den
samme sted — rør ikke ved den genererede JSON.

Den oprindelige kortvisning ligger i `legacy/legacy_website.txt`.

## 3. Fra KMZ til JSON

    python3 scripts/convert-kmz.py

Kun standardbiblioteket, ingen pakker at installere. Scriptet pakker KMZ'en
ud, læser `doc.kml` og skriver `data/locations.json`:

| I KML'en | Bliver til |
| --- | --- |
| `<Folder>` | en frugtkategori med navn og antal |
| `<Placemark>` med `<Point>` | et sted |
| `<Placemark>` med `<LineString>` | en strækning (fx Æblealleen), tegnet som linje |
| folderen `The Big Apple` | de tre polygoner der tegner æblet |
| `<IconStyle>` → `images/icon-N.png` | kortets emoji for kategorien |

`data/locations.json` er et **build-artefakt**. Det ligger i git, så sitet kan
serveres direkte fra GitHub Pages, men det skrives ikke i hånden.

### Emojierne

Kortets forfatter har valgt et Google-ikon pr. kategori, og de ikoner *er*
emoji-tegninger. Scriptet oversætter dem tilbage til den emoji, de er tegnet
efter: 🍎 🌰 🍐 🍒 🌸 🌿 🫐.

Én undtagelse: bladikonet bruges af både *Ramsløg* og *Andet frugt og grønt*,
hvilket ville give to kategorier præcis samme markør. Ramsløg beholder 🌿, og
den anden får 🌱. Det står i `EMOJI_OVERRIDE` øverst i scriptet — det er det
eneste sted, sitets emoji afviger fra kilden.

## 4. Kør lokalt

Sitet henter sine data med `fetch`, så det skal serveres over http. At åbne
`index.html` direkte fra filsystemet virker ikke.

    python3 -m http.server 8000
    # http://localhost:8000

## 5. GitHub Pages

`index.html` ligger i roden, så der skal ingen build eller workflow til:

**Settings → Pages → Build and deployment → Deploy from a branch**, vælg
branchen og mappen `/ (root)`. Hvert push udgiver sig selv.

## 6. Sådan opdateres kortet

    rediger kortet i Google My Maps
        ↓
    eksportér KMZ til legacy/
        ↓
    python3 scripts/convert-kmz.py
        ↓
    commit data/locations.json + KMZ
        ↓
    push — Pages udgiver automatisk

Kommer der en ny kategori i kortet, dukker den af sig selv op i filteret og
på Frugter-siden. Bruger den et ikon, scriptet ikke kender, falder den
tilbage på 🌿, og så skal `ICON_EMOJI` i scriptet have en linje mere.

## 7. Placering

Kortet kan vise brugerens egen position med **◎ Min placering**, og følge den
undervejs med **◎ Følg mig**, som skal slås til bevidst og kan slås fra igen.

Det bruger browserens indbyggede Geolocation API. Positionen bliver i
browseren: den tegner prikken med nøjagtighedscirkel og regner
fugleflugtsafstande ud til brugerens sortering "Nærmest mig". Den bliver
ikke sendt nogen steder hen, ikke gemt og ikke logget. Der er ingen server at
sende den til.

Afviser eller fejler placeringen, siger sitet det på almindeligt dansk og
fungerer videre uden. Der bliver aldrig vist en placeringsmarkør, før der
rent faktisk er givet lov.

## 8. Eksterne biblioteker

Kun [Leaflet](https://leafletjs.com/) 1.9.4, hentet fra cdnjs med
SRI-integritetstjek, og kortfliser fra
[OpenStreetMap](https://www.openstreetmap.org/copyright). Kan Leaflet ikke
hentes, skjules kortet, og listen over steder virker stadig.

Ingen npm, ingen framework, ingen tracking, ingen cookies.

## Filer

    index.html              siden — kort, frugter, guides, om
    assets/app.js           kort, filter, liste, placering
    assets/style.css        stilark, mobilførst
    data/locations.json     genereret data (rør den ikke)
    scripts/convert-kmz.py  KMZ → JSON
    legacy/                 den oprindelige KMZ og link til det gamle kort
    instructions.md         kravene sitet er bygget efter
