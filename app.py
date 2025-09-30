import os, json
from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from dotenv import load_dotenv
from webdav_client import NextcloudWebDAV
from pathlib import Path


# Load env explicitly
load_dotenv(dotenv_path='.env', override=True)

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.environ.get("APP_SECRET_KEY", "clothshop-mini-dev")

# Nextcloud config
WEBDAV_BASE = os.environ["NEXTCLOUD_WEBDAV_BASE"]
NC_USER     = os.environ["NEXTCLOUD_USERNAME"]
NC_PASS     = os.environ["NEXTCLOUD_APP_PASSWORD"]
nc = NextcloudWebDAV(WEBDAV_BASE, NC_USER, NC_PASS)

# Admin creds
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "admin123")

# Load products
CATALOG_PATH = Path(__file__).resolve().parent / "products.json"
try:
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        PRODUCTS = json.load(f)
    if not isinstance(PRODUCTS, list) or len(PRODUCTS) == 0:
        raise ValueError("Empty or invalid product list")
except Exception as e:
    print(f"[WARN] Couldn't load products.json: {e} -> using fallback catalog.")
    PRODUCTS = [
        {"id": 101, "name": "Cotton T-Shirt", "brand": "UrbanCo", "price": 499, "size": ["S","M","L"], "img": "https://picsum.photos/id/237/480/640"},
        {"id": 102, "name": "Slim Fit Jeans", "brand": "DenimX", "price": 1499, "size": ["30","32","34"], "img": "https://picsum.photos/id/1005/480/640"},
        {"id": 103, "name": "Athleisure Hoodie", "brand": "Move", "price": 1299, "size": ["M","L","XL"], "img": "https://picsum.photos/id/1027/480/640"},
        {"id": 104, "name": "Summer Dress", "brand": "Flora", "price": 899, "size": ["S","M","L"], "img": "https://picsum.photos/id/1011/480/640"}
    ]

# ---- Mock Auth (demo) ----
MOCK_USERS = {"student": "password123", "varsh": "pass@123"}

@app.route("/")
def home():
    if session.get("user"):
        return redirect(url_for("shop"))
    return render_template("login.html")

@app.route("/login", methods=["POST"])
def login():
    username = request.form.get("username","").strip()
    password = request.form.get("password","").strip()
    if MOCK_USERS.get(username) == password:
        session["user"] = username
        return redirect(url_for("shop"))
    return render_template("login.html", error="Invalid credentials")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))

# ---- Pages (user) ----
@app.route("/shop")
def shop():
    if not session.get("user"):
        return redirect(url_for("home"))
    return render_template("index.html", username=session["user"])

@app.route("/orders")
def orders_page():
    if not session.get("user"):
        return redirect(url_for("home"))
    return render_template("orders.html", username=session["user"])

# ---- APIs (user) ----
@app.route("/api/products")
def api_products():
    return jsonify(PRODUCTS)

@app.route("/api/checkout", methods=["POST"])
def api_checkout():
    if not session.get("user"):
        return jsonify({"error": "unauthorized"}), 401

    data    = request.get_json(force=True)
    items   = data.get("items", [])
    total   = data.get("total", 0)
    address = data.get("address", "")
    payment = data.get("payment", "COD")

    if not items:
        return jsonify({"error": "cart empty"}), 400

    order_id = nc.new_order_id()
    order = {
        "order_id": order_id,
        "user": session["user"],
        "items": items,
        "total": total,
        "address": address,
        "payment": payment,
        "status": "PLACED"
    }

    nc.ensure_folder("orders")
    nc.put_json(f"orders/{order_id}.json", order)

    meta = {
        "order_id": order_id,
        "user": session["user"],
        "total": total,
        "count": sum(i.get("qty",1) for i in items)
    }
    nc.append_order_index(meta)

    return jsonify({"ok": True, "order_id": order_id})

@app.route("/api/orders")
def api_orders():
    if not session.get("user"):
        return jsonify({"error": "unauthorized"}), 401
    nc.ensure_folder("orders")
    rows = nc.get_json("orders/index.json") or []
    rows = [r for r in rows if r.get("user") == session["user"]]
    return jsonify(rows)

# ---- Admin: login / page ----
@app.route("/admin")
def admin_page():
    if not session.get("admin"):
        return render_template("admin_login.html")
    return render_template("admin.html")

@app.route("/admin/login", methods=["POST"])
def admin_login():
    u = request.form.get("username","").strip()
    p = request.form.get("password","").strip()
    if u == ADMIN_USER and p == ADMIN_PASS:
        session["admin"] = True
        return redirect(url_for("admin_page"))
    return render_template("admin_login.html", error="Invalid admin credentials")

@app.route("/admin/logout")
def admin_logout():
    session.pop("admin", None)
    return redirect(url_for("admin_page"))

# ---- Admin APIs ----
@app.route("/api/admin/orders")
def api_admin_orders():
    if not session.get("admin"):
        return jsonify({"error":"unauthorized"}), 401
    nc.ensure_folder("orders")
    rows = nc.get_json("orders/index.json") or []
    return jsonify(rows)

@app.route("/api/admin/order/<oid>")
def api_admin_order_detail(oid):
    if not session.get("admin"):
        return jsonify({"error":"unauthorized"}), 401
    data = nc.get_json(f"orders/{oid}.json")
    if data is None:
        return jsonify({"error":"not found"}), 404
    return jsonify(data)

# health
@app.route("/api/health")
def api_health():
    try:
        nc.ensure_folder("orders")
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    # Use $PORT if set (Render), else FLASK_RUN_PORT (local), default 5000
    port = int(os.environ.get("PORT", os.environ.get("FLASK_RUN_PORT", 5000)))
    app.run(host="0.0.0.0", port=port)
