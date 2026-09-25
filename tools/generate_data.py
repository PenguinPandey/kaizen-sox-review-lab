#!/usr/bin/env python3
"""Generate the synthetic KaizenMotors population used by the site.

Deterministic (seed 15). Reads data/reference.js (role catalogue) and writes data/people.js.
Every person, account and issue is fictional. Issues are planted on purpose so the review has
something to find; the browser engine detects them independently (see tools/validate_data.py).

Run:  python tools/generate_data.py
"""
import json
import os
import random
import re
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASOF = date(2026, 9, 30)
rng = random.Random(15)


def load_ref():
    txt = open(os.path.join(ROOT, "data", "reference.js"), encoding="utf-8").read()
    txt = re.sub(r"^\s*window\.KAI_REF\s*=\s*", "", txt).strip().rstrip(";")
    return json.loads(txt)


REF = load_ref()
ROLES = {r["id"]: r for r in REF["roles"]}
TARGET = {s["id"]: s["target"] for s in REF["systems"]}

FIRST = ("Aarav Aditya Akash Amit Anil Ankit Arjun Arun Ashok Deepak Dinesh Farhan Gaurav Girish Harish Hemant Imran Jatin Karan Kiran "
         "Kunal Lokesh Manoj Mohan Naveen Nikhil Nitin Pankaj Prakash Pranav Rahul Rajesh Rakesh Ramesh Rohan Sachin Sameer Sandeep "
         "Sanjay Shivam Siddharth Suresh Tarun Uday Varun Vijay Vikas Vikram Vinod Yash Zubin Aditi Ananya Anjali Asha Bhavna Charu "
         "Deepa Divya Esha Gauri Geeta Isha Jaya Kavita Kriti Lakshmi Madhuri Meera Megha Neha Nisha Pooja Priya Radhika Rekha Ritu "
         "Sakshi Sangeeta Shreya Smita Sneha Sonal Sunita Swati Tanvi Uma Vandana Varsha Vidya Yamini Zoya").split()
LAST = ("Agarwal Bhatt Chaudhary Desai Deshmukh Dubey Gandhi Ghosh Gupta Iyer Jain Joshi Kamat Kapoor Kaur Khan Kulkarni Kumar Lal "
         "Malhotra Mehta Menon Mishra Mukherjee Nair Naidu Pandey Patel Pillai Rao Reddy Saxena Sethi Shah Sharma Shetty Singh Sinha "
         "Srinivasan Suri Tiwari Trivedi Varma Verma Yadav Bansal Chopra Dhar Fernandes Ghatge Hegde Jadhav Karnik Lobo Mane Naik "
         "Oberoi Parekh Rathore Sawant Tandon Thakur Wagh Zaveri Bajaj Chatterjee Dutta Khanna Krishnan Nambiar Patil").split()

people, by_id = [], {}
accts = []
_n = [1]
used_names, used_users = set(), {}
used_tickets = set()


def iso(d):
    return d.isoformat()


def mkname():
    while True:
        f, l = rng.choice(FIRST), rng.choice(LAST)
        if (f, l) not in used_names:
            used_names.add((f, l))
            return f, l


def add(dept, team, title, level, mgr, ptype="Employee", fixed_id=None, loc="Gurugram HQ", hire=None):
    if fixed_id:
        pid = fixed_id
    else:
        pid = "KM-%04d" % _n[0]
        _n[0] += 1
    f, l = mkname()
    if hire is None:
        if ptype == "Contractor":
            hire = ASOF - timedelta(days=rng.randint(60, 700))
        else:
            hire = ASOF - timedelta(days=int(365 * rng.randint(1, 4 + level * 2)) + rng.randint(0, 300))
    p = {"id": pid, "name": "%s %s" % (f, l), "first": f, "last": l,
         "email": "%s.%s@kaizenmotors.example" % (f.lower(), l.lower()),
         "dept": dept, "team": team, "title": title, "level": level, "managerId": mgr,
         "type": ptype, "status": "Active", "hire": iso(hire), "location": loc}
    people.append(p)
    by_id[pid] = p
    return pid


def staff(n, dept, team, title, level, mgrs, **kw):
    return [add(dept, team, title, level, rng.choice(mgrs), **kw) for _ in range(n)]


def uname(sysid, p):
    f, l = p["first"], p["last"]
    if sysid == "EBS":
        base = re.sub(r"[^A-Z]", "", (f[0] + l).upper())
    elif sysid == "GH":
        base = "%s-%s" % (f.lower(), l.lower())
    else:
        base = p["email"]
    key = (sysid, base)
    k = used_users.get(key, 0)
    used_users[key] = k + 1
    if k == 0:
        return base
    if sysid == "BL" or sysid == "KY":
        return base.replace("@", "%d@" % (k + 1))
    return "%s%d" % (base, k + 1)


def ticket():
    while True:
        t = "ITSM-%d" % rng.randint(10000, 99999)
        if t not in used_tickets:
            used_tickets.add(t)
            return t


def recent_login():
    r = rng.random()
    d = rng.randint(0, 6) if r < 0.6 else (rng.randint(7, 40) if r < 0.9 else rng.randint(41, 80))
    return iso(ASOF - timedelta(days=d))


