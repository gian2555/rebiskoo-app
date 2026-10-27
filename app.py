"""ReceiptSafe server.

- Serves the web app (public/).
- /api/config      -> public Supabase URL + anon key for the browser.
- /api/admin/export.csv -> CSV report for admins. Uses the service-role key, which stays on this server.
- /api/cron/push -> daily phone alerts (budget, due dates). Called by Vercel Cron, not by the browser.
"""
import csv
import hmac
import io
import json
import os
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv
from flask import Flask, Response, abort, jsonify, request, send_from_directory

load_dotenv()

# Keep only https://<project>.supabase.co, even if extra path or quotes were pasted into the setting.
_u = urlparse(os.environ["SUPABASE_URL"].strip().strip('"').strip("'"))
SUPABASE_URL = f"{_u.scheme}://{_u.netloc}"
ANON_KEY = os.environ["SUPABASE_ANON_KEY"].strip().strip('"').strip("'")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip().strip('"').strip("'")

# Vercel serves the public/ folder itself. Locally, Flask serves it from the same folder.
app = Flask(__name__, static_folder="public", static_url_path="")
SERVICE_HEADERS = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/config")
def config():
    # The anon key is meant to be public. Row Level Security protects the data.
    resp = jsonify(url=SUPABASE_URL, anonKey=ANON_KEY,
                   vapidPublicKey=os.environ.get("VAPID_PUBLIC_KEY", "").strip())
    resp.headers["Cache-Control"] = "no-store"
    return resp


def require_admin():
    """Check the caller's Supabase login token and confirm they are an admin."""
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token:
        abort(401)
    who = requests.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": ANON_KEY, "Authorization": f"Bearer {token}"},
        timeout=10,
    )
    if who.status_code != 200:
        abort(401)
    user_id = who.json()["id"]
    prof = requests.get(
        f"{SUPABASE_URL}/rest/v1/profiles",
        params={"id": f"eq.{user_id}", "select": "role"},
        headers=SERVICE_HEADERS,
        timeout=10,
    )
    rows = prof.json() if prof.ok else []
    if not rows or rows[0].get("role") != "admin":
        abort(403)
    return user_id


def fetch_receipts(status=None, date_from=None, date_to=None):
    params = {
        "select": "*,profiles!receipts_user_id_fkey(student_id,full_name)",
        "order": "paid_on.desc,created_at.desc",
    }
    if status in ("pending", "verified", "rejected"):
        params["status"] = f"eq.{status}"
    filters = []
    if date_from:
        filters.append(("paid_on", f"gte.{date_from}"))
    if date_to:
        filters.append(("paid_on", f"lte.{date_to}"))

    out, start, page = [], 0, 1000
    while True:
        headers = {**SERVICE_HEADERS, "Range": f"{start}-{start + page - 1}"}
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/receipts",
            params=list(params.items()) + filters,
            headers=headers,
            timeout=30,
        )
        r.raise_for_status()
        batch = r.json()
        out.extend(batch)
        if len(batch) < page:
            return out
        start += page


