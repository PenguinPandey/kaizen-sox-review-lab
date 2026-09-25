/* Process content: checklist, criteria, workflow, retention. Hand-written; edit freely. */
window.KAI_PROC = {
  ipeStandard: "Extract taken by IT (never the reviewer, never a user in scope). Row count agreed to the system screen or report. Query text and parameters archived. Extraction date/time and SHA-256 of the file recorded. ITGC Lead validates before it goes to a reviewer.",

  checklist: [
    /* ---------- Common ---------- */
    {id: "C1", sys: "ALL", item: "HR master: every employee and contractor with status, termination date, department, manager, transfer history, contract end date", source: "HRIS employee master + movement report (effective review date)", method: "Run by HR, not IT and not the reviewer", ipe: "Headcount agrees to payroll headcount; contractors agreed to vendor-management list", who: "HR Operations"},
    {id: "C2", sys: "ALL", item: "Org hierarchy and reviewer eligibility: manager chain, grade level, active flag", source: "Same HRIS extract", method: "Feeds the reviewer-assignment rules", ipe: "Every manager id resolves to an active person; no cycles", who: "ITGC Lead"},
    {id: "C3", sys: "ALL", item: "Prior-quarter review pack: open remediation items and exception register", source: "Evidence store / GRC tool", method: "Carry forward anything unresolved", ipe: "Register total agrees to last quarter's sign-off", who: "ITGC Lead"},
    {id: "C4", sys: "ALL", item: "Approved access-request tickets raised in the quarter", source: "ITSM (request, approval, fulfilment)", method: "Export tickets by system and date", ipe: "Ticket count agrees to ITSM dashboard; approver is not the requester", who: "IT Service Desk"},
    {id: "C5", sys: "ALL", item: "SoD rule set, role-to-function mapping and system/role owners (versioned)", source: "ITGC Lead's control document", method: "Approved by Controller, Treasurer and CTO before the cycle", ipe: "Version number and approval date recorded on the pack", who: "ITGC Lead"},
    {id: "C6", sys: "ALL", item: "Extraction log: who pulled each listing, when, with which query, plus file hash", source: "Evidence index", method: "One row per file", ipe: "This is the IPE record itself", who: "ITGC Lead"},

    /* ---------- Oracle EBS ---------- */
    {id: "E1", sys: "EBS", item: "User list with employee link, start/end date and last sign-on", source: "FND_USER (USER_NAME, EMPLOYEE_ID, START_DATE, END_DATE, LAST_LOGON_DATE)", method: "Change-managed read-only SQL run by Apps DBA on production", ipe: "Row count agrees to Define User screen; SQL stored with the file", who: "Apps DBA"},
    {id: "E2", sys: "EBS", item: "Responsibility and role assignments (active only)", source: "FND_USER_RESP_GROUPS_DIRECT joined to FND_RESPONSIBILITY_VL; UMX roles via WF_USER_ROLE_ASSIGNMENTS", method: "Filter end date is null or in the future", ipe: "Sample 10 users: screen vs extract", who: "Apps DBA"},
    {id: "E3", sys: "EBS", item: "What each responsibility can actually do (function-level map, excluded functions)", source: "FND_MENU_ENTRIES, FND_COMPILED_MENU_FUNCTIONS, form function exclusions", method: "Used to build the role-to-capability table", ipe: "Mapping approved by Controller for the cycle", who: "Apps DBA + Controller"},
    {id: "E4", sys: "EBS", item: "Privileged access: SYSADMIN, user-admin roles, APPS and DBA database accounts", source: "Responsibility list + DBA_USERS / DBA_ROLE_PRIVS", method: "Separate list reviewed by business owner and CIO", ipe: "DB account list agrees to DBA inventory", who: "Infrastructure DBA"},
    {id: "E5", sys: "EBS", item: "Sign-on history to test dormant accounts (90 days)", source: "FND_LOGINS / Signon Audit Users report", method: "Last successful login per user", ipe: "Extraction date is the review date, not earlier", who: "Apps DBA"},
    {id: "E6", sys: "EBS", item: "Access changes made during the quarter", source: "Audit trail on FND_USER and user-responsibility tables", method: "Match every grant to an approved ticket (C4)", ipe: "Audit trail was switched on for the whole period", who: "Apps DBA"},
    {id: "E7", sys: "EBS", item: "Service, interface and generic accounts with named owners", source: "FND_USER rows with no EMPLOYEE_ID", method: "Owner must be a current employee", ipe: "Count agrees to E1 total less named users", who: "Enterprise Apps Manager"},

    /* ---------- Blackline ---------- */
    {id: "B1", sys: "BL", item: "User and role export with status and last login", source: "Admin > Users export", method: "Full export, no filters", ipe: "Row count agrees to Users page total", who: "Finance Systems Analyst (not a reviewer)"},
    {id: "B2", sys: "BL", item: "Role and permission matrix", source: "Admin > Roles export", method: "Map each role to preparer / approver / admin capabilities", ipe: "Matrix approved by Controller", who: "Finance Systems Analyst"},
    {id: "B3", sys: "BL", item: "Reconciliation ownership: preparer and approver per account", source: "Accounts export (ownership columns)", method: "Detect same person as preparer and approver on one account", ipe: "Account count agrees to close checklist", who: "Controller's office"},
    {id: "B4", sys: "BL", item: "SSO group membership for the Blackline app", source: "Identity provider group export", method: "Everyone in Blackline must be in an approved group", ipe: "Group member count agrees to B1", who: "IT Identity team"},
    {id: "B5", sys: "BL", item: "API credentials and integrations with owners", source: "Admin > Integrations", method: "Owner must be a current employee", ipe: "Agree to integration inventory", who: "Enterprise Apps Manager"},
    {id: "B6", sys: "BL", item: "Audit log of user and role changes in the quarter", source: "Admin > Audit log", method: "Match to approved tickets (C4)", ipe: "Log covers full quarter", who: "Finance Systems Analyst"},

    /* ---------- Kyriba ---------- */
    {id: "K1", sys: "KY", item: "User and profile report with last connection and status", source: "Administration > Users; user-rights report", method: "Full export", ipe: "Row count agrees to Users screen", who: "Kyriba Administrator (not a reviewer)"},
    {id: "K2", sys: "KY", item: "Profile-to-rights matrix", source: "Administration > Profiles", method: "Which profiles can initiate, approve or maintain bank accounts", ipe: "Approved by Treasurer", who: "Kyriba Administrator"},
    {id: "K3", sys: "KY", item: "Payment approval workflow and limits per user or profile", source: "Workflow configuration screens", method: "Confirm two distinct approvers are enforced above the threshold", ipe: "Screenshot with date, signed off by Treasurer", who: "Treasury Manager"},
    {id: "K4", sys: "KY", item: "Bank-side signatory and portal user lists", source: "Bank confirmations and bank portal user lists", method: "Reconcile Kyriba approvers to the banks' own lists", ipe: "Bank confirmation letters dated within the quarter", who: "Treasury Manager"},
    {id: "K5", sys: "KY", item: "Bank connectivity and service accounts with owners", source: "SWIFT / host-to-host credential inventory", method: "Owner is a current employee; certificates not expired", ipe: "Agree to K1 service rows", who: "Enterprise Apps Manager"},
    {id: "K6", sys: "KY", item: "Audit trail of user, profile and beneficiary changes", source: "Administration > Audit trail", method: "Match to approved tickets (C4); check beneficiary changes vs call-back log", ipe: "Trail covers full quarter", who: "Kyriba Administrator"},

    /* ---------- GitHub ---------- */
    {id: "G1", sys: "GH", item: "Organisation members with role (owner / member) and 2FA / SSO status", source: "REST: GET /orgs/{org}/members, /memberships; Enterprise people export", method: "Scripted with a read-only token", ipe: "Count agrees to People page; token owner recorded", who: "DevOps (not an org owner reviewing themselves)"},
    {id: "G2", sys: "GH", item: "Team membership and repository permissions, including outside collaborators", source: "GET /orgs/{org}/teams, /teams/{slug}/members, /repos/{repo}/collaborators", method: "Focus on repos that deploy to production or hold finance code", ipe: "Repo list agrees to service catalogue", who: "DevOps"},
    {id: "G3", sys: "GH", item: "Production-database access path (SoD-critical): team prod-db-readers, the 'production' environment secrets, and DB-side grants", source: "GitHub team + environment secrets; database SHOW GRANTS / cloud IAM list", method: "Reconcile both directions: every DB grant has a GitHub identity and vice versa", ipe: "Two independent sources agree; differences explained", who: "Infrastructure DBA + DevOps"},
    {id: "G4", sys: "GH", item: "Branch protection rules, rulesets and production-environment reviewers", source: "GET /repos/{repo}/branches/{b}/protection; environments API", method: "Author cannot approve own PR; admins cannot bypass without alert", ipe: "Settings exported with date", who: "DevOps"},
    {id: "G5", sys: "GH", item: "Personal access tokens, deploy keys, GitHub Apps and SSO-authorised credentials", source: "GET /orgs/{org}/credential-authorizations; deploy keys; installed apps", method: "Owner is current; scope is least privilege; expiry set", ipe: "Agree to secrets inventory", who: "IT Security"},
    {id: "G6", sys: "GH", item: "Audit log of membership, permission and protection changes", source: "GET /orgs/{org}/audit-log (Enterprise Cloud)", method: "Match to approved tickets (C4)", ipe: "Log retention covers the quarter", who: "IT Security"}
  ],

  criteria: {
    EBS: {
      appropriate: [
        "User is an active employee or an in-contract contractor on the HR master",
        "Each responsibility matches the user's current job (role catalogue lists which departments may hold it)",
        "No combination of responsibilities crosses an SoD rule (R01, R02, R03, R06, R07, R13)",
        "Approval-type roles (journal approval, PO approval, access approval) sit with business managers, never with IT",
        "Signed in within the last 90 days; seasonal users are disabled outside their window",
        "Access has an approved request ticket that names the same role"
      ],
      redFlags: [
        "Terminated user still active, especially with any login after the termination date",
        "Super-user roles (GL Super User, Purchasing Super User) held by anyone",
        "Admin roles held outside IT, or IT staff holding finance transaction roles",
        "Movers who kept the previous department's roles",
        "Generic or shared logins, and service accounts with no current owner"
      ],
      reviewer: "Line manager (Manager level or above) as primary. High-risk roles (journals, payments, supplier bank details, PO approval, sysadmin) also go to the functional owner as second reviewer.",
      scrutiny: "Standard, with role-based escalation"
    },
    BL: {
      appropriate: [
        "Finance department staff only (IT only for the admin role)",
        "Preparers can only prepare, reviewers can only approve; nobody holds both",
        "Approvers are at Manager grade or above and are not the preparer of the same reconciliation",
        "Admin role limited to the Finance Systems team; changes to ownership or risk ratings are logged",
        "Read-only access for auditors is named, time-boxed and sponsored",
        "Signed in within the last 90 days"
      ],
      redFlags: [
        "Combined Preparer + Approver role, or one person holding both roles",
        "Person who posts journals in Oracle also approves reconciliations",
        "Shared logins (for example a shared reconciliation account)",
        "Leavers and movers out of Finance",
        "Admin access with no business reason"
      ],
      reviewer: "Every user has two reviewers: the line manager and the Financial Controller as system business owner. Admin accounts are reviewed by the Controller and the CIO's delegate, never by the admin's own team.",
      scrutiny: "Tier 1: 100% coverage, dual review, exceptions capped at one quarter, CFO approval"
    },
    KY: {
      appropriate: [
        "Treasury staff, plus named finance viewers, plus IT admins for the Administrator role",
        "Initiators cannot approve; maintainers of bank accounts cannot release payments",
        "Approvers match the bank's signatory list and the approved payment matrix",
        "Deal entry and deal confirmation are held by different people",
        "Administrator role limited to two named IT staff, each with a ticketed reason to hold it",
        "Signed in within the last 90 days, or a documented break-glass reason"
      ],
      redFlags: [
        "Payment Super User, or one person able to initiate and release",
        "Anyone who can create payments in Oracle and release them in Kyriba (R11)",
        "Leavers with payment rights, or approvers not on the bank signatory list",
        "Unused administrator accounts",
        "Changes to beneficiaries with no call-back evidence"
      ],
      reviewer: "Every user has two reviewers: the line manager and the Treasurer as system business owner. The Treasurer's own access is reviewed by the CFO and then the CEO.",
      scrutiny: "Tier 1: 100% coverage, dual review, exceptions capped at one quarter, CFO approval"
    },
    GH: {
      appropriate: [
        "Active employee, or contractor inside the contract end date and sponsored by a manager",
        "Developers have write on their own repositories only; no standing access to the production database",
        "Production-DB access sits with a small named group outside the development teams and is time-boxed",
        "Authors cannot approve their own pull requests or production deployments",
        "Organisation owners are few (maximum 3), all current staff, all with 2FA and SSO",
        "Service accounts have a current named owner and least-privilege scope"
      ],
      redFlags: [
        "Any developer who is a member of prod-db-readers (dev + prod SoD conflict)",
        "Developer who can also approve production deployments",
        "Repository admins who can switch off branch protection",
        "Leavers or expired contractors still in the organisation",
        "Service accounts whose owner has left"
      ],
      reviewer: "Engineering manager as primary. Anything that touches production (deployment approval, repo admin, org owner, prod-DB) goes to the CTO as second reviewer. Org owners are never reviewed by another org owner.",
      scrutiny: "Standard, with prod-DB path escalated"
    }
  },

  workflow: [
    {n: 1, title: "Reviewer decides to retain", who: "Reviewer", text: "During the review the reviewer decides an access should stay although it was flagged. Leavers, expired contractors, shared logins and unapproved access cannot be retained; they are remediated."},
    {n: 2, title: "Request raised", who: "Reviewer", text: "Written business justification, the risk in plain words, at least one compensating control from the library (two for Critical and Tier 1), and the requested duration."},
    {n: 3, title: "Approver routed", who: "System / ITGC Lead", text: "The approver must rank strictly above the reviewer, must not be the account holder or the reviewer, and must be an active employee. Critical or Tier 1 findings need VP level or higher."},
    {n: 4, title: "Independent concurrence", who: "ITGC Lead + Compliance", text: "For Critical and Tier 1 findings the ITGC Lead and Compliance confirm the compensating controls are real and testable. Internal Audit is informed, not asked to approve."},
    {n: 5, title: "Entered in the exception register", who: "ITGC Lead", text: "Register entry with expiry date, control owner and evidence location. Nothing is approved without an expiry."},
    {n: 6, title: "Compensating control operates", who: "Control owner", text: "The control runs on its stated schedule. The ITGC Lead samples it each month and keeps the evidence."},
    {n: 7, title: "Expiry or next review", who: "ITGC Lead", text: "The exception ends at the earlier of its expiry date and the next quarterly review. It is never renewed automatically. It must be re-requested and re-approved in full, or the access is removed."},
    {n: 8, title: "If rejected or expired", who: "IT + Reviewer", text: "Access is removed within 2 working days for Critical findings and 5 for others, then a fresh listing is pulled to prove it is gone."}
  ],

  slaDays: {"Critical": 2, "High": 5, "Medium": 5, "Low": 5},
  maxExceptionDays: {"Critical": 90, "High": 90, "Medium": 180, "Low": 180},

  /* What each finding kind may do. exceptable=false means it must be remediated. */
  kinds: {
    leaver: {label: "Leaver still active", exceptable: false, action: "Revoke"},
    contractor: {label: "Contractor past contract end", exceptable: false, action: "Revoke"},
    generic: {label: "Shared / generic login", exceptable: false, action: "Replace with named or service account"},
    svcowner: {label: "Service account owner has left", exceptable: false, action: "Assign a new owner"},
    noticket: {label: "Access with no approved request", exceptable: false, action: "Retro-approve by business owner or revoke"},
    dormant: {label: "Dormant or never-used account", exceptable: true, action: "Revoke"},
    mismatch: {label: "Role not typical for the person's department", exceptable: true, action: "Modify (remove role)"},
    sod: {label: "Segregation-of-duties conflict", exceptable: true, action: "Modify (remove one side)"}
  },

  retention: [
    {id: "RT1", item: "System user listings (raw extracts) and their extraction log", source: "Checklist items E1-G6", note: "The IPE record. Without it the review population is not defensible."},
    {id: "RT2", item: "HR master extract and org hierarchy used for the review", source: "C1, C2", note: "Proves leaver and mover tests used complete data."},
    {id: "RT3", item: "Reviewer assignment list with rules version", source: "Reviewer assignment", note: "Shows nobody reviewed their own access."},
    {id: "RT4", item: "Reviewer decisions per account with date, name and notes", source: "Review workbench", note: "One row per account: approve, revoke, modify or retain."},
    {id: "RT5", item: "Signed attestations from each reviewer", source: "Review workbench sign-off", note: "Business-owner sign-off is the SOX control evidence."},
    {id: "RT6", item: "SoD analysis results and the rule set used", source: "SoD engine", note: "Rules are versioned and approved before the cycle."},
    {id: "RT7", item: "Exception register with approvals, compensating controls and expiry", source: "Exception workflow", note: "Includes rejected requests and expired items."},
    {id: "RT8", item: "Remediation tickets and post-removal re-pull proving access is gone", source: "ITSM + fresh listing", note: "Closes the loop; an approval to remove is not proof of removal."},
    {id: "RT9", item: "Quarter summary and ITGC Lead sign-off", source: "Analysis + report", note: "What the auditor reads first."}
  ],

  pbc: [
    {q: "Give me the full population of users for each in-scope system on the review date.", a: "Listings E1, B1, K1, G1 with extraction log and hashes (RT1)."},
    {q: "How do I know the listing is complete and accurate?", a: "IPE record: count agreed to system screen, query archived, extracted by IT, validated by ITGC Lead."},
    {q: "Who reviewed each user's access and were they allowed to?", a: "Reviewer assignment list showing no self-review, level check, and business owner not IT admin (RT3)."},
    {q: "Show me the reviewer's sign-off for each system.", a: "Attestations with date and hash (RT5)."},
    {q: "What did you find and what happened to it?", a: "Decision log, remediation tickets and post-removal listings (RT4, RT8)."},
    {q: "Which conflicts were accepted and who approved them?", a: "Exception register: approver ranks above reviewer, compensating controls, expiry (RT7)."},
    {q: "Prove leavers lost access on time.", a: "HR termination list vs deactivation dates from the audit trail."},
    {q: "Show retention.", a: "Retention schedule and storage location; oldest available pack is seven years back."}
  ],

  calendar: [
    {t: -10, step: "Freeze SoD rule set and role mapping; approve reviewer assignments"},
    {t: -5, step: "Pull HR master and all system listings; validate IPE"},
    {t: 0, step: "Quarter end: as-of date for the review population"},
    {t: 1, step: "Run flags and SoD analysis; issue reviewer packs"},
    {t: 10, step: "Reviewers complete decisions; exception requests submitted"},
    {t: 15, step: "Second reviewers (Tier 1 and high-risk roles) complete; sign-offs due"},
    {t: 20, step: "Approve or reject exceptions; raise removal tickets"},
    {t: 25, step: "Removals done; fresh listings pulled to prove closure"},
    {t: 31, step: "ITGC Lead signs off; evidence pack sealed and filed"}
  ]
};
