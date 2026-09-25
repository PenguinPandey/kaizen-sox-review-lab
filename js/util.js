/* Shared helpers: DOM builder, dates, CSV, SHA-256, zip writer, storage. No dependencies. */
(function () {
  var KAI = (window.KAI = window.KAI || {});
  var U = (KAI.util = {});

  /* ---------- DOM ---------- */
  var PROPS = {value: 1, checked: 1, selected: 1, disabled: 1, indeterminate: 1};
  function append(el, kids) {
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k == null || k === false) continue;
      if (Array.isArray(k)) append(el, k);
      else if (k instanceof Node) el.appendChild(k);
      else el.appendChild(document.createTextNode(String(k)));
    }
  }
  U.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (PROPS[k]) el[k] = v;
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  };
  U.svg = function (tag, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs || {}) el.setAttribute(k, attrs[k]);
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  };
  U.clear = function (el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  };

  /* ---------- numbers and dates ---------- */
  U.pct = function (a, b) {
    return b ? Math.round((a / b) * 100) + "%" : "0%";
  };
  U.plural = function (n, w, ws) {
    return n + " " + (n === 1 ? w : ws || w + "s");
  };
  var MS = 86400000;
  U.parse = function (s) {
    if (!s) return null;
    var p = s.split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  };
  U.iso = function (d) {
    return d.toISOString().slice(0, 10);
  };
  U.daysBetween = function (a, b) {
    return Math.round((U.parse(b) - U.parse(a)) / MS);
  };
  U.addDays = function (s, n) {
    return U.iso(new Date(U.parse(s).getTime() + n * MS));
  };
  U.addYears = function (s, n) {
    var d = U.parse(s);
    d.setUTCFullYear(d.getUTCFullYear() + n);
    return U.iso(d);
  };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  U.fmtDate = function (s) {
    if (!s) return "never";
    var d = U.parse(s);
    return d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear();
  };
  U.today = function () {
    return U.iso(new Date());
  };

  /* ---------- storage (falls back to memory when blocked) ---------- */
  var mem = {};
  U.store = {
    get: function (k, def) {
      try {
        var v = window.localStorage.getItem(k);
        if (v != null) return JSON.parse(v);
      } catch (e) {
        if (k in mem) return mem[k];
      }
      return def;
    },
    set: function (k, v) {
      mem[k] = v;
      try {
        window.localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    },
    del: function (k) {
      delete mem[k];
      try {
        window.localStorage.removeItem(k);
      } catch (e) {}
    }
  };

  /* ---------- CSV and downloads ---------- */
  U.csvCell = function (v) {
    if (v == null) return "";
    var s = String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  U.toCSV = function (rows, cols) {
    var out = [cols.map(function (c) { return U.csvCell(c.label); }).join(",")];
    rows.forEach(function (r) {
      out.push(cols.map(function (c) { return U.csvCell(c.csv ? c.csv(r) : r[c.key]); }).join(","));
    });
    return out.join("\r\n") + "\r\n";
  };
  U.download = function (name, data, mime) {
    var blob = data instanceof Blob ? data : new Blob([data], {type: mime || "text/plain"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };

  /* ---------- SHA-256 (synchronous, works on file:// and http) ---------- */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  U.sha256Bytes = function (bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = bytes.length;
    var padLen = (((l + 9 + 63) >> 6) << 6);
    var m = new Uint8Array(padLen);
    m.set(bytes);
    m[l] = 0x80;
    var dv = new DataView(m.buffer);
    dv.setUint32(padLen - 8, Math.floor((l * 8) / 4294967296));
    dv.setUint32(padLen - 4, (l * 8) >>> 0);
    var w = new Uint32Array(64);
    for (var off = 0; off < padLen; off += 64) {
      var i;
      for (i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (i = 16; i < 64; i++) {
        var a15 = w[i - 15], a2 = w[i - 2];
        var s0 = ((a15 >>> 7) | (a15 << 25)) ^ ((a15 >>> 18) | (a15 << 14)) ^ (a15 >>> 3);
        var s1 = ((a2 >>> 17) | (a2 << 15)) ^ ((a2 >>> 19) | (a2 << 13)) ^ (a2 >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map(function (x) { return ("00000000" + x.toString(16)).slice(-8); }).join("");
  };
  U.sha256 = function (str) {
    return U.sha256Bytes(new TextEncoder().encode(str));
  };

  /* ---------- CRC32 + minimal ZIP (stored, no compression) ---------- */
  var CRC = null;
  U.crc32 = function (bytes) {
    if (!CRC) {
      CRC = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        CRC[n] = c >>> 0;
      }
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = CRC[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  U.makeZip = function (files) {
    var enc = new TextEncoder();
    var parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name);
      var data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
      var crc = U.crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = 0;
    central.forEach(function (c) { cdSize += c.length; });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), {type: "application/zip"});
  };
})();
