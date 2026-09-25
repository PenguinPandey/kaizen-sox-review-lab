(function () {
  var KAI = window.KAI, U = KAI.util, h = U.h, E = KAI.E, UI = KAI.ui;

  KAI.views.accounts = {
    title: "Accounts explorer",
    render: function (q) {
      var root = h("div"), A = E.assignments;
      root.appendChild(UI.page("Accounts explorer", "Every one of the " + E.accounts.length + " accounts with its roles, findings and reviewers. Filter, search, expand a row for detail, export to CSV."));

      var f = {sys: q.sys || "ALL", type: "ALL", sev: "ALL", kind: q.kind || "ALL"};
      var kinds = Object.keys(E.proc.kinds);
      var tbl;
      function match(a) {
        if (f.sys !== "ALL" && a.sys !== f.sys) return false;
        if (f.type !== "ALL" && a.type !== f.type) return false;
        var fs = E.findingsFor(a.id);
        if (f.sev === "none") return fs.length === 0;
        if (f.sev !== "ALL" && !fs.some(function (x) { return x.sev === f.sev; })) return false;
        if (f.kind !== "ALL" && !fs.some(function (x) { return x.kind === f.kind; })) return false;
        return true;
      }
      function apply() { tbl.setRows(E.accounts.filter(match)); }
      tbl = UI.table({
        rows: E.accounts.filter(match), pageSize: 50, csvName: "accounts.csv", searchPlaceholder: "Search user, holder, role, department...",
        searchText: function (a) { var p = E.people[a.holder]; return [a.id, a.user, a.sys, p.name, p.dept, p.title, a.roles.join(" "), a.roleObjs.map(function (r) { return r.name; }).join(" ")].join(" "); },
        toolbar: [
          UI.select([{value: "ALL", label: "All systems"}].concat(E.ref.systems.map(function (s) { return {value: s.id, label: s.name}; })), f.sys, function (v) { f.sys = v; apply(); }, {"aria-label": "System"}),
          UI.select([{value: "ALL", label: "All account types"}, {value: "Named", label: "Named"}, {value: "Service", label: "Service"}, {value: "Generic", label: "Generic / shared"}], "ALL", function (v) { f.type = v; apply(); }, {"aria-label": "Type"}),
          UI.select([{value: "ALL", label: "Any severity"}, {value: "Critical", label: "Has Critical"}, {value: "High", label: "Has High"}, {value: "Medium", label: "Has Medium"}, {value: "none", label: "No findings"}], "ALL", function (v) { f.sev = v; apply(); }, {"aria-label": "Severity"}),
          UI.select([{value: "ALL", label: "Any finding type"}].concat(kinds.map(function (k) { return {value: k, label: E.proc.kinds[k].label}; })), f.kind, function (v) { f.kind = v; apply(); }, {"aria-label": "Finding type"})
        ],
        expand: function (a) { return detail(a); },
        cols: [
          {label: "System", render: function (a) { return UI.sys(a.sys); }, csv: function (a) { return a.sys; }, sort: function (a) { return a.sys; }},
          {label: "Account", render: function (a) { return h("span", {class: "id"}, a.user); }, csv: function (a) { return a.user; }, sort: function (a) { return a.user; }},
          {label: "Holder", cls: "mid", render: function (a) { var p = E.people[a.holder]; return h("div", null, UI.person(a.holder), h("div", {class: "small muted"}, p.title + ", " + p.dept)); }, csv: function (a) { return E.name(a.holder); }, sort: function (a) { return E.name(a.holder); }},
          {label: "Type", render: function (a) { return a.type; }, sort: function (a) { return a.type; }},
          {label: "Roles", cls: "wide", render: function (a) { return h("span", {class: "small"}, a.roleObjs.map(function (r) { return r.name; }).join(", ")); }, csv: function (a) { return a.roles.join("; "); }},
          {label: "Last login", render: function (a) { return a.lastLogin ? U.fmtDate(a.lastLogin) : h("span", {class: "muted"}, "never"); }, csv: function (a) { return a.lastLogin || "never"; }, sort: function (a) { return a.lastLogin || ""; }},
          {label: "Findings", render: function (a) {
            var fs = E.findingsFor(a.id);
            if (!fs.length) return h("span", {class: "muted"}, "-");
            var by = {};
            fs.forEach(function (x) { by[x.sev] = (by[x.sev] || 0) + 1; });
            return h("span", {class: "row", style: "gap:4px"}, ["Critical", "High", "Medium", "Low"].filter(function (s) { return by[s]; }).map(function (s) { return h("span", {class: "chip " + s}, by[s] + " " + s); }));
          }, csv: function (a) { return E.findingsFor(a.id).length; }, sort: function (a) { var fs = E.findingsFor(a.id); return fs.length ? 10 - E.SEV_RANK[E.topSev(fs)] * 2 - (fs.length > 1 ? 1 : 0) : 99; }},
          {label: "Reviewer(s)", cls: "mid", render: function (a) { var x = A[a.id]; return h("div", {class: "small"}, E.name(x.primary.id), x.secondary ? h("div", {class: "muted"}, "+ " + E.name(x.secondary.id)) : null); }, csv: function (a) { var x = A[a.id]; return E.name(x.primary.id) + (x.secondary ? "; " + E.name(x.secondary.id) : ""); }}
        ]
      });
      root.appendChild(tbl);
      return root;
    }
  };

  function detail(a) {
    var p = E.people[a.holder], x = E.assignments[a.id], fs = E.findingsFor(a.id);
    var chain = E.chain(a.holder).map(function (c) { return c.name + " (L" + c.level + ")"; }).join(" > ");
    return h("div", {class: "grid g3"},
      h("div", null, h("h3", null, "Roles"), a.roleObjs.map(function (r) { return h("p", {class: "small"}, h("strong", null, r.name), h("br"), r.desc); })),
      h("div", null, h("h3", null, "Findings"), fs.length ? fs.map(function (f) { return h("p", {class: "small"}, UI.sev(f.sev), " ", h("strong", null, f.title), h("br"), f.detail); }) : h("p", {class: "small muted"}, "None")),
      h("div", null, h("h3", null, "Person and reviewers"),
        h("dl", {class: "kv"},
          h("dt", null, "Status"), h("dd", null, p.status + (p.termDate ? " (left " + U.fmtDate(p.termDate) + ")" : "") + " | " + p.type),
          h("dt", null, "Hired"), h("dd", null, U.fmtDate(p.hire)),
          h("dt", null, "Chain"), h("dd", null, chain || "-"),
          h("dt", null, "Request ticket"), h("dd", null, a.ticket || "none on record"),
          h("dt", null, "Created"), h("dd", null, U.fmtDate(a.created)),
          h("dt", null, "Primary"), h("dd", null, E.name(x.primary.id) + (x.primary.skipped.length ? " (after skipping " + x.primary.skipped.map(function (s) { return E.name(s.id); }).join(", ") + ")" : "")),
          x.secondary ? h("dt", null, "Second") : null, x.secondary ? h("dd", null, E.name(x.secondary.id) + " - " + x.secondary.why) : null)));
  }
})();
