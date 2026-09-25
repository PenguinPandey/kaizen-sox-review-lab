(function () {
  var KAI = window.KAI, U = KAI.util, h = U.h, E = KAI.E, UI = KAI.ui;

  function capList(keys) {
    return h("ul", {class: "plain", style: "margin:4px 0 0"}, keys.map(function (k) {
      var c = E.ref.capabilities[k];
      return h("li", null, h("strong", null, c.label), h("div", {class: "muted small"}, E.sys[k.split(".")[0]].name + ": " + c.txn));
    }));
  }

  KAI.views.sod = {
    title: "4. SoD conflict rules",
    render: function () {
      var root = h("div"), rules = E.ref.sodRules;
      var sodF = E.findings.filter(function (f) { return f.kind === "sod"; });
      root.appendChild(UI.page("4. Segregation-of-duties conflict rules",
        "Each rule names two specific transactions that one person must not be able to do, and the screens where they are done. A rule is checked against the combined roles of each person, in one system or across two."));

      root.appendChild(UI.note("info", h("strong", null, "The three required examples are marked. "), "Post + approve a journal (R01), create + pay a supplier (R02), provision + approve access (R03). The rest come from the same logic applied to Blackline, Kyriba, GitHub and cross-system flows. ",
        h("strong", null, "R04 is the GitHub developer + production-database rule.")));

      root.appendChild(h("div", {class: "grid g4"},
        UI.kpi("Rules", rules.length, rules.filter(function (r) { return r.sev === "Critical"; }).length + " critical"),
        UI.kpi("Conflicts found", sodF.length, "for " + Object.keys(sodF.reduce(function (m, f) { m[f.personId] = 1; return m; }, {})).length + " people", "high"),
        UI.kpi("Cross-system rules", rules.filter(function (r) { return r.scope === "cross"; }).length, "invisible if you review one system at a time"),
        UI.kpi("Single-role conflicts", sodF.filter(function (f) { return f.withinRole; }).length, "one role gives both halves")));

      /* rules */
      var sysFilter = "ALL";
      var listBox = h("div");
      var filterSel = UI.select([{value: "ALL", label: "All systems"}].concat(E.ref.systems.map(function (s) { return {value: s.id, label: s.name}; })).concat([{value: "CROSS", label: "Cross-system only"}]), "ALL", function (v) { sysFilter = v; drawRules(); }, {"aria-label": "Filter rules by system"});
      function drawRules() {
        U.clear(listBox);
        rules.filter(function (r) {
          return sysFilter === "ALL" || (sysFilter === "CROSS" ? r.scope === "cross" : r.systems.indexOf(sysFilter) >= 0);
        }).forEach(function (r) {
          var n = sodF.filter(function (f) { return f.ruleId === r.id; }).length;
          listBox.appendChild(UI.details(h("span", {class: "row", style: "gap:8px"},
            h("span", {class: "id"}, r.id), h("strong", null, r.name), UI.sev(r.sev), UI.sysList(r.systems),
            r.required ? UI.chip("Required example", "info") : null, r.scope === "cross" ? UI.chip("Cross-system", "") : null,
            h("span", {class: "muted small"}, n + " found")), r.id === "R01" || r.id === "R04",
            h("div", {class: "grid g2"},
              h("div", null, h("h3", null, "One person must not be able to..."), capList(r.a)),
              h("div", null, h("h3", null, "...and also..."), capList(r.b))),
            h("p", {style: "margin-top:12px"}, h("strong", null, "What it looks like: "), r.example),
            h("p", null, h("strong", null, "Why it matters: "), r.risk),
            h("h3", null, "If access must stay, compensating controls"),
            h("ul", {class: "plain"}, r.mitigation.map(function (k) { return h("li", null, h("strong", null, E.ref.controls[k].name + ". "), E.ref.controls[k].detail); }))));
        });
      }
      root.appendChild(UI.section("The rules", "Open a rule to see the exact transactions, an example and compensating controls.", h("div", {class: "toolbar"}, filterSel), listBox));
      drawRules();

      /* checker */
      root.appendChild(UI.section("Role combination checker", "Tick any roles a person might be given and see which rules fire. Try the quick examples, then try to build a combination that avoids every rule.", checker()));

      /* findings */
      var ruleSel = "ALL", sevSel = "ALL";
      var tbl = UI.table({rows: sodF, csvName: "sod-conflicts.csv", pageSize: 40, searchPlaceholder: "Search person, department, rule...", expand: function (f) { return detail(f); },
        searchText: function (f) { return [E.name(f.personId), E.people[f.personId].dept, E.people[f.personId].title, f.ruleId, f.title, f.detail].join(" "); },
        toolbar: [
          UI.select([{value: "ALL", label: "All rules"}].concat(rules.map(function (r) { return {value: r.id, label: r.id + " " + r.name}; })), "ALL", function (v) { ruleSel = v; apply(); }, {"aria-label": "Filter by rule"}),
          UI.select([{value: "ALL", label: "All severities"}, {value: "Critical", label: "Critical"}, {value: "High", label: "High"}], "ALL", function (v) { sevSel = v; apply(); }, {"aria-label": "Filter by severity"})
        ],
        cols: [
          {label: "Person", cls: "mid", render: function (f) { return h("div", null, UI.person(f.personId), h("div", {class: "muted small"}, E.people[f.personId].title + ", " + E.people[f.personId].dept)); }, csv: function (f) { return E.name(f.personId); }, sort: function (f) { return E.name(f.personId); }},
          {label: "Rule", cls: "wide", render: function (f) { return h("span", null, h("span", {class: "id"}, f.ruleId + " "), f.title); }, csv: function (f) { return f.ruleId + " " + f.title; }, sort: function (f) { return f.ruleId; }},
          {label: "Severity", render: function (f) { return UI.sev(f.sev); }, csv: function (f) { return f.sev; }, sort: function (f) { return 4 - E.SEV_RANK[f.sev]; }},
          {label: "Systems", render: function (f) { return UI.sysList(f.systems); }, csv: function (f) { return f.systems.join(" "); }},
          {label: "Roles causing it", cls: "wide", render: function (f) { return h("span", {class: "small"}, uniq(f.evA.concat(f.evB).map(function (e) { return e.roleName; })).join(" + ")); }, csv: function (f) { return uniq(f.evA.concat(f.evB).map(function (e) { return e.roleName; })).join(" + "); }},
          {label: "Exception", render: function (f) { var x = E.exceptionFor(f.key); return x ? UI.chip(x.id, "ok") : UI.link("exceptions?finding=" + encodeURIComponent(f.key), "None"); }, csv: function (f) { var x = E.exceptionFor(f.key); return x ? x.id : ""; }}
        ]});
      function apply() {
        tbl.setRows(sodF.filter(function (f) { return (ruleSel === "ALL" || f.ruleId === ruleSel) && (sevSel === "ALL" || f.sev === sevSel); }));
      }
      root.appendChild(UI.section("Conflicts found in the population", "Expand a row to see the exact accounts and roles behind it.", tbl));
      return root;
    }
  };

  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  function detail(f) {
    var rule = E.rules[f.ruleId];
    return h("div", {class: "grid g2"},
      h("div", null, h("h3", null, "Side A: " + rule.a.map(function (k) { return E.ref.capabilities[k].label; }).join(" / ")),
        h("ul", {class: "plain small"}, f.evA.map(function (e) { return h("li", null, h("span", {class: "id"}, e.acctId), " " + e.roleName + " (" + E.ref.capabilities[e.cap].txn + ")"); }))),
      h("div", null, h("h3", null, "Side B: " + rule.b.map(function (k) { return E.ref.capabilities[k].label; }).join(" / ")),
        h("ul", {class: "plain small"}, f.evB.map(function (e) { return h("li", null, h("span", {class: "id"}, e.acctId), " " + e.roleName + " (" + E.ref.capabilities[e.cap].txn + ")"); }))),
      h("p", {class: "small"}, h("strong", null, "Scenario: "), rule.example),
      h("p", {class: "small"}, h("strong", null, "Suggested fix: "), f.withinRole ? "Replace the combined role with the two separate roles and give one to someone else." : "Remove one side, or route to the exception workflow with compensating controls."));
  }

  function checker() {
    var box = h("div", {class: "card"});
    var checks = {}, out = h("div", {style: "margin-top:12px"});
    var cols = h("div", {class: "grid g4"});
    E.ref.systems.forEach(function (s) {
      var col = h("div", null, h("h3", null, s.name));
      E.ref.roles.filter(function (r) { return r.sys === s.id; }).forEach(function (r) {
        var cb = h("input", {type: "checkbox", id: "chk-" + r.id, onchange: run});
        checks[r.id] = cb;
        col.appendChild(h("label", {class: "small", style: "display:flex;gap:6px;margin:3px 0;align-items:flex-start", title: r.desc}, cb, r.name));
      });
      cols.appendChild(col);
    });
    var quick = [
      ["Journal poster + approver", ["EBS-GL-ACC", "EBS-GL-SUP"]],
      ["Supplier master + payments", ["EBS-SUP-MSTR", "EBS-AP-PAY"]],
      ["User admin + access approver", ["EBS-USR-ADM", "EBS-ACC-APPR"]],
      ["Developer + prod-DB", ["GH-DEV", "GH-PROD-DB"]],
      ["AP payments + Kyriba release", ["EBS-AP-PAY", "KY-PAY-APPR"]],
      ["A clean combination", ["EBS-AP-ENTRY", "EBS-INQ"]]
    ];
    var qrow = h("div", {class: "row", style: "margin-bottom:10px"}, h("span", {class: "muted small"}, "Quick examples:"));
    quick.forEach(function (q) {
      qrow.appendChild(h("button", {class: "btn sm", type: "button", onclick: function () {
        Object.keys(checks).forEach(function (k) { checks[k].checked = q[1].indexOf(k) >= 0; });
        run();
      }}, q[0]));
    });
    qrow.appendChild(h("button", {class: "btn sm ghost", type: "button", onclick: function () { Object.keys(checks).forEach(function (k) { checks[k].checked = false; }); run(); }}, "Clear"));
    function run() {
      U.clear(out);
      var ids = Object.keys(checks).filter(function (k) { return checks[k].checked; });
      if (!ids.length) { out.appendChild(h("p", {class: "muted"}, "Tick some roles.")); return; }
      var res = E.conflictsForRoles(ids);
      if (!res.length) { out.appendChild(h("div", {class: "verdict ok"}, "No SoD rule fires for this combination.")); return; }
      out.appendChild(h("div", {class: "verdict bad"}, res.length + " rule(s) fire"));
      res.forEach(function (x) {
        out.appendChild(h("div", {class: "note bad"}, h("div", {class: "row"}, h("strong", null, x.rule.id + " " + x.rule.name), UI.sev(x.rule.sev)),
          h("div", {class: "small"}, uniq(x.evA.map(function (e) { return e.roleName; })).join(", ") + "  versus  " + uniq(x.evB.map(function (e) { return e.roleName; })).join(", ")),
          h("div", {class: "small muted"}, x.rule.example)));
      });
    }
    box.appendChild(qrow); box.appendChild(cols); box.appendChild(out);
    run();
    return box;
  }
})();
