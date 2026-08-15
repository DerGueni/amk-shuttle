/* ============================================================
   shuttle_fahrzeuge.js  —  AMK Shuttle (Crew-Shuttle-Planung)
   Klassisches Skript (kein Modul, kein fetch): file://-fähig.
   Von shuttle.html per <script src> geladen.

   Enthält:
     - VORLAGEN  : Draufsichten der Fahrzeugtypen (Sitzraster)
     - zeichneVan(): baut die Draufsicht als SVG (ohne Bilddateien)
   Raster: x = Spalte (0 = links/Fahrerseite), y = Reihe (0 = vorne)
   ============================================================ */
(function (root) {
  'use strict';

  /* ---- Fahrzeug-Vorlagen (Draufsicht) ---------------------- */
  var VORLAGEN = {
    pkw5: {
      name: 'PKW · 5 Sitze', kurz: '5-Sitzer', plaetze: 4, spalten: 3, reihen: 2,
      beschreibung: 'Normaler Kombi. Fahrer plus vier Mitfahrer, wenig Platz für Cases.',
      sitze: [
        { id: 'F', x: 0, y: 0, typ: 'fahrer', name: 'Fahrer' },
        { id: 'BF', x: 2, y: 0, name: 'Beifahrer' },
        { id: '2L', x: 0, y: 1, name: 'Reihe 2 links' },
        { id: '2M', x: 1, y: 1, name: 'Reihe 2 Mitte' },
        { id: '2R', x: 2, y: 1, name: 'Reihe 2 rechts' }
      ]
    },
    van6: {
      name: 'Van · 6 Sitze', kurz: '6-Sitzer', plaetze: 5, spalten: 3, reihen: 3,
      beschreibung: 'Kleiner Van mit zwei Einzelreihen und Gang in der Mitte.',
      sitze: [
        { id: 'F', x: 0, y: 0, typ: 'fahrer', name: 'Fahrer' },
        { id: 'BF', x: 2, y: 0, name: 'Beifahrer' },
        { id: '2L', x: 0, y: 1, name: 'Reihe 2 links' },
        { id: '2R', x: 2, y: 1, name: 'Reihe 2 rechts' },
        { id: '3L', x: 0, y: 2, name: 'Reihe 3 links' },
        { id: '3R', x: 2, y: 2, name: 'Reihe 3 rechts' }
      ]
    },
    van7: {
      name: 'Van · 7 Sitze', kurz: '7-Sitzer', plaetze: 6, spalten: 3, reihen: 3,
      beschreibung: 'Klassischer Bus: Dreierbank in der Mitte, zwei Sitze hinten.',
      sitze: [
        { id: 'F', x: 0, y: 0, typ: 'fahrer', name: 'Fahrer' },
        { id: 'BF', x: 2, y: 0, name: 'Beifahrer' },
        { id: '2L', x: 0, y: 1, name: 'Reihe 2 links' },
        { id: '2M', x: 1, y: 1, name: 'Reihe 2 Mitte' },
        { id: '2R', x: 2, y: 1, name: 'Reihe 2 rechts' },
        { id: '3L', x: 0, y: 2, name: 'Reihe 3 links' },
        { id: '3R', x: 2, y: 2, name: 'Reihe 3 rechts' }
      ]
    },
    van8: {
      name: 'Van · 8 Sitze', kurz: '8-Sitzer', plaetze: 7, spalten: 3, reihen: 3,
      beschreibung: 'Zwei volle Dreierbänke hinter der Fahrerreihe.',
      sitze: [
        { id: 'F', x: 0, y: 0, typ: 'fahrer', name: 'Fahrer' },
        { id: 'BF', x: 2, y: 0, name: 'Beifahrer' },
        { id: '2L', x: 0, y: 1, name: 'Reihe 2 links' },
        { id: '2M', x: 1, y: 1, name: 'Reihe 2 Mitte' },
        { id: '2R', x: 2, y: 1, name: 'Reihe 2 rechts' },
        { id: '3L', x: 0, y: 2, name: 'Reihe 3 links' },
        { id: '3M', x: 1, y: 2, name: 'Reihe 3 Mitte' },
        { id: '3R', x: 2, y: 2, name: 'Reihe 3 rechts' }
      ]
    },
    van9: {
      name: 'Van · 9 Sitze', kurz: '9-Sitzer', plaetze: 8, spalten: 3, reihen: 4,
      beschreibung: 'Langer Van, hinten Gang in der Mitte, Platz für Gepäck im Heck.',
      sitze: [
        { id: 'F', x: 0, y: 0, typ: 'fahrer', name: 'Fahrer' },
        { id: 'BF', x: 2, y: 0, name: 'Beifahrer' },
        { id: '2L', x: 0, y: 1, name: 'Reihe 2 links' },
        { id: '2M', x: 1, y: 1, name: 'Reihe 2 Mitte' },
        { id: '2R', x: 2, y: 1, name: 'Reihe 2 rechts' },
        { id: '3L', x: 0, y: 2, name: 'Reihe 3 links' },
        { id: '3R', x: 2, y: 2, name: 'Reihe 3 rechts' },
        { id: '4L', x: 0, y: 3, name: 'Reihe 4 links' },
        { id: '4R', x: 2, y: 3, name: 'Reihe 4 rechts' }
      ]
    },
    bus16: {
      name: 'Minibus · 16 Sitze', kurz: '16-Sitzer', plaetze: 15, spalten: 4, reihen: 6,
      beschreibung: 'Großer Minibus mit Mittelgang. Für ganze Abteilungen oder Nachtfahrten.',
      sitze: (function () {
        var s = [{ id: 'F', x: 0, y: 0, typ: 'fahrer', name: 'Fahrer' }, { id: 'BF', x: 3, y: 0, name: 'Beifahrer' }];
        for (var r = 1; r <= 5; r++) {
          s.push({ id: (r + 1) + 'L', x: 0, y: r, name: 'Reihe ' + (r + 1) + ' links' });
          s.push({ id: (r + 1) + 'M', x: 1, y: r, name: 'Reihe ' + (r + 1) + ' Mitte' });
          s.push({ id: (r + 1) + 'R', x: 3, y: r, name: 'Reihe ' + (r + 1) + ' rechts' });
        }
        return s;
      })()
    }
  };

  var REIHENFOLGE = ['pkw5', 'van6', 'van7', 'van8', 'van9', 'bus16'];

  /* ---- Zeichnen ------------------------------------------- */
  /* opts: {
       zustand: function(sitzId) -> {klasse, text, titel, klickbar}
       zellgroesse, klick: function(sitzId, ev)
       ohneKlick: true  -> reine Vorschau
     }                                                          */
  /* Masse: SZ = Sitzgroesse, WAND = Seitenwand, NASE = Front mit Haube und
     Windschutzscheibe, HECK = Heckscheibe mit Klappe. RAND = Platz fuer
     Raeder und Spiegel, die ueber die Karosserie hinausstehen.            */
  var SZ = 62, LU = 10, LUR = 22, WAND = 15, RAND = 16, NASE = 96, HECK = 64;

  function svgEl(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  function masse(v) {
    var innenB = v.spalten * SZ + (v.spalten - 1) * LU;
    var innenH = v.reihen * SZ + (v.reihen - 1) * LUR;
    var karB = innenB + 2 * WAND;
    return { innenB: innenB, innenH: innenH, karB: karB,
             b: karB + 2 * RAND, h: NASE + innenH + HECK };
  }

  /* Umriss von oben: vorne schmaler (Motorhaube), hinten leicht eingezogen */
  function karosserie(L, R, T, B) {
    var fi = 13, ri = 7;
    return 'M ' + (L + fi) + ' ' + (T + 30) +
      ' C ' + (L + fi) + ' ' + (T + 8) + ', ' + (L + fi + 10) + ' ' + T + ', ' + (L + fi + 26) + ' ' + T +
      ' L ' + (R - fi - 26) + ' ' + T +
      ' C ' + (R - fi - 10) + ' ' + T + ', ' + (R - fi) + ' ' + (T + 8) + ', ' + (R - fi) + ' ' + (T + 30) +
      ' L ' + (R - fi) + ' ' + (T + 44) +
      ' C ' + (R - fi) + ' ' + (T + 56) + ', ' + R + ' ' + (T + 58) + ', ' + R + ' ' + (T + 74) +
      ' L ' + R + ' ' + (B - 70) +
      ' C ' + R + ' ' + (B - 54) + ', ' + (R - ri) + ' ' + (B - 50) + ', ' + (R - ri) + ' ' + (B - 38) +
      ' L ' + (R - ri) + ' ' + (B - 20) +
      ' C ' + (R - ri) + ' ' + (B - 6) + ', ' + (R - ri - 10) + ' ' + B + ', ' + (R - ri - 24) + ' ' + B +
      ' L ' + (L + ri + 24) + ' ' + B +
      ' C ' + (L + ri + 10) + ' ' + B + ', ' + (L + ri) + ' ' + (B - 6) + ', ' + (L + ri) + ' ' + (B - 20) +
      ' L ' + (L + ri) + ' ' + (B - 38) +
      ' C ' + (L + ri) + ' ' + (B - 50) + ', ' + L + ' ' + (B - 54) + ', ' + L + ' ' + (B - 70) +
      ' L ' + L + ' ' + (T + 74) +
      ' C ' + L + ' ' + (T + 58) + ', ' + (L + fi) + ' ' + (T + 56) + ', ' + (L + fi) + ' ' + (T + 44) +
      ' Z';
  }

  function zeichneVan(vorlageId, opts) {
    opts = opts || {};
    var v = VORLAGEN[vorlageId] || VORLAGEN.van7;
    var m = masse(v);
    /* Bild liegt laengs: Breite = Fahrzeuglaenge, Hoehe = Fahrzeugbreite */
    var svg = svgEl('svg', {
      viewBox: '0 0 ' + m.h + ' ' + m.b, width: '100%',
      xmlns: 'http://www.w3.org/2000/svg', class: 'vanmap'
    });
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    /* Die Karosserie wird stehend gezeichnet und dann gedreht, damit die
       Front nach rechts zeigt. Die Sitze kommen danach aufrecht dazu. */
    var kar = svgEl('g', { transform: 'matrix(0 1 -1 0 ' + m.h + ' 0)' });
    svg.appendChild(kar);

    var L = RAND, R = RAND + m.karB, T = 0, B = m.h;
    var innenL = L + WAND, innenR = R - WAND;

    /* ---- Karosserie ---- */
    kar.appendChild(svgEl('path', {
      d: karosserie(L, R, T, B),
      fill: 'var(--vanbody)', stroke: 'var(--vanline)', 'stroke-width': 3.5
    }));


    /* ---- Raeder: liegen auf der Karosserie, damit sie sichtbar bleiben ---- */
    var radY = [NASE - 24, m.h - HECK - 20];
    if (v.reihen >= 5) radY.splice(1, 0, NASE - 24 + Math.round((m.h - HECK - 20 - (NASE - 24)) / 2));
    radY.forEach(function (ry) {
      [L - 9, R - 5].forEach(function (rx) {
        kar.appendChild(svgEl('rect', {
          x: rx, y: ry, width: 14, height: 42, rx: 6,
          fill: 'var(--vanrad)', stroke: 'var(--vanline)', 'stroke-width': 1.6
        }));
      });
    });


    /* ---- Aussenspiegel (liegen auf der Karosserie) ---- */
    [L - 13, R - 5].forEach(function (mx) {
      kar.appendChild(svgEl('rect', {
        x: mx, y: NASE - 40, width: 18, height: 12, rx: 5,
        fill: 'var(--vanrad)', stroke: 'var(--vanline)', 'stroke-width': 1.6
      }));
    });
    /* ---- Kuehlergrill ---- */
    kar.appendChild(svgEl('rect', {
      x: L + 62, y: 7, width: m.karB - 124, height: 15, rx: 6,
      fill: 'var(--vanglas)', stroke: 'var(--vanline)', 'stroke-width': 1.2
    }));
    /* ---- Scheinwerfer und Ruecklichter ---- */
    [[L + 27, 'var(--vanlicht)', 9], [R - 57, 'var(--vanlicht)', 9]].forEach(function (p) {
      kar.appendChild(svgEl('rect', {
        x: p[0], y: p[2], width: 30, height: 12, rx: 5,
        fill: p[1], stroke: 'var(--vanline)', 'stroke-width': 1, opacity: .9
      }));
    });
    [L + 24, R - 54].forEach(function (lx) {
      kar.appendChild(svgEl('rect', {
        x: lx, y: m.h - 23, width: 30, height: 11, rx: 5,
        fill: 'var(--vanruecklicht)', stroke: 'var(--vanline)', 'stroke-width': 1, opacity: .9
      }));
    });

    /* ---- Motorhaube mit Mittelnaht ---- */
    kar.appendChild(svgEl('rect', {
      x: L + 20, y: 24, width: m.karB - 40, height: NASE - 62, rx: 16,
      fill: 'var(--vanhaube)', stroke: 'var(--vanline)', 'stroke-width': 1.5
    }));
    kar.appendChild(svgEl('line', {
      x1: L + m.karB / 2, y1: 26, x2: L + m.karB / 2, y2: NASE - 40,
      stroke: 'var(--vanline)', 'stroke-width': 1.2, opacity: .6
    }));

    /* ---- Windschutzscheibe ---- */
    kar.appendChild(svgEl('path', {
      d: 'M ' + (innenL + 15) + ' ' + (NASE - 32) + ' L ' + (innenR - 15) + ' ' + (NASE - 32) +
        ' L ' + (innenR + 1) + ' ' + (NASE - 6) + ' L ' + (innenL - 1) + ' ' + (NASE - 6) + ' Z',
      fill: 'var(--vanglas)', stroke: 'var(--vanline)', 'stroke-width': 1.5
    }));

    /* ---- Heckscheibe und Klappe ---- */
    kar.appendChild(svgEl('path', {
      d: 'M ' + (innenL - 2) + ' ' + (m.h - HECK + 12) + ' L ' + (innenR + 2) + ' ' + (m.h - HECK + 12) +
        ' L ' + (innenR - 12) + ' ' + (m.h - HECK + 40) + ' L ' + (innenL + 12) + ' ' + (m.h - HECK + 40) + ' Z',
      fill: 'var(--vanglas)', stroke: 'var(--vanline)', 'stroke-width': 1.5
    }));
    kar.appendChild(svgEl('rect', {
      x: L + 26, y: m.h - 44, width: m.karB - 52, height: 15, rx: 7,
      fill: 'none', stroke: 'var(--vanline)', 'stroke-width': 1.2, opacity: .7
    }));

    /* ---- Offener Innenraum: Dach ist weg, man sieht den Boden ---- */
    kar.appendChild(svgEl('rect', {
      x: innenL - 3, y: NASE - 10, width: m.innenB + 6, height: m.innenH + 20, rx: 12,
      fill: 'var(--vaninnen)', stroke: 'var(--vanline)', 'stroke-width': 1.6
    }));
    kar.appendChild(svgEl('rect', {
      x: innenL + 1, y: NASE - 6, width: m.innenB - 2, height: m.innenH + 12, rx: 9,
      fill: 'none', stroke: 'var(--vanline)', 'stroke-width': 1, opacity: .45
    }));

    /* ---- Tuerfugen an beiden Seiten ---- */
    for (var r = 0; r < v.reihen - 1; r++) {
      var fy = NASE + r * (SZ + LUR) + SZ + LUR / 2;
      [[L + 3, innenL - 3], [innenR + 3, R - 3]].forEach(function (seg) {
        kar.appendChild(svgEl('line', {
          x1: seg[0], y1: fy, x2: seg[1], y2: fy,
          stroke: 'var(--vanline)', 'stroke-width': 1.4, opacity: .8
        }));
      });
    }

    /* Sitze */
    v.sitze.forEach(function (s) {
      /* Reihe 0 liegt rechts (Front), Spalte 0 oben (Fahrerseite) */
      var x = m.h - (NASE + s.y * (SZ + LUR)) - SZ;
      var y = innenL + s.x * (SZ + LU);
      var z = opts.zustand ? (opts.zustand(s.id, s) || {}) : {};
      var g = svgEl('g', { class: 'seat ' + (z.klasse || 'frei') + (z.klickbar ? ' klickbar' : ''), 'data-sitz': s.id });

      var ti = svgEl('title');
      ti.textContent = z.titel || s.name;
      g.appendChild(ti);

      /* Sitzschale: Lehne + Fläche */
      g.appendChild(svgEl('rect', { x: x, y: y, width: SZ, height: SZ, rx: 12, class: 'seatbox' }));
      g.appendChild(svgEl('rect', { x: x + 6, y: y + 5, width: SZ - 12, height: 9, rx: 4, class: 'seatlehne' }));

      if (s.typ === 'fahrer') {
        /* Lenkrad */
        g.appendChild(svgEl('circle', { cx: x + SZ / 2, cy: y + SZ / 2 + 4, r: 13, class: 'lenkrad' }));
        g.appendChild(svgEl('circle', { cx: x + SZ / 2, cy: y + SZ / 2 + 4, r: 4, class: 'lenkradnabe' }));
      } else {
        var t1 = svgEl('text', { x: x + SZ / 2, y: y + SZ / 2 + 3, class: 'seattext' });
        t1.textContent = (z.text !== undefined ? z.text : '');
        g.appendChild(t1);
        var t2 = svgEl('text', { x: x + SZ / 2, y: y + SZ - 9, class: 'seatsub' });
        t2.textContent = (z.sub !== undefined ? z.sub : s.id);
        g.appendChild(t2);
      }

      if (!opts.ohneKlick && z.klickbar && opts.klick) {
        g.style.cursor = 'pointer';
        g.addEventListener('click', function (ev) { opts.klick(s.id, s, ev); });
      }
      svg.appendChild(g);
    });

    return svg;
  }

  root.VANS = {
    VORLAGEN: VORLAGEN,
    REIHENFOLGE: REIHENFOLGE,
    zeichneVan: zeichneVan,
    masse: masse,
    sitze: function (id) { return (VORLAGEN[id] || VORLAGEN.van7).sitze; },
    buchbar: function (id) {
      return (VORLAGEN[id] || VORLAGEN.van7).sitze.filter(function (s) { return s.typ !== 'fahrer'; });
    }
  };
})(window);