def csv_safe(value):
    """Stop spreadsheet apps from running a cell that starts with = + - or @."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@") else text


@app.get("/api/admin/export.csv")
def export_csv():
    require_admin()
    rows = fetch_receipts(
        request.args.get("status"), request.args.get("from"), request.args.get("to")
    )
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Student ID", "Student name", "Date paid", "Description", "Category",
                "Amount (PHP)", "Receipt no.", "Status", "Review note", "Submitted"])
    total = 0.0
    for r in rows:
        p = r.get("profiles") or {}
        total += float(r["amount"])
        w.writerow([csv_safe(p.get("student_id")), csv_safe(p.get("full_name")), r["paid_on"],
                    csv_safe(r["description"]), csv_safe(r["category"]), f'{float(r["amount"]):.2f}',
                    csv_safe(r.get("receipt_no")), r["status"], csv_safe(r.get("review_note")),
                    r["created_at"][:19].replace("T", " ")])
    w.writerow([])
    w.writerow(["Total", "", "", "", "", f"{total:.2f}"])
    name = f"receipts-{datetime.now():%Y-%m-%d}.csv"
    return Response(
        "﻿" + buf.getvalue(),  # BOM so Excel shows the peso text and names correctly
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{name}"', "Cache-Control": "no-store"},
    )


# ---------------------------------------------------------------- daily phone alerts
PH = timezone(timedelta(hours=8))  # Philippine time
MSG = {
    "en": {
        "over": "{a} over budget this month.",
        "b80": "You have used {p}% of your monthly budget. {a} left.",
        "due": "{n} is due in {d} days. {a} still unpaid.",
        "today": "{n} is due today. {a} still unpaid.",
        "overdue": "{n} was due {d} days ago. {a} still unpaid.",
    },
    "fil": {
        "over": "Lampas ng {a} sa budget ngayong buwan.",
        "b80": "Nagamit mo na ang {p}% ng budget mo kada buwan. {a} ang natitira.",
        "due": "Due na ang {n} sa loob ng {d} araw. {a} ang hindi pa bayad.",
        "today": "Due na ngayon ang {n}. {a} ang hindi pa bayad.",
        "overdue": "Lampas na ng {d} araw ang due ng {n}. {a} ang hindi pa bayad.",
    },
}


def peso(x):
    return f"\u20b1{x:,.2f}"


def rest_all(table, select, user_ids=None, order=None):
    """Read a whole table (or only some users' rows) with the service key, page by page."""
    chunks = [user_ids[i:i + 40] for i in range(0, len(user_ids), 40)] if user_ids is not None else [None]
    out = []
    for ch in chunks:
        offset = 0
        while True:
            params = {"select": select, "limit": 1000, "offset": offset}
            if order:
                params["order"] = order
            if ch is not None:
                params["user_id"] = f"in.({','.join(ch)})"
            r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}", params=params, headers=SERVICE_HEADERS, timeout=30)
            r.raise_for_status()
            rows = r.json()
            out.extend(rows)
            if len(rows) < 1000:
                break
            offset += 1000
    return out


def fee_paid(fees, receipts, links):
    """Same matching as the app: linked receipts first, then by category, oldest payment first."""
    paid = {f["id"]: 0.0 for f in fees}
    free = []
    for r in receipts:
        fid = links.get(r["id"])
        if fid in paid:
            paid[fid] += float(r["amount"])
        else:
            free.append(r)
    free.sort(key=lambda r: str(r["paid_on"]))
    for r in free:
        left = float(r["amount"])
        same = [f for f in fees if f["category"] == r["category"]]
        for f in same:
            take = min(left, max(0.0, float(f["amount"]) - paid[f["id"]]))
            paid[f["id"]] += take
            left -= take
        if left > 0.005 and same:
            paid[same[-1]["id"]] += left
    return paid


def build_alerts(prefs, fees, receipts, links, today):
    m = MSG.get((prefs or {}).get("lang"), MSG["en"])
    out = []
    goal = float((prefs or {}).get("monthly_budget") or 0)
    if goal:
        mk = today.strftime("%Y-%m")
        spent = sum(float(r["amount"]) for r in receipts if str(r["paid_on"]).startswith(mk))
        if spent > goal:
            out.append((f"b{mk}o", m["over"].format(a=peso(spent - goal))))
        elif spent >= goal * 0.8:
            out.append((f"b{mk}", m["b80"].format(p=round(spent / goal * 100), a=peso(goal - spent))))
    paid = fee_paid(fees, receipts, links)
    for f in fees:
        if not f.get("due_on") or f.get("marked_paid"):  # marked paid by hand: no alerts
            continue
        left = max(0.0, float(f["amount"]) - paid[f["id"]])
        if left < 0.005:
            continue
        d = (date.fromisoformat(f["due_on"]) - today).days
        if d < 0:
            out.append((f"f{f['id']}o", m["overdue"].format(n=f["name"], d=-d, a=peso(left))))
        elif d <= 7:
            out.append((f"f{f['id']}{d}", m["today" if d == 0 else "due"].format(n=f["name"], d=d, a=peso(left))))
    return out