def acct(sysid, pid, roles, kind="Named", owner=None, user=None):
    seq = len([a for a in accts if a["sys"] == sysid]) + 1
    if user is None:
        user = uname(sysid, by_id[pid])
    base = date(2020, 1, 1)
    hire = date.fromisoformat(by_id[pid]["hire"]) if pid else base
    start = max(hire, base)
    created = start + timedelta(days=rng.randint(0, max(1, (ASOF - start).days - 90)))
    a = {"id": "%s-%04d" % (sysid, seq), "sys": sysid, "user": user, "person": pid,
         "owner": owner if kind != "Named" else None, "type": kind, "roles": list(roles),
         "created": iso(created), "lastLogin": recent_login(), "status": "Active", "ticket": ticket()}
    if kind != "Named":
        a["person"] = None
        a["created"] = iso(date(2019, 1, 1) + timedelta(days=rng.randint(0, 900)))
    accts.append(a)
    return a


def acct_of(pid, sysid):
    for a in accts:
        if a["person"] == pid and a["sys"] == sysid:
            return a
    return None


def give(pid, sysid, roles):
    a = acct_of(pid, sysid)
    if a is None:
        return acct(sysid, pid, roles)
    for r in roles:
        if r not in a["roles"]:
            a["roles"].append(r)
    return a


def setroles(pid, sysid, roles):
    a = acct_of(pid, sysid)
    if a is None:
        return acct(sysid, pid, roles)
    a["roles"] = list(roles)
    return a


# ------------------------------------------------------------------ organisation
T = {}
board = add("Board", "", "Independent Director & Audit Committee Chair", 8, None, fixed_id="KM-9001", loc="Mumbai")
ceo = add("Executive", "", "Managing Director & CEO", 7, board)
cfo = add("Executive", "", "Chief Financial Officer", 6, ceo)
cio = add("Executive", "", "Chief Information Officer", 6, ceo)
cto = add("Executive", "", "Chief Technology Officer (VP Engineering)", 6, ceo)
coo = add("Executive", "", "Chief Operating Officer", 6, ceo)
chro = add("Executive", "", "Chief Human Resources Officer", 6, ceo)

# Finance
controller = add("Finance", "Controllership", "Financial Controller", 5, cfo)
gl_sr = add("Finance", "GL & Close", "Senior Manager - General Ledger", 4, controller)
gl_mgr = [add("Finance", "GL & Close", "Manager - Financial Close", 3, gl_sr) for _ in range(2)]
gl_lead = add("Finance", "GL & Close", "Team Lead - GL", 2, gl_mgr[0])
gl_staff = staff(16, "Finance", "GL & Close", "GL Accountant", 1, gl_mgr + [gl_lead, gl_lead])
ap_mgr = add("Finance", "Accounts Payable", "Manager - Accounts Payable", 3, controller)
ap_lead = add("Finance", "Accounts Payable", "Team Lead - AP", 2, ap_mgr)
ap_entry = staff(8, "Finance", "Accounts Payable", "AP Executive", 1, [ap_mgr, ap_lead])
ap_pay = staff(2, "Finance", "Accounts Payable", "Senior AP Executive - Payments", 2, [ap_mgr])
ap_appr = staff(1, "Finance", "Accounts Payable", "Senior AP Executive - Approvals", 2, [ap_mgr])
ar_mgr = add("Finance", "Accounts Receivable", "Manager - Accounts Receivable", 3, controller)
ar_staff = staff(12, "Finance", "Accounts Receivable", "AR Executive", 1, [ar_mgr])
fac_mgr = add("Finance", "Fixed Assets & Cost", "Manager - Fixed Assets & Costing", 3, controller)
fac_staff = staff(8, "Finance", "Fixed Assets & Cost", "Cost / Fixed Asset Accountant", 1, [fac_mgr])
tax_mgr = add("Finance", "Tax", "Manager - Tax & Compliance", 3, controller)
tax_staff = staff(3, "Finance", "Tax", "Tax Executive", 1, [tax_mgr])
fpa_mgr = add("Finance", "FP&A", "Manager - FP&A", 3, cfo)
fpa_staff = staff(4, "Finance", "FP&A", "FP&A Analyst", 1, [fpa_mgr])
fin_sys = staff(2, "Finance", "Finance Systems", "Finance Systems Analyst", 2, [controller])

# Treasury
treasurer = add("Treasury", "", "Treasurer", 5, cfo)
tr_mgr = [add("Treasury", "", "Manager - Treasury", 3, treasurer) for _ in range(2)]
tr_pay = staff(5, "Treasury", "", "Treasury Analyst - Payments", 1, tr_mgr)
tr_cash = staff(2, "Treasury", "", "Treasury Analyst - Cash", 1, tr_mgr)
tr_deal = staff(1, "Treasury", "", "Treasury Analyst - Front Office", 1, tr_mgr)
tr_conf = staff(1, "Treasury", "", "Treasury Analyst - Back Office", 1, tr_mgr)

