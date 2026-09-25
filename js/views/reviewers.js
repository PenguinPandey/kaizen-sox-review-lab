(function () {
  var KAI = window.KAI, U = KAI.util, h = U.h, E = KAI.E, UI = KAI.ui;

  KAI.views.reviewers = {
    title: "2. Reviewer assignment",
    render: function () {
      var root = h("div"), st = E.stats();
      var A = E.assignments;
      root.appendChild(UI.page("2. Reviewer assignment: who reviews whose access",
        "A reviewer has to understand what the access allows, must not be the person who holds it, and must not be the IT admin of that system. The engine applies those rules to all " + st.accounts + " accounts and escalates when the obvious reviewer isn't eligible."));

      var dual = E.accounts.filter(function (a) { return A[a.id].dual; }).length;
      var esc = E.accounts.filter(function (a) { return A[a.id].primary.skipped.length || (A[a.id].secondary && A[a.id].secondary.skipped.length); }).length;
      var violations = E.validateAssignments().length;
      var naive = E.naive();
      root.appendChild(h("div", {class: "grid g4"},
        UI.kpi("Accounts assigned", st.accounts, "every one has a named primary reviewer"),
        UI.kpi("Second reviewer", dual, U.pct(dual, st.accounts) + " (all Blackline, all Kyriba, plus high-risk roles)"),
        UI.kpi("Needed escalation", esc, "first choice was not eligible"),
        UI.kpi("Rule violations", violations, "self-review, level, admin, leaver", violations ? "crit" : "ok")));

      /* rules */
      root.appendChild(UI.section("The assignment rules", "In this order. The first person up the management chain who passes every test becomes the reviewer.",
        h("div", {class: "grid g2"},
          h("div", {class: "card"}, h("h3", null, "Who is asked"),
            h("ol", {class: "plain"},
              h("li", null, h("strong", null, "Primary reviewer: "), "the account holder's line manager (for shared or service accounts, the owner's manager)."),
              h("li", null, h("strong", null, "Second reviewer: "), "the system business owner for the role's function (Financial Controller, Treasurer, Head of Procurement, CTO...). Required for every Blackline and Kyriba account, and for any high-risk role elsewhere."),
              h("li", null, h("strong", null, "IT admin roles: "), "reviewed by the business owner, never by the admin's own IT team alone."))),
          h("div", {class: "card"}, h("h3", null, "Who is rejected (and the chain moves up)"),
            h("ul", {class: "flags"},
              h("li", null, "The account holder or owner (self-review)"),
              h("li", null, "Anyone who has left the company (HR field is stale)"),
              h("li", null, "Anyone below Manager level (level " + E.MIN_REVIEWER_LEVEL + "); a team lead cannot judge finance access"),
              h("li", null, "Anyone who does not rank above the holder (no reciprocal or upward review)"),
              h("li", null, "Anyone who administers that system (business owner is not the IT admin)"),
              h("li", null, "For the second review: the primary reviewer (two independent people)"))))));

      /* naive vs engine */
      var byReason = {};
      naive.forEach(function (n) {
        var k = n.reason.indexOf("Administers") === 0 ? "Reviewer administers the system" : n.reason.split(" (")[0];
        byReason[k] = (byReason[k] || 0) + 1;
      });
      root.appendChild(UI.section("Why not just use the HR line manager?", "Same accounts, assigned two ways. The simple approach fails on " + naive.length + " accounts.",
        h("div", {class: "grid g2"},
          h("div", {class: "card"}, h("h3", null, "Simple approach: HR line manager, or owner for shared accounts"),
            h("ul", {class: "flags"}, Object.keys(byReason).sort(function (a, b) { return byReason[b] - byReason[a]; }).map(function (k) {
              return h("li", null, h("strong", null, byReason[k] + " accounts: "), k);
            }))),
          h("div", {class: "card"}, h("h3", null, "This engine"),
            h("p", null, h("span", {class: violations ? "cov-bad" : "cov-ok"}, violations + " violations")),
            h("p", {class: "muted small"}, "Each failed choice is logged with its reason and the chain moves up. Every final assignment is re-checked from scratch on page load."),
            h("p", {class: "small"}, "See the escalation log below.")))));

      /* try to break it */
      root.appendChild(UI.section("Try to break it", "Pick any account and any person as reviewer. The engine says whether that would be allowed and why not.", tester()));

      /* escalation log */
      var escRows = [];
      E.accounts.forEach(function (a) {
        var x = A[a.id];
        x.primary.skipped.forEach(function (s) { escRows.push({acct: a, slot: "Primary", skip: s, final: x.primary.id}); });
        if (x.secondary) x.secondary.skipped.forEach(function (s) { escRows.push({acct: a, slot: "Second", skip: s, final: x.secondary.id}); });
      });
      root.appendChild(UI.section("Escalation log", "Every time the first choice was rejected. " + escRows.length + " rejections across " + esc + " accounts.",
        UI.table({rows: escRows, csvName: "reviewer-escalations.csv", pageSize: 40, searchPlaceholder: "Search person, reason, system...", cols: [
          {label: "Account", render: function (r) { return h("span", null, UI.sys(r.acct.sys), " ", h("span", {class: "id"}, r.acct.user)); }, csv: function (r) { return r.acct.id; }, sort: function (r) { return r.acct.id; }},
          {label: "Holder", render: function (r) { return UI.person(r.acct.holder); }, csv: function (r) { return E.name(r.acct.holder); }},
          {label: "Slot", render: function (r) { return r.slot; }},
          {label: "Rejected", render: function (r) { return UI.person(r.skip.id, {title: true}); }, csv: function (r) { return E.name(r.skip.id); }},
          {label: "Reason", cls: "wide", render: function (r) { return r.skip.reason; }},
          {label: "Reviewer used", render: function (r) { return UI.person(r.final); }, csv: function (r) { return E.name(r.final); }}
        ]})));

      /* who reviews the reviewers */
      var rv = E.reviewers();
      root.appendChild(UI.section("Who reviews the reviewers", "Reviewers have accounts too. Each one's own access goes to the next person up, so the chain ends at the Audit Committee Chair rather than at a person reviewing themselves.",
        UI.table({rows: rv, csvName: "reviewer-workload.csv", pageSize: 20, searchPlaceholder: "Search reviewers...", cols: [
          {label: "Reviewer", render: function (r) { return UI.person(r.id, {title: true}); }, csv: function (r) { return E.name(r.id); }, sort: function (r) { return E.name(r.id); }},
          {label: "Primary", render: function (r) { return r.primary; }, sort: function (r) { return r.primary; }},
          {label: "Second", render: function (r) { return r.secondary; }, sort: function (r) { return r.secondary; }},
          {label: "Systems", render: function (r) { return UI.sysList(Object.keys(r.bySys)); }, csv: function (r) { return Object.keys(r.bySys).join(" "); }},
          {label: "Their own access is reviewed by", cls: "wide", render: function (r) {
            var mine = E.acctsOf(r.id);
            if (!mine.length) return h("span", {class: "muted"}, "No accounts in scope");
            var seen = {};
            mine.forEach(function (a) { seen[A[a.id].primary.id] = 1; if (A[a.id].secondary) seen[A[a.id].secondary.id] = 1; });
            return h("span", null, Object.keys(seen).map(function (id, i) { return [i ? ", " : "", UI.person(id)]; }));
          }, csv: function (r) {
            var seen = {};
            E.acctsOf(r.id).forEach(function (a) { seen[E.name(A[a.id].primary.id)] = 1; });
            return Object.keys(seen).join("; ");
          }},
          {label: "Load", render: function (r) { return r.primary + r.secondary > 60 ? UI.chip("heavy", "High") : UI.chip("ok", "ok"); }, csv: false}
        ]})));

      /* full list */
      root.appendChild(UI.section("Every assignment", null,
        UI.table({rows: E.accounts, csvName: "reviewer-assignments.csv", pageSize: 50, searchPlaceholder: "Search by user, holder or reviewer...",
          searchText: function (a) { return [a.id, a.user, a.sys, E.name(a.holder), E.name(A[a.id].primary.id), A[a.id].secondary ? E.name(A[a.id].secondary.id) : ""].join(" "); },
          cols: [
            {label: "System", render: function (a) { return UI.sys(a.sys); }, csv: function (a) { return a.sys; }, sort: function (a) { return a.sys; }},
            {label: "Account", render: function (a) { return h("span", {class: "id"}, a.user); }, csv: function (a) { return a.user; }, sort: function (a) { return a.user; }},
            {label: "Holder", render: function (a) { return UI.person(a.holder); }, csv: function (a) { return E.name(a.holder); }, sort: function (a) { return E.name(a.holder); }},
            {label: "Type", render: function (a) { return a.type; }, sort: function (a) { return a.type; }},
            {label: "Primary reviewer", render: function (a) { return UI.person(A[a.id].primary.id, {title: true}); }, csv: function (a) { return E.name(A[a.id].primary.id); }},
            {label: "Second reviewer", render: function (a) { var s = A[a.id].secondary; return s ? h("span", null, UI.person(s.id, {title: true}), h("div", {class: "muted small"}, s.why)) : h("span", {class: "muted"}, "-"); }, csv: function (a) { var s = A[a.id].secondary; return s ? E.name(s.id) : ""; }}
          ]})));
      return root;
    }
  };

  function tester() {
    var box = h("div", {class: "card"});
    var accts = E.accounts.filter(function (a) { return E.assignments[a.id].primary.id; });
    var acctSel = UI.combo(accts.map(function (a) { return {value: a.id, label: a.sys + " | " + a.user + " | " + E.name(a.holder) + " (" + a.type + ")"}; }), accts[0].id, run, {"aria-label": "Account: type to search"});
    var slotSel = UI.select([{value: "primary", label: "as primary reviewer"}, {value: "secondary", label: "as second reviewer"}], "primary", run, {"aria-label": "Slot"});
    var people = Object.keys(E.people).map(function (id) { return E.people[id]; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    var perSel = UI.combo(people.map(function (p) { return {value: p.id, label: p.name + " - " + p.title + " (L" + p.level + (p.status !== "Active" ? ", LEFT" : "") + ")"}; }), people[0].id, run, {"aria-label": "Candidate reviewer: type to search"});
    var out = h("div", {style: "margin-top:12px"});
    var quick = h("div", {class: "row", style: "margin-top:10px"}, h("span", {class: "muted small"}, "Quick cases:"));
    function pickCase(label, fn) {
      quick.appendChild(h("button", {class: "btn sm", type: "button", onclick: function () { fn(); run(); }}, label));
    }
    pickCase("Reviewer = holder", function () { perSel.value = acctSel.value ? E.acct[acctSel.value].holder : perSel.value; slotSel.value = "primary"; });
    pickCase("A leaver", function () {
      var id = Object.keys(E.people).filter(function (i) { return E.people[i].status === "Terminated" && E.people[i].level >= 3; })[0];
      perSel.value = id;
    });
    pickCase("The holder's own report", function () {
      var a = E.acct[acctSel.value];
      var rep = Object.keys(E.people).filter(function (i) { return E.people[i].managerId === a.holder; })[0] || Object.keys(E.people).filter(function (i) { return E.people[i].level < E.people[a.holder].level; })[0];
      perSel.value = rep;
    });
    pickCase("A GitHub org owner", function () {
      var id = Object.keys(E.people).filter(function (i) { return E.isAdminIn(i, "GH") && E.people[i].status === "Active"; })[0];
      var a = E.accounts.filter(function (x) { return x.sys === "GH" && x.holder !== id && E.people[x.holder].level < E.people[id].level; })[0];
      acctSel.value = a.id; perSel.value = id; slotSel.value = "primary";
    });
    function run() {
      U.clear(out);
      var a = E.acct[acctSel.value];
      var res = E.checkReviewer(a.id, perSel.value, slotSel.value);
      var cur = E.assignments[a.id];
      if (slotSel.value === "secondary" && !cur.secondary) {
        out.appendChild(h("div", {class: "verdict warn"}, "This account has no second reviewer (standard risk). Choose 'primary'."));
        return;
      }
      if (res.hard) out.appendChild(h("div", {class: "verdict bad"}, "Blocked: " + res.hard));
      else if (res.warn) out.appendChild(h("div", {class: "verdict warn"}, "Allowed with a warning: " + res.warn));
      else out.appendChild(h("div", {class: "verdict ok"}, "Allowed. This person passes every reviewer rule for this account."));
      var chosen = slotSel.value === "primary" ? cur.primary : cur.secondary;
      out.appendChild(h("p", {class: "muted small", style: "margin-top:8px"}, "The engine would use: ", UI.person(chosen.id, {title: true}), chosen.skipped.length ? " (after rejecting " + chosen.skipped.map(function (s) { return E.name(s.id); }).join(", ") + ")" : ""));
    }
    box.appendChild(h("div", {class: "row"}, h("span", null, "Account (type to search)"), acctSel));
    box.appendChild(h("div", {class: "row", style: "margin-top:8px"}, h("span", null, "Reviewer (type to search)"), perSel, slotSel));
    box.appendChild(quick);
    box.appendChild(out);
    run();
    return box;
  }
})();
