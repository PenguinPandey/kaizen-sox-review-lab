/* Reusable UI components. */
(function () {
  var KAI = (window.KAI = window.KAI || {});
  var U = KAI.util, h = U.h, E = KAI.E;
  var UI = (KAI.ui = {});
  KAI.views = KAI.views || {};

  UI.chip = function (text, cls, title) { return h("span", {class: "chip " + (cls || ""), title: title}, text); };
  UI.sev = function (s) { return h("span", {class: "chip " + s}, s); };
  UI.sys = function (id) { return h("span", {class: "chip sys", title: E.sys[id] ? E.sys[id].name : id}, id === "CROSS" ? "CROSS" : id); };
  UI.sysList = function (list) { return h("span", {class: "row", style: "gap:4px"}, list.map(UI.sys)); };
  UI.kind = function (k) { return E.proc.kinds[k].label; };

  UI.person = function (id, opt) {
    var p = E.people[id];
    if (!p) return h("span", {class: "muted"}, "-");
    var t = p.title + " | L" + p.level + " " + E.ref.levels[p.level] + " | " + p.dept + (p.status !== "Active" ? " | LEFT " + U.fmtDate(p.termDate) : "");
    return h("span", {title: t}, p.name, p.status !== "Active" ? h("span", {class: "chip bad", style: "margin-left:6px"}, "left") : null,
      opt && opt.title ? h("span", {class: "muted small"}, " - " + p.title) : null);
  };

  UI.kpi = function (label, value, sub, tone) {
    return h("div", {class: "kpi " + (tone || "")}, h("div", {class: "v"}, value), h("div", {class: "l"}, label), sub ? h("div", {class: "s"}, sub) : null);
  };
  UI.card = function (title, sub) {
    var kids = Array.prototype.slice.call(arguments, 2);
    return h("div", {class: "card"}, title ? h("h3", null, title) : null, sub ? h("p", {class: "muted small"}, sub) : null, kids);
  };
  UI.section = function (title, sub) {
    var kids = Array.prototype.slice.call(arguments, 2);
    return h("section", {class: "section"}, h("h2", null, title), sub ? h("p", {class: "sub"}, sub) : null, kids);
  };
  UI.note = function (kind) {
    return h("div", {class: "note " + kind}, Array.prototype.slice.call(arguments, 1));
  };
  UI.btn = function (label, fn, cls) { return h("button", {class: "btn " + (cls || ""), type: "button", onclick: fn}, label); };
  UI.page = function (title, lede) {
    var el = h("div", null, h("h1", null, title), lede ? h("p", {class: "lede"}, lede) : null);
    return el;
  };
  UI.link = function (route, label, cls) { return h("a", {href: "#/" + route, class: cls || ""}, label); };
  UI.progress = function (frac) { return h("div", {class: "progress", role: "progressbar", "aria-valuenow": Math.round(frac * 100)}, h("i", {style: "width:" + Math.round(frac * 100) + "%"})); };

  UI.tabs = function (items, initial) {
    var wrap = h("div"), bar = h("div", {class: "tabs", role: "tablist"}), body = h("div");
    var cur = initial || items[0].id;
    function show(id) {
      cur = id;
      Array.prototype.forEach.call(bar.children, function (b) { b.setAttribute("aria-selected", b.dataset.id === id ? "true" : "false"); });
      U.clear(body);
      var it = items.filter(function (x) { return x.id === id; })[0];
      body.appendChild(it.render());
    }
    items.forEach(function (it) {
      var b = h("button", {role: "tab", "data-id": it.id, onclick: function () { show(it.id); }}, it.label);
      bar.appendChild(b);
    });
    wrap.appendChild(bar);
    wrap.appendChild(body);
    show(cur);
    wrap.show = show;
    return wrap;
  };

  UI.details = function (summary, open) {
    var kids = Array.prototype.slice.call(arguments, 2);
    return h("details", {class: "d", open: open ? true : null}, h("summary", null, summary), h("div", {class: "body"}, kids));
  };

  UI.select = function (options, value, onchange, attrs) {
    var s = h("select", Object.assign({onchange: function () { onchange(s.value); }}, attrs || {}));
    options.forEach(function (o) {
      s.appendChild(h("option", {value: o.value, selected: String(o.value) === String(value) ? true : null}, o.label));
    });
    return s;
  };

  /* Type-ahead picker: an input with a datalist. combo.value is the item's value, not its label. */
  var comboN = 0;
  UI.combo = function (items, value, onchange, attrs) {
    var id = "combo" + comboN++;
    var input = h("input", Object.assign({type: "text", list: id, autocomplete: "off", style: "min-width:280px;max-width:100%"}, attrs || {}));
    var dl = h("datalist", {id: id}, items.map(function (it) { return h("option", {value: it.label}); }));
    var box = h("span", null, input, dl);
    var cur = value;
    function labelOf(v) { var it = items.filter(function (x) { return x.value === v; })[0]; return it ? it.label : ""; }
    input.value = labelOf(value);
    input.placeholder = "Type to search, or click to see the list";
    input.addEventListener("focus", function () { input.value = ""; });
    input.addEventListener("input", function () {
      var it = items.filter(function (x) { return x.label === input.value; })[0];
      if (it) { cur = it.value; input.blur(); onchange(cur); }
    });
    input.addEventListener("blur", function () { input.value = labelOf(cur); });
    Object.defineProperty(box, "value", {get: function () { return cur; }, set: function (v) { cur = v; input.value = labelOf(v); }});
    return box;
  };

  /* Sortable, searchable table. cols: {label, render(row), sort(row), csv(row), cls}. */
  UI.table = function (opt) {
    var rows = opt.rows, sortCol = opt.sortCol == null ? -1 : opt.sortCol, sortDir = opt.sortDir || 1;
    var limit = opt.pageSize || 60, shown = limit, q = "";
    var wrap = h("div");
    var toolbar = h("div", {class: "toolbar"});
    var count = h("span", {class: "count"});
    var search = null;
    if (opt.search !== false) {
      search = h("input", {type: "search", placeholder: opt.searchPlaceholder || "Search...", "aria-label": "Search table", oninput: function () { q = search.value.toLowerCase(); shown = limit; draw(); }});
      toolbar.appendChild(search);
    }
    (opt.toolbar || []).forEach(function (t) { toolbar.appendChild(t); });
    toolbar.appendChild(count);
    if (opt.csvName) {
      toolbar.appendChild(h("span", {class: "grow", style: "flex:1"}));
      toolbar.appendChild(h("button", {class: "btn sm", type: "button", onclick: function () {
        U.download(opt.csvName, U.toCSV(current(), opt.csvCols || opt.cols.filter(function (c) { return c.csv !== false; }).map(function (c) {
          return {label: c.label, csv: c.csv || function (r) { return textOf(c.render(r)); }};
        })), "text/csv");
      }}, "Export CSV"));
    }
    var thead = h("thead"), tbody = h("tbody"), more = h("div", {class: "more no-print"});
    var table = h("table", {class: "tbl"}, thead, tbody);
    var tw = h("div", {class: "tw" + (opt.noMax ? " nomax" : "")}, table);
    wrap.appendChild(toolbar); wrap.appendChild(tw); wrap.appendChild(more);

    function textOf(v) { return v instanceof Node ? v.textContent : v == null ? "" : String(v); }
    function rowText(r) {
      if (opt.searchText) return opt.searchText(r).toLowerCase();
      return opt.cols.map(function (c) { return textOf(c.render(r)); }).join(" ").toLowerCase();
    }
    function current() {
      var list = q ? rows.filter(function (r) { return rowText(r).indexOf(q) >= 0; }) : rows.slice();
      if (sortCol >= 0) {
        var c = opt.cols[sortCol], key = c.sort || function (r) { return textOf(c.render(r)); };
        list.sort(function (a, b) {
          var x = key(a), y = key(b);
          return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
        });
      }
      return list;
    }
    function drawHead() {
      U.clear(thead);
      var tr = h("tr");
      if (opt.expand) tr.appendChild(h("th", {style: "width:28px"}));
      opt.cols.forEach(function (c, i) {
        var th = h("th", {class: c.sort || c.sortable ? "sortable" : "", scope: "col"}, c.label, sortCol === i ? (sortDir > 0 ? " ▲" : " ▼") : "");
        if (c.sort || c.sortable) th.addEventListener("click", function () {
          if (sortCol === i) sortDir = -sortDir; else { sortCol = i; sortDir = 1; }
          drawHead(); draw();
        });
        tr.appendChild(th);
      });
      thead.appendChild(tr);
    }
    function draw() {
      var list = current();
      count.textContent = list.length === rows.length ? U.plural(rows.length, "row") : list.length + " of " + rows.length + " rows";
      U.clear(tbody);
      list.slice(0, shown).forEach(function (r) {
        var tr = h("tr", {class: opt.rowClass ? opt.rowClass(r) : ""});
        var detail = null;
        if (opt.expand) {
          var btn = h("button", {class: "btn sm ghost", type: "button", "aria-label": "Details", onclick: function () {
            if (detail) { detail.remove(); detail = null; btn.textContent = "+"; }
            else { detail = h("tr", {class: "expand"}, h("td", {colspan: opt.cols.length + 1}, opt.expand(r))); tr.after(detail); btn.textContent = "-"; }
          }}, "+");
          tr.appendChild(h("td", null, btn));
        }
        opt.cols.forEach(function (c) { tr.appendChild(h("td", {class: c.cls || ""}, c.render(r))); });
        tbody.appendChild(tr);
      });
      U.clear(more);
      if (list.length > shown) more.appendChild(h("button", {class: "btn sm", type: "button", onclick: function () { shown += limit * 2; draw(); }}, "Show more (" + (list.length - shown) + " left)"));
      if (!list.length) tbody.appendChild(h("tr", null, h("td", {colspan: opt.cols.length + 1, class: "muted"}, opt.empty || "Nothing matches.")));
    }
    drawHead(); draw();
    wrap.setRows = function (r) { rows = r; shown = limit; draw(); };
    wrap.current = current;
    return wrap;
  };
})();