# Procurement
head_proc = add("Procurement", "", "Head of Procurement", 5, coo)
proc_mgr = [add("Procurement", "", "Manager - Procurement", 3, head_proc) for _ in range(3)]
buy_lead = [add("Procurement", "", "Team Lead - Buying", 2, proc_mgr[0]) for _ in range(2)]
buyers = staff(14, "Procurement", "", "Buyer", 1, buy_lead + proc_mgr)
sup_mstr = staff(3, "Procurement", "", "Supplier Master Data Analyst", 1, [proc_mgr[1]])

# Sales, HR
head_sales = add("Sales", "", "Head of Sales & Distribution", 5, ceo)
reg_mgr = [add("Sales", "", "Regional Sales Manager", 4, head_sales) for _ in range(4)]
od_lead = [add("Sales", "", "Order Desk Lead", 2, m) for m in reg_mgr]
sales_staff = staff(40, "Sales", "", "Order Desk Executive", 1, od_lead)
hr_mgr = [add("HR", "", "Manager - HR Operations", 3, chro) for _ in range(2)]
hr_staff = staff(5, "HR", "", "HR Executive", 1, hr_mgr)

# IT
head_ops = add("IT", "", "Head of IT Operations", 5, cio)
ent_apps = add("IT", "Enterprise Apps", "Manager - Enterprise Applications", 3, head_ops)
infra_mgr = add("IT", "Infrastructure", "Manager - Infrastructure", 3, head_ops)
sec_mgr = add("IT", "Security", "Manager - IT Security", 3, head_ops)
devops_mgr = add("IT", "DevOps", "Manager - DevOps", 3, head_ops)
sysadmins = staff(3, "IT", "Enterprise Apps", "Oracle Applications DBA / SysAdmin", 2, [ent_apps])
it_apps = staff(5, "IT", "Enterprise Apps", "Application Support Analyst", 1, [ent_apps])
dbas = staff(2, "IT", "Infrastructure", "Database Administrator", 2, [infra_mgr])
devops_lead = add("IT", "DevOps", "DevOps Lead", 2, devops_mgr)
rel_mgr = staff(3, "IT", "DevOps", "Release Manager", 2, [devops_mgr])
devops_eng = add("IT", "DevOps", "DevOps Engineer", 1, devops_mgr)

# Engineering
dir_eng = add("Engineering", "", "Director - Engineering", 5, cto)
eng_mgr = [add("Engineering", "", "Engineering Manager", 4 if i < 2 else 3, dir_eng, loc="Pune") for i in range(5)]
eng_lead = [add("Engineering", "", "Tech Lead", 2, eng_mgr[i], loc="Pune") for i in range(5)]
eng_dev = staff(28, "Engineering", "", "Software Engineer", 1, eng_lead + eng_lead + eng_mgr, loc="Pune")
eng_qa = staff(4, "Engineering", "", "QA Engineer", 1, eng_mgr, loc="Pune")
eng_con = staff(6, "Engineering", "", "Contract Developer", 1, eng_mgr, ptype="Contractor", loc="Pune")

# Assurance
head_ia = add("Internal Audit", "", "Head of Internal Audit", 5, board)
auditors = staff(3, "Internal Audit", "", "Internal Auditor", 2, [head_ia])
head_comp = add("Compliance", "", "Head of Risk & Compliance", 5, cfo)
itgc_lead = add("Compliance", "", "ITGC Lead (you)", 4, head_comp)
comp_an = staff(1, "Compliance", "", "Compliance Analyst", 1, [head_comp])

# ------------------------------------------------------------------ base accounts
# EBS
for pid in (cfo, coo):
    acct("EBS", pid, ["EBS-INQ", "EBS-ACC-APPR"])
acct("EBS", chro, ["EBS-INQ"])
acct("EBS", controller, ["EBS-GL-SUP", "EBS-GL-PERIOD", "EBS-ACC-APPR"])
acct("EBS", gl_sr, ["EBS-GL-SUP"])
for m in gl_mgr:
    acct("EBS", m, ["EBS-GL-SUP"])
acct("EBS", gl_lead, ["EBS-GL-ACC"])
for s in gl_staff:
    acct("EBS", s, ["EBS-GL-ACC"])
acct("EBS", ap_mgr, ["EBS-AP-APPR", "EBS-INQ"])
acct("EBS", ap_lead, ["EBS-AP-APPR"])
for s in ap_entry:
    acct("EBS", s, ["EBS-AP-ENTRY"])
for s in ap_pay:
    acct("EBS", s, ["EBS-AP-PAY"])
for s in ap_appr:
    acct("EBS", s, ["EBS-AP-APPR"])
acct("EBS", ar_mgr, ["EBS-INQ", "EBS-ACC-APPR"])
for i, s in enumerate(ar_staff):
    acct("EBS", s, ["EBS-AR-CASH"] if i < 7 else ["EBS-AR-CM"])
acct("EBS", fac_mgr, ["EBS-INQ"])
for i, s in enumerate(fac_staff):
    acct("EBS", s, ["EBS-FA"] if i < 5 else ["EBS-INQ"])
for pid in [tax_mgr, fpa_mgr] + tax_staff + fpa_staff:
    acct("EBS", pid, ["EBS-INQ"])
for pid in fin_sys:
    acct("EBS", pid, ["EBS-INQ"])
