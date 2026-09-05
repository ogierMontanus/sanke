# Website Instructions: Frugt i Odense og omegn

## 1. Overall task

Build a simple, static website called **"Frugt i Odense og omegn"**, deployed via **GitHub Pages**.

The website is a map-based guide to fruit and edible plants that can be harvested on public areas in Odense and the surrounding area.

Keep the technology stack simple. Minimize legacy code, unnecessary dependencies, external services, APIs, databases, and backend infrastructure.

The site should work well on both desktop and mobile, with particular attention to mobile use while walking around and foraging.

---

## 2. Primary data source

The principal content of the website is a custom **Google My Maps** map exported in **KMZ format**. See folder legacy.

The KMZ contains the points of interest (POIs).

Each POI represents a location where a particular fruit or edible plant can potentially be harvested.

Treat the KMZ as the **source dataset**.
The legacy website lives at https://www.google.com/maps/d/u/0/viewer?hl=da&mid=1_CKAv9kG5AE8ovzdb8dSOD524jkJopmK&ll=55.394402063321635%2C10.411179531365633&z=13. Refer to get a basic idea of the older UI.
Do not manually recreate the POIs in the website code.

The build process should:

1. Read the KMZ file.
2. Extract the KML contained within it.
3. Parse the KML.
4. Convert the relevant POI information into a simple web-friendly data format, preferably JSON.
5. Use that generated JSON as the data consumed by the website.

Keep the original KMZ in the repository so that the provenance of the website data remains clear.

A possible structure is:

    /data/
        frugt.kmz
        locations.json

    /src/
        index.html
        app.js
        style.css

    /scripts/
        convert-kmz.py

The exact structure may be changed if there is a simpler solution.

---

## 3. POI data

Each POI should preserve, where available:

- name
- fruit/plant type
- emoji
- latitude
- longitude
- description
- source information
- any useful metadata contained in the KMZ

The user already has **emojis for the different types of fruit**.

Preserve and use these emojis as the principal visual category markers.

For example:

- 🍎 apples
- 🍐 pears
- 🫐 berries
- 🌳 elder
- 🌿 wild garlic

Do not invent new fruit categories when the KMZ already supplies the relevant categorisation.

---

## 4. Main interface

The map should be the principal interface of the website.

The homepage should immediately present the map and the fruit locations.

Users should be able to:

- see all POIs;
- click/tap a POI;
- see its name and description;
- identify the fruit type from its emoji;
- filter the map by fruit/plant type;
- see their current location;
- determine which fruit locations are close to them.

The website should be usable without creating an account.

---

## 5. Interactive map

Use a lightweight mapping library.

**Leaflet is the preferred choice** unless there is a compelling technical reason to use another library.

Avoid unnecessary mapping frameworks or complex GIS infrastructure.

The map should:

- display the POIs;
- use the appropriate fruit emoji for the POI marker where practical;
- provide popups with information about each location;
- support normal mobile map gestures;
- support zooming and panning;
- work well on small screens.

The map does not need a backend.

---

## 6. User's current location

The website must be able to display the user's current location, especially when accessed from a mobile device.

Use the browser's standard **Geolocation API**.

Provide a clear control such as:

**◎ Min placering**

When activated:

1. Request permission to access the user's location.
2. Obtain the current position.
3. Display the position prominently on the map.
4. Centre the map on the user's position.
5. Where possible, display the estimated location accuracy as an accuracy circle.

The user's location should be processed locally in the browser.

Do not send or store the user's location on a server.

The map must remain fully usable if the user refuses location permission.

---

## 7. Optional continuous location tracking

Consider providing a second function:

**◎ Følg mig**

When explicitly activated by the user, use the browser's location-watching functionality to update the user's position while walking.

This should not run automatically.

The user should explicitly activate continuous tracking.

Provide an obvious way to stop tracking.

Avoid unnecessary battery consumption.

---

## 8. Distance from the user

When the user's position is available, calculate the approximate distance from the user to each POI locally.

Allow the interface to show information such as:

> 🍎 Æbletræ  
> 340 m fra dig

Provide a **"Nærmest mig"** option that sorts or filters POIs according to distance from the user's current location.

Do not introduce a routing API merely to calculate distances.

Straight-line distance calculated from the coordinates is sufficient.

---

## 9. Privacy

Do not create user accounts.

Do not create a user-location database.

Do not transmit the user's location to an external server.

Use the browser's Geolocation API directly.

Explain briefly, where appropriate, that location access is optional and is used locally to show the user's position and distances to fruit locations.

---

# 10. About the project

Include an **Om** page explaining the purpose and limitations of the project.

The basic text and ideas should be based on the following:

## Frugt i Odense og omegn

Hvis Fyn er Danmarks have, er Odense *The Big Apple*.

Ringvejen har form som et æble, og rundt omkring i byen står der frugttræer og andre spiselige planter på offentligt tilgængelige arealer.

Dette website forsøger at gøre nogle af dem synlige.

Kortet er ikke et officielt register og på ingen måde dækkende. Det er et udvalg af steder, som er blevet fundet interessante.

Odense Kommune har også et større kort over spiselige planter og frugttræer, som blandt andet dækker den vestlige del af byen bedre.

Anbefalingerne er uden garanti.

Brugeren har selv ansvaret for at kontrollere, at vedkommende befinder sig på et areal, hvor det er tilladt at opholde sig og plukke.

Hvis man er i tvivl, skal man lade være med at plukke.

---

# 11. Guides

Create a small section called **Guides**.

The guides should be short, practical and readable on a mobile phone.

