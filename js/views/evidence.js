(function () {
  var KAI = window.KAI, U = KAI.util, h = U.h, E = KAI.E, UI = KAI.ui;
  var lastPack = null;

  function col(label, fn) { return {label: label, csv: fn}; }

  /* ---------- pack contents ---------- */
  function buildFiles() {
    var A = E.assignments, S = KAI.state, files = [];
    function csv(name, rows, cols) { files.push({name: name, rows: rows.length, data: U.toCSV(rows, cols)}); }

    csv("01_population_accounts.csv", E.accounts, [
      col("account_id", function (a) { return a.id; }), col("system", function (a) { return E.sys[a.sys].name; }), col("username", function (a) { return a.user; }),
      col("account_type", function (a) { return a.type; }), col("holder_id", function (a) { return a.holder; }), col("holder_name", function (a) { return E.name(a.holder); }),
      col("roles", function (a) { return a.roles.join("; "); }), col("created", function (a) { return a.created; }), col("last_login", function (a) { return a.lastLogin || "never"; }),
      col("status", function (a) { return a.status; }), col("request_ticket", function (a) { return a.ticket || "NONE"; })]);

    var pids = Object.keys(E.people);
    csv("02_hr_master_extract.csv", pids.map(function (i) { return E.people[i]; }), [
      col("person_id", function (p) { return p.id; }), col("name", function (p) { return p.name; }), col("department", function (p) { return p.dept; }), col("title", function (p) { return p.title; }),
      col("level", function (p) { return p.level; }), col("manager_id", function (p) { return p.managerId || ""; }), col("type", function (p) { return p.type; }),
      col("status", function (p) { return p.status; }), col("termination_date", function (p) { return p.termDate || ""; }), col("contract_end", function (p) { return p.contractEnd || ""; }),
      col("previous_department", function (p) { return p.prevDept || ""; }), col("transfer_date", function (p) { return p.transferDate || ""; })]);

    csv("03_reviewer_assignments.csv", E.accounts, [
      col("account_id", function (a) { return a.id; }), col("holder", function (a) { return E.name(a.holder); }),
      col("primary_reviewer", function (a) { return E.name(A[a.id].primary.id); }), col("primary_reviewer_id", function (a) { return A[a.id].primary.id; }),
      col("primary_rejected", function (a) { return A[a.id].primary.skipped.map(function (s) { return E.name(s.id) + ": " + s.reason; }).join(" | "); }),
      col("second_reviewer", function (a) { return A[a.id].secondary ? E.name(A[a.id].secondary.id) : ""; }),
      col("second_reviewer_id", function (a) { return A[a.id].secondary ? A[a.id].secondary.id : ""; }),
      col("self_review", function (a) { return A[a.id].primary.id === a.holder || (A[a.id].secondary && A[a.id].secondary.id === a.holder) ? "YES" : "no"; })]);

    csv("04_findings.csv", E.findings, [
      col("finding_key", function (f) { return f.key; }), col("kind", function (f) { return f.kind; }), col("rule", function (f) { return f.ruleId || ""; }), col("severity", function (f) { return f.sev; }),
      col("systems", function (f) { return f.systems.join(" "); }), col("holder", function (f) { return E.name(f.holderId); }), col("accounts", function (f) { return f.accountIds.join(" "); }),
      col("title", function (f) { return f.title; }), col("detail", function (f) { return f.detail; }),
      col("exception_id", function (f) { var x = E.exceptionFor(f.key); return x ? x.id : ""; })]);

    csv("05_sod_rule_set.csv", E.ref.sodRules, [
      col("rule", function (r) { return r.id; }), col("name", function (r) { return r.name; }), col("severity", function (r) { return r.sev; }), col("scope", function (r) { return r.scope; }),
      col("side_a", function (r) { return r.a.join("; "); }), col("side_b", function (r) { return r.b.join("; "); }), col("risk", function (r) { return r.risk; })]);

    var dec = Object.keys(S.decisions).map(function (k) { var d = S.decisions[k]; return Object.assign({key: k}, d); });
    csv("06_review_decisions.csv", dec, [
      col("account_slot", function (d) { return d.key; }), col("reviewer", function (d) { return E.name(d.by); }), col("decision", function (d) { return d.decision; }),
      col("note", function (d) { return d.note || ""; }), col("decided_at", function (d) { return d.ts || ""; })]);

    var so = Object.keys(S.signoffs).map(function (k) { return S.signoffs[k]; });
    files.push({name: "07_reviewer_signoffs.json", rows: so.length, data: JSON.stringify(so, null, 2)});

    csv("08_exception_register.csv", E.allExceptions(), [
      col("id", function (x) { return x.id; }), col("finding", function (x) { return x.key; }), col("holder", function (x) { return E.name(x.personId); }), col("reviewer", function (x) { return E.name(x.reviewerId); }),
      col("approver", function (x) { return E.name(x.approverId); }), col("approved_on", function (x) { return x.approvedOn; }), col("expires_on", function (x) { return x.expiresOn; }),
      col("controls", function (x) { return (x.controls || []).join("; "); }), col("status_on_review_date", function (x) { return E.exceptionAudit(x).status; })]);

    csv("09_ipe_extraction_log.csv", E.proc.checklist, [
      col("item", function (i) { return i.id; }), col("system", function (i) { return i.sys; }), col("data", function (i) { return i.item; }), col("source", function (i) { return i.source; }),
      col("pulled", function (i) { return (S.checklist[i.id] || {}).pulled ? "yes" : "no"; }), col("ipe_checked", function (i) { return (S.checklist[i.id] || {}).ipe ? "yes" : "no"; })]);

    var st = E.stats();
    var summary = ["# Access review evidence: " + E.ref.org.name + " " + E.ref.org.reviewPeriod, "",
      "Population as of " + E.asOf + ". " + st.accounts + " accounts, " + st.identities + " people.",
      "Findings: " + st.total + " (Critical " + st.sev.Critical + ", High " + st.sev.High + ", Medium " + st.sev.Medium + ", Low " + st.sev.Low + ").",
      "Reviewer assignment rule violations: " + E.validateAssignments().length + ".",
      "Decisions recorded: " + dec.length + ". Sign-offs: " + so.length + ". Exceptions on register: " + E.allExceptions().length + ".",
      "", "All data is synthetic."].join("\n");
    files.push({name: "10_summary.md", rows: 1, data: summary});
    return files;
  }

  function build() {
    var files = buildFiles();
    files.forEach(function (f) { f.bytes = new TextEncoder().encode(f.data).length; f.sha256 = U.sha256(f.data); });
    var ret = E.retention(E.asOf, E.ref.org.retentionYears);
    var manifest = {
      pack: "KM-ARV-" + E.ref.org.quarterKey, entity: E.ref.org.name, period: E.ref.org.reviewPeriod, populationAsOf: E.asOf,
      generatedAt: new Date().toISOString(), ruleSetVersion: "SoD-2026Q3-v1", retainUntilMinimum: ret.minUntil, retainUntilPolicy: ret.policyUntil,
      note: "Synthetic data. Hashes are SHA-256 of each file's exact bytes (UTF-8).",
      files: files.map(function (f) { return {name: f.name, rows: f.rows, bytes: f.bytes, sha256: f.sha256}; })
    };
    var mtext = JSON.stringify(manifest, null, 2);
    var packHash = U.sha256(mtext);
    files.unshift({name: "00_manifest.json", rows: files.length, data: mtext, bytes: new TextEncoder().encode(mtext).length, sha256: U.sha256(mtext)});
    lastPack = {files: files, manifest: manifest, packHash: packHash, at: manifest.generatedAt};
    return lastPack;
  }

  KAI.views.evidence = {
    title: "6. Evidence retention",
    render: function () {
      var root = h("div"), S = KAI.state, org = E.ref.org;
      root.appendChild(UI.page("6. Evidence retention for the auditor",
        "An access review that cannot be shown to the auditor did not happen. This page defines what to keep, for how long, and in what form, then builds the pack from what you did in this session."));

      /* retention calculator */
      var out = h("div"), yrs = org.retentionYears, review = org.asOf, hold = false;
      function calc() {
        U.clear(out);
        if (!review) return;
        if (yrs < 7) {
          out.appendChild(h("div", {class: "verdict bad"}, "Not allowed: " + yrs + " years is below the 7-year SOX requirement. Use 7 or more."));
          return;
        }
        var r = E.retention(review, yrs);
        out.appendChild(h("div", {class: "grid g3"},
          UI.kpi("Absolute minimum", U.fmtDate(r.minUntil), yrs + " years from the review date"),
          UI.kpi("Recommended policy date", U.fmtDate(r.policyUntil), yrs + " years from fiscal year end (" + U.fmtDate(r.fyEnd) + ")", "ok"),
          UI.kpi("Destruction", hold ? "ON HOLD" : "After " + U.fmtDate(r.policyUntil), hold ? "legal hold overrides the date" : "only with Compliance sign-off", hold ? "crit" : "")));
      }
      root.appendChild(UI.section("Retention rule", "Business-owner sign-off and its supporting evidence are kept 7 years. The clock runs from the end of the fiscal year the review belongs to, which is safer than counting from the review date.",
        h("div", {class: "card"},
          h("div", {class: "row"},
            h("label", null, "Review date ", h("input", {type: "date", value: review, onchange: function () { review = this.value; calc(); }})),
            h("label", null, "Retention (years) ", h("input", {type: "number", min: 1, max: 20, value: yrs, style: "width:80px", onchange: function () { yrs = +this.value; calc(); }})),
            h("label", null, h("input", {type: "checkbox", onchange: function () { hold = this.checked; calc(); }}), " Legal hold")),
          out,
          UI.note("warn", h("strong", null, "Check local law too. "), "Indian company law may require books of account and supporting records for longer than 7 years. Treat 7 as the floor and confirm the final period with Legal."))));
      calc();

      /* artefacts */
      var ret = E.retention(org.asOf, org.retentionYears);
      root.appendChild(UI.section("What is kept", "Nine evidence sets per quarter. Together they let an auditor re-perform the review.",
        UI.table({search: false, noMax: true, rows: E.proc.retention, cols: [
          {label: "Evidence", cls: "wide", render: function (r) { return h("div", null, h("strong", null, r.item), h("div", {class: "muted small"}, r.note)); }},
          {label: "Produced by", cls: "mid", render: function (r) { return r.source; }},
          {label: "Keep until", render: function (r) { return U.fmtDate(ret.policyUntil); }}
        ]})));

      root.appendChild(UI.section("How it is kept", null, h("div", {class: "grid g3"},
        UI.card("Immutable storage", "Write-once or versioned storage. Nobody, including the ITGC Lead, can edit a sealed pack. Corrections are new files."),
        UI.card("Findable", "Naming: KM-ARV-2026Q3-<system>-<item>. An index lists every file with its hash so the auditor can find and verify it."),
        UI.card("Access controlled", "Read access for Compliance, Internal Audit and the external auditor. Deletion needs Compliance sign-off and no legal hold."))));

      /* pack */
      var packBox = h("div");
      root.appendChild(UI.section("Evidence pack builder", "Builds the files from this session's data, hashes each one with SHA-256 and packs them into a ZIP. Nothing leaves your browser.", packBox));
      function drawPack() {
        U.clear(packBox);
        var done = E.proc.checklist.filter(function (i) { return (S.checklist[i.id] || {}).pulled && (S.checklist[i.id] || {}).ipe; }).length;
        var decisions = Object.keys(S.decisions).length, tasks = E.accounts.length + E.accounts.filter(function (a) { return E.assignments[a.id].secondary; }).length;
        var signoffs = Object.keys(S.signoffs).length;
        packBox.appendChild(h("div", {class: "grid g4"},
          UI.kpi("Checklist items done", done + " / " + E.proc.checklist.length, "from page 1"),
          UI.kpi("Review decisions", decisions + " / " + tasks, "from the workbench"),
          UI.kpi("Reviewer sign-offs", signoffs, "from the workbench"),
          UI.kpi("Exceptions", E.allExceptions().length, "register")));
        if (decisions < tasks) packBox.appendChild(UI.note("warn", "The review is not complete, so the pack will be marked as a draft. You can still build it to see the format."));
        packBox.appendChild(h("div", {class: "row", style: "margin:12px 0"},
          UI.btn("Build evidence pack", function () { build(); drawPack(); }, "primary"),
          lastPack ? UI.btn("Download ZIP", function () { U.download("KM-ARV-" + org.quarterKey + "-evidence.zip", U.makeZip(lastPack.files.map(function (f) { return {name: f.name, data: f.data}; }))); }) : null,
          lastPack ? UI.btn("Download manifest only", function () { U.download("KM-ARV-" + org.quarterKey + "-manifest.json", lastPack.files[0].data, "application/json"); }) : null));
        if (lastPack) {
          packBox.appendChild(UI.note("good", h("strong", null, "Pack sealed at " + lastPack.at + ". "), "Pack hash (SHA-256 of the manifest): ", h("code", null, lastPack.packHash)));
          packBox.appendChild(UI.table({search: false, noMax: true, rows: lastPack.files, cols: [
            {label: "File", render: function (f) { return h("span", {class: "id"}, f.name); }},
            {label: "Rows", render: function (f) { return f.rows; }},
            {label: "Bytes", render: function (f) { return f.bytes; }},
            {label: "SHA-256", cls: "wide", render: function (f) { return h("code", {class: "small", style: "word-break:break-all"}, f.sha256); }}
          ]}));
          var vres = h("div", {style: "margin-top:8px"});
          packBox.appendChild(h("div", {class: "card", style: "margin-top:14px"}, h("h3", null, "Verify a file"),
            h("p", {class: "muted small"}, "Unzip the pack, pick any file. The page recomputes its SHA-256 and compares it with the manifest, the way an auditor would."),
            h("input", {type: "file", "aria-label": "File to verify", onchange: function () {
              var fl = this.files[0]; if (!fl) return;
              var rd = new FileReader();
              rd.onload = function () {
                var hash = U.sha256Bytes(new Uint8Array(rd.result));
                var m = lastPack.files.filter(function (f) { return f.sha256 === hash; })[0];
                U.clear(vres);
                vres.appendChild(m ? h("div", {class: "verdict ok"}, "Match: " + fl.name + " is identical to " + m.name + " in the manifest.")
                  : h("div", {class: "verdict bad"}, "No match: " + fl.name + " does not match any file in the manifest (edited, or from a different pack)."));
              };
              rd.readAsArrayBuffer(fl);
            }}), vres));
        }
      }
      drawPack();

      /* PBC */
      root.appendChild(UI.section("What the auditor will ask for", "Auditors send a 'provided by client' (PBC) list. Each request maps to a file in the pack.",
        UI.table({search: false, noMax: true, rows: E.proc.pbc, cols: [
          {label: "Auditor asks", cls: "wide", render: function (r) { return r.q; }},
          {label: "You show", cls: "wide", render: function (r) { return r.a; }}
        ]})));

      /* calendar */
      root.appendChild(UI.section("Review calendar", "Days are counted from the quarter-end population date (" + U.fmtDate(org.asOf) + ").",
        h("div", {class: "card"}, h("table", {class: "tbl"}, h("tbody", null, E.proc.calendar.map(function (c) {
          return h("tr", null, h("td", {class: "nowrap"}, U.fmtDate(U.addDays(org.asOf, c.t))), h("td", {class: "muted nowrap"}, c.t === 0 ? "T" : (c.t > 0 ? "T+" : "T") + c.t), h("td", null, c.step));
        }))))));
      return root;
    }
  };
})();
