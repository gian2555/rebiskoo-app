"""ReceiptSafe server.

- Serves the web app (static/).
- /api/config      -> public Supabase URL + anon key for the browser.
- /api/admin/export.csv -> CSV report for admins. Uses the service-role key, which stays on this server.
"""
import csv
import io
import os
from datetime import datetime

import requests
from dotenv import load_dotenv
from flask import Flask, Response, abort, jsonify, request, send_from_directory

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

app = Flask(__name__, static_folder="static", static_url_path="")
SERVICE_HEADERS = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/config")
def config():
    # The anon key is meant to be public. Row Level Security protects the data.
    resp = jsonify(url=SUPABASE_URL, anonKey=ANON_KEY)
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
        "select": "*,profiles(student_id,full_name)",
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=os.environ.get("FLASK_DEBUG") == "1")
