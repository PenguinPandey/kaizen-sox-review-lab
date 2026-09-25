(function () {
  var KAI = window.KAI, U = KAI.util, h = U.h, E = KAI.E, UI = KAI.ui;

  var TESTS = [
    ["leaver", "HR master says the person has left but the account is active", "Critical (High if the account is read-only); Critical whenever it was used after the last day"],
    ["contractor", "Contractor's end date has passed but the account is active", "High"],
    ["dormant", "No login for 90 days, or created 30+ days ago and never used", "Medium; High if the account holds a high-risk or privileged role"],
    ["mismatch", "A role is normally held by other departments (movers keep old access)", "Medium; High if the role is high-risk"],
    ["sod", "The person's roles together let them do both halves of a risky transaction", "Set by the rule (Critical or High); see page 4"],
    ["generic", "Shared login with no individual accountability", "High"],
    ["svcowner", "Service or shared account whose named owner has left", "High"],
    ["noticket", "No approved request ticket that matches the access", "Medium"]
  ];

  KAI.views.criteria = {
    title: "3. Review criteria",
    render: function () {
      var root = h("div");
      root.appendChild(UI.page("3. Review criteria: what 'appropriate access' means",
        "Appropriate access is not 'the manager said yes'. It is: right person, right job, right amount, still needed, and nothing that lets them do both halves of a risky transaction. Below are the tests every account gets, then the specific criteria and role catalogue for each system."));

      var counts = {};
      E.findings.forEach(function (f) { counts[f.kind] = (counts[f.kind] || 0) + 1; });
      root.appendChild(UI.section("Eight tests applied to every account", "Run automatically; the reviewer sees the result next to each account in the workbench.",
        UI.table({search: false, noMax: true, rows: TESTS, cols: [
          {label: "Test", render: function (r) { return h("strong", null, E.proc.kinds[r[0]].label); }},
          {label: "Flag raised when", cls: "wide", render: function (r) { return r[1]; }},
          {label: "Severity", cls: "mid", render: function (r) { return r[2]; }},
          {label: "Can it be retained?", render: function (r) { return E.proc.kinds[r[0]].exceptable ? UI.chip("Yes, with exception", "info") : UI.chip("No, must be fixed", "bad"); }},
          {label: "Default action", cls: "mid", render: function (r) { return E.proc.kinds[r[0]].action; }},
          {label: "Found now", render: function (r) { return counts[r[0]] || 0; }}
        ]})));

      root.appendChild(UI.section("By system", "Pick a system for its criteria, red flags, reviewer arrangement and role catalogue.",
        UI.tabs(E.ref.systems.map(function (s) {
          return {id: s.id, label: s.name, render: function () { return system(s); }};
        }))));

      root.appendChild(UI.section("Four principles behind every criterion", null,
        h("div", {class: "grid g4"},
          UI.card("Least privilege", "The role must be needed for today's job, not last year's."),
          UI.card("Separation", "No single person holds both halves of a transaction, in one system or across two."),
          UI.card("Ownership", "Every account has a named, current human accountable for it."),
          UI.card("Understanding", "The reviewer must be able to say what each role lets the person do. That is why roles are described in plain English below."))));
      return root;
    }
  };

  function system(s) {
    var c = E.proc.criteria[s.id];
    var box = h("div");
    box.appendChild(h("div", {class: "row", style: "margin-bottom:8px"}, UI.chip(s.tierLabel, s.tier === 1 ? "t1" : ""), h("span", {class: "muted small"}, "Business owner: " + s.businessOwner)));
    box.appendChild(h("p", null, s.why));
    box.appendChild(h("div", {class: "grid g2"},
      h("div", {class: "card"}, h("h3", null, "Appropriate access means"), h("ul", {class: "ticks"}, c.appropriate.map(function (t) { return h("li", null, t); }))),
      h("div", {class: "card"}, h("h3", null, "Red flags"), h("ul", {class: "flags"}, c.redFlags.map(function (t) { return h("li", null, t); })))));
    box.appendChild(h("div", {class: "grid g2", style: "margin-top:14px"},
      UI.card("Who reviews", null, h("p", null, c.reviewer)),
      UI.card("Scrutiny level", null, h("p", null, c.scrutiny), h("p", {class: "muted small"}, "Privileged accounts here: " + E.stats().bySys[s.id].priv))));

    var roles = E.ref.roles.filter(function (r) { return r.sys === s.id; });
    var holders = {};
    E.accounts.forEach(function (a) { a.roles.forEach(function (r) { holders[r] = (holders[r] || 0) + 1; }); });
    box.appendChild(h("h3", {style: "margin-top:18px"}, "Role catalogue for " + s.name + " (" + roles.length + " roles)"));
    box.appendChild(h("p", {class: "muted small"}, "'Who normally holds it' drives the department-fit test. Capabilities show the exact transactions the role allows; those feed the SoD rules."));
    box.appendChild(UI.table({rows: roles, noMax: true, pageSize: 40, csvName: "roles-" + s.id + ".csv", searchPlaceholder: "Search roles...", cols: [
      {label: "Role", cls: "mid", render: function (r) { return h("div", null, h("strong", null, r.name), h("div", {class: "id"}, r.id)); }, csv: function (r) { return r.name; }, sort: function (r) { return r.name; }},
      {label: "What it lets the holder do", cls: "wide", render: function (r) { return r.desc; }, csv: function (r) { return r.desc; }},
      {label: "Exact transactions", cls: "wide", render: function (r) {
        return h("ul", {class: "plain small", style: "margin:0;padding-left:16px"}, r.caps.map(function (k) { return h("li", null, E.ref.capabilities[k].label, h("span", {class: "muted"}, " (" + E.ref.capabilities[k].txn + ")")); }));
      }, csv: function (r) { return r.caps.map(function (k) { return E.ref.capabilities[k].txn; }).join("; "); }},
      {label: "Risk", render: function (r) { return h("span", {class: "chip " + ["", "Low", "Medium", "High"][r.risk]}, ["", "Low", "Medium", "High"][r.risk]); }, sort: function (r) { return r.risk; }, csv: function (r) { return r.risk; }},
      {label: "Who normally holds it", cls: "mid", render: function (r) { return r.depts.length ? r.depts.join(", ") : "Any department"; }, csv: function (r) { return r.depts.join("; "); }},
      {label: "Privileged", render: function (r) { return r.priv ? UI.chip("Yes", "High") : "No"; }, csv: function (r) { return r.priv ? "yes" : "no"; }},
      {label: "Holders", render: function (r) { return holders[r.id] || 0; }, sort: function (r) { return holders[r.id] || 0; }}
    ]}));
    return box;
  }
})();
