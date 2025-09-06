# EcoFinds Backend – Flask + PostgreSQL Skeleton
# ------------------------------------------------------------
# • Minimal dependencies: Flask, psycopg2-binary, passlib[bcrypt], python-dotenv.
# • Provides secure JWT auth, product CRUD, cart, orders.
# • Connects to PostgreSQL. For MySQL, swap psycopg2 with mysql-connector-python.
# • Suitable for hackathon MVP.
# ------------------------------------------------------------

from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2, os, jwt, datetime
from passlib.hash import bcrypt
from functools import wraps
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ecofinds")
JWT_SECRET = os.getenv("JWT_SECRET", "supersecret")

app = Flask(__name__)
CORS(app)

# ---------------- DB HELPER ----------------
def get_db():
    return psycopg2.connect(DB_URL)

# ---------------- AUTH DECORATOR ----------------
def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing token"}), 401
        token = auth.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            request.user_id = payload["uid"]
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return wrapper

# ---------------- AUTH ROUTES ----------------
@app.post("/api/auth/signup")
def signup():
    data = request.json
    if not data.get("email") or not data.get("password"):
        return {"error": "Email and password required"}, 400
    hashed = bcrypt.hash(data["password"])
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO users (email, username, password_hash) VALUES (%s,%s,%s) RETURNING id", (data["email"], data.get("username"), hashed))
                uid = cur.fetchone()[0]
        return {"message": "User created", "id": uid}
    except psycopg2.Error as e:
        return {"error": str(e)}, 400

@app.post("/api/auth/login")
def login():
    data = request.json
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, password_hash, username FROM users WHERE email=%s", (data["email"],))
            row = cur.fetchone()
            if not row or not bcrypt.verify(data["password"], row[1]):
                return {"error": "Invalid credentials"}, 401
            token = jwt.encode({"uid": row[0], "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8)}, JWT_SECRET, algorithm="HS256")
            return {"token": token, "user": {"id": row[0], "email": data["email"], "username": row[2]}}

# ---------------- USER PROFILE ----------------
@app.get("/api/users/me")
@require_auth
def me():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, username FROM users WHERE id=%s", (request.user_id,))
            row = cur.fetchone()
            return {"id": row[0], "email": row[1], "username": row[2]}

@app.put("/api/users/me")
@require_auth
def update_me():
    data = request.json
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET username=%s, email=%s WHERE id=%s RETURNING id, email, username", (data["username"], data["email"], request.user_id))
            row = cur.fetchone()
            return {"user": {"id": row[0], "email": row[1], "username": row[2]}}

# ---------------- PRODUCTS CRUD ----------------
@app.get("/api/products")
@require_auth
def list_products():
    q = request.args.get("q", "").lower()
    cat = request.args.get("category", "All")
    with get_db() as conn:
        with conn.cursor() as cur:
            sql = "SELECT id,title,description,category,price,image_url,owner_id FROM products WHERE 1=1"
            params = []
            if q:
                sql += " AND LOWER(title) LIKE %s"
                params.append(f"%{q}%")
            if cat != "All":
                sql += " AND category=%s"
                params.append(cat)
            cur.execute(sql, params)
            rows = cur.fetchall()
            return {"items": [dict(id=r[0], title=r[1], description=r[2], category=r[3], price=str(r[4]), image_url=r[5], owner_id=r[6]) for r in rows]}

@app.post("/api/products")
@require_auth
def create_product():
    data = request.json
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO products (title,description,category,price,image_url,owner_id) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id", (data["title"], data.get("description"), data["category"], data["price"], data.get("image_url"), request.user_id))
            pid = cur.fetchone()[0]
            return {"id": pid}

@app.put("/api/products/<int:pid>")
@require_auth
def update_product(pid):
    data = request.json
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE products SET title=%s,description=%s,category=%s,price=%s,image_url=%s WHERE id=%s AND owner_id=%s RETURNING id", (data["title"], data.get("description"), data["category"], data["price"], data.get("image_url"), pid, request.user_id))
            if cur.rowcount == 0:
                return {"error": "Not found"}, 404
            return {"message": "Updated"}

@app.delete("/api/products/<int:pid>")
@require_auth
def delete_product(pid):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM products WHERE id=%s AND owner_id=%s", (pid, request.user_id))
            return {"message": "Deleted"}

@app.get("/api/my/listings")
@require_auth
def my_listings():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id,title,price,category,image_url FROM products WHERE owner_id=%s", (request.user_id,))
            rows = cur.fetchall()
            return {"items": [dict(id=r[0], title=r[1], price=str(r[2]), category=r[3], image_url=r[4]) for r in rows]}

# ---------------- CART + ORDERS ----------------
@app.get("/api/cart")
@require_auth
def get_cart():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT c.id,p.title,p.price,p.image_url FROM cart_items c JOIN products p ON c.product_id=p.id WHERE c.user_id=%s", (request.user_id,))
            rows = cur.fetchall()
            return {"items": [dict(id=r[0], title=r[1], price=str(r[2]), image_url=r[3]) for r in rows]}

@app.post("/api/cart")
@require_auth
def add_cart():
    data = request.json
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cart_items (user_id,product_id,quantity) VALUES (%s,%s,%s)", (request.user_id, data["product_id"], data.get("quantity", 1)))
            return {"message": "Added"}

@app.delete("/api/cart/<int:item_id>")
@require_auth
def remove_cart(item_id):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM cart_items WHERE id=%s AND user_id=%s", (item_id, request.user_id))
            return {"message": "Removed"}

@app.post("/api/checkout")
@require_auth
def checkout():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO orders (user_id, product_id, purchased_at) SELECT user_id, product_id, NOW() FROM cart_items WHERE user_id=%s", (request.user_id,))
            cur.execute("DELETE FROM cart_items WHERE user_id=%s", (request.user_id,))
            return {"message": "Order placed"}

@app.get("/api/orders")
@require_auth
def orders():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT o.id,p.title,p.price,p.image_url,o.purchased_at FROM orders o JOIN products p ON o.product_id=p.id WHERE o.user_id=%s ORDER BY o.purchased_at DESC", (request.user_id,))
            rows = cur.fetchall()
            return {"items": [dict(id=r[0], title=r[1], price=str(r[2]), image_url=r[3], purchased_at=r[4].isoformat()) for r in rows]}

if __name__ == "__main__":
    app.run(debug=True)