Create at least the following guides:

## 11.1 Må jeg plukke det?

Explain that the first question is whether the user is actually permitted to pick the fruit or plant.

The website must not imply that everything growing on public-looking land is automatically available for harvesting.

The historical expression about taking as much as one can carry in one's hat may be mentioned as a historical curiosity, including its association with medieval Danish law, but it must **not** be presented as a simple modern legal rule.

The practical advice should be:

> Er du i tvivl, så lad være med at plukke.

Avoid presenting uncertain historical or legal claims as established contemporary law.

---

## 11.2 Er det sikkert?

Users must be able to identify what they are eating.

Explain that apples and pears are generally relatively easy to identify, whereas some plants have dangerous lookalikes.

Mention in particular:

- hyldebær and possible confusion with other plants;
- ramsløg and its dangerous lookalikes.

Recommend consulting reliable plant-identification resources.

The basic rule is:

> Spis aldrig en plante, du ikke med sikkerhed kan identificere.

Do not provide false certainty about plant identification.

---

## 11.3 Er det lækkert?

Explain that edibility and taste are different questions.

Fruit from old or unknown trees can vary considerably.

Apples can be:

- sweet;
- sour;
- bitter;
- mealy;
- excellent for eating;
- better suited for cooking or juice.

Taste is ultimately for the user to judge.

---

## 11.4 Er det indsatsen værd?

Explain that some fruit is particularly rewarding to harvest.

Apples should be presented as especially useful because they are relatively robust and versatile.

Other berries and soft fruit may be more difficult to transport and preserve.

Freezing can be recommended as a practical way of preserving fruit.

---

## 11.5 Pluk uden at ødelægge

Give basic harvesting advice:

- Do not damage branches.
- Do not break shoots or buds unnecessarily.
- Do not destroy the plant while harvesting.
- Do not trample surrounding vegetation.
- Leave roots and bulbs in the ground.

For **ramsløg**, explicitly state:

> Riv ikke planten op med roden.

Harvest leaves without destroying the plant or its underground parts.

---

# 12. Tone and presentation

The website should be:

- Danish;
- concise;
- informative;
- slightly playful;
- practical;
- visually clean.

The "The Big Apple" idea can provide the site with personality.

Do not turn the website into a bureaucratic catalogue.

At the same time, do not allow humour to obscure important legal or safety information.

---

# 13. Suggested navigation

Use a minimal navigation structure:

- **Kort**
- **Frugter**
- **Guides**
- **Om**

On mobile, the navigation should remain compact.

The map should be the dominant feature of the site.

---

# 14. Frugter overview

Create a simple overview of the fruit and plant categories represented in the dataset.

Use the existing emojis as visual identifiers.

For each category, show:

- emoji;
- name;
- number of mapped locations, if useful;
- link/filter to display the category on the map.

The categories should be generated from the actual dataset rather than hard-coded where possible.

---

# 15. Technical constraints

Prefer:

- HTML
- CSS
- vanilla JavaScript
- Leaflet
- a small Python conversion script if necessary
- GitHub Pages
- static JSON generated from the KMZ

Avoid unless demonstrably necessary:

- React
- Vue
- Angular
- Node.js build infrastructure
- databases
- backend servers
- serverless functions
- CMS systems
- authentication
- external APIs
- unnecessary npm dependencies

The final website should be deployable as a static GitHub Pages site.

---

# 16. Data-processing principle

The KMZ is the authoritative input for the map.

Do not modify the source data merely to make the website easier to code.

If transformation is necessary, make the transformation explicit and reproducible.

The generated JSON should be considered a build artifact rather than the primary source.

Ideally, the repository should allow this workflow:

    update KMZ
        ↓
    run conversion
        ↓
    generate locations.json
        ↓
    deploy GitHub Pages

---

# 17. Responsive design

Design mobile-first.

The website will often be used outdoors, while the user is physically near the fruit locations.

Ensure:

- large enough touch targets;
- readable text;
- map controls that are easy to operate with one hand;
- the current-location button is easy to find;
- popups work properly on mobile;
- no unnecessary visual clutter.

Desktop should remain fully functional.

---

# 18. Current-location UX

The map should clearly distinguish:

**User location**

from

**Fruit POIs**.

The user's location must never be confused with a fruit location.

When location permission has not yet been granted, do not show a misleading location marker.

When location is unavailable, give a short, useful error message rather than exposing browser/JavaScript errors.

---

# 19. Error handling

Handle at least:

- invalid or missing KMZ;
- malformed KML;
- POIs without coordinates;
- unavailable geolocation;
- denied geolocation permission;
- location timeout;
- inaccurate location;
- empty fruit categories.

Do not allow a single malformed POI to prevent the entire map from loading.

---

# 20. Documentation

Include a concise README explaining:

1. What the project is.
2. Where the KMZ source data is located.
3. How KMZ is converted to JSON.
4. How the website is run locally.
5. How GitHub Pages deployment works.
6. How to update the map data.
7. How geolocation works.
8. Which external libraries, if any, are used.

Keep the documentation proportional to the simplicity of the project.

---

# 21. Principle of minimalism

The project should favour the simplest solution that fulfils the requirements.

Do not introduce infrastructure merely because it is technically possible.

The desired end state is essentially:

    KMZ
      ↓
    small conversion script
      ↓
    JSON
      ↓
    HTML + CSS + JavaScript
      ↓
    Leaflet map
      ↓
    GitHub Pages

The website should be maintainable by a researcher who is comfortable with data, GitHub, Python and basic web technologies, but does not want to maintain a complex modern web application.