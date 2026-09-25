# Low-Level Design (LLD)

Companion to [HLD.md](HLD.md). This document describes the data model, algorithms, modules and how to extend the project.

## 1. Runtime model

- One HTML page (`index.html`) loads classic scripts in a fixed order. Everything hangs off `window.KAI`.
- Data files assign globals: `KAI_REF` (reference), `KAI_PROC` (process text), `KAI_DATA` (population).
- `engine.js` builds indexes once (`E.init()`), then pages read from it.
- Routing is hash-based (`#/sod`, `#/exceptions?finding=...&reviewer=...`), so it works on any static host and from `file://`.

Script order (dependencies flow downward):

```
reference.js  process.js  people.js
util.js  engine.js  ui.js  charts.js
views/*.js  app.js
```

`ui.js` creates `KAI.views = {}`; each view file registers `KAI.views.<id> = {title, render(query) -> Node}`; `app.js` (last) runs the router.

## 2. Data model

### 2.1 `data/reference.js` (strict JSON after `window.KAI_REF = `)

```text
org        {name, reviewPeriod, quarterKey, asOf, reviewDue, nextReview, fiscalYearEnd, retentionYears}
levels     {1..8: label}                      grade ladder; 3 = Manager, 6 = VP/C-suite, 8 = Audit Committee Chair
systems[]  {id, name, tier(1|2), tierLabel, businessOwner, ownerFn, adminCaps[], target, why}
capabilities  {"SYS.NAME": {label, txn}}      txn = exact screen path (this is what makes a rule "specific")
roles[]    {id, sys, name, desc, caps[], risk(1-3), priv, depts[], ownerFn}
sodRules[] {id, name, sev, required, scope(system|cross), systems[], a[], b[], example, risk, mitigation[]}
controls   {"CC-...": {name, detail}}         compensating controls library
```

`roles[].depts` lists the departments that normally hold the role (empty = any). It drives the "role not typical for department" test.
`systems[].adminCaps` marks the capabilities that make someone an *administrator* of that system (used to bar admins from reviewing).

### 2.2 `data/people.js` (generated)

```text
meta       {asOf, itgcLeadId, auditChairId, ceoId, cfoId, cioId, ctoId, functionOwners{dept: personId}}
people[]   {id, name, email, dept, team, title, level, managerId, type(Employee|Contractor), status(Active|Terminated),
            hire, location, [termDate], [contractEnd], [prevDept, transferDate], [promotedOn]}
accounts[] {id, sys, user, person|null, owner|null, type(Named|Service|Generic), roles[], created, lastLogin|null, status, ticket|null}
exceptions[] {id, key, personId, sys, reviewerId, approverId, approvedOn, expiresOn, controls[], justification, sev, ticket, concurrence, status}
```

Invariants (checked by `generate_data.py` and `validate_data.py`): totals 340 / 80 / 25 / 60; every manager chain ends at `KM-9001`; no cycles; every role belongs to the account's system; Named accounts have a `person`, Service and Generic have an `owner`.

### 2.3 Derived objects (built in `E.init`)

```text
Account (in place)   + holder (person or owner), roleObjs[], maxRisk, priv
Finding              {key, kind, ruleId?, sev, sys|"CROSS", systems[], accountIds[], personId, holderId,
                      title, detail, exceptable, [evA, evB, withinRole]}
Assignment           {primary: {id, skipped[{id, reason}]}, secondary: {..., fn, why}|null, dual}
```

Finding keys are stable identifiers used by exceptions:
`sod|<personId>|<ruleId>` for conflicts, `<kind>|<accountId>` for account-level findings.

### 2.4 Browser state (`localStorage["kai.state.v1"]`)

```text
checklist  {itemId: {pulled, ipe}}
decisions  {"<accountId>|<primary|secondary>": {decision, note, by, ts}}
signoffs   {reviewerId: {reviewer, at, count, hash, counts}}
exceptions [user-created exception objects, same shape as seeded, plus mine:true]
```

`localStorage["kai.theme"]` stores `light` or `dark`. Storage access is wrapped; if blocked, an in-memory copy is used.

## 3. Algorithms

### 3.1 Account-level findings (`raiseAccountFindings`)

| kind | Raised when | Severity |
|---|---|---|
| `leaver` | Person `status = Terminated`, account still exists | Critical if last login is after `termDate` or the account holds a role of risk 2+, else High |
| `contractor` | Contractor, `status = Active`, `contractEnd < asOf` | High |
| `generic` | `type = Generic` | High |
| `svcowner` | Service/Generic account and the owner has left | High |
| `dormant` | Named, holder not a leaver, last login over 90 days ago, or never logged in and created 30+ days ago | High if `maxRisk = 3` or privileged, else Medium |
| `mismatch` | Named, holder not a leaver, some role has a non-empty `depts` that excludes the person's current department | High if the role is risk 3, else Medium |
| `noticket` | Named and `ticket` is null | Medium |

