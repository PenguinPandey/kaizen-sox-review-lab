(function () {
  var KAI = window.KAI, U = KAI.util, h = U.h, E = KAI.E, UI = KAI.ui, C = KAI.charts;

  /* Shared with the printable report: returns the list of findings text and numbers. */
  KAI.analysis = function () {
    var st = E.stats(), F = E.findings;
    function cnt(fn) { return F.filter(fn).length; }
    function people(fn) {
      var m = {};
      F.filter(fn).forEach(function (f) { if (f.personId) m[f.personId] = 1; });
      return Object.keys(m).length;
    }
    var a = {st: st};
    a.leaverAccts = cnt(function (f) { return f.kind === "leaver"; });
    a.leaverPeople = people(function (f) { return f.kind === "leaver"; });
    a.postLogin = cnt(function (f) { return f.kind === "leaver" && /AFTER/.test(f.detail); });
    a.kyLeaver = F.filter(function (f) { return f.kind === "leaver" && f.sys === "KY"; });
    a.sodTotal = cnt(function (f) { return f.kind === "sod"; });
    a.sodPeople = people(function (f) { return f.kind === "sod"; });
    a.sodCrit = cnt(function (f) { return f.kind === "sod" && f.sev === "Critical"; });
    a.r = function (id) { return cnt(function (f) { return f.ruleId === id; }); };
    a.movers = cnt(function (f) { return f.kind === "mismatch" && /Moved from/.test(f.detail); });
    a.mismatch = cnt(function (f) { return f.kind === "mismatch"; });
    a.dormant = cnt(function (f) { return f.kind === "dormant"; });
    a.dormantHigh = cnt(function (f) { return f.kind === "dormant" && f.sev === "High"; });
    a.contractors = cnt(function (f) { return f.kind === "contractor"; });
    a.shared = cnt(function (f) { return f.kind === "generic"; });
    a.svcowner = cnt(function (f) { return f.kind === "svcowner"; });
    a.noticket = cnt(function (f) { return f.kind === "noticket"; });
    a.ghDev = E.accounts.filter(function (x) { return x.sys === "GH" && x.type === "Named"; }).length;
    a.repoAdmins = E.accounts.filter(function (x) { return x.roles.indexOf("GH-REPO-ADMIN") >= 0; }).length;
    a.orgOwnerLeft = E.accounts.filter(function (x) { return x.roles.indexOf("GH-ORG-OWNER") >= 0 && x.person && E.people[x.person].status === "Terminated"; }).length;
    a.escalated = E.accounts.filter(function (x) { return E.assignments[x.id].primary.skipped.length > 0; }).length;
    a.flaggedRate = function (id) { var d = st.bySys[id]; return Object.keys(d.flagged).length / d.accounts; };
    a.exAudits = E.allExceptions().map(function (ex) { return {ex: ex, au: E.exceptionAudit(ex)}; });
    return a;
  };

  KAI.views.analysis = {
    title: "Analysis",
    render: function () {
      var A = KAI.analysis(), st = A.st, org = E.ref.org;
      var root = h("div");
      root.appendChild(UI.page("Analysis of the " + org.reviewPeriod + " review",
        "Computed live from the synthetic population by the same rules the workbench uses. Population as of " + U.fmtDate(org.asOf) + ". Numbers on this page will change if you regenerate the data."));

      var critAccts = Object.keys(E.findings.filter(function (f) { return f.sev === "Critical"; }).reduce(function (m, f) { f.accountIds.forEach(function (i) { m[i] = 1; }); return m; }, {})).length;
      root.appendChild(h("div", {class: "grid g6"},
        UI.kpi("Accounts in scope", st.accounts, st.identities + " people"),
        UI.kpi("Accounts with a finding", st.flaggedAccounts, U.pct(st.flaggedAccounts, st.accounts) + " of population"),
        UI.kpi("Critical findings", st.sev.Critical, critAccts + " accounts", "crit"),
        UI.kpi("Leavers still active", A.leaverAccts, A.leaverPeople + " people", "crit"),
        UI.kpi("SoD conflicts", A.sodTotal, A.sodPeople + " people, " + A.sodCrit + " critical", "high"),
        UI.kpi("Dormant / never used", A.dormant, A.dormantHigh + " with high-risk roles")));

      /* by system */
      var rows = E.ref.systems.map(function (s) {
        return {label: s.name, note: s.tier === 1 ? "Tier 1" : "Tier 2", seg: st.bySys[s.id].sev};
      });
      rows.push({label: "Cross-system", note: "Conflicts spanning systems", seg: st.cross.sev});
      root.appendChild(UI.section("Findings by system and severity", "One finding is one issue on one account (or one SoD conflict for one person).",
        h("div", {class: "card"}, C.stacked(rows))));

      /* scrutiny */
      var rateRows = E.ref.systems.map(function (s) {
        var d = st.bySys[s.id];
        return {label: s.name, note: Object.keys(d.flagged).length + " of " + d.accounts + " accounts", value: Object.keys(d.flagged).length, total: d.accounts};
      });
      var t1a = 0, t1f = 0, t2a = 0, t2f = 0;
      E.ref.systems.forEach(function (s) {
        var d = st.bySys[s.id], f = Object.keys(d.flagged).length;
        if (s.tier === 1) { t1a += d.accounts; t1f += f; } else { t2a += d.accounts; t2f += f; }
      });
      var riskRows = E.ref.systems.map(function (s) {
        var list = E.accounts.filter(function (a) { return a.sys === s.id; });
        var hi = list.filter(function (a) { return a.maxRisk >= 3; }).length;
        return {label: s.name, note: hi + " of " + list.length + " accounts", value: hi, total: list.length};
      });
      root.appendChild(UI.section("Why Blackline and Kyriba get higher scrutiny", "Two views: how often accounts are flagged, and how much damage one account could do.",
        h("div", {class: "grid g2"},
          h("div", {class: "card"}, h("h3", null, "Accounts with at least one finding"), C.rate(rateRows)),
          h("div", {class: "card"}, h("h3", null, "Accounts holding a high-risk role (approve, pay, admin)"), C.rate(riskRows, "Critical"))),
        h("div", {class: "card", style: "margin-top:14px"},
          h("p", null, "Flag rates are close: ", h("strong", null, U.pct(t1f, t1a)), " in Tier 1 (Blackline, Kyriba) against ", h("strong", null, U.pct(t2f, t2a)), " in Tier 2 (Oracle EBS, GitHub). Frequency is not the argument."),
          h("p", {class: "muted"}, "Impact is. In Blackline and Kyriba a large share of users can approve, release or administer, and one unchecked approver either signs off the close or moves cash. That is why both systems get a second reviewer on every account, a 90-day cap on exceptions and CFO-level approval, while Oracle EBS and GitHub escalate only their high-risk roles."),
          A.kyLeaver.length ? UI.note("bad", h("strong", null, "Kyriba: "), A.kyLeaver.length + " person who has left still holds a payment role. ", UI.link("accounts", "See accounts")) : null)));

      /* heat */
      var kinds = ["leaver", "contractor", "svcowner", "generic", "sod", "mismatch", "dormant", "noticket"];
      var cols = ["EBS", "BL", "KY", "GH", "CROSS"];
      var heat = kinds.map(function (k) {
        return {label: E.proc.kinds[k].label, cells: cols.map(function (c) { return E.findings.filter(function (f) { return f.kind === k && f.sys === c; }).length; })};
      });
      root.appendChild(UI.section("What kind of problem, where", "Darker means more findings.", C.heat(["Oracle EBS", "Blackline", "Kyriba", "GitHub", "Cross-system"], heat)));

      /* narrative */
      var bullets = [
        ["Joiner-mover-leaver control is the biggest gap.", A.leaverAccts + " active accounts belong to " + A.leaverPeople + " people who have left. " + A.postLogin +
          " of those accounts were used after the person's last day. That needs an incident check, not just a removal.", "accounts"],
        ["Segregation of duties.", A.sodTotal + " conflicts across " + A.sodPeople + " people (" + A.sodCrit + " critical). Journal post+approve: " + A.r("R01") +
          ". Supplier create+pay: " + A.r("R02") + ". Provision+approve access: " + A.r("R03") + ". Payment cycle across Oracle and Kyriba: " + A.r("R11") + ".", "sod"],
        ["Blackline close control.", A.r("R08") + " users can prepare and approve their own reconciliations, and " + A.r("R12") + " people can post journals in Oracle and sign off reconciliations in Blackline.", "sod"],
        ["Kyriba cash control.", A.r("R09") + " user can initiate and release a payment alone, " + A.r("R10") + " can add a beneficiary and release to it, " + A.r("R14") + " confirms their own deals.", "sod"],
        ["GitHub and production data.", A.r("R04") + " of " + A.ghDev + " named GitHub users are developers with production-database read access (dev + prod). " + A.r("R05") +
          " can approve their own production deployments, " + A.repoAdmins + " repository admins can switch off branch protection, and " + A.orgOwnerLeft + " organisation owner has left the company.", "sod"],
        ["Movers keep old access.", A.mismatch + " accounts carry roles that don't fit the department; " + A.movers + " belong to people who transferred and were never cleaned up.", "accounts"],
        ["Dormant and unapproved.", A.dormant + " dormant or never-used accounts (" + A.dormantHigh + " with high-risk roles) and " + A.noticket + " accounts with no approved request ticket.", "accounts"],
        ["Ownership.", A.shared + " shared logins and " + A.svcowner + " service account whose owner has left; nobody is accountable.", "accounts"],
        ["Review mechanics.", A.escalated + " accounts could not go to the HR line manager (manager left, below Manager level, or admin of the system), so the engine escalated to the next eligible person.", "reviewers"]
      ];
      root.appendChild(UI.section("What the review found", null,
        h("div", {class: "card"}, h("ul", {class: "plain"}, bullets.map(function (b) {
          return h("li", null, h("strong", null, b[0] + " "), b[1], " ", UI.link(b[2], "Drill in"));
        })))));

      /* reviewer concentration */
      var rv = E.reviewers().slice(0, 8);
      root.appendChild(UI.section("Who carries the review", "Top reviewers by workload. A person with 100+ accounts is a rubber-stamp risk; a handful of business owners should carry only the high-risk second reviews.",
        UI.table({search: false, noMax: true, rows: rv, cols: [
          {label: "Reviewer", render: function (r) { return UI.person(r.id, {title: true}); }},
          {label: "As primary", render: function (r) { return r.primary; }, sort: function (r) { return r.primary; }},
          {label: "As second", render: function (r) { return r.secondary; }, sort: function (r) { return r.secondary; }},
          {label: "Systems", render: function (r) { return UI.sysList(Object.keys(r.bySys)); }}
        ]}),
        rv[0].primary + rv[0].secondary > 60 ? UI.note("warn", h("strong", null, E.name(rv[0].id) + " carries " + (rv[0].primary + rv[0].secondary) + " review tasks. "),
          "Dual review of every Tier 1 user concentrates work on the business owner. Name a deputy at Senior Manager level or above in the assignment list for standard (non-privileged) users, and keep privileged and high-risk accounts with the owner. Do not delegate below Manager level.") : null));

      /* exceptions */
      var ex = A.exAudits;
      var byStatus = {Active: 0, Expired: 0, "Non-compliant": 0};
      ex.forEach(function (x) { byStatus[x.au.status]++; });
      var soon = ex.filter(function (x) { return x.au.status === "Active" && x.au.daysLeft <= 30; }).length;
      root.appendChild(UI.section("Exception register health", null,
        h("div", {class: "grid g4"},
          UI.kpi("On the register", ex.length),
          UI.kpi("Valid and current", byStatus.Active, soon + " expire within 30 days", "ok"),
          UI.kpi("Expired, still open", byStatus.Expired, "access should have been removed", "crit"),
          UI.kpi("Approval not compliant", byStatus["Non-compliant"], "approver does not outrank reviewer or a check failed", "crit")),
        h("p", {style: "margin-top:10px"}, UI.link("exceptions", "Open the register"))));

      /* recommendations */
      var recs = [
        ["P1", "Disable every leaver account and investigate logins after departure", "IT Service Desk + HR; Head of IT Ops signs off", "2 working days", A.leaverAccts + " accounts", "accounts"],
        ["P1", "Remove production-DB read from developers; move to time-boxed break-glass with ticket and query logging", "CTO + Infrastructure DBA", "5 working days", A.r("R04") + " developers", "sod"],
        ["P1", "Kyriba: remove Payment Super User and any bank-maintain plus release combinations; verify approvers against bank signatory lists", "Treasurer + CFO", "5 working days", (A.r("R09") + A.r("R10") + A.r("R11")) + " conflicts", "sod"],
        ["P1", "Assign a new owner or decommission accounts whose owner has left; replace shared logins", "Enterprise Apps Manager, DevOps", "10 working days", (A.svcowner + A.shared) + " accounts", "accounts"],
        ["P2", "Split Blackline preparer and approver; retire the combined role", "Financial Controller", "By " + U.fmtDate(org.reviewDue), (A.r("R08") + A.r("R12")) + " conflicts", "sod"],
        ["P2", "Remove GL and PO super-user roles; separate journal post and approve; separate PO create and approve", "Controller + Head of Procurement", "By " + U.fmtDate(org.reviewDue), (A.r("R01") + A.r("R06") + A.r("R07")) + " conflicts", "sod"],
        ["P2", "Approve exceptions only through the workflow; re-approve or close the ones that are expired or mis-approved", "ITGC Lead + CFO", "By " + U.fmtDate(org.reviewDue), (byStatus.Expired + byStatus["Non-compliant"]) + " register entries", "exceptions"],
        ["P3", "Clean up movers and revoke dormant accounts; ask managers to confirm seasonal users", "Line managers", "By " + U.fmtDate(org.reviewDue), (A.mismatch + A.dormant) + " accounts", "accounts"],
        ["P3", "Retro-approve or revoke access with no request ticket", "Business owners", "By " + U.fmtDate(org.reviewDue), A.noticket + " accounts", "accounts"],
        ["Process", "Automate the HR leaver feed into Oracle, Blackline, Kyriba and GitHub, and trigger a mini-review on every transfer, so problems don't wait for the quarterly cycle", "CIO + CHRO", "Design by " + U.fmtDate(org.nextReview), "root cause of leavers and movers", "criteria"]
      ];
      root.appendChild(UI.section("Recommendations", "Ordered by risk. Owners are roles in the org chart, not the reviewer's own team.",
        UI.table({search: false, noMax: true, rows: recs, cols: [
          {label: "Priority", render: function (r) { return h("span", {class: "chip " + (r[0] === "P1" ? "Critical" : r[0] === "P2" ? "High" : r[0] === "P3" ? "Medium" : "info")}, r[0]); }},
          {label: "Action", cls: "wide", render: function (r) { return r[1]; }},
          {label: "Owner", cls: "mid", render: function (r) { return r[2]; }},
          {label: "Due", render: function (r) { return r[3]; }},
          {label: "Covers", render: function (r) { return r[4]; }},
          {label: "", render: function (r) { return UI.link(r[5], "Open"); }}
        ]})));
      return root;
    }
  };
})();
