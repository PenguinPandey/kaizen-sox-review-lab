# SOX Access Review Lab

An interactive, browser-only simulation of a **quarterly SOX ITGC user access review** for a fictional company, KaizenMotors.
It is a working version of the Day 15 assignment from the Srida IT *22-Day GRC Simulation* ("Design an access review checklist, SOX-aligned"), built as a website instead of a written document.

No backend, no build step, no dependencies. Open `index.html` in a browser, or host the folder on GitHub Pages.

> **All people, accounts, ticket numbers and findings are invented.** They are produced by `tools/generate_data.py` with a fixed random seed. Issues are planted on purpose so there is something to find.

---

## The scenario

KaizenMotors (auto-parts, mid-size, Rs 300 cr revenue, US-listed parent) must review access to every financial system each quarter. You are the **ITGC Lead**. Four systems are in scope:

| System | Accounts | Scrutiny |
|---|---|---|
| Oracle EBS (ERP + Finance) | 340 | Tier 2: manager review, high-risk roles escalated |
| Blackline (reconciliation) | 80 | **Tier 1**: every user reviewed twice |
| Kyriba (treasury) | 25 | **Tier 1**: every user reviewed twice |
| Corporate GitHub (some devs have prod-DB access) | 60 | Tier 2, prod-DB path escalated |

## The six tasks, and where each one lives

| # | Assignment task | Page | What it does |
|---|---|---|---|
| 1 | Access review checklist (what to pull, from where) | **Data-pull checklist** | 31 items with source table/report, method, completeness-and-accuracy check (IPE) and owner. Tick items off; progress is saved. |
| 2 | Reviewer assignment | **Reviewer assignment** | Rules engine assigns primary and second reviewers to all 505 accounts, blocks self-review, and logs every escalation. A "try to break it" tester checks any manual override. |
| 3 | Review criteria per system | **Review criteria** | What "appropriate access" means, red flags, reviewer arrangement and a plain-English role catalogue (45 roles) for each system. |
| 4 | SoD conflict rules | **SoD conflict rules** | 14 rules naming exact transactions and screens, a role-combination checker, and every conflict found. Includes the required three and the GitHub dev + prod-DB rule. |
| 5 | Exception approval workflow | **Exception workflow** | Step-by-step wizard. The approver must outrank the reviewer and sit in the accountable management line. Exception register is re-audited on every load. |
| 6 | Evidence retention for the auditor | **Evidence retention** | 7-year retention calculator, evidence list, PBC (auditor request) map, and a downloadable **evidence pack (ZIP)** with a SHA-256 manifest and a file verifier. |

Extra pages: **Analysis** (findings, why Tier 1 gets more scrutiny, recommendations), **Review workbench** (play the reviewer and sign off), **Accounts explorer** (all 505 accounts, filter and export) and a **Printable report** (print to PDF).

### How the success criteria are met

The **Home** page checks these live from the data rather than stating them:

- **SoD rules are specific transactions**: every rule names two capabilities and the exact screen for each (for example *GL > Journals > Enter* against *GL > Journals > Approval*).
- **No self-review**: a reviewer is rejected if they are the holder or owner, have left, are below Manager level, do not outrank the holder, or administer the system. Every final assignment is re-checked from scratch on load; the result is 0 violations. A plain "line manager reviews" approach would have failed on 173 accounts.
- **Exception approver ranks above the reviewer**: enforced in the wizard and re-checked on stored exceptions. The seeded register includes one exception that fails (approver at same level) and one that has expired, to show the control catching them.
- **7-year retention**: default 7 years from fiscal-year end; the calculator refuses less than 7.
- **Blackline and Kyriba get higher scrutiny**: all 105 accounts get two reviewers, exceptions are capped at 90 days, and approval needs VP level or above.
- **GitHub prod-DB flagged**: rule R04 (Critical) flags every developer who holds both code-write and production-database read.


## Design documents

- [`docs/HLD.md`](docs/HLD.md): high-level design (context, architecture, decisions, limits).
- [`docs/LLD.md`](docs/LLD.md): low-level design (data model, algorithms, file map, how to extend).

## Layout

```
index.html            app shell
tests.html            in-browser test page
css/styles.css        styles (light and dark, print)
data/reference.js     roles, capabilities, SoD rules, controls
data/process.js       checklist, criteria, workflow, retention text
data/people.js        generated people, accounts, seeded exceptions
js/util.js            DOM helper, dates, CSV, SHA-256, ZIP
js/engine.js          findings, SoD, reviewer assignment, exceptions
js/ui.js, charts.js   components and charts
js/views/*.js         one file per page
js/app.js             router, state, theme
tools/                data generator and validator (Python)
docs/                 HLD and LLD
```

## Limits and honest caveats

- It is a simulation. Sign-off is stored in your browser and is not tamper-proof; a real control needs a system of record.
- Retention: 7 years is the SOX floor used by the assignment. Indian company law may require longer for books of account. The page says so; confirm with Legal.
- The rules, role names and Oracle table names are realistic but simplified. Adapt them to your real environment before using any of this in practice.
- KaizenMotors is fictional. The scenario text belongs to Srida IT's practice lab; this project is an independent learning aid and is not affiliated with them.