@app.get("/api/cron/push")
def cron_push():
    """Once a day: work out each subscribed student's alerts and push them to their phones."""
    secret = os.environ.get("CRON_SECRET", "")
    if not secret or not hmac.compare_digest(request.headers.get("Authorization", ""), f"Bearer {secret}"):
        abort(401)
    vapid_key = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    if not vapid_key:
        return jsonify(error="VAPID_PRIVATE_KEY is not set"), 500
    from pywebpush import WebPushException, webpush  # imported here so the rest of the app never depends on it

    today = datetime.now(PH).date()
    subs = rest_all("push_subscriptions", "*", order="id")
    users = sorted({s["user_id"] for s in subs})
    if not users:
        return jsonify(users=0, sent=0)
    prefs = {p["user_id"]: p for p in rest_all("user_prefs", "*", users, "user_id")}
    fees, receipts, links, logged = {}, {}, {}, {}
    for f in rest_all("fees", "*", users, "user_id,position,id"):
        fees.setdefault(f["user_id"], []).append(f)
    for r in rest_all("receipts", "id,user_id,amount,paid_on,category", users, "id"):
        receipts.setdefault(r["user_id"], []).append(r)
    for l in rest_all("fee_links", "receipt_id,fee_id,user_id", users, "receipt_id"):
        links.setdefault(l["user_id"], {})[l["receipt_id"]] = l["fee_id"]
    r = requests.get(f"{SUPABASE_URL}/rest/v1/push_log", params={"select": "user_id,key", "sent_on": f"eq.{today}", "limit": 10000},
                     headers=SERVICE_HEADERS, timeout=30)
    r.raise_for_status()
    for g in r.json():
        logged.setdefault(g["user_id"], set()).add(g["key"])

    sent, dead, new_log = 0, [], []
    for uid in users:
        alerts = [a for a in build_alerts(prefs.get(uid), fees.get(uid, []), receipts.get(uid, []), links.get(uid, {}), today)
                  if a[0] not in logged.get(uid, set())][:5]
        for key, text in alerts:
            ok = False
            for s in (x for x in subs if x["user_id"] == uid):
                try:
                    webpush(
                        subscription_info={"endpoint": s["endpoint"], "keys": {"p256dh": s["p256dh"], "auth": s["auth"]}},
                        data=json.dumps({"title": "ReceiptSafe", "body": text, "tag": key, "url": "./"}),
                        vapid_private_key=vapid_key,
                        vapid_claims={"sub": os.environ.get("VAPID_SUBJECT", "mailto:admin@example.com")},
                        ttl=86400,
                    )
                    ok = True
                    sent += 1
                except WebPushException as e:
                    if e.response is not None and e.response.status_code in (404, 410):
                        dead.append(s["endpoint"])  # the phone unsubscribed
                except Exception:
                    pass
            if ok:
                new_log.append({"user_id": uid, "key": key, "sent_on": str(today)})
    if new_log:
        requests.post(f"{SUPABASE_URL}/rest/v1/push_log", json=new_log, timeout=30,
                      headers={**SERVICE_HEADERS, "Prefer": "resolution=ignore-duplicates,return=minimal"})
    for ep in set(dead):
        requests.delete(f"{SUPABASE_URL}/rest/v1/push_subscriptions", params={"endpoint": f"eq.{ep}"}, headers=SERVICE_HEADERS, timeout=15)
    return jsonify(users=len(users), sent=sent, removed=len(set(dead)))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=os.environ.get("FLASK_DEBUG") == "1")