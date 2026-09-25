/* Tiny chart helpers built from divs and SVG. No libraries. */
(function () {
  var KAI = (window.KAI = window.KAI || {});
  var U = KAI.util, h = U.h;
  var C = (KAI.charts = {});
  var SEVS = ["Critical", "High", "Medium", "Low"];

  /* rows: [{label, seg:{Critical:n,...}, note}] */
  C.stacked = function (rows) {
    var max = Math.max.apply(null, rows.map(function (r) { return SEVS.reduce(function (s, k) { return s + (r.seg[k] || 0); }, 0); })) || 1;
    var wrap = h("div", {class: "bars", role: "list"});
    rows.forEach(function (r) {
      var total = SEVS.reduce(function (s, k) { return s + (r.seg[k] || 0); }, 0);
      var track = h("div", {class: "bar-track", title: SEVS.map(function (k) { return k + ": " + (r.seg[k] || 0); }).join(", ")});
      SEVS.forEach(function (k) {
        if (r.seg[k]) track.appendChild(h("div", {class: "bar-seg " + k, style: "width:" + (r.seg[k] / max * 100) + "%"}));
      });
      wrap.appendChild(h("div", {class: "bar-row", role: "listitem"}, h("div", null, r.label, r.note ? h("div", {class: "muted small"}, r.note) : null), track, h("div", {class: "right"}, String(total))));
    });
    wrap.appendChild(C.legend());
    return wrap;
  };
  C.legend = function () {
    return h("div", {class: "legend"}, SEVS.map(function (k) {
      return h("span", null, h("i", {class: "dot bar-seg " + k, style: "width:10px;height:10px;border-radius:3px"}), k);
    }));
  };

  /* rows: [{label, value, total, note}] value out of total shown as bar */
  C.rate = function (rows, cls) {
    var wrap = h("div", {class: "bars"});
    rows.forEach(function (r) {
      var frac = r.total ? r.value / r.total : 0;
      wrap.appendChild(h("div", {class: "bar-row"}, h("div", null, r.label, r.note ? h("div", {class: "muted small"}, r.note) : null),
        h("div", {class: "bar-track"}, h("div", {class: "bar-seg " + (cls || "acc"), style: "width:" + frac * 100 + "%"})),
        h("div", {class: "right"}, Math.round(frac * 100) + "%")));
    });
    return wrap;
  };

  /* Heat table: cols [{label}], rows [{label, cells:[n]}] */
  C.heat = function (colLabels, rows) {
    var max = 1;
    rows.forEach(function (r) { r.cells.forEach(function (n) { if (n > max) max = n; }); });
    var head = h("tr", null, h("th", null, ""), colLabels.map(function (c) { return h("th", {class: "right"}, c); }), h("th", {class: "right"}, "Total"));
    var body = rows.map(function (r) {
      var tot = r.cells.reduce(function (a, b) { return a + b; }, 0);
      return h("tr", null, h("td", null, r.label, r.note ? h("div", {class: "muted small"}, r.note) : null), r.cells.map(function (n) {
        var a = n ? 0.12 + 0.55 * (n / max) : 0;
        return h("td", {class: "h" + (n ? "" : " z"), style: n ? "background: color-mix(in srgb, var(--crit) " + Math.round(a * 100) + "%, transparent)" : ""}, n || "-");
      }), h("td", {class: "h right"}, tot));
    });
    return h("div", {class: "tw nomax"}, h("table", {class: "tbl heat"}, h("thead", null, head), h("tbody", null, body)));
  };

  C.donut = function (segs, size) {
    size = size || 150;
    var total = segs.reduce(function (s, x) { return s + x.value; }, 0) || 1;
    var r = size / 2 - 14, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r, off = 0;
    var svg = U.svg("svg", {viewBox: "0 0 " + size + " " + size, width: size, height: size, role: "img", "aria-label": "Distribution chart"});
    svg.appendChild(U.svg("circle", {cx: cx, cy: cy, r: r, fill: "none", stroke: "var(--panel2)", "stroke-width": 20}));
    segs.forEach(function (s) {
      if (!s.value) return;
      var len = (s.value / total) * circ;
      svg.appendChild(U.svg("circle", {cx: cx, cy: cy, r: r, fill: "none", stroke: s.color, "stroke-width": 20, "stroke-dasharray": len + " " + (circ - len), "stroke-dashoffset": -off, transform: "rotate(-90 " + cx + " " + cy + ")"}));
      off += len;
    });
    var t = U.svg("text", {x: cx, y: cy + 6, "text-anchor": "middle", "font-size": 22, "font-weight": 700, fill: "var(--ink)"});
    t.textContent = total;
    svg.appendChild(t);
    return svg;
  };
})();