for pid in [treasurer] + tr_mgr + tr_pay + tr_cash + tr_deal + tr_conf:
    acct("EBS", pid, ["EBS-INQ"])
acct("EBS", head_proc, ["EBS-INQ", "EBS-ACC-APPR"])
for m in proc_mgr:
    acct("EBS", m, ["EBS-PO-APPR"])
for pid in buy_lead + buyers:
    acct("EBS", pid, ["EBS-PO-BUY"])
for pid in sup_mstr:
    acct("EBS", pid, ["EBS-SUP-MSTR"])
acct("EBS", head_sales, ["EBS-INQ", "EBS-ACC-APPR"])
for pid in reg_mgr:
    acct("EBS", pid, ["EBS-INQ"])
for pid in od_lead + sales_staff:
    acct("EBS", pid, ["EBS-OM"])
for pid in hr_mgr:
    acct("EBS", pid, ["EBS-INQ", "EBS-ACC-APPR"])
for pid in hr_staff:
    acct("EBS", pid, ["EBS-INQ"])
acct("EBS", ent_apps, ["EBS-SYSADMIN"])
for pid in sysadmins:
    acct("EBS", pid, ["EBS-SYSADMIN"])
for i, pid in enumerate(it_apps):
    acct("EBS", pid, ["EBS-USR-ADM"] if i < 2 else ["EBS-INQ"])
for pid in [head_ia] + auditors + [head_comp, itgc_lead] + comp_an:
    acct("EBS", pid, ["EBS-INQ"])

# Blackline
acct("BL", controller, ["BL-REV"])
acct("BL", cfo, ["BL-AUDIT"])
acct("BL", gl_sr, ["BL-REV"])
for m in gl_mgr:
    acct("BL", m, ["BL-REV"])
acct("BL", gl_lead, ["BL-PREP"])
for s in gl_staff:
    acct("BL", s, ["BL-PREP"])
acct("BL", ap_mgr, ["BL-REV"])
acct("BL", ap_lead, ["BL-PREP"])
for i, s in enumerate(ap_entry):
    acct("BL", s, ["BL-TXN"] if i < 6 else ["BL-PREP"])
acct("BL", ar_mgr, ["BL-REV"])
for i, s in enumerate(ar_staff[:8]):
    acct("BL", s, ["BL-TXN"] if i < 6 else ["BL-PREP"])
acct("BL", fac_mgr, ["BL-REV"])
for s in fac_staff[:4]:
    acct("BL", s, ["BL-PREP"])
for s in tax_staff:
    acct("BL", s, ["BL-PREP"])
for pid in fin_sys:
    acct("BL", pid, ["BL-ADMIN"])
for pid in auditors:
    acct("BL", pid, ["BL-AUDIT"])
for pid in [head_comp, itgc_lead]:
    acct("BL", pid, ["BL-AUDIT"])
acct("BL", it_apps[2], ["BL-ADMIN"])

# Kyriba
acct("KY", treasurer, ["KY-PAY-APPR"])
acct("KY", tr_mgr[0], ["KY-PAY-APPR"])
acct("KY", tr_mgr[1], ["KY-BANK"])
for s in tr_pay:
    acct("KY", s, ["KY-PAY-INIT"])
for s in tr_cash:
    acct("KY", s, ["KY-CASH"])
acct("KY", tr_deal[0], ["KY-DEAL"])
acct("KY", tr_conf[0], ["KY-DEAL-CONF"])
acct("KY", cfo, ["KY-PAY-APPR"])
acct("KY", controller, ["KY-INQ"])
acct("KY", fpa_mgr, ["KY-CASH"])
acct("KY", fpa_staff[0], ["KY-CASH"])
acct("KY", it_apps[3], ["KY-ADMIN"])
acct("KY", it_apps[4], ["KY-ADMIN"])
for a_ in auditors[:2]:
    acct("KY", a_, ["KY-INQ"])
acct("KY", itgc_lead, ["KY-INQ"])
acct("KY", ap_mgr, ["KY-INQ"])

# GitHub
acct("GH", dir_eng, ["GH-READ"])
for m in eng_mgr:
    acct("GH", m, ["GH-MAINT"])
for m in eng_lead:
    acct("GH", m, ["GH-MAINT"])
for s in eng_dev:
    acct("GH", s, ["GH-DEV"])
for s in eng_qa:
    acct("GH", s, ["GH-READ"])
for s in eng_con:
    acct("GH", s, ["GH-DEV"])
acct("GH", head_ops, ["GH-ORG-OWNER"])
acct("GH", devops_mgr, ["GH-ORG-OWNER"])
acct("GH", devops_lead, ["GH-ORG-OWNER"])
for s in rel_mgr:
    acct("GH", s, ["GH-READ", "GH-DEPLOY"])
acct("GH", devops_eng, ["GH-DEV"])

