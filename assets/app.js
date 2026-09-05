/* Frugt i Odense og omegn
   Vanilla JS + Leaflet. Data kommer fra data/locations.json, som genereres
   fra KMZ'en af scripts/convert-kmz.py.

   Brugerens placering bliver udelukkende brugt her i browseren: til at tegne
   prikken på kortet og regne afstande ud. Den forlader aldrig enheden. */

(function () {
  'use strict';

  var ODENSE = [55.3960, 10.3880];
  var DATA_URL = 'data/locations.json';
  var VIEWS = ['kort', 'frugter', 'guides', 'om'];

  var data = null;
  var katById = {};
  var map = null;
  var lag = {};                  // sted-id -> marker/polyline
  var poiLag = null;             // L.LayerGroup med alle frugtmarkører
  var aktivKategori = 'alle';
  var sortering = 'kategori';

  var migMarker = null;
  var migCirkel = null;
  var migPos = null;             // {lat, lon, acc}
  var watchId = null;

  var el = {};
  ['kategori-chips', 'stedliste', 'tom', 'listtitel', 'sortering', 'afstand-hint',
   'btn-her', 'btn-foelg', 'geomsg', 'frugtliste', 'kildenote', 'om-kilde'
  ].forEach(function (id) { el[id] = document.getElementById(id); });

  /* ------------------------------------------------------------------ *
   * Småting
   * ------------------------------------------------------------------ */

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') { n.textContent = attrs[k]; }
      else if (k === 'class') { n.className = attrs[k]; }
      else { n.setAttribute(k, attrs[k]); }
    });
    (kids || []).forEach(function (c) { if (c) { n.appendChild(c); } });
    return n;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Fugleflugtsafstand i meter. Haversine — rigeligt præcist til formålet,
     og der er ingen grund til at spørge en rutetjeneste om det. */
  function afstandM(lat1, lon1, lat2, lon2) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function visAfstand(m) {
    if (m < 1000) { return Math.round(m / 10) * 10 + ' m fra dig'; }
    return (m / 1000).toFixed(1).replace('.', ',') + ' km fra dig';
  }

  function kat(id) { return katById[id] || { navn: 'Ukendt', emoji: '🌿' }; }

  function medAfstand(sted) {
    if (!migPos) { return null; }
    return afstandM(migPos.lat, migPos.lon, sted.lat, sted.lon);
  }

  /* ------------------------------------------------------------------ *
   * Visninger (Kort / Frugter / Guides / Om)
   * ------------------------------------------------------------------ */

  function visVisning(navn) {
    if (VIEWS.indexOf(navn) === -1) { navn = 'kort'; }
    VIEWS.forEach(function (v) {
      document.getElementById('view-' + v).hidden = (v !== navn);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.nav a'), function (a) {
      a.classList.toggle('is-on', a.getAttribute('data-view') === navn);
    });
    // Leaflet måler containeren forkert, hvis den var skjult, da kortet blev tegnet.
    if (navn === 'kort' && map) { setTimeout(function () { map.invalidateSize(); }, 0); }
    if (navn !== 'kort') { window.scrollTo(0, 0); }
  }

  function ruter() {
    visVisning((location.hash || '#kort').slice(1));
  }

  /* ------------------------------------------------------------------ *
   * Kort
   * ------------------------------------------------------------------ */

  function popupHtml(sted) {
    var k = kat(sted.kategori);
    var html = '<h3><span class="pop-emoji">' + k.emoji + '</span> ' + esc(sted.navn) + '</h3>' +
               '<p class="pop-kat">' + esc(k.navn) +
               (sted.geometri === 'linje' ? ' · flere træer langs strækningen' : '') + '</p>';
    if (sted.beskrivelse) { html += '<p class="pop-desc">' + esc(sted.beskrivelse) + '</p>'; }
    var m = medAfstand(sted);
    if (m !== null) { html += '<p class="pop-afstand">' + esc(visAfstand(m)) + '</p>'; }
    return html;
  }

  function tegnKort() {
    map = L.map('map', { zoomControl: false, tap: true }).setView(ODENSE, 13);
    // Zoom i højre side: venstre nederste hjørne er reserveret til
    // placeringsknapperne, som skal kunne nås med tommelfingeren.
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // "The Big Apple" — æblet som ringvejen tegner. Rent pynt, så det må ikke
    // kunne klikkes: markørerne ligger ovenpå.
    (data.dekoration || []).forEach(function (form) {
      L.polygon(form.punkter, {
        color: form.farve,
        weight: form.fyld ? 2 : 4,
        opacity: 0.75,
        fill: form.fyld,
        fillColor: form.farve,
        fillOpacity: form.fyld ? 0.18 : 0,
        interactive: false
      }).addTo(map);
    });

    poiLag = L.layerGroup().addTo(map);

    data.steder.forEach(function (sted) {
      var k = kat(sted.kategori);
      var form;

      if (sted.geometri === 'linje' && sted.linje && sted.linje.length > 1) {
        form = L.polyline(sted.linje, { color: '#7CB342', weight: 5, opacity: 0.9 });
      } else {
        form = L.marker([sted.lat, sted.lon], {
          icon: L.divIcon({
            className: 'pin' + (sted.geometri === 'linje' ? ' pin-linje' : ''),
            html: '<span class="pin-emoji">' + k.emoji + '</span>',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -14]
          }),
          alt: k.navn + ': ' + sted.navn,
          keyboard: true
        });
      }

      form.bindPopup(function () { return popupHtml(sted); }, { maxWidth: 280 });
      lag[sted.id] = form;
    });

    opdaterKort();
  }

  function synligeSteder() {
    return data.steder.filter(function (s) {
      return aktivKategori === 'alle' || s.kategori === aktivKategori;
    });
  }

  function opdaterKort() {
    if (!map) { return; }
    poiLag.clearLayers();
    synligeSteder().forEach(function (s) { poiLag.addLayer(lag[s.id]); });
  }

  function gaaTilSted(sted) {
    if (!map) { return; }
    visVisning('kort');
    if (location.hash !== '#kort') { history.replaceState(null, '', '#kort'); }
    map.invalidateSize();
    map.setView([sted.lat, sted.lon], Math.max(map.getZoom(), 16), { animate: true });
    var form = lag[sted.id];
    if (form) { form.openPopup(); }
    document.querySelector('.mapwrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ------------------------------------------------------------------ *
   * Filter, liste og frugtoversigt
   * ------------------------------------------------------------------ */

  function saetKategori(id) {
    aktivKategori = id;
    Array.prototype.forEach.call(document.querySelectorAll('.fchip'), function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-kat') === id);
    });
    el['listtitel'].textContent = id === 'alle' ? 'Steder' : kat(id).emoji + ' ' + kat(id).navn;
    opdaterKort();
    tegnListe();
  }

  function tegnFilter() {
    data.kategorier.forEach(function (k) {
      var b = h('button', { type: 'button', class: 'fchip', 'data-kat': k.id }, [
        h('span', { class: 'fchip-emoji', 'aria-hidden': 'true', text: k.emoji }),
        document.createTextNode(k.navn + ' '),
        h('span', { class: 'fchip-tal', text: String(k.antal) })
      ]);
      b.addEventListener('click', function () { saetKategori(k.id); });
      el['kategori-chips'].appendChild(b);
    });
    document.querySelector('.fchip-all').addEventListener('click', function () { saetKategori('alle'); });
  }

  function tegnListe() {
    var steder = synligeSteder().slice();

    if (sortering === 'afstand' && migPos) {
      steder.sort(function (a, b) { return medAfstand(a) - medAfstand(b); });
    } else if (sortering === 'navn') {
      steder.sort(function (a, b) { return a.navn.localeCompare(b.navn, 'da'); });
    } else {
      steder.sort(function (a, b) {
        var ka = kat(a.kategori).navn, kb = kat(b.kategori).navn;
        return ka === kb ? a.navn.localeCompare(b.navn, 'da') : ka.localeCompare(kb, 'da');
      });
    }

    el['stedliste'].textContent = '';
    steder.forEach(function (sted) {
      var k = kat(sted.kategori);
      var m = medAfstand(sted);

      var meta = [k.navn];
      if (sted.geometri === 'linje') { meta.push('strækning'); }

      var krop = [
        h('span', { class: 'sted-navn', text: sted.navn }),
        sted.beskrivelse ? h('span', { class: 'sted-desc', text: sted.beskrivelse }) : null,
        h('span', { class: 'sted-meta' }, [
          document.createTextNode(meta.join(' · ')),
          m === null ? null : h('span', { class: 'sted-afstand', text: ' · ' + visAfstand(m) })
        ])
      ];

      var knap = h('button', { type: 'button', class: 'sted' }, [
        h('span', { class: 'sted-emoji', 'aria-hidden': 'true', text: k.emoji }),
        h('span', { class: 'sted-krop' }, krop)
      ]);
      knap.addEventListener('click', function () { gaaTilSted(sted); });
      el['stedliste'].appendChild(h('li', null, [knap]));
    });

    el['tom'].hidden = steder.length > 0;
  }

  function tegnFrugter() {
    data.kategorier.forEach(function (k) {
      var b = h('button', { type: 'button', class: 'frugt' }, [
        h('span', { class: 'frugt-emoji', 'aria-hidden': 'true', text: k.emoji }),
        h('span', null, [
          h('span', { class: 'frugt-navn', text: k.navn }),
          h('span', { class: 'frugt-antal', text: k.antal + (k.antal === 1 ? ' sted' : ' steder') })
        ]),
        h('span', { class: 'frugt-pil', 'aria-hidden': 'true', text: '›' })
      ]);
      b.addEventListener('click', function () {
        saetKategori(k.id);
        location.hash = '#kort';
        window.scrollTo(0, 0);
      });
      el['frugtliste'].appendChild(h('li', null, [b]));
    });

    var kilde = data.kilde || {};
    var tekst = 'Kategorierne kommer fra kortets egne lag i "' + (kilde.navn || 'kildekortet') + '". ' +
                'Tallene tælles ud af datasættet, ikke skrevet ind i hånden.';
    el['kildenote'].textContent = tekst;

    if (el['om-kilde']) {
      el['om-kilde'].textContent =
        'Stederne stammer fra et Google My Maps-kort, "' + (kilde.navn || '') + '", som ligger i ' +
        'projektet som ' + (kilde.fil || 'en KMZ-fil') + ' og bliver lavet om til JSON af et lille ' +
        'Python-script. ' + (kilde.beskrivelse || '');
    }
  }

  /* ------------------------------------------------------------------ *
   * Placering
   * ------------------------------------------------------------------ */

  function besked(tekst, varighed) {
    el['geomsg'].textContent = tekst;
    el['geomsg'].hidden = false;
    if (besked._t) { clearTimeout(besked._t); }
    if (varighed) {
      besked._t = setTimeout(function () { el['geomsg'].hidden = true; }, varighed);
    }
  }

  function geoFejl(err) {
    // Ingen rå browserfejl til brugeren — kun noget, der kan handles på.
    var tekst;
    if (!err || err.code === 2) {
      tekst = 'Din placering kunne ikke findes lige nu. Prøv igen udendørs eller tjek, at GPS er slået til.';
    } else if (err.code === 1) {
      tekst = 'Kortet må ikke se din placering. Du kan give lov i browserens indstillinger — kortet virker fint uden.';
    } else if (err.code === 3) {
      tekst = 'Det tog for lang tid at finde din placering. Prøv igen.';
    } else {
      tekst = 'Din placering er ikke tilgængelig.';
    }
    besked(tekst, 9000);
    stopFoelg();
  }

  function saetPosition(pos) {
    var lat = pos.coords.latitude, lon = pos.coords.longitude;
    var acc = pos.coords.accuracy || 0;
    migPos = { lat: lat, lon: lon, acc: acc };

    if (!migMarker) {
      migMarker = L.marker([lat, lon], {
        icon: L.divIcon({ className: 'pin', html: '<div class="mig-prik"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        alt: 'Din placering',
        zIndexOffset: 1000,
        interactive: false
      }).addTo(map);
      migCirkel = L.circle([lat, lon], {
        radius: acc, color: '#1266d6', weight: 1, fillColor: '#1266d6', fillOpacity: 0.12, interactive: false
      }).addTo(map);
    } else {
      migMarker.setLatLng([lat, lon]);
      migCirkel.setLatLng([lat, lon]).setRadius(acc);
    }

    el['sortering'].querySelector('option[value="afstand"]').disabled = false;
    el['afstand-hint'].hidden = true;

    if (acc > 500) {
      besked('Placeringen er upræcis (± ' + Math.round(acc) + ' m). Afstandene er kun omtrentlige.', 8000);
    } else {
      el['geomsg'].hidden = true;
    }

    tegnListe();
    if (map.getPopup && map._popup) { map._popup.update(); }
  }

  function minPlacering() {
    if (!navigator.geolocation) {
      besked('Din browser kan ikke oplyse placering. Kortet virker fint uden.', 8000);
      return;
    }
    besked('Finder din placering …');
    navigator.geolocation.getCurrentPosition(function (pos) {
      saetPosition(pos);
      map.setView([pos.coords.latitude, pos.coords.longitude], 16, { animate: true });
    }, geoFejl, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }

  function stopFoelg() {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    el['btn-foelg'].setAttribute('aria-pressed', 'false');
    el['btn-foelg'].innerHTML = '<span aria-hidden="true">◎</span> Følg mig';
  }

  function foelgMig() {
    if (watchId !== null) {
      stopFoelg();
      besked('Følger dig ikke længere.', 4000);
      return;
    }
    if (!navigator.geolocation) {
      besked('Din browser kan ikke oplyse placering. Kortet virker fint uden.', 8000);
      return;
    }
    besked('Følger din placering, mens du går. Tryk igen for at stoppe.', 6000);
    el['btn-foelg'].setAttribute('aria-pressed', 'true');
    el['btn-foelg'].innerHTML = '<span aria-hidden="true">◼</span> Stop';
    watchId = navigator.geolocation.watchPosition(function (pos) {
      var foerste = !migPos;
      saetPosition(pos);
      if (foerste) { map.setView([pos.coords.latitude, pos.coords.longitude], 16); }
      else { map.panTo([pos.coords.latitude, pos.coords.longitude], { animate: true, duration: 0.6 }); }
    }, geoFejl, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
  }

  /* ------------------------------------------------------------------ *
   * Opstart
   * ------------------------------------------------------------------ */

  function gyldigt(sted) {
    return sted && typeof sted.lat === 'number' && typeof sted.lon === 'number' &&
           isFinite(sted.lat) && isFinite(sted.lon) && sted.id;
  }

  function start(json) {
    data = json || {};
    // Én ødelagt POI må ikke vælte hele kortet.
    data.steder = (data.steder || []).filter(gyldigt);
    data.kategorier = (data.kategorier || []).filter(function (k) {
      return k && k.id && data.steder.some(function (s) { return s.kategori === k.id; });
    });
    data.kategorier.forEach(function (k) { katById[k.id] = k; });

    if (!data.steder.length) {
      besked('Der er ingen steder i datafilen. Kør scripts/convert-kmz.py for at generere den igen.');
      return;
    }

    tegnFilter();
    tegnFrugter();
    tegnListe();

    if (typeof L === 'undefined') {
      besked('Kortet kunne ikke hentes. Listen nedenfor virker stadig.');
      document.getElementById('map').hidden = true;
      document.querySelector('.mapctl').hidden = true;
    } else {
      tegnKort();
    }

    el['btn-her'].addEventListener('click', minPlacering);
    el['btn-foelg'].addEventListener('click', foelgMig);
    el['sortering'].addEventListener('change', function () {
      sortering = el['sortering'].value;
      tegnListe();
    });

    window.addEventListener('hashchange', ruter);
    ruter();
  }

  fetch(DATA_URL)
    .then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    })
    .then(start)
    .catch(function (err) {
      besked('Kortdataene kunne ikke hentes (' + err.message + '). ' +
             'Kører du sitet lokalt, skal det serveres over http — fx "python3 -m http.server".');
      window.addEventListener('hashchange', ruter);
      ruter();
    });
})();
