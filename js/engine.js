/* Engine: joins data, raises findings, assigns reviewers, validates exceptions. Pure logic, no DOM. */
(function () {
  var KAI = (window.KAI = window.KAI || {});
  var U = KAI.util;
  var E = (KAI.E = {});

  var SEV_RANK = {Critical: 4, High: 3, Medium: 2, Low: 1};
  E.SEV_RANK = SEV_RANK;
  var MIN_REVIEWER_LEVEL = 3;
  E.MIN_REVIEWER_LEVEL = MIN_REVIEWER_LEVEL;

  E.init = function () {
    var ref = (E.ref = window.KAI_REF);
    var data = (E.data = window.KAI_DATA);
    E.proc = window.KAI_PROC;
    E.asOf = ref.org.asOf;

    E.people = {};
    data.people.forEach(function (p) { E.people[p.id] = p; });
    E.roles = {};
    ref.roles.forEach(function (r) { E.roles[r.id] = r; });
    E.sys = {};
    ref.systems.forEach(function (s) { E.sys[s.id] = s; });
    E.rules = {};
    ref.sodRules.forEach(function (r) { E.rules[r.id] = r; });
    E.accounts = data.accounts;
    E.acct = {};
    E.accounts.forEach(function (a) {
      E.acct[a.id] = a;
      a.holder = a.person || a.owner;
      a.roleObjs = a.roles.map(function (r) { return E.roles[r]; });
      a.maxRisk = Math.max.apply(null, a.roleObjs.map(function (r) { return r.risk; }));
      a.priv = a.roleObjs.some(function (r) { return r.priv; });
    });

    E.personAccts = {};
    E.accounts.forEach(function (a) {
      if (a.person) (E.personAccts[a.person] = E.personAccts[a.person] || []).push(a);
    });
    buildCaps();
    E.findings = [];
    raiseAccountFindings();
    raiseSod();
    E.findings.sort(function (a, b) { return SEV_RANK[b.sev] - SEV_RANK[a.sev] || (a.key < b.key ? -1 : 1); });
    E.byKey = {};
    E.byAcct = {};
    E.findings.forEach(function (f) {
      E.byKey[f.key] = f;
      f.accountIds.forEach(function (id) { (E.byAcct[id] = E.byAcct[id] || []).push(f); });
    });
    assignAll();
  };

  /* ---------- people helpers ---------- */
  E.name = function (id) { return id && E.people[id] ? E.people[id].name : "-"; };
  E.label = function (id) {
    var p = E.people[id];
    return p ? p.name + " (" + p.title + ")" : "-";
  };
  E.chain = function (pid) {
    var out = [], cur = E.people[pid], g = 0;
    while (cur && cur.managerId && g++ < 20) {
      cur = E.people[cur.managerId];
      if (cur) out.push(cur);
    }
    return out;
  };
  E.acctsOf = function (pid) { return E.personAccts[pid] || []; };

  var caps = {};
  function buildCaps() {
    caps = {};
    E.accounts.forEach(function (a) {
      if (!a.person) return;
      var m = (caps[a.person] = caps[a.person] || {});
      a.roleObjs.forEach(function (r) {
        r.caps.forEach(function (c) {
          (m[c] = m[c] || []).push({acctId: a.id, sys: a.sys, roleId: r.id, roleName: r.name, cap: c});
        });
      });
    });
  }
  E.capsOf = function (pid) { return caps[pid] || {}; };
  E.isAdminIn = function (pid, sysId) {
    var c = caps[pid];
    if (!c) return false;
    return E.sys[sysId].adminCaps.some(function (k) { return c[k]; });
  };

  /* ---------- findings ---------- */
  function mk(f) {
    f.exceptable = E.proc.kinds[f.kind].exceptable;
    E.findings.push(f);
  }

  function raiseAccountFindings() {
    var asOf = E.asOf;
    E.accounts.forEach(function (a) {
      var p = a.person ? E.people[a.person] : null;
      var owner = a.owner ? E.people[a.owner] : null;
      var base = {accountIds: [a.id], systems: [a.sys], sys: a.sys, personId: a.person, holderId: a.holder};
      var isLeaver = false;

      if (p && p.status === "Terminated") {
        isLeaver = true;
        var days = U.daysBetween(p.termDate, asOf);
        var post = a.lastLogin && a.lastLogin > p.termDate;
        mk(Object.assign({}, base, {
          key: "leaver|" + a.id, kind: "leaver", sev: post || a.maxRisk >= 2 ? "Critical" : "High",
          title: "Leaver still has an active account",
          detail: "Left on " + U.fmtDate(p.termDate) + " (" + days + " days ago). " +
            (post ? "Last login " + U.fmtDate(a.lastLogin) + " is AFTER the termination date." : "Last login " + U.fmtDate(a.lastLogin) + ".")
        }));
      }
      if (p && p.status === "Active" && p.type === "Contractor" && p.contractEnd && p.contractEnd < asOf) {
        mk(Object.assign({}, base, {
          key: "contractor|" + a.id, kind: "contractor", sev: "High",
          title: "Contractor still active after contract end",
          detail: "Contract ended " + U.fmtDate(p.contractEnd) + " (" + U.daysBetween(p.contractEnd, asOf) + " days ago); account still active."
        }));
      }
      if (a.type === "Generic") {
        mk(Object.assign({}, base, {
          key: "generic|" + a.id, kind: "generic", sev: "High",
          title: "Shared / generic login",
          detail: "No individual accountability. Nominal owner: " + E.name(a.owner) + "."
        }));
      }
      if (a.type !== "Named" && owner && owner.status === "Terminated") {
        mk(Object.assign({}, base, {
          key: "svcowner|" + a.id, kind: "svcowner", sev: "High",
          title: "Owner of " + a.type.toLowerCase() + " account has left",
          detail: "Owner " + owner.name + " left on " + U.fmtDate(owner.termDate) + ". Nobody is accountable for this account."
        }));
      }
      if (a.type === "Named" && !isLeaver) {
        // dormant / never used
        var dormantDays = a.lastLogin ? U.daysBetween(a.lastLogin, asOf) : null;
        var never = !a.lastLogin && U.daysBetween(a.created, asOf) >= 30;
        if (never || (dormantDays != null && dormantDays > 90)) {
          mk(Object.assign({}, base, {
            key: "dormant|" + a.id, kind: "dormant", sev: a.maxRisk >= 3 || a.priv ? "High" : "Medium",
            title: never ? "Account never used" : "Dormant account (over 90 days)",
            detail: never ? "Created " + U.fmtDate(a.created) + " and never logged in."
              : "Last login " + U.fmtDate(a.lastLogin) + " (" + dormantDays + " days ago)."
          }));
        }
        // role not typical for department
        var bad = a.roleObjs.filter(function (r) { return r.depts.length && r.depts.indexOf(p.dept) < 0; });
        if (bad.length) {
          var mover = p.prevDept ? " Moved from " + p.prevDept + " on " + U.fmtDate(p.transferDate) + " and kept old access." : "";
          mk(Object.assign({}, base, {
            key: "mismatch|" + a.id, kind: "mismatch",
            sev: bad.some(function (r) { return r.risk >= 3; }) ? "High" : "Medium",
            title: "Role not typical for " + p.dept,
            detail: bad.map(function (r) { return r.name; }).join(", ") + " is normally held by " + bad[0].depts.join(" / ") + "." + mover
          }));
        }
      }
      if (a.type === "Named" && !a.ticket) {
        mk(Object.assign({}, base, {
          key: "noticket|" + a.id, kind: "noticket", sev: "Medium",
          title: "No approved access request on record",
          detail: "No ITSM ticket links to this account's roles (" + a.roles.join(", ") + ")."
        }));
      }
    });
  }

  function raiseSod() {
    E.ref.sodRules.forEach(function (rule) {
      Object.keys(caps).forEach(function (pid) {
        var p = E.people[pid];
        if (p.status !== "Active") return;
        var c = caps[pid];
        var A = rule.a.filter(function (k) { return c[k]; });
        var B = rule.b.filter(function (k) { return c[k]; });
        if (!A.length || !B.length) return;
        var evA = [], evB = [];
        A.forEach(function (k) { evA = evA.concat(c[k]); });
        B.forEach(function (k) { evB = evB.concat(c[k]); });
        var within = evA.some(function (x) { return evB.some(function (y) { return x.roleId === y.roleId; }); });
        var accIds = [], systems = [];
        evA.concat(evB).forEach(function (e) {
          if (accIds.indexOf(e.acctId) < 0) accIds.push(e.acctId);
          if (systems.indexOf(e.sys) < 0) systems.push(e.sys);
        });
        var la = evA[0], lb = evB[0];
        mk({
          key: "sod|" + pid + "|" + rule.id, kind: "sod", ruleId: rule.id, sev: rule.sev,
          accountIds: accIds, systems: systems, sys: systems.length > 1 ? "CROSS" : systems[0],
          personId: pid, holderId: pid, evA: evA, evB: evB, withinRole: within,
          title: rule.name,
          detail: (within ? "One role gives both sides: " + la.roleName + ". " : "Holds " + la.roleName + " and " + lb.roleName + ". ") +
            "Can: " + E.ref.capabilities[la.cap].label.toLowerCase() + " + " + E.ref.capabilities[lb.cap].label.toLowerCase() + "."
        });
      });
    });
  }

  E.findingsFor = function (acctId) { return E.byAcct[acctId] || []; };
  E.topSev = function (list) {
    var best = null;
    list.forEach(function (f) { if (!best || SEV_RANK[f.sev] > SEV_RANK[best]) best = f.sev; });
    return best;
  };
  E.suggest = function (acct) {
    var list = E.findingsFor(acct.id);
    if (!list.length) return "Approve";
    var kinds = list.map(function (f) { return f.kind; });
    if (kinds.indexOf("leaver") >= 0 || kinds.indexOf("contractor") >= 0) return "Revoke";
    if (kinds.every(function (k) { return k === "dormant"; })) return "Revoke";
    return "Modify";
  };

  /* ---------- reviewer assignment ---------- */
  var ASSIGN = {};
  E.assignments = ASSIGN;

  E.rejectReason = function (cand, ctx) {
    if (!cand) return "No such person";
    if (ctx.exclude[cand.id]) return ctx.exclude[cand.id];
    if (cand.status !== "Active") return "Has left the company (HR manager field is stale)";
    if (cand.level < MIN_REVIEWER_LEVEL) return "Below Manager level, cannot be expected to judge this access";
    if (cand.level <= ctx.holderLevel) return "Does not rank above the account holder";
    if (E.isAdminIn(cand.id, ctx.sysId)) return "Administers " + E.sys[ctx.sysId].name + " (business owner must not be the IT admin)";
    return null;
  };

  E.pickReviewer = function (startId, ctx) {
    var skipped = [], cur = startId, g = 0;
    while (cur && g++ < 15) {
      var p = E.people[cur];
      var why = E.rejectReason(p, ctx);
      if (!why) return {id: cur, skipped: skipped};
      skipped.push({id: cur, reason: why});
      cur = p.managerId;
    }
    return {id: null, skipped: skipped};
  };

  E.needsSecond = function (a) { return E.sys[a.sys].tier === 1 || a.maxRisk >= 3; };
  E.ownerRole = function (a) {
    var best = a.roleObjs[0];
    a.roleObjs.forEach(function (r) { if (r.risk > best.risk) best = r; });
    return best;
  };
  function ctxFor(a, extraExclude) {
    var h = E.people[a.holder];
    var ex = {};
    ex[a.holder] = "Self-review: reviewer is the account holder or owner";
    if (a.owner) ex[a.owner] = "Self-review: reviewer owns the account";
    if (extraExclude) ex[extraExclude] = "Already the primary reviewer (second review must be independent)";
    return {exclude: ex, holderLevel: h.level, sysId: a.sys};
  }

  E.assign = function (a) {
    var holder = E.people[a.holder];
    var prim = E.pickReviewer(holder.managerId, ctxFor(a));
    var out = {primary: prim, secondary: null, dual: false};
    if (E.needsSecond(a)) {
      var role = E.ownerRole(a);
      var fnOwner = E.data.meta.functionOwners[role.ownerFn];
      out.dual = true;
      out.secondary = E.pickReviewer(fnOwner, ctxFor(a, prim.id));
      out.secondary.fn = role.ownerFn;
      out.secondary.why = E.sys[a.sys].tier === 1 ? "Tier 1 system: every user gets a second review" : "High-risk role (" + role.name + ")";
    }
    return out;
  };
  function assignAll() {
    E.accounts.forEach(function (a) { ASSIGN[a.id] = E.assign(a); });
  }

  E.tasksFor = function (reviewerId) {
    var out = [];
    E.accounts.forEach(function (a) {
      var x = ASSIGN[a.id];
      if (x.primary.id === reviewerId) out.push({acct: a, slot: "primary"});
      if (x.secondary && x.secondary.id === reviewerId) out.push({acct: a, slot: "secondary"});
    });
    return out;
  };
  E.reviewers = function () {
    var m = {};
    E.accounts.forEach(function (a) {
      var x = ASSIGN[a.id];
      [["primary", x.primary], ["secondary", x.secondary]].forEach(function (pair) {
        if (!pair[1] || !pair[1].id) return;
        var r = (m[pair[1].id] = m[pair[1].id] || {id: pair[1].id, primary: 0, secondary: 0, bySys: {}});
        r[pair[0]]++;
        r.bySys[a.sys] = (r.bySys[a.sys] || 0) + 1;
      });
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) {
      return b.primary + b.secondary - (a.primary + a.secondary);
    });
  };

  /* what would a naive process (HR line manager, or owner for non-named accounts) get wrong? */
  E.naive = function () {
    var rows = [];
    E.accounts.forEach(function (a) {
      var h = E.people[a.holder];
      var cand = a.person ? h.managerId : a.owner;
      var why = E.rejectReason(E.people[cand], ctxFor(a));
      if (why) rows.push({acct: a, candidate: cand, reason: why});
    });
    return rows;
  };

  /* every final assignment re-checked from scratch; must be empty */
  E.validateAssignments = function () {
    var bad = [];
    E.accounts.forEach(function (a) {
      var x = ASSIGN[a.id];
      var slots = [["primary", x.primary, null], ["secondary", x.secondary, x.primary.id]];
      slots.forEach(function (s) {
        if (!s[1]) return;
        var why = s[1].id ? E.rejectReason(E.people[s[1].id], ctxFor(a, s[2])) : "No eligible reviewer found";
        if (why) bad.push({acctId: a.id, slot: s[0], reason: why});
      });
    });
    return bad;
  };

  /* try a manual override; returns hard failures and soft warnings */
  E.checkReviewer = function (acctId, candId, slot) {
    var a = E.acct[acctId];
    var x = ASSIGN[acctId];
    var ctx = ctxFor(a, slot === "secondary" ? x.primary.id : null);
    var hard = E.rejectReason(E.people[candId], ctx);
    var warn = null;
    if (!hard) {
      var inChain = E.chain(a.holder).some(function (p) { return p.id === candId; });
      var fnOwner = E.data.meta.functionOwners[E.ownerRole(a).ownerFn];
      if (!inChain && candId !== fnOwner) warn = "Not in the holder's management chain and not the function owner. Only accept if they can explain what this access allows.";
    }
    return {hard: hard, warn: warn};
  };

  /* what would this combination of roles trigger? (used by the SoD role checker) */
  E.conflictsForRoles = function (roleIds) {
    var c = {};
    roleIds.forEach(function (id) {
      var r = E.roles[id];
      r.caps.forEach(function (cap) { (c[cap] = c[cap] || []).push({roleId: id, roleName: r.name, cap: cap, sys: r.sys}); });
    });
    var out = [];
    E.ref.sodRules.forEach(function (rule) {
      var A = rule.a.filter(function (k) { return c[k]; }), B = rule.b.filter(function (k) { return c[k]; });
      if (!A.length || !B.length) return;
      var evA = [], evB = [];
      A.forEach(function (k) { evA = evA.concat(c[k]); });
      B.forEach(function (k) { evB = evB.concat(c[k]); });
      out.push({rule: rule, evA: evA, evB: evB});
    });
    return out;
  };

  /* ---------- exceptions ---------- */
  E.allExceptions = function () {
    var mine = (KAI.state && KAI.state.exceptions) || [];
    return E.data.exceptions.concat(mine);
  };
  E.isTier1 = function (sysId) { return E.sys[sysId] && E.sys[sysId].tier === 1; };
  E.limits = function (f) {
    var tier1 = f.systems.some(E.isTier1);
    var crit = f.sev === "Critical";
    return {
      exceptable: f.exceptable,
      maxDays: E.proc.maxExceptionDays[f.sev],
      minControls: crit || tier1 ? 2 : 1,
      minApproverLevel: crit || tier1 ? 6 : 4,
      concurrence: crit || tier1,
      tier1: tier1,
      slaDays: E.proc.slaDays[f.sev]
    };
  };
  E.controlsFor = function (f) {
    if (f.kind === "sod") return E.rules[f.ruleId].mitigation.slice();
    if (f.kind === "dormant") return ["CC-LOGIN-ALERT", "CC-SEASONAL-REENABLE"];
    return ["CC-MANAGER-SPOTCHECK", "CC-LOGIN-ALERT"];
  };
  function inLine(approverId, holderId, reviewerId) {
    var ok = false;
    [holderId, reviewerId].forEach(function (x) {
      E.chain(x).forEach(function (c) { if (c.id === approverId) ok = true; });
    });
    return ok;
  }
  E.approverCandidates = function (f, reviewerId) {
    var lim = E.limits(f);
    var rev = E.people[reviewerId];
    var out = [];
    Object.keys(E.people).forEach(function (id) {
      var p = E.people[id];
      if (p.level < 4) return;
      var why = [];
      if (id === f.holderId) why.push("Is the account holder");
      if (id === reviewerId) why.push("Is the reviewer");
      if (p.level <= rev.level) why.push("Does not rank above the reviewer (level " + p.level + " vs " + rev.level + ")");
      if (p.status !== "Active") why.push("Has left the company");
      if (p.level < lim.minApproverLevel) why.push("Needs VP / C-suite level (6+) for this finding");
      if (E.chain(id).some(function (c) { return c.id === f.holderId; })) why.push("Reports to the account holder");
      if (!inLine(id, f.holderId, reviewerId)) why.push("Not in the holder's or reviewer's management line (must own the risk)");
      out.push({p: p, ok: why.length === 0, why: why});
    });
    out.sort(function (a, b) { return (b.ok - a.ok) || (a.p.level - b.p.level) || (a.p.name < b.p.name ? -1 : 1); });
    return out;
  };
  E.exceptionAudit = function (ex) {
    var f = E.byKey[ex.key];
    var rev = E.people[ex.reviewerId], app = E.people[ex.approverId];
    var sysList = f ? f.systems : [ex.sys];
    var lim = f ? E.limits(f) : {maxDays: 90, minControls: 2, minApproverLevel: 6, concurrence: true};
    var days = U.daysBetween(ex.approvedOn, ex.expiresOn);
    var checks = [
      {ok: app.level > rev.level, label: "Approver ranks above reviewer", detail: app.name + " level " + app.level + " vs " + rev.name + " level " + rev.level},
      {ok: ex.approverId !== ex.personId && ex.approverId !== ex.reviewerId, label: "Approver is neither holder nor reviewer"},
      {ok: app.status === "Active", label: "Approver is an active employee"},
      {ok: app.level >= lim.minApproverLevel, label: "Approver level meets the minimum (" + lim.minApproverLevel + ")"},
      {ok: days <= lim.maxDays && days > 0, label: "Duration within " + lim.maxDays + " days", detail: days + " days"},
      {ok: (ex.controls || []).length >= lim.minControls, label: "At least " + lim.minControls + " compensating control(s)", detail: (ex.controls || []).length + " listed"},
      {ok: !lim.concurrence || ex.concurrence === true, label: "ITGC Lead concurrence recorded (Critical / Tier 1)"},
      {ok: inLine(ex.approverId, ex.personId, ex.reviewerId), label: "Approver is in the holder's or reviewer's management line"}
    ];
    var expired = ex.expiresOn < E.asOf;
    var valid = checks.every(function (c) { return c.ok; });
    return {checks: checks, valid: valid, expired: expired,
            status: expired ? "Expired" : valid ? "Active" : "Non-compliant",
            daysLeft: U.daysBetween(E.asOf, ex.expiresOn), findingOpen: !!f, sysList: sysList};
  };
  E.exceptionFor = function (key) {
    var found = null;
    E.allExceptions().forEach(function (ex) {
      if (ex.key !== key) return;
      var au = E.exceptionAudit(ex);
      if (au.status === "Active") found = ex;
    });
    return found;
  };

  /* ---------- retention ---------- */
  E.retention = function (reviewDate, years) {
    var fy = reviewDate.slice(0, 4) + "-12-31";
    return {
      minUntil: U.addYears(reviewDate, years),
      policyUntil: U.addYears(fy, years),
      fyEnd: fy
    };
  };

  /* ---------- statistics ---------- */
  E.stats = function () {
    var byS = {};
    E.ref.systems.forEach(function (s) {
      byS[s.id] = {sys: s, accounts: 0, named: 0, service: 0, generic: 0, flagged: {}, sev: {Critical: 0, High: 0, Medium: 0, Low: 0}, kind: {}, priv: 0};
    });
    E.accounts.forEach(function (a) {
      var s = byS[a.sys];
      s.accounts++;
      if (a.type === "Named") s.named++;
      else if (a.type === "Service") s.service++;
      else s.generic++;
      if (a.priv) s.priv++;
    });
    var cross = {sev: {Critical: 0, High: 0, Medium: 0, Low: 0}, kind: {}, count: 0};
    var flaggedAll = {}, sevAll = {Critical: 0, High: 0, Medium: 0, Low: 0}, kindAll = {};
    E.findings.forEach(function (f) {
      sevAll[f.sev]++;
      kindAll[f.kind] = (kindAll[f.kind] || 0) + 1;
      f.accountIds.forEach(function (id) { flaggedAll[id] = true; });
      var targets = f.sys === "CROSS" ? [cross] : [byS[f.sys]];
      targets[0].sev[f.sev]++;
      var kk = f.kind === "sod" ? f.ruleId : f.kind;
      targets[0].kind[kk] = (targets[0].kind[kk] || 0) + 1;
      if (f.sys === "CROSS") cross.count++;
      else f.accountIds.forEach(function (id) { byS[f.sys].flagged[id] = true; });
    });
    var identities = Object.keys(E.personAccts).length;
    return {bySys: byS, cross: cross, flaggedAccounts: Object.keys(flaggedAll).length, sev: sevAll, kind: kindAll,
            identities: identities, total: E.findings.length, accounts: E.accounts.length};
  };
})();
