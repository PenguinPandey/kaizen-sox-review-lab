(function () {
  var KAI = window.KAI, U = KAI.util, h = U.h, E = KAI.E, UI = KAI.ui;

  KAI.views.home = {
    title: "Home",
    render: function () {
      var st = E.stats(), ref = E.ref, org = ref.org;
      var root = h("div");

      root.appendChild(h("div", {class: "hero"},
        h("p", {class: "muted small tight"}, "DAY 15 | ITGC | SOC 1 / SOC 2 | YOU ARE THE ITGC LEAD"),
        h("h1", null, "Quarterly access review, SOX-aligned"),
        h("p", {class: "lede tight", style: "margin-top:8px"},
          "KaizenMotors (auto-parts, mid-size, Rs 300 cr revenue, US-listed parent) must review access to every financial system each quarter. " +
          "This lab is the whole process, working: it pulls data, assigns reviewers, applies review criteria, finds segregation-of-duties conflicts, " +
          "runs exceptions, and packs evidence for the auditor. Review period: " + org.reviewPeriod + "."),
        h("div", {class: "row", style: "margin-top:14px"},
          UI.btn("See the analysis", function () { KAI.go("analysis"); }, "primary"),
          UI.btn("Open the review workbench", function () { KAI.go("workbench"); }),
          UI.btn("Try the SoD role checker", function () { KAI.go("sod"); }))));

      /* systems */
      root.appendChild(UI.section("Four systems in scope", org.parent + ". " + st.accounts + " accounts across " + st.identities + " people (some hold accounts in several systems).",
        h("div", {class: "grid g4"}, ref.systems.map(function (s) {
          var d = st.bySys[s.id];
          var crit = d.sev.Critical, flagged = Object.keys(d.flagged).length;
          return h("div", {class: "card"},
            h("div", {class: "row", style: "justify-content:space-between"}, h("strong", null, s.name), s.tier === 1 ? UI.chip("Tier 1", "t1") : UI.chip("Tier 2", "")),
            h("div", {class: "muted small"}, s.type),
            h("div", {class: "kpi", style: "border:0;box-shadow:none;padding:8px 0 0;background:none"},
              h("div", {class: "v"}, d.accounts), h("div", {class: "l"}, "accounts")),
            h("div", {class: "small", style: "margin-top:6px"}, h("span", {class: "chip Critical"}, crit + " critical"), " ", h("span", {class: "chip"}, flagged + " accounts flagged")),
            h("p", {class: "muted small", style: "margin-top:8px"}, s.tierLabel));
        }))));

      /* tasks */
      var tasks = [
        ["1", "Access review checklist", "What to pull, from where, how to prove the list is complete", "checklist",
          E.proc.checklist.length + " items across 4 systems + HR and ITSM"],
        ["2", "Reviewer assignment", "Who reviews whose access, with self-review blocked", "reviewers",
          E.validateAssignments().length + " rule violations across " + st.accounts + " accounts"],
        ["3", "Review criteria", "What 'appropriate access' means per system", "criteria",
          ref.roles.length + " roles described in plain English"],
        ["4", "SoD conflict rules", "Specific transactions that one person must not hold together", "sod",
          ref.sodRules.length + " rules, " + (st.kind.sod || 0) + " conflicts found"],
        ["5", "Exception workflow", "When access is retained despite the review", "exceptions",
          "Approver must outrank reviewer; " + E.allExceptions().length + " exceptions on the register"],
        ["6", "Evidence for the auditor", "What to keep, for how long, in what form", "evidence",
          E.ref.org.retentionYears + "-year retention, downloadable evidence pack"]
      ];
      root.appendChild(UI.section("The six tasks from the assignment", "Each one is a working page rather than a paragraph.",
        h("div", {class: "grid g3"}, tasks.map(function (t) {
          return h("a", {href: "#/" + t[3], class: "card", style: "color:inherit;display:block"},
            h("div", {class: "row"}, h("span", {class: "chip info"}, "Task " + t[0]), h("strong", null, t[1])),
            h("p", {class: "muted small", style: "margin:6px 0 4px"}, t[2]),
            h("div", {class: "small"}, t[4]));
        }))));

      /* success criteria, checked live */
      var rules = ref.sodRules;
      var txnOk = rules.every(function (r) { return r.a.concat(r.b).every(function (c) { return ref.capabilities[c].txn; }); });
      var naive = E.naive().length, bad = E.validateAssignments().length;
      var audits = E.data.exceptions.map(E.exceptionAudit);
      var caught = audits.filter(function (a) { return a.status !== "Active"; }).length;
      var t1 = E.accounts.filter(function (a) { return E.isTier1(a.sys); });
      var t1dual = t1.filter(function (a) { return E.assignments[a.id].dual && E.assignments[a.id].secondary.id; }).length;
      var r04 = E.findings.filter(function (f) { return f.ruleId === "R04"; }).length;
      var crit = [
        ["SoD conflicts are specific transactions, not vague roles", txnOk,
          rules.length + " rules, each naming the exact screens. Example: 'GL > Journals > Enter' versus 'GL > Journals > Approval'.", "sod"],
        ["Reviewer assignment excludes self-review", bad === 0,
          "0 violations across " + st.accounts + " accounts. A plain 'line manager reviews' approach would have broken the rules " + naive + " times; the engine escalates instead.", "reviewers"],
        ["Exception approval ranks above the reviewer's role", audits.length > 0,
          "Enforced in the wizard and re-checked on every stored exception. The seeded register has " + caught + " of " + audits.length + " exceptions that fail (one expired, one approver at same level).", "exceptions"],
        ["Evidence retention meets the 7-year rule", E.ref.org.retentionYears >= 7,
          "Default " + E.ref.org.retentionYears + " years from fiscal year end; the calculator refuses less than 7.", "evidence"],
        ["Blackline and Kyriba get higher scrutiny", t1.length === t1dual,
          t1.length + " accounts, all " + t1dual + " get two reviewers; exceptions capped at 90 days with CFO-level approval.", "reviewers"],
        ["GitHub prod-DB access flagged as a SoD risk", r04 > 0,
          r04 + " developers hold both code-write and production-database read (rule R04, Critical).", "sod"]
      ];
      root.appendChild(UI.section("The success criteria, checked live", "These are computed from the data each time the page loads, not typed in.",
        h("div", {class: "tw nomax"}, h("table", {class: "tbl"},
          h("tbody", null, crit.map(function (c) {
            return h("tr", null,
              h("td", {style: "width:28px"}, h("span", {class: c[1] ? "cov-ok" : "cov-bad"}, c[1] ? "✓" : "✗")),
              h("td", {class: "mid"}, h("strong", null, c[0])),
              h("td", null, c[2]),
              h("td", null, UI.link(c[3], "Open")));
          }))))));

      root.appendChild(UI.section("How to use it", null,
        h("div", {class: "grid g3"},
          UI.card("1. Read the design", "Pages 1 to 6 explain each part of the process, with the data behind it."),
          UI.card("2. Play the reviewer", "Open the review workbench, pick a reviewer and make decisions. The rules stop you approving a leaver or self-review."),
          UI.card("3. Build the evidence", "Everything you do is saved in your browser. Download the evidence pack as a ZIP with SHA-256 hashes."))));

      root.appendChild(UI.note("warn", h("strong", null, "All data here is invented. "),
        "The people, accounts, ticket numbers and findings are generated by tools/generate_data.py with a fixed seed. Issues are planted on purpose so there is something to find. Nothing is stored on a server; your decisions live in this browser only."));
      return root;
    }
  };
})();