# Service / generic accounts (owner = a named person)
acct("EBS", None, ["EBS-INQ"], kind="Service", owner=ent_apps, user="INTF_BANK_STMT")
acct("EBS", None, ["EBS-MFG"], kind="Service", owner=sysadmins[1], user="BATCH_SCHED")
acct("EBS", None, ["EBS-OM"], kind="Service", owner=it_apps[0], user="INTF_ORDERS_WEB")
acct("EBS", None, ["EBS-SYSADMIN"], kind="Generic", owner=ent_apps, user="SYSADMIN")
acct("EBS", None, ["EBS-GL-ACC"], kind="Generic", owner=gl_mgr[0], user="FIN_MONTHEND_TEMP")
acct("BL", None, ["BL-PREP"], kind="Generic", owner=gl_mgr[1], user="recon_shared@kaizenmotors.example")
acct("BL", None, ["BL-TXN"], kind="Service", owner=ent_apps, user="svc_erp_feed@kaizenmotors.example")
acct("KY", None, ["KY-INQ"], kind="Service", owner=ent_apps, user="svc_swift_conn@kaizenmotors.example")
acct("GH", None, ["GH-SVC"], kind="Service", owner=devops_lead, user="svc-ci-runner")
acct("GH", None, ["GH-SVC"], kind="Service", owner=rel_mgr[0], user="svc-release-bot")
acct("GH", None, ["GH-SVC"], kind="Service", owner=eng_mgr[0], user="svc-dependency-bot")
acct("GH", None, ["GH-SVC"], kind="Service", owner=devops_mgr, user="svc-legacy-deploy")

# ------------------------------------------------------------------ planted identity-level issues
taken = set()


def take(pid):
    assert pid not in taken, pid
    taken.add(pid)
    return pid


# --- Journal / period SoD
take(gl_staff[0]); setroles(gl_staff[0], "EBS", ["EBS-GL-SUPER"])                 # R01 super user
take(gl_sr); give(gl_sr, "EBS", ["EBS-GL-ACC"])                                   # R01 + R12 (has BL-REV)
take(gl_staff[1]); give(gl_staff[1], "EBS", ["EBS-GL-SUP"])                       # R01 promotion creep
by_id[gl_staff[1]]["title"] = "Assistant Manager - GL"; by_id[gl_staff[1]]["level"] = 2
by_id[gl_staff[1]]["promotedOn"] = "2026-05-18"
take(gl_lead); give(gl_lead, "EBS", ["EBS-GL-PERIOD"]); give(gl_lead, "BL", ["BL-REV"])  # R07 + R12
take(gl_staff[2]); give(gl_staff[2], "EBS", ["EBS-GL-PERIOD"])                    # R07
# --- Supplier / payments
take(sup_mstr[0]); give(sup_mstr[0], "EBS", ["EBS-AP-PAY"])                       # R02 (+ mismatch)
take(sup_mstr[1])                                                                  # R02 via transfer
p = by_id[sup_mstr[1]]; p.update(dept="Finance", team="Accounts Payable", title="Senior AP Executive - Payments",
                                 prevDept="Procurement", transferDate="2026-04-06", managerId=ap_mgr)
give(sup_mstr[1], "EBS", ["EBS-AP-PAY"])
# --- PO
take(buyers[0]); setroles(buyers[0], "EBS", ["EBS-PO-SUPER"])                     # R06 super user
take(buyers[1]); give(buyers[1], "EBS", ["EBS-PO-APPR"])                          # R06
take(buy_lead[1]); give(buy_lead[1], "EBS", ["EBS-PO-APPR"])                      # R06 promotion creep
by_id[buy_lead[1]]["title"] = "Assistant Manager - Procurement"; by_id[buy_lead[1]]["promotedOn"] = "2026-03-02"
# --- Access administration
take(it_apps[0]); give(it_apps[0], "EBS", ["EBS-ACC-APPR"])                       # R03 (+ mismatch)
take(sysadmins[0]); give(sysadmins[0], "EBS", ["EBS-AP-PAY"])                     # R13 (+ mismatch)
take(fin_sys[0]); give(fin_sys[0], "EBS", ["EBS-USR-ADM"])                        # privileged access outside IT
# --- Blackline
take(gl_staff[4]); setroles(gl_staff[4], "BL", ["BL-PREP-REV"])                   # R08
take(ar_staff[0]); setroles(ar_staff[0], "BL", ["BL-PREP-REV"])                   # R08
take(fac_mgr); give(fac_mgr, "BL", ["BL-PREP"])                                   # R08 (manager prepares own recs)
# --- Kyriba
take(tr_pay[0]); setroles(tr_pay[0], "KY", ["KY-PAY-ALL"])                        # R09
take(tr_mgr[1]); give(tr_mgr[1], "KY", ["KY-PAY-APPR"])                           # R10
take(tr_deal[0]); give(tr_deal[0], "KY", ["KY-DEAL-CONF"])                        # R14
take(ap_pay[0]); give(ap_pay[0], "KY", ["KY-PAY-APPR"])                           # R11 (+ mismatch)
take(tr_mgr[0]); give(tr_mgr[0], "EBS", ["EBS-AP-PAY"])                           # R11
# --- Movers (old-department access retained)
take(ap_entry[0])                                                                  # Finance AP -> Procurement buyer
p = by_id[ap_entry[0]]; p.update(dept="Procurement", team="", title="Buyer", prevDept="Finance",
                                 transferDate="2026-05-11", managerId=proc_mgr[2])
