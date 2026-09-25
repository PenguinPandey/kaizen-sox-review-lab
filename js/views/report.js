(function () {
  var KAI = window.KAI, U = KAI.util, h = U.h, E = KAI.E, UI = KAI.ui;

  function tbl(head, rows) {
    return h("div", {class: "tw nomax"}, h("table", {class: "tbl"},
      h("thead", null, h("tr", null, head.map(function (x) { return h("th", null, x); }))),
      h("tbody", null, rows.map(function (r) { return h("tr", null, r.map(function (c) { return h("td", null, c); })); }))));
  }

  KAI.views.report = {
    title: "Printable report",
    render: function () {
      var org = E.ref.org, st = E.stats(), A = KAI.analysis(), ret = E.retention(org.asOf, org.retentionYears);
      var root = h("div", {class: "report"});
      root.appendChild(h("div", {class: "row no-print", style: "justify-content:space-between;margin-bottom:10px"},
        h("span", {class: "muted"}, "Everything on one page, generated from the live data. Use Print and choose 'Save as PDF' for a document."),
        UI.btn("Print / Save as PDF", function () { window.print(); }, "primary")));

      root.appendChild(h("h1", null, "Quarterly access review process and results"));
      root.appendChild(h("p", {class: "muted"}, org.name + " (fictional). " + org.reviewPeriod + ". Population as of " + U.fmtDate(org.asOf) + ". Prepared by the ITGC Lead. All data synthetic."));

      root.appendChild(h("h2", null, "Scope"));
      root.appendChild(tbl(["System", "Purpose", "Accounts", "Tier", "Business owner"], E.ref.systems.map(function (s) {
        return [s.name, s.type, String(st.bySys[s.id].accounts), s.tierLabel, s.businessOwner];
      })));
      root.appendChild(h("p", null, "Total " + st.accounts + " accounts held by " + st.identities + " people. Quarterly review with business-owner sign-off and evidence retained " + org.retentionYears + " years."));

      root.appendChild(h("h2", null, "1. Access review checklist: what to pull and from where"));
      root.appendChild(h("p", null, E.proc.ipeStandard));
      root.appendChild(tbl(["ID", "System", "Data", "Source", "Completeness / accuracy check"], E.proc.checklist.map(function (i) { return [i.id, i.sys, i.item, i.source, i.ipe]; })));

      root.appendChild(h("h2", null, "2. Reviewer assignment"));
      root.appendChild(h("p", null, "Primary reviewer: the holder's line manager (the owner's manager for shared and service accounts). Second reviewer: the system business owner, required for every Blackline and Kyriba account and for any high-risk role. A reviewer is rejected if they are the holder, have left, are below Manager level, do not outrank the holder, or administer the system. Rejected reviewers are skipped and the chain moves up."));
      root.appendChild(h("p", null, "Result: " + st.accounts + " accounts assigned, " + E.accounts.filter(function (a) { return E.assignments[a.id].dual; }).length + " with a second reviewer, " + A.escalated + " needing escalation, " + E.validateAssignments().length + " rule violations. A plain line-manager approach would have failed on " + E.naive().length + " accounts."));

      root.appendChild(h("h2", null, "3. Review criteria per system"));
      E.ref.systems.forEach(function (s) {
        var c = E.proc.criteria[s.id];
        root.appendChild(h("h3", null, s.name + " (" + s.tierLabel + ")"));
        root.appendChild(h("p", null, h("strong", null, "Appropriate: "), c.appropriate.join("; ") + "."));
        root.appendChild(h("p", null, h("strong", null, "Red flags: "), c.redFlags.join("; ") + "."));
        root.appendChild(h("p", null, h("strong", null, "Reviewers: "), c.reviewer));
      });

      root.appendChild(h("h2", null, "4. Segregation-of-duties conflict rules"));
      root.appendChild(tbl(["Rule", "Severity", "Transaction A", "Transaction B", "Found"], E.ref.sodRules.map(function (r) {
        return [r.id + (r.required ? " (required)" : "") + " " + r.name, r.sev,
          r.a.map(function (k) { return E.ref.capabilities[k].label + " [" + E.ref.capabilities[k].txn + "]"; }).join("; "),
          r.b.map(function (k) { return E.ref.capabilities[k].label + " [" + E.ref.capabilities[k].txn + "]"; }).join("; "),
          String(E.findings.filter(function (f) { return f.ruleId === r.id; }).length)];
      })));

      root.appendChild(h("h2", null, "5. Exception approval workflow"));
      root.appendChild(h("ol", null, E.proc.workflow.map(function (s) { return h("li", null, h("strong", null, s.title + " (" + s.who + "). "), s.text); })));
      root.appendChild(h("p", null, "Limits: Critical, High and Tier 1 exceptions last at most 90 days; Medium and Low at most 180. At least 2 compensating controls for Critical or Tier 1. The approver must rank strictly above the reviewer and be VP level or higher for Critical or Tier 1. Leavers, expired contractors, shared logins and unapproved access cannot be retained."));

      root.appendChild(h("h2", null, "6. Evidence retention"));
      root.appendChild(h("p", null, "Kept " + org.retentionYears + " years from fiscal year end (this quarter: until " + U.fmtDate(ret.policyUntil) + "; absolute minimum " + U.fmtDate(ret.minUntil) + "), in write-once storage with an index of file hashes."));
      root.appendChild(tbl(["Evidence", "Why"], E.proc.retention.map(function (r) { return [r.item, r.note]; })));

      root.appendChild(h("h2", null, "Results of this quarter's review"));
      root.appendChild(tbl(["", "Oracle EBS", "Blackline", "Kyriba", "GitHub", "Cross-system"], [
        ["Accounts"].concat(E.ref.systems.map(function (s) { return String(st.bySys[s.id].accounts); })).concat(["-"]),
        ["Critical"].concat(E.ref.systems.map(function (s) { return String(st.bySys[s.id].sev.Critical); })).concat([String(st.cross.sev.Critical)]),
        ["High"].concat(E.ref.systems.map(function (s) { return String(st.bySys[s.id].sev.High); })).concat([String(st.cross.sev.High)]),
        ["Medium"].concat(E.ref.systems.map(function (s) { return String(st.bySys[s.id].sev.Medium); })).concat([String(st.cross.sev.Medium)])
      ]));
      root.appendChild(h("ul", null, [
        A.leaverAccts + " accounts of " + A.leaverPeople + " leavers still active, " + A.postLogin + " used after departure.",
        A.sodTotal + " SoD conflicts for " + A.sodPeople + " people (" + A.sodCrit + " critical), including " + A.r("R04") + " developers with production-database read access.",
        A.r("R08") + " Blackline users can prepare and approve their own reconciliations; " + (A.r("R09") + A.r("R10")) + " Kyriba users can move money alone.",
        A.mismatch + " mismatched roles (" + A.movers + " movers), " + A.dormant + " dormant accounts, " + A.noticket + " accounts without an approved request, " + A.shared + " shared logins."
      ].map(function (t) { return h("li", null, t); })));
      return root;
    }
  };
})();
