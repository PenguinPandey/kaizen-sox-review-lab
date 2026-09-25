(function () {
  var KAI = window.KAI, U = KAI.util, h = U.h, E = KAI.E, UI = KAI.ui;

  KAI.views.exceptions = {
    title: "5. Exception workflow",
    render: function (q) {
      var root = h("div");
      root.appendChild(UI.page("5. Exception approval workflow: when access stays despite the review",
        "Sometimes a flagged access is genuinely needed. It may stay only through this workflow: a written reason, compensating controls, a short expiry, and an approver who outranks the reviewer. Leavers and shared logins can never be retained."));

      /* steps */
      root.appendChild(UI.section("The workflow", null, h("div", {class: "steps"}, E.proc.workflow.map(function (s) {
        return h("div", {class: "step"}, h("div", {class: "n"}, s.n), h("h3", null, s.title), h("div", {class: "who"}, s.who), h("p", null, s.text));
      }))));

      /* limits */
      var lim = E.proc.maxExceptionDays;
      root.appendChild(UI.section("Limits by severity", "Tier 1 systems (Blackline, Kyriba) are treated like Critical whatever the finding's own severity.",
        UI.table({search: false, noMax: true, rows: E.ref.severities, cols: [
          {label: "Severity", render: function (s) { return UI.sev(s); }},
          {label: "Longest exception", render: function (s) { return lim[s] + " days" + (lim[s] === 90 ? " (one review cycle)" : ""); }},
          {label: "Compensating controls", render: function (s) { return s === "Critical" ? "2 or more" : "1 or more (2 on Tier 1)"; }},
          {label: "Approver must be", cls: "mid", render: function (s) { return s === "Critical" || s === "High" ? "Above the reviewer; VP or C-suite (level 6+) for Critical" : "Above the reviewer, Senior Manager or higher"; }},
          {label: "ITGC Lead concurrence", render: function (s) { return s === "Critical" ? "Required" : "Required on Tier 1"; }},
          {label: "Removal if rejected", render: function (s) { return E.proc.slaDays[s] + " working days"; }}
        ]})));

      /* wizard */
      root.appendChild(UI.section("Request an exception", "Pick a finding as the reviewer and follow it through. The approver list shows who is eligible and why everyone else is not.", wizard(q)));

      /* register */
      root.appendChild(UI.section("Exception register", "Seeded exceptions plus any you create. Every entry is re-audited against the rules each time this page loads.", register()));
      return root;
    }
  };

  function wizard(q) {
    var box = h("div", {class: "card"});
    var all = E.findings.slice();
    var form = {kind: "sod", key: null, reviewerId: null, justification: "", controls: {}, days: 90, concurrence: false, approverId: null};
    if (q.finding && E.byKey[q.finding]) { form.key = q.finding; form.kind = E.byKey[q.finding].kind; }
    var body = h("div");
    box.appendChild(body);

    function findingsOfKind() { return all.filter(function (f) { return f.kind === form.kind; }); }
    function reviewersFor(f) {
      var ids = [];
      f.accountIds.forEach(function (id) {
        var x = E.assignments[id];
        [x.primary.id, x.secondary && x.secondary.id].forEach(function (r) { if (r && ids.indexOf(r) < 0) ids.push(r); });
      });
      return ids;
    }

    function draw() {
      U.clear(body);
      var kinds = Object.keys(E.proc.kinds);
      body.appendChild(h("div", {class: "grid g2"},
        h("div", null, h("label", {class: "f"}, "1. Type of finding"),
          UI.select(kinds.map(function (k) { return {value: k, label: E.proc.kinds[k].label + (E.proc.kinds[k].exceptable ? "" : " (cannot be retained)")}; }), form.kind, function (v) { form.kind = v; form.key = null; form.approverId = null; draw(); }, {"aria-label": "Type of finding"})),
        h("div", null, h("label", {class: "f"}, "2. Finding"),
          UI.select([{value: "", label: "Choose..."}].concat(findingsOfKind().map(function (f) {
            var x = E.exceptionFor(f.key);
            return {value: f.key, label: (f.ruleId ? f.ruleId + " " : "") + E.name(f.holderId) + " - " + (f.kind === "sod" ? f.title : f.detail.slice(0, 60)) + (x ? " [has exception]" : "")};
          })), form.key || "", function (v) { form.key = v || null; form.reviewerId = null; form.approverId = null; form.controls = {}; draw(); }, {"aria-label": "Finding", style: "max-width:100%;width:100%"}))));

      var f = form.key ? E.byKey[form.key] : null;
      if (!f) { body.appendChild(h("p", {class: "muted", style: "margin-top:12px"}, "Choose a finding to begin.")); return; }

      var lim = E.limits(f);
      body.appendChild(h("div", {class: "note " + (f.sev === "Critical" ? "bad" : "info"), style: "margin-top:12px"},
        h("div", {class: "row"}, UI.sev(f.sev), UI.sysList(f.systems), h("strong", null, f.title)),
        h("div", null, UI.person(f.holderId, {title: true}), ": ", f.detail)));

      if (!lim.exceptable) {
        body.appendChild(h("div", {class: "verdict bad"}, "This cannot be retained. " + E.proc.kinds[f.kind].label + " must be remediated: " + E.proc.kinds[f.kind].action + " within " + lim.slaDays + " working days, then re-pull the listing to prove it."));
        return;
      }
      var existing = E.exceptionFor(f.key);
      if (existing) body.appendChild(UI.note("good", "Already covered by ", h("strong", null, existing.id), ", valid until " + U.fmtDate(existing.expiresOn) + "."));

      var revIds = reviewersFor(f);
      if (!form.reviewerId) form.reviewerId = q.reviewer && revIds.indexOf(q.reviewer) >= 0 ? q.reviewer : revIds[0];
      if (!form.days || form.days > lim.maxDays) form.days = lim.maxDays;
      var recommended = E.controlsFor(f);
      if (!Object.keys(form.controls).length) recommended.forEach(function (c) { form.controls[c] = true; });

      body.appendChild(h("label", {class: "f"}, "3. Reviewer requesting the exception"));
      body.appendChild(UI.select(revIds.map(function (id) { return {value: id, label: E.label(id) + " (L" + E.people[id].level + ")"}; }), form.reviewerId, function (v) { form.reviewerId = v; form.approverId = null; draw(); }, {"aria-label": "Reviewer"}));

      body.appendChild(h("label", {class: "f"}, "4. Business justification (why is this access needed?)"));
      body.appendChild(h("textarea", {"aria-label": "Justification", placeholder: "Plain words: what job needs this, why can't it be split, what happens if we remove it.", oninput: function () { form.justification = this.value; validate(); }}, form.justification));

      body.appendChild(h("label", {class: "f"}, "5. Compensating controls (need " + lim.minControls + " or more)"));
      var cbox = h("div");
      Object.keys(E.ref.controls).forEach(function (k) {
        var c = E.ref.controls[k];
        cbox.appendChild(h("label", {style: "display:flex;gap:8px;margin:4px 0;align-items:flex-start"},
          h("input", {type: "checkbox", checked: !!form.controls[k], onchange: function () { form.controls[k] = this.checked; validate(); }}),
          h("span", null, h("strong", null, c.name), recommended.indexOf(k) >= 0 ? h("span", {class: "chip info", style: "margin-left:6px"}, "recommended") : null, h("div", {class: "muted small"}, c.detail))));
      });
      body.appendChild(cbox);

      body.appendChild(h("label", {class: "f"}, "6. Duration in days (maximum " + lim.maxDays + ")"));
      body.appendChild(h("div", {class: "row"}, h("input", {type: "number", min: 1, max: 400, value: form.days, style: "width:100px", "aria-label": "Days", oninput: function () { form.days = +this.value; validate(); }}),
        h("span", {class: "muted small", id: "exp-date"})));

      body.appendChild(h("label", {class: "f"}, "7. Approver (must outrank the reviewer)"));
      var cands = E.approverCandidates(f, form.reviewerId);
      body.appendChild(h("div", {class: "tw", style: "max-height:260px"}, h("table", {class: "tbl"},
        h("thead", null, h("tr", null, h("th", null, ""), h("th", null, "Person"), h("th", null, "Level"), h("th", null, "Eligible?"))),
        h("tbody", null, cands.map(function (c) {
          return h("tr", null,
            h("td", null, h("input", {type: "radio", name: "approver", value: c.p.id, disabled: !c.ok, checked: form.approverId === c.p.id, "aria-label": "Choose " + c.p.name, onchange: function () { form.approverId = c.p.id; validate(); }})),
            h("td", null, UI.person(c.p.id, {title: true})), h("td", null, "L" + c.p.level),
            h("td", null, c.ok ? UI.chip("Eligible", "ok") : h("span", {class: "small muted"}, c.why.join("; "))));
        })))));

      var conc = null;
      if (lim.concurrence) {
        conc = h("label", {style: "display:flex;gap:8px;margin-top:12px;align-items:flex-start"},
          h("input", {type: "checkbox", checked: form.concurrence, onchange: function () { form.concurrence = this.checked; validate(); }}),
          h("span", null, h("strong", null, "8. ITGC Lead concurrence. "), "As ITGC Lead I have confirmed the compensating controls are real and testable. Required for Critical and Tier 1. Internal Audit is informed."));
        body.appendChild(conc);
      }
      var result = h("div", {style: "margin-top:12px"});
      var submit = h("button", {class: "btn primary", type: "button", onclick: doSubmit}, "Register exception");
      body.appendChild(result);
      body.appendChild(h("div", {class: "row", style: "margin-top:10px"}, submit));

      function candidate() {
        return {key: f.key, personId: f.holderId, sys: f.sys === "CROSS" ? f.systems[0] : f.sys, reviewerId: form.reviewerId, approverId: form.approverId || form.reviewerId,
          approvedOn: E.asOf, expiresOn: U.addDays(E.asOf, Math.max(0, form.days || 0)),
          controls: Object.keys(form.controls).filter(function (k) { return form.controls[k]; }), justification: form.justification, sev: f.sev, concurrence: form.concurrence};
      }
      function validate() {
        U.clear(result);
        var ex = candidate(), au = E.exceptionAudit(ex);
        var expEl = body.querySelector("#exp-date");
        if (expEl) expEl.textContent = "expires " + U.fmtDate(ex.expiresOn);
        var checks = au.checks.slice();
        if (!form.approverId) checks[0] = {ok: false, label: "Approver chosen and outranks reviewer"};
        var textOk = form.justification.trim().length >= 20;
        checks.unshift({ok: textOk, label: "Justification written (20+ characters)"});
        var ok = checks.every(function (c) { return c.ok; }) && !!form.approverId;
        result.appendChild(h("ul", {class: "plain small", style: "list-style:none;padding:0"}, checks.map(function (c) {
          return h("li", null, h("span", {class: c.ok ? "cov-ok" : "cov-bad"}, c.ok ? "✓ " : "✗ "), c.label, c.detail ? h("span", {class: "muted"}, " (" + c.detail + ")") : null);
        })));
        submit.disabled = !ok;
        submit._ok = ok;
      }
      function doSubmit() {
        if (!submit._ok) return;
        var ex = candidate();
        var n = E.data.exceptions.length + KAI.state.exceptions.length + 1;
        ex.id = "EXC-2026-" + ("000" + n).slice(-4);
        ex.ticket = "ITSM-" + (90000 + n);
        ex.status = "Approved";
        ex.mine = true;
        KAI.state.exceptions.push(ex);
        KAI.save();
        KAI.go("exceptions");
        KAI.refresh();
      }
      validate();
    }
    draw();
    return box;
  }

  function register() {
    var rows = E.allExceptions().map(function (ex) { return {ex: ex, au: E.exceptionAudit(ex)}; });
    var wrap = h("div");
    var bad = rows.filter(function (r) { return r.au.status !== "Active"; }).length;
    if (bad) wrap.appendChild(UI.note("bad", h("strong", null, bad + " of " + rows.length + " register entries do not stand up to audit. "), "Expired items still have access and mis-approved items were never validly approved. The ITGC Lead must revoke or re-route them."));
    wrap.appendChild(UI.table({rows: rows, csvName: "exception-register.csv", search: false, noMax: true, rowClass: function (r) { return r.au.status === "Active" ? "" : "bad-row"; },
      expand: function (r) {
        var ex = r.ex;
        return h("div", {class: "grid g2"},
          h("div", null, h("h3", null, "Checks"), h("ul", {class: "plain small", style: "list-style:none;padding:0"}, r.au.checks.map(function (c) {
            return h("li", null, h("span", {class: c.ok ? "cov-ok" : "cov-bad"}, c.ok ? "✓ " : "✗ "), c.label, c.detail ? h("span", {class: "muted"}, " (" + c.detail + ")") : null);
          })), r.au.expired ? h("p", {class: "small cov-bad"}, "Expired " + Math.abs(r.au.daysLeft) + " days ago and not re-approved. Access should have been removed.") : null),
          h("div", null, h("h3", null, "Justification"), h("p", {class: "small"}, ex.justification || "-"),
            h("h3", null, "Compensating controls"), h("ul", {class: "plain small"}, (ex.controls || []).map(function (k) { return h("li", null, E.ref.controls[k] ? E.ref.controls[k].name : k); })),
            ex.mine ? h("button", {class: "btn sm danger", type: "button", onclick: function () {
              KAI.state.exceptions = KAI.state.exceptions.filter(function (x) { return x.id !== ex.id; }); KAI.save(); KAI.refresh();
            }}, "Delete my exception") : null));
      },
      cols: [
        {label: "ID", render: function (r) { return h("span", {class: "id"}, r.ex.id); }, csv: function (r) { return r.ex.id; }},
        {label: "Finding", cls: "wide", render: function (r) { var f = E.byKey[r.ex.key]; return h("div", null, UI.person(r.ex.personId), h("div", {class: "small muted"}, f ? (f.ruleId ? f.ruleId + " " : "") + f.title : "Finding no longer open")); }, csv: function (r) { return E.name(r.ex.personId) + " " + r.ex.key; }},
        {label: "Reviewer", render: function (r) { return h("span", null, UI.person(r.ex.reviewerId), " ", UI.chip("L" + E.people[r.ex.reviewerId].level)); }, csv: function (r) { return E.name(r.ex.reviewerId) + " L" + E.people[r.ex.reviewerId].level; }},
        {label: "Approver", render: function (r) { return h("span", null, UI.person(r.ex.approverId), " ", UI.chip("L" + E.people[r.ex.approverId].level, r.au.checks[0].ok ? "" : "bad")); }, csv: function (r) { return E.name(r.ex.approverId) + " L" + E.people[r.ex.approverId].level; }},
        {label: "Approved", render: function (r) { return U.fmtDate(r.ex.approvedOn); }, csv: function (r) { return r.ex.approvedOn; }},
        {label: "Expires", render: function (r) { return h("span", null, U.fmtDate(r.ex.expiresOn), h("div", {class: "small muted"}, r.au.daysLeft >= 0 ? r.au.daysLeft + " days left" : Math.abs(r.au.daysLeft) + " days overdue")); }, csv: function (r) { return r.ex.expiresOn; }},
        {label: "Status", render: function (r) { return h("span", {class: "chip " + (r.au.status === "Active" ? "ok" : "bad")}, r.au.status); }, csv: function (r) { return r.au.status; }},
        {label: "Source", render: function (r) { return r.ex.mine ? "You" : "Prior quarter"; }, csv: function (r) { return r.ex.mine ? "you" : "seeded"; }}
      ]}));
    return wrap;
  }
})();