give(ap_entry[0], "EBS", ["EBS-PO-BUY"])
take(gl_staff[3])                                                                  # Finance GL -> Treasury analyst
p = by_id[gl_staff[3]]; p.update(dept="Treasury", team="", title="Treasury Analyst - Cash", prevDept="Finance",
                                 transferDate="2026-06-15", managerId=tr_mgr[0])
give(gl_staff[3], "KY", ["KY-CASH"])

# --- GitHub
dev_pool = list(eng_dev)
rng.shuffle(dev_pool)
for pid in dev_pool[:8]:                                                           # R04
    take(pid); give(pid, "GH", ["GH-PROD-DB"])
for pid in dev_pool[8:11]:                                                         # R05 devs
    take(pid); give(pid, "GH", ["GH-DEPLOY"])
for pid in eng_lead[:2]:                                                           # R05 leads
    take(pid); give(pid, "GH", ["GH-DEPLOY"])
for pid in (eng_lead[2], eng_lead[3], eng_mgr[4]):                                 # repo admins
    take(pid); setroles(pid, "GH", ["GH-REPO-ADMIN"])

# ------------------------------------------------------------------ top-ups
def count(sysid, kind=None):
    return len([a for a in accts if a["sys"] == sysid and (kind is None or a["type"] == kind)])


# Kyriba: fill named accounts to 24 with read-only finance users
pool = [tax_mgr, gl_mgr[0], gl_mgr[1], ar_mgr, fac_mgr, head_comp, comp_an[0], auditors[2]]
for pid in pool:
    if count("KY") >= TARGET["KY"]:
        break
    if acct_of(pid, "KY") is None:
        acct("KY", pid, ["KY-INQ"])

# Blackline: plant-finance preparers
n_plant = TARGET["BL"] - count("BL")
assert n_plant > 0, n_plant
plant_fin = []
for i in range(n_plant):
    m = rng.choice(gl_mgr + [fac_mgr])
    pid = add("Finance", "Plant Finance", "Plant Accountant", 1, m,
              loc=rng.choice(["Pune Plant", "Chennai Plant", "Manesar Plant", "Aurangabad Plant"]))
    plant_fin.append(pid)
    acct("EBS", pid, ["EBS-GL-ACC"])
    acct("BL", pid, ["BL-PREP"])

# Oracle EBS: plant / supply-chain population fills the rest
head_sc = add("Supply Chain & Mfg", "", "Head of Supply Chain & Manufacturing", 5, coo)
acct("EBS", head_sc, ["EBS-INQ", "EBS-ACC-APPR"])
plants = ["Pune Plant", "Chennai Plant", "Manesar Plant", "Aurangabad Plant"]
plant_mgr, sc_sup, sc_lead = [], [], []
for pl in plants:
    pm = add("Supply Chain & Mfg", "Plant Operations", "Plant Manager", 4, head_sc, loc=pl)
    plant_mgr.append(pm)
    acct("EBS", pm, ["EBS-INQ"])
    for _ in range(3):
        s = add("Supply Chain & Mfg", "Plant Operations", "Shift / Warehouse Supervisor", 3, pm, loc=pl)
        sc_sup.append(s)
        acct("EBS", s, ["EBS-INV-ADJ"])
        l = add("Supply Chain & Mfg", "Plant Operations", "Line / Stores Lead", 2, s, loc=pl)
        sc_lead.append(l)
        acct("EBS", l, ["EBS-MFG"])
acct("EBS", None, ["EBS-RCV"], kind="Generic", owner=sc_sup[0], user="WH_SHARED_PUNE")
n_sc = TARGET["EBS"] - count("EBS")
assert n_sc > 0, n_sc
sc_staff = []
for i in range(n_sc):
    lead = rng.choice(sc_lead + sc_sup)
    ptype = "Contractor" if i < 3 else "Employee"
    pl = by_id[lead]["location"]
    role = rng.choice(["EBS-RCV", "EBS-RCV", "EBS-MFG", "EBS-MFG", "EBS-MFG", "EBS-INV-ADJ"])
    title = {"EBS-RCV": "Stores / Receiving Clerk", "EBS-MFG": "Production Operator (ERP)", "EBS-INV-ADJ": "Inventory Controller"}[role]
    if ptype == "Contractor":
        title, role = "Contract Stores Clerk", "EBS-RCV"
    pid = add("Supply Chain & Mfg", "Plant Operations", title, 1, lead, ptype=ptype, loc=pl)
    sc_staff.append(pid)
    acct("EBS", pid, [role])

# ------------------------------------------------------------------ planted population issues
def pick(pool_, n):
    cand = [x for x in pool_ if x not in taken]
    rng.shuffle(cand)
    got = cand[:n]
    assert len(got) == n, (n, len(pool_))
    for g in got:
        taken.add(g)
    return got


def terminate(pid, days_ago, post_login=False):
    p = by_id[pid]
    d = ASOF - timedelta(days=days_ago)
    p["status"] = "Terminated"
    p["termDate"] = iso(d)
    for a in accts:
        if a["person"] == pid:
            if post_login:
                a["lastLogin"] = iso(min(ASOF, d + timedelta(days=rng.randint(2, 12))))
            else:
                a["lastLogin"] = iso(d - timedelta(days=rng.randint(0, 6)))
    return pid


