(function () {
  var KAI = window.KAI, U = KAI.util, h = U.h, E = KAI.E, UI = KAI.ui;

  KAI.views.checklist = {
    title: "1. Data-pull checklist",
    render: function () {
      var items = E.proc.checklist, S = KAI.state;
      var root = h("div");
      root.appendChild(UI.page("1. Access review checklist: what to pull, from where",
        "Every reviewer decision rests on a list. If the list is incomplete or wrong, the review is worthless, so each row carries a completeness and accuracy check (IPE, 'information produced by the entity') that the auditor will test first."));

      root.appendChild(UI.note("info", h("strong", null, "IPE standard applied to every extract. "), E.proc.ipeStandard));

      var overall = h("div"), overallBar = h("div");
      root.appendChild(h("div", {class: "card"}, overall, overallBar));

      function st(id) { return S.checklist[id] || {pulled: false, ipe: false}; }
      function progress(list) {
        var done = list.filter(function (i) { return st(i.id).pulled && st(i.id).ipe; }).length;
        return {done: done, total: list.length, frac: list.length ? done / list.length : 0};
      }
      var refreshers = [];
      function refresh() {
        var p = progress(items);
        U.clear(overall); U.clear(overallBar);
        overall.appendChild(h("div", {class: "row", style: "justify-content:space-between"},
          h("strong", null, "Progress: " + p.done + " of " + p.total + " items pulled and IPE-checked"),
          h("span", {class: "muted small"}, "Saved in this browser")));
        overallBar.appendChild(UI.progress(p.frac));
        refreshers.forEach(function (f) { f(); });
      }

      function tableFor(list) {
        return UI.table({
          rows: list, csvName: "access-review-checklist.csv", searchPlaceholder: "Search items, tables, reports...",
          cols: [
            {label: "ID", render: function (r) { return h("span", {class: "id"}, r.id); }, sort: function (r) { return r.id; }},
            {label: "System", render: function (r) { return r.sys === "ALL" ? UI.chip("All", "info") : UI.sys(r.sys); }, csv: function (r) { return r.sys; }, sort: function (r) { return r.sys; }},
            {label: "Data to pull", cls: "wide", render: function (r) { return h("strong", null, r.item); }, csv: function (r) { return r.item; }},
            {label: "Where from", cls: "wide", render: function (r) { return h("span", {class: "small"}, r.source); }, csv: function (r) { return r.source; }},
            {label: "How", cls: "mid", render: function (r) { return h("span", {class: "small"}, r.method); }, csv: function (r) { return r.method; }},
            {label: "Completeness / accuracy check", cls: "wide", render: function (r) { return h("span", {class: "small"}, r.ipe); }, csv: function (r) { return r.ipe; }},
            {label: "Pulled by", cls: "mid", render: function (r) { return h("span", {class: "small"}, r.who); }, csv: function (r) { return r.who; }},
            {label: "Pulled", csv: function (r) { return st(r.id).pulled ? "yes" : "no"; }, render: function (r) {
              return h("input", {type: "checkbox", checked: st(r.id).pulled, "aria-label": "Pulled " + r.id, onchange: function () {
                S.checklist[r.id] = Object.assign({}, st(r.id), {pulled: this.checked}); KAI.save(); refresh();
              }});
            }},
            {label: "IPE ok", csv: function (r) { return st(r.id).ipe ? "yes" : "no"; }, render: function (r) {
              return h("input", {type: "checkbox", checked: st(r.id).ipe, "aria-label": "IPE checked " + r.id, onchange: function () {
                S.checklist[r.id] = Object.assign({}, st(r.id), {ipe: this.checked}); KAI.save(); refresh();
              }});
            }}
          ]
        });
      }

      var groups = [["all", "All items", items], ["ALL", "HR, ITSM and governance", items.filter(function (i) { return i.sys === "ALL"; })]]
        .concat(E.ref.systems.map(function (s) { return [s.id, s.name, items.filter(function (i) { return i.sys === s.id; })]; }));
      var tabs = UI.tabs(groups.map(function (g) {
        return {id: g[0], label: g[1] + " (" + g[2].length + ")", render: function () {
          var box = h("div");
          if (g[0] === "GH") box.appendChild(UI.note("warn", h("strong", null, "Watch item G3. "), "GitHub is the only system where the access that matters (production database) lives partly outside the system. Reconcile GitHub team membership and the database's own grant list in both directions."));
          if (g[0] === "BL" || g[0] === "KY") box.appendChild(UI.note("info", h("strong", null, "Tier 1. "), "Listings for this system are pulled by someone who is not a reviewer and does not hold a business role in it. Every account gets two reviewers."));
          var p = progress(g[2]);
          box.appendChild(h("p", {class: "muted small"}, p.done + " of " + p.total + " done in this group."));
          box.appendChild(tableFor(g[2]));
          return box;
        }};
      }));
      root.appendChild(tabs);

      var legend = [
        ["Data to pull", "Which list or report you need from the system."],
        ["Where from", "The table, screen or API where it lives."],
        ["How", "How to extract it, for example read-only SQL run by the DBA."],
        ["Completeness / accuracy check", "How you prove the list is complete and correct. Auditors test this first, because a review built on an incomplete list proves nothing."],
        ["Pulled by", "Who extracts it. Never the reviewer, so nobody can filter their own name out of the list."],
        ["Pulled / IPE ok", "Your two tick boxes: the data has been pulled, and its completeness and accuracy check has been done."]
      ];
      root.appendChild(h("div", {class: "card", style: "margin-top:14px"},
        h("h3", null, "Legend: what each column means"),
        h("p", {class: "muted small"}, "This page is about the information you must collect from each system before anyone can review access. It is not about what the systems can do (that is on the Review criteria page)."),
        h("dl", {class: "kv"}, legend.map(function (l) { return [h("dt", null, l[0]), h("dd", null, l[1])]; })),
        h("p", {class: "muted small", style: "margin-top:10px"}, "The 'HR, ITSM and governance' tab is not a fifth system. It holds data needed for every review: the HR list of leavers and movers, the access-request tickets, and the approved SoD rule set.")));

      root.appendChild(h("div", {class: "row no-print", style: "margin-top:14px"},
        UI.btn("Reset checklist progress", function () {
          if (!confirm("Clear all ticks on this page?")) return;
          S.checklist = {}; KAI.save(); KAI.go("checklist"); location.reload();
        }, "danger")));

      root.appendChild(UI.section("Why these sources", null,
        h("div", {class: "grid g3"},
          UI.card("Independent extraction", "IT pulls the data. The reviewer never does, and never touches the query, so nobody can filter their own name out of the list."),
          UI.card("Two-way tie-outs", "Every listing is agreed to the system's own count. For GitHub prod-DB, GitHub and the database are compared in both directions."),
          UI.card("HR is the source of truth", "Leavers, movers, managers and contract dates come from the HR master, not from the systems being reviewed."))));

      refresh();
      return root;
    }
  };
})();
