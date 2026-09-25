(function () {
  var KAI = window.KAI, U = KAI.util, h = U.h, E = KAI.E, UI = KAI.ui;
  var DECISIONS = ["Approve", "Revoke", "Modify", "Retain"];
  var HELP = {Approve: "Access is appropriate as is", Revoke: "Remove the account", Modify: "Remove or change roles", Retain: "Keep despite finding; needs an approved exception"};

  function key(t) { return t.acct.id + "|" + t.slot; }

  KAI.views.workbench = {
    title: "Review workbench",
    render: function (q) {
      var S = KAI.state;
      var reviewers = E.reviewers();
      var defId = q.reviewer && E.people[q.reviewer] ? q.reviewer : E.data.meta.functionOwners.Finance;
      if (!reviewers.some(function (r) { return r.id === defId; })) defId = reviewers[0].id;
      var rid = defId, me = E.people[rid];
      var tasks = E.tasksFor(rid);
      var root = h("div");

      root.appendChild(UI.page("Review workbench: play the reviewer",
        "Pick a reviewer and make a decision on every account assigned to them. The rules stop you approving a leaver or an SoD conflict, require a note for anything but a clean approval, and require an approved exception before you can retain a flagged access."));

      root.appendChild(h("div", {class: "card"}, h("div", {class: "row"},
        h("label", null, "Reviewer "),
        UI.select(reviewers.map(function (r) { return {value: r.id, label: E.name(r.id) + " - " + E.people[r.id].title + " (" + (r.primary + r.secondary) + " tasks)"}; }), rid, function (v) { KAI.go("workbench", {reviewer: v}); }, {"aria-label": "Reviewer"}),
        h("span", {class: "muted small"}, "Level " + me.level + ", " + me.dept))));

      var summary = h("div", {style: "margin-top:14px"}), signBox = h("div", {style: "margin-top:14px"});
      root.appendChild(summary);

      var only = false;
      var stEls = {};
      var tbl = UI.table({
        rows: tasks, pageSize: 40, csvName: "decisions-" + me.name.replace(/\s+/g, "-").toLowerCase() + ".csv", searchPlaceholder: "Search account or holder...",
        searchText: function (t) { return [t.acct.user, t.acct.sys, E.name(t.acct.holder), t.acct.roles.join(" ")].join(" "); },
        toolbar: [h("label", {class: "small"}, h("input", {type: "checkbox", onchange: function () { only = this.checked; tbl.setRows(only ? tasks.filter(function (t) { return E.findingsFor(t.acct.id).length; }) : tasks); }}), " Show only flagged")],
        csvCols: [
          {label: "account", csv: function (t) { return t.acct.id; }}, {label: "system", csv: function (t) { return t.acct.sys; }}, {label: "username", csv: function (t) { return t.acct.user; }},
          {label: "slot", csv: function (t) { return t.slot; }}, {label: "holder", csv: function (t) { return E.name(t.acct.holder); }}, {label: "roles", csv: function (t) { return t.acct.roles.join("; "); }},
          {label: "findings", csv: function (t) { return E.findingsFor(t.acct.id).map(function (f) { return f.sev + ": " + f.title; }).join(" | "); }},
          {label: "decision", csv: function (t) { return (S.decisions[key(t)] || {}).decision || ""; }}, {label: "note", csv: function (t) { return (S.decisions[key(t)] || {}).note || ""; }},
          {label: "rule_check", csv: function (t) { return validate(t) || "OK"; }}],
        cols: [
          {label: "Account and holder", cls: "mid", render: function (t) {
            var p = E.people[t.acct.holder];
            return h("div", null, h("div", null, UI.sys(t.acct.sys), " ", h("span", {class: "id"}, t.acct.user)),
              h("div", {style: "margin-top:4px"}, UI.person(t.acct.holder)),
              h("div", {class: "small muted"}, p.title + ", " + p.dept + (t.acct.type !== "Named" ? " (owner)" : "")),
              h("div", {class: "small muted"}, t.acct.type + " | " + (t.slot === "primary" ? "primary review" : "second review")));
          }, sort: function (t) { return t.acct.user; }},
          {label: "What the access allows", cls: "wide", render: function (t) {
            return h("div", null, t.acct.roleObjs.map(function (r) {
              return h("div", {class: "small", style: "margin-bottom:4px"}, h("span", {class: "chip " + ["", "Low", "Medium", "High"][r.risk]}, r.name), h("div", {class: "muted"}, r.desc));
            }));
          }},
          {label: "Findings", cls: "wide", render: function (t) {
            var fs = E.findingsFor(t.acct.id);
            if (!fs.length) return h("span", {class: "muted small"}, "None");
            return h("div", null, fs.map(function (f) {
              return h("div", {class: "small", style: "margin-bottom:5px"}, UI.sev(f.sev), " ", h("strong", null, f.ruleId ? f.ruleId + " " + f.title : f.title), h("div", {class: "muted"}, f.detail));
            }));
          }, sort: function (t) { var fs = E.findingsFor(t.acct.id); return fs.length ? 4 - E.SEV_RANK[E.topSev(fs)] : 9; }},
          {label: "Your decision", cls: "mid", render: function (t) {
            var k = key(t), d = S.decisions[k] || {};
            var sel = h("select", {"aria-label": "Decision for " + t.acct.user, onchange: function () { setDecision(t, {decision: sel.value}); }},
              h("option", {value: ""}, "Choose..."), DECISIONS.map(function (x) { return h("option", {value: x, selected: d.decision === x ? true : null, title: HELP[x]}, x); }));
            var note = h("input", {type: "text", value: d.note || "", "aria-label": "Note for " + t.acct.user, placeholder: "Why? (required unless Approve)", style: "width:100%;margin-top:6px", onchange: function () { setDecision(t, {note: this.value}); }});
            var span = h("div", {class: "small", style: "margin-top:6px"});
            stEls[k] = span; paintStatus(t);
            return h("div", null, sel, h("span", {class: "small muted", style: "margin-left:8px"}, "Suggested: " + E.suggest(t.acct)), note, span);
          }}
        ]
      });
      root.appendChild(h("div", {class: "row", style: "margin-top:14px"},
        UI.btn("Pre-fill suggested decisions", function () {
          tasks.forEach(function (t) {
            if ((S.decisions[key(t)] || {}).decision) return;
            var s = E.suggest(t.acct);
            var fs = E.findingsFor(t.acct.id);
            S.decisions[key(t)] = {decision: s === "Approve" ? "Approve" : s, note: s === "Approve" ? "" : "Suggested by engine: " + fs.map(function (f) { return f.title; }).join("; "), by: rid, ts: new Date().toISOString(), suggested: true};
          });
          dropSignoff(); KAI.save(); KAI.refresh();
        }),
        UI.btn("Clear my decisions", function () {
          tasks.forEach(function (t) { delete S.decisions[key(t)]; });
          dropSignoff(); KAI.save(); KAI.refresh();
        }, "danger")));
      root.appendChild(UI.note("warn", h("strong", null, "Pre-filling is a convenience, not a review. "), "Approving a batch without reading it is the classic access-review failure. Open the flagged rows, read what the access allows, and change the decision if you disagree."));
      root.appendChild(h("div", {style: "margin-top:10px"}, tbl));
      root.appendChild(signBox);

      function dropSignoff() {
        if (S.signoffs[rid]) { delete S.signoffs[rid]; }
      }
      function setDecision(t, patch) {
        var k = key(t), d = Object.assign({by: rid}, S.decisions[k] || {}, patch, {ts: new Date().toISOString()});
        delete d.suggested;
        if (!d.decision) { delete S.decisions[k]; } else S.decisions[k] = d;
        var had = !!S.signoffs[rid];
        dropSignoff();
        KAI.save();
        paintStatus(t); paintSummary();
        if (had) signBox.prepend(UI.note("warn", "Your earlier sign-off was withdrawn because a decision changed. Sign again when finished."));
      }
      function validate(t) {
        var d = S.decisions[key(t)];
        if (!d || !d.decision) return "Pending";
        var fs = E.findingsFor(t.acct.id);
        var fixed = fs.filter(function (f) { return !f.exceptable; }), exc = fs.filter(function (f) { return f.exceptable; });
        if (d.decision === "Approve") {
          if (fixed.length) return "Cannot approve: " + E.proc.kinds[fixed[0].kind].label.toLowerCase() + ". Revoke or modify.";
          if (exc.length) return "Cannot approve a flagged account. Revoke, modify, or retain with an exception.";
        }
        if (d.decision === "Retain") {
          if (fixed.length) return "Cannot retain: " + E.proc.kinds[fixed[0].kind].label.toLowerCase() + " must be fixed.";
          if (!exc.length) return "Nothing to retain: approve instead.";
          var missing = exc.filter(function (f) { return !E.exceptionFor(f.key); });
          if (missing.length) return "NEEDEXC:" + missing[0].key;
        }
        if (d.decision !== "Approve" && !(d.note || "").trim()) return "Add a note explaining the decision.";
        return null;
      }
      function paintStatus(t) {
        var el = stEls[key(t)];
        if (!el) return;
        U.clear(el);
        var v = validate(t);
        if (v === "Pending") el.appendChild(h("span", {class: "muted"}, "Pending"));
        else if (!v) el.appendChild(h("span", {class: "cov-ok"}, "✓ OK"));
        else if (v.indexOf("NEEDEXC:") === 0) {
          var k = v.slice(8);
          el.appendChild(h("span", {class: "cov-bad"}, "Needs an approved exception. "));
          el.appendChild(h("a", {href: "#/exceptions?finding=" + encodeURIComponent(k) + "&reviewer=" + rid}, "Request one"));
        } else el.appendChild(h("span", {class: "cov-bad"}, v));
      }
      function counts() {
        var c = {Approve: 0, Revoke: 0, Modify: 0, Retain: 0, pending: 0, invalid: 0, flagged: 0};
        tasks.forEach(function (t) {
          var d = S.decisions[key(t)];
          if (E.findingsFor(t.acct.id).length) c.flagged++;
          if (!d || !d.decision) c.pending++; else { c[d.decision]++; if (validate(t)) c.invalid++; }
        });
        return c;
      }
      function paintSummary() {
        var c = counts();
        U.clear(summary);
        summary.appendChild(h("div", {class: "grid g6"},
          UI.kpi("Assigned to you", tasks.length, c.flagged + " flagged"),
          UI.kpi("Pending", c.pending, "still to decide", c.pending ? "high" : "ok"),
          UI.kpi("Approve", c.Approve), UI.kpi("Revoke / Modify", c.Revoke + c.Modify), UI.kpi("Retain", c.Retain),
          UI.kpi("Rule problems", c.invalid, "fix before sign-off", c.invalid ? "crit" : "ok")));
        paintSign(c);
      }
      function paintSign(c) {
        Array.prototype.slice.call(signBox.querySelectorAll(".signcard")).forEach(function (n) { n.remove(); });
        var so = S.signoffs[rid];
        var card = h("div", {class: "card signcard"});
        if (so) {
          card.appendChild(h("h3", null, "Signed off"));
          card.appendChild(UI.note("good", h("strong", null, me.name + " signed off on " + so.at + ". "), so.count + " decisions. Decision hash (SHA-256): ", h("code", {style: "word-break:break-all"}, so.hash)));
          card.appendChild(UI.btn("Withdraw sign-off", function () { delete S.signoffs[rid]; KAI.save(); paintSummary(); }, "danger"));
        } else {
          var ready = c.pending === 0 && c.invalid === 0 && tasks.length > 0;
          var cb = h("input", {type: "checkbox", onchange: function () { btn.disabled = !(ready && cb.checked); }});
          var btn = h("button", {class: "btn primary", type: "button", disabled: true, onclick: signOff}, "Sign off");
          card.appendChild(h("h3", null, "Attestation and sign-off"));
          card.appendChild(h("p", {class: "small"}, ready ? "All decisions are made and pass the rules." : "Sign-off unlocks when every decision is made and passes the rules (" + c.pending + " pending, " + c.invalid + " with problems)."));
          card.appendChild(h("label", {style: "display:flex;gap:8px;align-items:flex-start"}, cb,
            h("span", null, "I have reviewed each account assigned to me, I understand what the access allows, and my decisions reflect the person's current job. I am not reviewing my own access, and I am not an administrator of these systems.")));
          card.appendChild(h("div", {style: "margin-top:10px"}, btn));
          if (!ready) cb.disabled = true;
          function signOff() {
            var mine = {};
            tasks.forEach(function (t) { mine[key(t)] = S.decisions[key(t)]; });
            S.signoffs[rid] = {reviewerId: rid, reviewer: me.name, title: me.title, at: new Date().toISOString(), count: tasks.length, hash: U.sha256(JSON.stringify(mine)), counts: {Approve: c.Approve, Revoke: c.Revoke, Modify: c.Modify, Retain: c.Retain}};
            KAI.save(); paintSummary();
          }
        }
        signBox.appendChild(card);
      }
      paintSummary();
      return root;
    }
  };
})();