# Leavers (HR terminated, accounts still active)
sc_only = [x for x in sc_staff[3:] if by_id[x]["type"] == "Employee"]
l_sc = pick(sc_only, 3)
for i, pid in enumerate(l_sc):
    terminate(pid, rng.randint(15, 120), post_login=(i == 0))
l_sup = take(sc_sup[4]); terminate(l_sup, 26)                                       # supervisor left, team still points to them
l_sales = pick(sales_staff, 2)
for pid in l_sales:
    terminate(pid, rng.randint(20, 140))
l_gl = take(gl_staff[5]); terminate(l_gl, 47, post_login=True)                    # JE poster left, logged in after leaving
l_ap = take(ap_entry[1]); terminate(l_ap, 63)
l_buy = take(buyers[3]); terminate(l_buy, 38)
l_tr = take(tr_pay[1]); terminate(l_tr, 33)                                       # Kyriba payment initiator left
terminate(devops_mgr, 24)                                                          # org owner left; team still reports to them
taken.add(devops_mgr)
l_dev = pick(eng_dev, 2)
for pid in l_dev:
    terminate(pid, rng.randint(30, 150))
l_qa = pick(eng_qa, 1)
terminate(l_qa[0], 72)

# Contractors past contract end (still active)
con_sc = [x for x in sc_staff if by_id[x]["type"] == "Contractor"]
for i, pid in enumerate(con_sc):
    by_id[pid]["contractEnd"] = iso(ASOF - timedelta(days=35)) if i == 0 else iso(ASOF + timedelta(days=rng.randint(30, 180)))
for i, pid in enumerate(eng_con):
    if pid in taken:
        continue
    by_id[pid]["contractEnd"] = (iso(ASOF - timedelta(days=20)) if i == 0 else iso(ASOF - timedelta(days=75)) if i == 1
                                 else iso(ASOF + timedelta(days=rng.randint(40, 200))))
taken.update(con_sc)
taken.update(eng_con)

# Dormant / never-used accounts
def dormant(pid, sysid, days=None):
    a = acct_of(pid, sysid)
    a["lastLogin"] = iso(ASOF - timedelta(days=days or rng.randint(100, 420)))
    return a


for pid in pick(sc_staff, 6) + pick(sales_staff, 3) + pick(ar_staff[4:] + fac_staff + fpa_staff, 3) + pick(buyers, 2):
    dormant(pid, "EBS")
never = pick(sc_staff + sales_staff, 3)
for pid in never:
    a = acct_of(pid, "EBS")
    a["lastLogin"] = None
    a["created"] = iso(ASOF - timedelta(days=rng.randint(50, 120)))
for pid in pick(plant_fin, 6):
    dormant(pid, "BL")
pf = pick(plant_fin, 1)[0]
a = acct_of(pf, "BL"); a["lastLogin"] = None; a["created"] = iso(ASOF - timedelta(days=64))
kydorm = it_apps[4]; dormant(kydorm, "KY", 211); taken.add(kydorm)                 # secondary Kyriba admin, unused
for pid in pick(eng_dev + eng_qa, 8):
    dormant(pid, "GH")

# Movers found among the plant / sales population
mv1 = pick(sc_staff, 1)[0]                                                          # stores clerk -> plant accountant
p = by_id[mv1]; p.update(dept="Finance", team="Plant Finance", title="Plant Accountant", prevDept="Supply Chain & Mfg",
                         transferDate="2026-07-06", managerId=gl_mgr[1])
give(mv1, "EBS", ["EBS-GL-ACC"])
a = acct_of(mv1, "EBS"); a["roles"] = ["EBS-GL-ACC", "EBS-RCV"]
mv2 = pick(sales_staff, 1)[0]                                                       # order desk -> supply planner
p = by_id[mv2]; p.update(dept="Supply Chain & Mfg", team="Planning", title="Supply Planner", prevDept="Sales",
                         transferDate="2026-06-01", managerId=head_sc)
mv3 = pick(sales_staff, 1)[0]                                                       # order desk -> HR
p = by_id[mv3]; p.update(dept="HR", team="", title="HR Executive", prevDept="Sales", transferDate="2026-03-16", managerId=hr_mgr[0])

# Access without an approved request
for sysid, n in (("EBS", 9), ("BL", 3), ("KY", 1), ("GH", 3)):
    cand = [a for a in accts if a["sys"] == sysid and a["type"] == "Named" and a["person"] not in taken]
    rng.shuffle(cand)
    for a in cand[:n]:
        a["ticket"] = None

# ------------------------------------------------------------------ seeded exception register
def dated(days):
    return iso(ASOF + timedelta(days=days))


exceptions = []


def rev_of(pid):
    cur = by_id[by_id[pid]["managerId"]]
    while cur["level"] < 3 or cur["status"] != "Active":
        cur = by_id[cur["managerId"]]
    return cur["id"]