`E.proc.kinds[kind].exceptable` decides whether a finding may be retained through the exception workflow. Leaver, contractor, generic, svcowner and noticket are not exceptable.

### 3.2 SoD detection (`raiseSod`)

```
caps[person][capability] = [{account, role, ...}]     built from every Named account of that person (all systems)
for each rule, for each Active person:
    A = capabilities of the person in rule.a
    B = capabilities of the person in rule.b
    if A and B are both non-empty: raise finding (accounts = union of the accounts involved)
```

Because capabilities are namespaced (`EBS.`, `BL.`, `KY.`, `GH.`) and the join is by person, the same code handles single-system and cross-system rules. `withinRole` is true when one role supplies both sides (for example *GL Super User*).

`E.conflictsForRoles(roleIds)` runs the same test for a hypothetical role set (used by the checker).

### 3.3 Reviewer assignment (`E.assign`, `E.pickReviewer`, `E.rejectReason`)

```
holder    = account.person or account.owner
primary   = pickReviewer(start = holder.managerId, exclude = {holder, owner})
secondary = if needsSecond(account):                      # system.tier == 1  or  account.maxRisk >= 3
                start = functionOwners[ highest-risk role .ownerFn ]
                pickReviewer(start, exclude = {holder, owner, primary})

pickReviewer(start, ctx):
    cur = start
    while cur:
        why = rejectReason(person[cur], ctx)
        if not why: return cur
        skipped.append({cur, why});  cur = person[cur].managerId
```

`rejectReason` returns the first failing test, in this order:

1. in the exclusion set (self-review, or already primary)
2. not `Active` (HR manager field is stale)
3. `level < 3` (below Manager)
4. `level <= holder.level` (does not outrank)
5. holds any `adminCaps` of the system being reviewed (business owner is not the IT admin)

The chain ends at the Audit Committee Chair (`level 8`), so a reviewer always exists. `E.validateAssignments()` re-runs `rejectReason` on every final choice from scratch and must return an empty list. `E.naive()` computes what an HR-line-manager-only approach would get wrong, to show why the rules matter.

`E.checkReviewer(account, candidate, slot)` applies the same tests to a manual override and adds one soft warning if the candidate is neither in the holder's management chain nor the function owner.

### 3.4 Exceptions

`E.limits(finding)`:

| Property | Rule |
|---|---|
| `exceptable` | from the finding kind |
| `maxDays` | `KAI_PROC.maxExceptionDays[severity]` (Critical 90, High 90, Medium 180, Low 180) |
| `tier1` | any involved system has `tier = 1` |
| `minControls` | 2 if Critical or Tier 1, else 1 |
| `minApproverLevel` | 6 if Critical or Tier 1, else 4 |
| `concurrence` | required if Critical or Tier 1 |
| `slaDays` | removal deadline if rejected or expired |

`E.approverCandidates(finding, reviewerId)` returns every person at level 4 or above with `ok` and a list of reasons. A candidate is rejected if they are the holder or reviewer, do not rank above the reviewer, have left, are below `minApproverLevel`, report to the holder, or are not in the management line (chain of the holder or of the reviewer).

`E.exceptionAudit(exception)` returns eight checks and a status:

1. approver level > reviewer level
2. approver is neither holder nor reviewer
3. approver active
4. approver level at least the minimum
5. duration positive and within `maxDays`
6. at least `minControls` compensating controls
7. concurrence recorded when required
8. approver in the accountable management line

Status is `Expired` if `expiresOn < asOf`, else `Active` if every check passes, else `Non-compliant`. `E.exceptionFor(key)` returns an exception only if its status is `Active`.

### 3.5 Retention

```
minUntil    = reviewDate + years
policyUntil = end of the fiscal year of reviewDate (31 Dec) + years
```

The page refuses `years < 7`.

### 3.6 Utilities

- **SHA-256:** standard FIPS 180-4, block loop over a padded `Uint8Array`, synchronous. Verified against known vectors and `crypto.subtle` in `tests.html`.
- **CRC-32 and ZIP:** table-driven CRC-32; ZIP writer emits local headers, central directory and end record using method 0 (stored). UTF-8 flag set. Verified with Python's `zipfile.testzip()`.
- **CSV:** RFC 4180 quoting, CRLF line ends.

### 3.7 Evidence pack (`views/evidence.js`)

`build()` produces 11 files: manifest, population, HR extract, reviewer assignments, findings, SoD rule set, review decisions, sign-offs, exception register, IPE extraction log, summary. Each file gets a SHA-256 in the manifest; the pack hash is the SHA-256 of the manifest text. The verifier hashes a chosen file and looks for the same hash in the manifest.

## 4. Module map

