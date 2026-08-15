/*!
 * qr.js - eigenstaendige, offline QR-Code-Generierung (kein CDN, kein ES-Modul)
 * Byte-Mode (UTF-8), Fehlerkorrektur-Level M (Standard), automatische Versionswahl 1-40.
 * Implementiert nach ISO/IEC 18004 (Reed-Solomon-ECC, Format-/Versions-Info, Maskenwahl per Penalty).
 * API: window.QR.matrix(text) / QR.svg(text,opts) / QR.canvas(text,opts) / QR.render(container,text,opts)
 * file:// tauglich, klassisches Skript.
 */
(function (global) {
  'use strict';

  // ===================================================================
  // Galois-Feld GF(256), Primitivpolynom x^8+x^4+x^3+x^2+1 (0x11d)
  // ===================================================================
  var EXP_TABLE = new Array(256);
  var LOG_TABLE = new Array(256);
  (function initGF() {
    for (var i = 0; i < 8; i++) { EXP_TABLE[i] = 1 << i; }
    for (var i = 8; i < 256; i++) {
      EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i++) { LOG_TABLE[EXP_TABLE[i]] = i; }
  })();
  function glog(n) { if (n < 1) { throw new Error('glog(' + n + ')'); } return LOG_TABLE[n]; }
  function gexp(n) {
    while (n < 0) { n += 255; }
    while (n >= 256) { n -= 255; }
    return EXP_TABLE[n];
  }

  // Polynom ueber GF(256), num = Koeffizienten (hoechster Grad zuerst)
  function Poly(num, shift) {
    var offset = 0;
    while (offset < num.length && num[offset] === 0) { offset++; }
    this.num = new Array(num.length - offset + shift);
    for (var i = 0; i < num.length - offset; i++) { this.num[i] = num[i + offset]; }
    for (var i = num.length - offset; i < this.num.length; i++) { this.num[i] = 0; }
  }
  Poly.prototype.get = function (idx) { return this.num[idx]; };
  Poly.prototype.len = function () { return this.num.length; };
  Poly.prototype.multiply = function (e) {
    var num = new Array(this.len() + e.len() - 1);
    for (var i = 0; i < num.length; i++) { num[i] = 0; }
    for (var i = 0; i < this.len(); i++) {
      for (var j = 0; j < e.len(); j++) {
        num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
      }
    }
    return new Poly(num, 0);
  };
  Poly.prototype.mod = function (e) {
    if (this.len() - e.len() < 0) { return this; }
    var ratio = glog(this.get(0)) - glog(e.get(0));
    var num = this.num.slice();
    for (var i = 0; i < e.len(); i++) {
      num[i] ^= gexp(glog(e.get(i)) + ratio);
    }
    return new Poly(num, 0).mod(e);
  };
  function errorCorrectPolynomial(ecLen) {
    var a = new Poly([1], 0);
    for (var i = 0; i < ecLen; i++) {
      a = a.multiply(new Poly([1, gexp(i)], 0));
    }
    return a;
  }

  // ===================================================================
  // RS-Block-Tabelle (ISO/IEC 18004 Tabelle, Versionen 1-40, je [L,M,Q,H])
  // Zeilenformat je Eintrag: [count,total,data, count2,total2,data2]
  // ===================================================================
  var RS_BLOCK_TABLE = [
    [1,26,19],[1,26,16],[1,26,13],[1,26,9],
    [1,44,34],[1,44,28],[1,44,22],[1,44,16],
    [1,70,55],[1,70,44],[2,35,17],[2,35,13],
    [1,100,80],[2,50,32],[2,50,24],[4,25,9],
    [1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],
    [2,86,68],[4,43,27],[4,43,19],[4,43,15],
    [2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],
    [2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],
    [2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],
    [2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],
    [4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],
    [2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],
    [4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],
    [3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],
    [5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],
    [5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],
    [1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],
    [5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],
    [3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],
    [3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],
    [4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],
    [2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],
    [4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],
    [6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],
    [8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],
    [10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],
    [8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],
    [3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],
    [7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],
    [5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],
    [13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],
    [17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],
    [17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],
    [13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],
    [12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],
    [6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],
    [17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],
    [4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],
    [20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],
    [19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]
  ];
  var EC_LEVEL_ROW = { L: 0, M: 1, Q: 2, H: 3 };
  var EC_LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  function getRSBlocks(version, ecLevel) {
    var row = RS_BLOCK_TABLE[(version - 1) * 4 + EC_LEVEL_ROW[ecLevel]];
    var n = row.length / 3;
    var list = [];
    for (var i = 0; i < n; i++) {
      var count = row[i * 3], total = row[i * 3 + 1], data = row[i * 3 + 2];
      for (var j = 0; j < count; j++) { list.push({ total: total, data: data }); }
    }
    return list;
  }

  function totalDataCount(version, ecLevel) {
    var blocks = getRSBlocks(version, ecLevel);
    var sum = 0;
    for (var i = 0; i < blocks.length; i++) { sum += blocks[i].data; }
    return sum;
  }

  // ===================================================================
  // Ausrichtungsmuster-Positionen je Version (1-40)
  // ===================================================================
  var ALIGNMENT_TABLE = [
    [], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42], [6,26,46], [6,28,50],
    [6,30,54], [6,32,58], [6,34,62], [6,26,46,66], [6,26,48,70], [6,26,50,74], [6,30,54,78],
    [6,30,56,82], [6,30,58,86], [6,34,62,90], [6,28,50,72,94], [6,26,50,74,98], [6,30,54,78,102],
    [6,28,54,80,106], [6,32,58,84,110], [6,30,58,86,114], [6,34,62,90,118], [6,26,50,74,98,122],
    [6,30,54,78,102,126], [6,26,52,78,104,130], [6,30,56,82,108,134], [6,34,60,86,112,138],
    [6,30,58,86,114,142], [6,34,62,90,118,146], [6,30,54,78,102,126,150], [6,24,50,76,102,128,154],
    [6,28,54,80,106,132,158], [6,32,58,84,110,136,162], [6,26,54,82,110,138,166], [6,30,58,86,114,142,170]
  ];

  // ===================================================================
  // BCH-Codes fuer Format-Info (15,5) und Versions-Info (18,6)
  // ===================================================================
  var G15 = (1<<10)|(1<<8)|(1<<5)|(1<<4)|(1<<2)|(1<<1)|(1<<0); // 0x537
  var G18 = (1<<12)|(1<<11)|(1<<10)|(1<<9)|(1<<8)|(1<<5)|(1<<2)|(1<<0); // 0x1F25
  var G15_MASK = (1<<14)|(1<<12)|(1<<10)|(1<<4)|(1<<1); // 0x5412

  function bchDigit(data) {
    var d = 0;
    while (data !== 0) { d++; data >>>= 1; }
    return d;
  }
  function bchTypeInfo(data) {
    var d = data << 10;
    while (bchDigit(d) - bchDigit(G15) >= 0) {
      d ^= (G15 << (bchDigit(d) - bchDigit(G15)));
    }
    return ((data << 10) | d) ^ G15_MASK;
  }
  function bchTypeNumber(data) {
    var d = data << 12;
    while (bchDigit(d) - bchDigit(G18) >= 0) {
      d ^= (G18 << (bchDigit(d) - bchDigit(G18)));
    }
    return (data << 12) | d;
  }

  // ===================================================================
  // Maskenmuster 0-7
  // ===================================================================
  var MASK_FUNCS = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r, c) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
    function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
    function (r, c) { return ((r * c) % 3 + (r + c) % 2) % 2 === 0; }
  ];

  // ===================================================================
  // Bit-Puffer
  // ===================================================================
  function BitBuffer() {
    this.buf = [];
    this.length = 0;
  }
  BitBuffer.prototype.putBit = function (bit) {
    var idx = Math.floor(this.length / 8);
    if (this.buf.length <= idx) { this.buf.push(0); }
    if (bit) { this.buf[idx] |= (0x80 >>> (this.length % 8)); }
    this.length++;
  };
  BitBuffer.prototype.put = function (num, len) {
    for (var i = 0; i < len; i++) {
      this.putBit(((num >>> (len - i - 1)) & 1) === 1);
    }
  };

  // ===================================================================
  // UTF-8 Byte-Kodierung (ohne TextEncoder-Abhaengigkeit, file:// sicher)
  // ===================================================================
  function utf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.codePointAt(i);
      if (code > 0xFFFF) { i++; } // Surrogatpaar ueberspringen
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
      } else if (code < 0x10000) {
        bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
      } else {
        bytes.push(
          0xF0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3F),
          0x80 | ((code >> 6) & 0x3F),
          0x80 | (code & 0x3F)
        );
      }
    }
    return bytes;
  }

  // Laenge des Zeichenanzahl-Indikators (Byte-Mode) in Bits, je Version
  function cciBits(version) {
    return version < 10 ? 8 : 16;
  }
  var MODE_BYTE = 4; // 0100

  // Kleinste passende Version (1-40) fuer gegebene Byte-Anzahl und ECC-Level ermitteln
  function chooseVersion(byteLen, ecLevel) {
    for (var v = 1; v <= 40; v++) {
      var headerBits = 4 + cciBits(v);
      var neededBits = headerBits + byteLen * 8;
      var capacityBits = totalDataCount(v, ecLevel) * 8;
      if (neededBits <= capacityBits) { return v; }
    }
    return null;
  }

  var PAD0 = 0xEC, PAD1 = 0x11;

  // Datenstrom (Mode+CCI+Daten+Terminator+Padding) nach ISO/IEC 18004 aufbauen
  function createData(version, ecLevel, bytes) {
    var buffer = new BitBuffer();
    buffer.put(MODE_BYTE, 4);
    buffer.put(bytes.length, cciBits(version));
    for (var i = 0; i < bytes.length; i++) { buffer.put(bytes[i], 8); }

    var totalDC = totalDataCount(version, ecLevel);
    if (buffer.length > totalDC * 8) {
      throw new Error('code length overflow (' + buffer.length + '>' + (totalDC * 8) + ')');
    }
    if (buffer.length + 4 <= totalDC * 8) { buffer.put(0, 4); }
    while (buffer.length % 8 !== 0) { buffer.putBit(false); }
    while (buffer.length < totalDC * 8) {
      buffer.put(PAD0, 8);
      if (buffer.length >= totalDC * 8) { break; }
      buffer.put(PAD1, 8);
    }
    return buffer.buf;
  }

  // Reed-Solomon-ECC berechnen und Bloecke interleaven -> finale Codewort-Sequenz
  function createBytes(dataBytes, rsBlocks) {
    var offset = 0;
    var maxDc = 0, maxEc = 0;
    var dcdata = new Array(rsBlocks.length);
    var ecdata = new Array(rsBlocks.length);

    for (var r = 0; r < rsBlocks.length; r++) {
      var dcCount = rsBlocks[r].data;
      var ecCount = rsBlocks[r].total - dcCount;
      maxDc = Math.max(maxDc, dcCount);
      maxEc = Math.max(maxEc, ecCount);

      dcdata[r] = new Array(dcCount);
      for (var i = 0; i < dcCount; i++) { dcdata[r][i] = 0xff & dataBytes[i + offset]; }
      offset += dcCount;

      var rsPoly = errorCorrectPolynomial(ecCount);
      var rawPoly = new Poly(dcdata[r], rsPoly.len() - 1);
      var modPoly = rawPoly.mod(rsPoly);

      ecdata[r] = new Array(rsPoly.len() - 1);
      for (var i = 0; i < ecdata[r].length; i++) {
        var modIndex = i + modPoly.len() - ecdata[r].length;
        ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
      }
    }

    var totalCount = 0;
    for (var i = 0; i < rsBlocks.length; i++) { totalCount += rsBlocks[i].total; }
    var out = new Array(totalCount);
    var idx = 0;
    for (var i = 0; i < maxDc; i++) {
      for (var r = 0; r < rsBlocks.length; r++) {
        if (i < dcdata[r].length) { out[idx++] = dcdata[r][i]; }
      }
    }
    for (var i = 0; i < maxEc; i++) {
      for (var r = 0; r < rsBlocks.length; r++) {
        if (i < ecdata[r].length) { out[idx++] = ecdata[r][i]; }
      }
    }
    return out;
  }

  // ===================================================================
  // Modul-Matrix aufbauen (Finder/Timing/Alignment/Format-/Versions-Info/Daten)
  // ===================================================================
  function QRMatrix(version, ecLevel) {
    this.version = version;
    this.ecLevel = ecLevel;
    this.moduleCount = version * 4 + 17;
    this.modules = [];
    for (var r = 0; r < this.moduleCount; r++) {
      var row = new Array(this.moduleCount);
      for (var c = 0; c < this.moduleCount; c++) { row[c] = null; }
      this.modules.push(row);
    }
  }
  QRMatrix.prototype.isDark = function (r, c) { return !!this.modules[r][c]; };

  QRMatrix.prototype.setupFinder = function (row, col) {
    var mc = this.moduleCount, m = this.modules;
    for (var r = -1; r <= 7; r++) {
      if (row + r <= -1 || mc <= row + r) { continue; }
      for (var c = -1; c <= 7; c++) {
        if (col + c <= -1 || mc <= col + c) { continue; }
        if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
          m[row + r][col + c] = true;
        } else {
          m[row + r][col + c] = false;
        }
      }
    }
  };

  QRMatrix.prototype.setupTiming = function () {
    var mc = this.moduleCount, m = this.modules;
    for (var r = 8; r < mc - 8; r++) {
      if (m[r][6] !== null) { continue; }
      m[r][6] = (r % 2 === 0);
    }
    for (var c = 8; c < mc - 8; c++) {
      if (m[6][c] !== null) { continue; }
      m[6][c] = (c % 2 === 0);
    }
  };

  QRMatrix.prototype.setupAlignment = function () {
    var pos = ALIGNMENT_TABLE[this.version - 1];
    var m = this.modules;
    for (var i = 0; i < pos.length; i++) {
      for (var j = 0; j < pos.length; j++) {
        var row = pos[i], col = pos[j];
        if (m[row][col] !== null) { continue; }
        for (var r = -2; r <= 2; r++) {
          for (var c = -2; c <= 2; c++) {
            if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
              m[row + r][col + c] = true;
            } else {
              m[row + r][col + c] = false;
            }
          }
        }
      }
    }
  };

  QRMatrix.prototype.setupTypeNumber = function (test) {
    var bits = bchTypeNumber(this.version);
    var m = this.modules, mc = this.moduleCount;
    for (var i = 0; i < 18; i++) {
      var mod = (!test && (((bits >> i) & 1) === 1));
      m[Math.floor(i / 3)][i % 3 + mc - 8 - 3] = mod;
    }
    for (var i = 0; i < 18; i++) {
      var mod = (!test && (((bits >> i) & 1) === 1));
      m[i % 3 + mc - 8 - 3][Math.floor(i / 3)] = mod;
    }
  };

  QRMatrix.prototype.setupTypeInfo = function (test, maskPattern) {
    var data = (EC_LEVEL_BITS[this.ecLevel] << 3) | maskPattern;
    var bits = bchTypeInfo(data);
    var m = this.modules, mc = this.moduleCount;
    for (var i = 0; i < 15; i++) {
      var mod = (!test && (((bits >> i) & 1) === 1));
      if (i < 6) { m[i][8] = mod; }
      else if (i < 8) { m[i + 1][8] = mod; }
      else { m[mc - 15 + i][8] = mod; }
    }
    for (var i = 0; i < 15; i++) {
      var mod = (!test && (((bits >> i) & 1) === 1));
      if (i < 8) { m[8][mc - i - 1] = mod; }
      else if (i < 9) { m[8][15 - i - 1 + 1] = mod; }
      else { m[8][15 - i - 1] = mod; }
    }
    m[mc - 8][8] = !test;
  };

  QRMatrix.prototype.mapData = function (data, maskPattern) {
    var m = this.modules, mc = this.moduleCount;
    var maskFunc = MASK_FUNCS[maskPattern];
    var inc = -1, row = mc - 1, bitIndex = 7, byteIndex = 0;
    for (var col = mc - 1; col > 0; col -= 2) {
      if (col === 6) { col--; }
      while (true) {
        for (var c = 0; c < 2; c++) {
          if (m[row][col - c] === null) {
            var dark = false;
            if (byteIndex < data.length) {
              dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
            }
            if (maskFunc(row, col - c)) { dark = !dark; }
            m[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
          }
        }
        row += inc;
        if (row < 0 || mc <= row) { row -= inc; inc = -inc; break; }
      }
    }
  };

  QRMatrix.prototype.build = function (dataCodewords, test, maskPattern) {
    this.setupFinder(0, 0);
    this.setupFinder(this.moduleCount - 7, 0);
    this.setupFinder(0, this.moduleCount - 7);
    this.setupAlignment();
    this.setupTiming();
    this.setupTypeInfo(test, maskPattern);
    if (this.version >= 7) { this.setupTypeNumber(test); }
    this.mapData(dataCodewords, maskPattern);
  };

  // Penalty-Bewertung nach ISO/IEC 18004 Regel 1-4 (vereinfachte Regel 3, wie Standardpraxis)
  function getLostPoint(qr) {
    var mc = qr.moduleCount, lost = 0;
    // Regel 1: gleichfarbige Nachbarn
    for (var row = 0; row < mc; row++) {
      for (var col = 0; col < mc; col++) {
        var sameCount = 0, dark = qr.isDark(row, col);
        for (var r = -1; r <= 1; r++) {
          if (row + r < 0 || mc <= row + r) { continue; }
          for (var c = -1; c <= 1; c++) {
            if (col + c < 0 || mc <= col + c) { continue; }
            if (r === 0 && c === 0) { continue; }
            if (dark === qr.isDark(row + r, col + c)) { sameCount++; }
          }
        }
        if (sameCount > 5) { lost += (3 + sameCount - 5); }
      }
    }
    // Regel 2: 2x2 Bloecke
    for (var row = 0; row < mc - 1; row++) {
      for (var col = 0; col < mc - 1; col++) {
        var count = 0;
        if (qr.isDark(row, col)) { count++; }
        if (qr.isDark(row + 1, col)) { count++; }
        if (qr.isDark(row, col + 1)) { count++; }
        if (qr.isDark(row + 1, col + 1)) { count++; }
        if (count === 0 || count === 4) { lost += 3; }
      }
    }
    // Regel 3: Finder-aehnliche Muster (1:1:3:1:1)
    for (var row = 0; row < mc; row++) {
      for (var col = 0; col < mc - 6; col++) {
        if (qr.isDark(row, col) && !qr.isDark(row, col + 1) && qr.isDark(row, col + 2) &&
            qr.isDark(row, col + 3) && qr.isDark(row, col + 4) && !qr.isDark(row, col + 5) &&
            qr.isDark(row, col + 6)) { lost += 40; }
      }
    }
    for (var col = 0; col < mc; col++) {
      for (var row = 0; row < mc - 6; row++) {
        if (qr.isDark(row, col) && !qr.isDark(row + 1, col) && qr.isDark(row + 2, col) &&
            qr.isDark(row + 3, col) && qr.isDark(row + 4, col) && !qr.isDark(row + 5, col) &&
            qr.isDark(row + 6, col)) { lost += 40; }
      }
    }
    // Regel 4: Hell/Dunkel-Verhaeltnis
    var darkCount = 0;
    for (var col = 0; col < mc; col++) {
      for (var row = 0; row < mc; row++) {
        if (qr.isDark(row, col)) { darkCount++; }
      }
    }
    var ratio = Math.abs(100 * darkCount / mc / mc - 50) / 5;
    lost += ratio * 10;
    return lost;
  }

  // Version + ECC bauen, beste von 8 Masken per Penalty waehlen, finale Matrix liefern
  function buildMatrix(bytes, version, ecLevel) {
    var rsBlocks = getRSBlocks(version, ecLevel);
    var dataStream = createData(version, ecLevel, bytes);
    var codewords = createBytes(dataStream, rsBlocks);

    var bestPattern = 0, bestLost = 0;
    for (var p = 0; p < 8; p++) {
      var trial = new QRMatrix(version, ecLevel);
      trial.build(codewords, true, p);
      var lost = getLostPoint(trial);
      if (p === 0 || lost < bestLost) { bestLost = lost; bestPattern = p; }
    }

    var qr = new QRMatrix(version, ecLevel);
    qr.build(codewords, false, bestPattern);

    var out = [];
    for (var r = 0; r < qr.moduleCount; r++) {
      var row = [];
      for (var c = 0; c < qr.moduleCount; c++) { row.push(qr.isDark(r, c)); }
      out.push(row);
    }
    return out;
  }

  // ===================================================================
  // Oeffentliche API
  // ===================================================================

  // 2D-Modul-Matrix (true=dunkel) fuer beliebigen Text, Byte-Mode UTF-8, ECC=M, Version 1-40 automatisch.
  // Bei Fehler/zu langem Text: null + console.warn (kein throw).
  function matrix(text) {
    try {
      if (text === null || typeof text === 'undefined') { text = ''; }
      var bytes = utf8Bytes(String(text));
      var ecLevel = 'M';
      var version = chooseVersion(bytes.length, ecLevel);
      if (!version) {
        console.warn('QR: Text zu lang fuer QR-Code (max. Version 40, ECC M).', text);
        return null;
      }
      return buildMatrix(bytes, version, ecLevel);
    } catch (e) {
      console.warn('QR.matrix: Fehler bei der Generierung.', e);
      return null;
    }
  }

  function svg(text, opts) {
    opts = opts || {};
    var size = opts.size || 220;
    var margin = (typeof opts.margin === 'number') ? opts.margin : 4;
    var dark = opts.dark || '#17181C';
    var light = opts.light || '#ffffff';
    try {
      var m = matrix(text);
      if (!m) { return null; }
      var n = m.length;
      var cell = (size - margin * 2) / n;
      if (cell <= 0) { cell = 1; }
      var path = '';
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (m[r][c]) {
            var x = margin + c * cell, y = margin + r * cell;
            path += 'M' + x + ',' + y + 'h' + cell + 'v' + cell + 'h' + (-cell) + 'z ';
          }
        }
      }
      var svgStr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size +
        '" width="' + size + '" height="' + size + '" shape-rendering="crispEdges">' +
        '<rect width="' + size + '" height="' + size + '" fill="' + light + '"/>' +
        '<path d="' + path.trim() + '" fill="' + dark + '"/>' +
        '</svg>';
      return svgStr;
    } catch (e) {
      console.warn('QR.svg: Fehler bei der Generierung.', e);
      return null;
    }
  }

  function canvasFn(text, opts) {
    opts = opts || {};
    var size = opts.size || 220;
    var margin = (typeof opts.margin === 'number') ? opts.margin : 4;
    var dark = opts.dark || '#17181C';
    var light = opts.light || '#ffffff';
    try {
      var m = matrix(text);
      if (!m) { return null; }
      var n = m.length;
      var cell = (size - margin * 2) / n;
      if (cell <= 0) { cell = 1; }
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      if (!ctx) { console.warn('QR.canvas: 2D-Kontext nicht verfuegbar.'); return null; }
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = dark;
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (m[r][c]) {
            ctx.fillRect(margin + c * cell, margin + r * cell, Math.ceil(cell), Math.ceil(cell));
          }
        }
      }
      return canvas;
    } catch (e) {
      console.warn('QR.canvas: Fehler bei der Generierung.', e);
      return null;
    }
  }

  function render(container, text, opts) {
    try {
      if (!container) { console.warn('QR.render: kein Container uebergeben.'); return null; }
      if (typeof container === 'string') { container = document.querySelector(container); }
      if (!container) { console.warn('QR.render: Container nicht gefunden.'); return null; }
      var svgStr = svg(text, opts);
      if (!svgStr) { container.innerHTML = ''; return null; }
      container.innerHTML = svgStr;
      return container.firstElementChild;
    } catch (e) {
      console.warn('QR.render: Fehler bei der Generierung.', e);
      return null;
    }
  }

  var QR = {
    matrix: matrix,
    svg: svg,
    canvas: canvasFn,
    render: render
  };

  global.QR = QR;

})(typeof window !== 'undefined' ? window : this);