def exc(key, person, reviewer, approver, approved_days, expiry_days, controls, why, sev, sys_, note=None):
    exceptions.append({
        "id": "EXC-2026-%04d" % (len(exceptions) + 1), "key": key, "personId": person, "sys": sys_,
        "reviewerId": reviewer, "approverId": approver, "approvedOn": dated(approved_days), "expiresOn": dated(expiry_days),
        "controls": controls, "justification": why, "sev": sev, "ticket": ticket(), "concurrence": True, "status": "Approved"})


exc("sod|%s|R04" % dev_pool[0], dev_pool[0], rev_of(dev_pool[0]), cto, -34, 56, ["CC-BREAKGLASS-DB", "CC-DB-QUERY-LOG"],
    "Data-platform engineer needs read access to the finance replica to support quarter-end reconciliation tooling until the reporting layer is delivered.", "Critical", "GH")
exc("sod|%s|R01" % gl_sr, gl_sr, controller, cfo, -30, 60, ["CC-JE-REVIEW", "CC-MANAGER-SPOTCHECK"],
    "Sole senior GL owner during controller's team restructure; Controller reviews every journal she posts.", "Critical", "EBS")
exc("sod|%s|R08" % fac_mgr, fac_mgr, controller, cfo, -20, 70, ["CC-RECON-REPERFORM", "CC-MANAGER-SPOTCHECK"],
    "Manager prepares fixed-asset reconciliations while a preparer is on long leave; Controller re-performs each one.", "Critical", "BL")
exc("dormant|%s" % acct_of(kydorm, "KY")["id"], kydorm, treasurer, cfo, -15, 75, ["CC-LOGIN-ALERT", "CC-ADMIN-LOG-REVIEW"],
    "Backup Kyriba administrator kept for business continuity; every login alerts the Treasurer.", "High", "KY")
exc("sod|%s|R06" % buyers[0], buyers[0], head_proc, head_sc, -25, 65, ["CC-PO-REPORT"],
    "Procurement lead needs to raise and approve urgent plant POs.", "High", "EBS")                     # approver does NOT outrank reviewer
exc("sod|%s|R07" % gl_lead, gl_lead, gl_mgr[0], controller, -110, -21, ["CC-PERIOD-ALERT"],
    "Period re-open rights kept for prior-year audit adjustments.", "High", "EBS")                      # expired, not re-approved
dorm_fin = [a for a in accts if a["sys"] == "EBS" and a["person"] in (ar_staff[4:] + fac_staff + fpa_staff)
            and a["lastLogin"] and (ASOF - date.fromisoformat(a["lastLogin"])).days > 90]
if dorm_fin:
    d = dorm_fin[0]
    exc("dormant|%s" % d["id"], d["person"], rev_of(d["person"]),
        controller, -50, 110, ["CC-SEASONAL-REENABLE"], "Year-end closing user; account is only needed in the annual close window.", "Medium", "EBS")

# ------------------------------------------------------------------ checks
assert count("EBS") == 340 and count("BL") == 80 and count("KY") == 25 and count("GH") == 60, \
    {s: count(s) for s in TARGET}
ids = {p["id"] for p in people}
for p in people:
    seen, cur = set(), p
    while cur["managerId"]:
        assert cur["id"] not in seen, "cycle at " + cur["id"]
        seen.add(cur["id"])
        assert cur["managerId"] in ids, cur["managerId"]
        cur = by_id[cur["managerId"]]
    assert cur["id"] == "KM-9001", (p["id"], cur["id"])
for a in accts:
    for r in a["roles"]:
        assert ROLES[r]["sys"] == a["sys"], (a["id"], r)
    assert (a["person"] is None) == (a["type"] != "Named")
    if a["person"]:
        assert a["person"] in ids
    if a["owner"]:
        assert a["owner"] in ids

# ------------------------------------------------------------------ write
function_owners = {"Finance": controller, "Treasury": treasurer, "Procurement": head_proc, "Supply Chain & Mfg": head_sc,
                   "Sales": head_sales, "IT": head_ops, "Engineering": cto, "HR": chro, "Executive": ceo}
meta = {"generated": "deterministic, seed 15", "asOf": iso(ASOF), "itgcLeadId": itgc_lead, "auditChairId": board, "ceoId": ceo,
        "cfoId": cfo, "cioId": cio, "ctoId": cto, "functionOwners": function_owners,
        "note": "All people, accounts and issues are fictional and generated for this simulation."}

for p in people:
    p.pop("first", None)
    p.pop("last", None)


def dump(o):
    return json.dumps(o, separators=(",", ":"), ensure_ascii=False)


out = ["window.KAI_DATA = {", '"meta": ' + dump(meta) + ",", '"people": [']
out += [dump(p) + ("," if i < len(people) - 1 else "") for i, p in enumerate(people)]
out += ["],", '"accounts": [']
out += [dump(a) + ("," if i < len(accts) - 1 else "") for i, a in enumerate(accts)]
out += ["],", '"exceptions": [']
out += [dump(e) + ("," if i < len(exceptions) - 1 else "") for i, e in enumerate(exceptions)]
out += ["]", "};", ""]
path = os.path.join(ROOT, "data", "people.js")
with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(out))
print("wrote", path)
print("people:", len(people), "accounts:", len(accts), {s: count(s) for s in TARGET}, "exceptions:", len(exceptions))