| File | Contents |
|---|---|
| `js/util.js` | `h()` and `svg()` DOM builders, dates, `store`, CSV, `download`, `sha256`, `crc32`, `makeZip` |
| `js/engine.js` | `E.init`, `E.findings`, `E.assignments`, `E.assign`, `E.rejectReason`, `E.validateAssignments`, `E.naive`, `E.checkReviewer`, `E.limits`, `E.approverCandidates`, `E.exceptionAudit`, `E.exceptionFor`, `E.retention`, `E.stats`, `E.conflictsForRoles` |
| `js/ui.js` | `UI.table` (sort, search, paging, CSV, expandable rows), `UI.tabs`, `UI.combo` (type-ahead), chips, KPI, notes, details |
| `js/charts.js` | stacked severity bars, rate bars, heat table, donut |
| `js/app.js` | state load/save, hash router, nav, theme toggle, docs links |
| `js/views/home.js` | scenario, systems, six tasks, live success-criteria table |
| `js/views/analysis.js` | KPIs, findings by system, scrutiny argument, narrative, reviewer load, exception health, recommendations. Exports `KAI.analysis()` for the report |
| `js/views/checklist.js` | checklist with two ticks per row, progress |
| `js/views/reviewers.js` | assignment rules, naive-versus-engine comparison, override tester, escalation log, reviewer workload |
| `js/views/criteria.js` | eight tests, per-system criteria, role catalogue |
| `js/views/sod.js` | rule cards, role checker, findings table |
| `js/views/exceptions.js` | workflow steps, limits, wizard, register |
| `js/views/evidence.js` | retention calculator, artefacts, pack builder and verifier, auditor requests, calendar |
| `js/views/workbench.js` | reviewer decisions, validation, sign-off |
| `js/views/accounts.js` | filterable table of all accounts |
| `js/views/report.js` | printable consolidated report |
| `tools/generate_data.py` | builds people, accounts, planted issues, seeded exceptions |
| `tools/validate_data.py` | independent finding counts and structural checks |
| `tests.html` | 57 engine and utility assertions |

## 5. UI conventions

- Pages are built with `h(tag, attrs, ...children)`. Text is always added as text nodes.
- A view returns a DOM node and is re-rendered on hash change or `KAI.refresh()`.
- Tables use `UI.table({rows, cols, ...})`. A column has `label`, `render(row)`, optional `sort(row)`, `csv(row)`, `cls`. `expand(row)` adds an expandable detail row; `csvCols` overrides the export columns.
- Severity is always shown as text plus colour.
- Theme: CSS custom properties; `prefers-color-scheme` by default, `data-theme` override from the toggle.
- Print: `@media print` hides navigation and controls and removes table scroll limits.

## 6. Workbench rules (`views/workbench.js`)

Decisions: Approve, Revoke, Modify, Retain. `validate(task)`:

- Non-exceptable finding present: cannot Approve or Retain.
- Exceptable finding present: cannot Approve; Retain requires an `Active` exception for every exceptable finding on the account (else a link to the wizard).
- Anything except Approve needs a note.
- Sign-off is enabled only when no task is pending or invalid and the attestation box is ticked. Changing any decision withdraws the reviewer's sign-off. The sign-off record stores a SHA-256 of that reviewer's decisions.

## 7. Testing

- **`tests.html`** (browser): 57 assertions grouped as utilities, population counts, rule quality, SoD detection, account-level flags, assignment invariants (no self-review, ranks above holder, never a leaver, never a system admin, all Tier 1 dual), guard rails, exceptions, retention, ZIP size, and cross-check numbers against the Python validator.
- **`tools/validate_data.py`**: structural integrity and independent recomputation of every finding count. Numbers must equal those in `tests.html`.
- **Manual**: the ZIP was checked with Python `zipfile`; pages were exercised in a browser at desktop and phone widths, light and dark.

## 8. How to extend

**Add an SoD rule.** Add an entry to `sodRules` in `data/reference.js` with `a` and `b` capability lists, an example and mitigation control ids. Nothing else changes; run `python tools/validate_data.py` and refresh.

**Add a capability or role.** Add the capability (with `txn`) and the role (with `caps`, `risk`, `depts`) in `reference.js`. Use the role in `tools/generate_data.py` if you want accounts to hold it.

**Add a system.** Add it to `systems` (with `tier`, `adminCaps`, `ownerFn`), add its capabilities and roles, add checklist items and criteria in `data/process.js`, and extend the generator. The engine and pages iterate over `systems`, so tables and charts pick it up.

**Change retention.** Edit `org.retentionYears` in `reference.js`. Values below 7 are refused on the retention page.

**Change the population or the seed.** Edit `tools/generate_data.py` (seed at the top; planted issues in the "planted" sections) and rerun it.

## 9. Known limitations

- Sign-offs and exceptions live in one browser; there is no shared or tamper-proof store.
- Person identity across systems is by person id, not by fuzzy matching of user names, which is what a real project would need.
- The engine treats every SoD rule as symmetrical and role-based; real environments also need transaction-level thresholds (approval limits) and time-based conflicts.
- Finding severities are fixed rules, not a risk score.
