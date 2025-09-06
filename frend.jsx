import React, { useEffect, useMemo, useState } from "react";

/**
 * EcoFinds – Frontend (Single‑file React app)
 * -----------------------------------------------------------
 * • Minimal deps: React + Tailwind via CDN in the host page.
 * • Clean, responsive UI and consistent layout.
 * • Robust client‑side validation.
 * • Works with a local backend (Flask/Express + PostgreSQL/MySQL).
 * • Replace API_BASE with your backend origin. Endpoints are documented below.
 * • Token is stored in localStorage and sent in Authorization header.
 * -----------------------------------------------------------
 * Expected backend endpoints (example):
 *  POST   /api/auth/signup      {email, username, password}
 *  POST   /api/auth/login       {email, password} -> {token, user}
 *  GET    /api/users/me         -> {id, email, username}
 *  PUT    /api/users/me         {username, email}
 *  GET    /api/products         ?q=keyword&category="All"&limit=20&offset=0
 *  POST   /api/products         {title, description, category, price, image_url}
 *  GET    /api/products/:id
 *  PUT    /api/products/:id
 *  DELETE /api/products/:id
 *  GET    /api/my/listings
 *  GET    /api/cart
 *  POST   /api/cart             {product_id, quantity}
 *  DELETE /api/cart/:item_id
 *  POST   /api/checkout         -> creates orders
 *  GET    /api/orders           -> previous purchases for current user
 */

// ===================== CONFIG =====================
const API_BASE = "http://localhost:5000"; // change to your backend

// Helper: unified fetch with auth + JSON handling
async function api(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : res.text();
}

// ===================== UTIL & VALIDATION =====================
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignup({ email, username, password }) {
  const errors = {};
  if (!email || !emailRegex.test(email)) errors.email = "Enter a valid email";
  if (!username || username.length < 3)
    errors.username = "Username must be at least 3 characters";
  if (!password || password.length < 6)
    errors.password = "Password must be at least 6 characters";
  return errors;
}

function validateLogin({ email, password }) {
  const errors = {};
  if (!email || !emailRegex.test(email)) errors.email = "Enter a valid email";
  if (!password) errors.password = "Password is required";
  return errors;
}

function validateProduct(p) {
  const errors = {};
  if (!p.title || p.title.trim().length < 3)
    errors.title = "Title must be at least 3 characters";
  if (!p.category) errors.category = "Category is required";
  if (p.price === undefined || p.price === null || isNaN(Number(p.price)) || Number(p.price) <= 0)
    errors.price = "Price must be a positive number";
  if (p.description && p.description.length > 1000)
    errors.description = "Description is too long";
  return errors;
}

// ===================== UI PRIMITIVES =====================
function Label({ htmlFor, children }) {
  return <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{children}</label>;
}

function Input(props) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-800/60 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 " +
        (props.className || "")
      }
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={
        "w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-800/60 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[96px] " +
        (props.className || "")
      }
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={
        "w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-800/60 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 " +
        (props.className || "")
      }
    />
  );
}

function Button({ children, variant = "primary", ...rest }) {
  const styles =
    variant === "ghost"
      ? "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700"
      : variant === "danger"
      ? "bg-rose-600 hover:bg-rose-700 text-white"
      : "bg-emerald-600 hover:bg-emerald-700 text-white";
  return (
    <button
      {...rest}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${styles} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function Card({ children }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/50 shadow-sm p-4">{children}</div>
  );
}

function Page({ title, right }) {
  return (
    <div className="max-w-6xl mx-auto w-full p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">{title}</h1>
        {right}
      </div>
    </div>
  );
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-3">
        <span>{message}</span>
        <button onClick={onClose} className="text-white/75 hover:text-white">✕</button>
      </div>
    </div>
  );
}

// ===================== AUTH & APP SHELL =====================
function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  const saveAuth = (tk, usr) => {
    setToken(tk);
    setUser(usr);
    localStorage.setItem("token", tk);
    localStorage.setItem("user", JSON.stringify(usr));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return { token, user, saveAuth, logout, setUser };
}

function Header({ current, setCurrent, onLogout }) {
  const nav = [
    { key: "feed", label: "Browse" },
    { key: "add", label: "Add Product" },
    { key: "my", label: "My Listings" },
    { key: "cart", label: "Cart" },
    { key: "orders", label: "Purchases" },
    { key: "profile", label: "Profile" },
  ];
  return (
    <div className="sticky top-0 z-40 backdrop-blur bg-white/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white grid place-items-center font-bold">E</div>
          <span className="font-semibold text-slate-800 dark:text-slate-100">EcoFinds</span>
        </div>
        <nav className="hidden sm:flex items-center gap-2">
          {nav.map((n) => (
            <Button
              key={n.key}
              variant={current === n.key ? "primary" : "ghost"}
              onClick={() => setCurrent(n.key)}
            >
              {n.label}
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="danger" onClick={onLogout}>Logout</Button>
        </div>
      </div>
      {/* Mobile nav */}
      <div className="sm:hidden px-4 pb-3 flex gap-2 overflow-x-auto">
        {[
          { key: "feed", label: "Browse" },
          { key: "add", label: "Add" },
          { key: "my", label: "My" },
          { key: "cart", label: "Cart" },
          { key: "orders", label: "Purch." },
          { key: "profile", label: "Profile" },
        ].map((n) => (
          <Button key={n.key} variant={current === n.key ? "primary" : "ghost"} onClick={() => setCurrent(n.key)}>
            {n.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function AuthScreen({ onAuthed, setToast }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const validate = mode === "login" ? validateLogin : validateSignup;
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        await api("/api/auth/signup", { method: "POST", body: form });
        setToast("Signup successful, please login.");
        setMode("login");
      } else {
        const res = await api("/api/auth/login", { method: "POST", body: { email: form.email, password: form.password } });
        onAuthed(res.token, res.user);
      }
    } catch (err) {
      setToast(err.message.replace(/\"/g, '"'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-900 p-4">
      <Card>
        <div className="w-[92vw] max-w-md">
          <h1 className="text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="text-sm text-slate-500 mb-4">Buy & sell pre‑owned goods sustainably.</p>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {errors.email && <p className="text-rose-600 text-sm mt-1">{errors.email}</p>}
            </div>
            {mode === "signup" && (
              <div>
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                {errors.username && <p className="text-rose-600 text-sm mt-1">{errors.username}</p>}
              </div>
            )}
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              {errors.password && <p className="text-rose-600 text-sm mt-1">{errors.password}</p>}
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button type="submit" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Login" : "Sign Up"}</Button>
              <button type="button" className="text-emerald-700 hover:underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
                {mode === "login" ? "Create account" : "Have an account? Login"}
              </button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}

// ===================== FEATURES =====================
const CATEGORIES = ["All", "Electronics", "Fashion", "Home", "Books", "Sports", "Other"];

function ProductCard({ item, onAddToCart, onOpen }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 flex flex-col">
      <div className="aspect-video bg-slate-100 dark:bg-slate-700 grid place-items-center text-slate-400">
        {/* If your backend returns an image_url, display it; else placeholder */}
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="object-cover w-full h-full" />
        ) : (
          <span className="text-sm">No Image</span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{item.title}</div>
        <div className="text-sm text-slate-500 mb-2">{item.category}</div>
        <div className="mt-auto flex items-center justify-between">
          <div className="font-bold">₹{Number(item.price).toFixed(2)}</div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpen(item)}>View</Button>
            <Button onClick={() => onAddToCart(item.id)}>Add</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrowsePage({ token, setToast }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api(`/api/products?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`, { token });
      setData(res.items || res);
    } catch (e) {
      setToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // lightweight real‑time: refresh on interval (can swap to SSE/WebSocket later)
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [token, category]);

  const addToCart = async (product_id) => {
    try {
      await api("/api/cart", { method: "POST", body: { product_id, quantity: 1 }, token });
      setToast("Added to cart");
    } catch (e) {
      setToast(e.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <Label>Search</Label>
            <Input placeholder="Search by title…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          </div>
          <div className="w-full sm:w-56">
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
          <Button onClick={load}>Apply</Button>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))
        ) : data.length ? (
          data.map((item) => (
            <ProductCard key={item.id} item={item} onAddToCart={addToCart} onOpen={setSelected} />
          ))
        ) : (
          <div className="text-slate-500">No products found.</div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-40 bg-black/50 grid place-items-center p-4" onClick={() => setSelected(null)}>
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <Card>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="aspect-video bg-slate-100 dark:bg-slate-700 grid place-items-center">
                  {selected.image_url ? (
                    <img src={selected.image_url} alt={selected.title} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-sm text-slate-400">No Image</span>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">{selected.title}</h3>
                  <div className="text-sm text-slate-500 mb-2">{selected.category}</div>
                  <p className="text-sm mb-3 whitespace-pre-wrap">{selected.description}</p>
                  <div className="font-bold text-lg mb-4">₹{Number(selected.price).toFixed(2)}</div>
                  <div className="flex gap-2">
                    <Button onClick={() => addToCart(selected.id)}>Add to Cart</Button>
                    <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductForm({ token, setToast, initial, onSaved }) {
  const [form, setForm] = useState(
    initial || { title: "", category: "Electronics", price: "", description: "", image_url: "" }
  );
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = validateProduct(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      if (initial) {
        await api(`/api/products/${initial.id}`, { method: "PUT", body: form, token });
        setToast("Listing updated");
      } else {
        await api("/api/products", { method: "POST", body: form, token });
        setToast("Listing created");
        setForm({ title: "", category: "Electronics", price: "", description: "", image_url: "" });
      }
      onSaved?.();
    } catch (e) {
      setToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label htmlFor="title">Product Title</Label>
          <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          {errors.title && <p className="text-rose-600 text-sm mt-1">{errors.title}</p>}
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.filter((c) => c !== "All").map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          {errors.category && <p className="text-rose-600 text-sm mt-1">{errors.category}</p>}
        </div>
        <div>
          <Label htmlFor="price">Price</Label>
          <Input id="price" type="number" min="1" step="0.01" value={form.price}
                 onChange={(e) => setForm({ ...form, price: e.target.value })} />
          {errors.price && <p className="text-rose-600 text-sm mt-1">{errors.price}</p>}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="image_url">Image URL (optional)</Label>
          <Input id="image_url" placeholder="https://…" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="desc">Description</Label>
          <TextArea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {errors.description && <p className="text-rose-600 text-sm mt-1">{errors.description}</p>}
        </div>
        <div className="sm:col-span-2 flex gap-2">
          <Button type="submit" disabled={loading}>{loading ? "Saving…" : initial ? "Update Listing" : "Submit Listing"}</Button>
          {initial && (
            <Button type="button" variant="ghost" onClick={() => onSaved?.(true)}>Cancel</Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function AddPage({ token, setToast }) {
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <h2 className="text-xl font-bold mb-4">Add New Product</h2>
      <ProductForm token={token} setToast={setToast} />
    </div>
  );
}

function MyListings({ token, setToast }) {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = async () => {
    try {
      const res = await api("/api/my/listings", { token });
      setItems(res.items || res);
    } catch (e) {
      setToast(e.message);
    }
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [token]);

  const remove = async (id) => {
    if (!confirm("Delete this listing?")) return;
    try {
      await api(`/api/products/${id}`, { method: "DELETE", token });
      setToast("Deleted");
      load();
    } catch (e) {
      setToast(e.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <h2 className="text-xl font-bold">My Listings</h2>
      {edit ? (
        <ProductForm token={token} setToast={setToast} initial={edit} onSaved={() => { setEdit(null); load(); }} />
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <Card key={it.id}>
            <div className="aspect-video bg-slate-100 dark:bg-slate-700 grid place-items-center rounded-xl overflow-hidden mb-3">
              {it.image_url ? <img src={it.image_url} alt={it.title} className="object-cover w-full h-full" /> : <span className="text-sm text-slate-400">No Image</span>}
            </div>
            <div className="font-semibold">{it.title}</div>
            <div className="text-sm text-slate-500">₹{Number(it.price).toFixed(2)} • {it.category}</div>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => setEdit(it)}>Edit</Button>
              <Button variant="danger" onClick={() => remove(it.id)}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CartPage({ token, setToast }) {
  const [items, setItems] = useState([]);
  const load = async () => {
    try {
      const res = await api("/api/cart", { token });
      setItems(res.items || res);
    } catch (e) {
      setToast(e.message);
    }
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const remove = async (item_id) => {
    try {
      await api(`/api/cart/${item_id}`, { method: "DELETE", token });
      setToast("Removed from cart");
      load();
    } catch (e) {
      setToast(e.message);
    }
  };

  const total = useMemo(() => items.reduce((s, it) => s + Number(it.price) * (it.quantity || 1), 0), [items]);

  const checkout = async () => {
    try {
      await api("/api/checkout", { method: "POST", token });
      setToast("Purchase successful");
      load();
    } catch (e) {
      setToast(e.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <h2 className="text-xl font-bold">Cart</h2>
      {items.length === 0 ? (
        <Card><p className="text-slate-600">Your cart is empty.</p></Card>
      ) : (
        <>
          {items.map((it) => (
            <Card key={it.id}>
              <div className="flex gap-4 items-center">
                <div className="w-24 h-24 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden grid place-items-center">
                  {it.image_url ? <img src={it.image_url} alt={it.title} className="object-cover w-full h-full" /> : <span className="text-sm text-slate-400">No Image</span>}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{it.title}</div>
                  <div className="text-sm text-slate-500">₹{Number(it.price).toFixed(2)}</div>
                </div>
                <Button variant="danger" onClick={() => remove(it.id)}>Remove</Button>
              </div>
            </Card>
          ))}
          <Card>
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Total: ₹{total.toFixed(2)}</div>
              <Button onClick={checkout}>Checkout</Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function OrdersPage({ token, setToast }) {
  const [items, setItems] = useState([]);
  const load = async () => {
    try {
      const res = await api("/api/orders", { token });
      setItems(res.items || res);
    } catch (e) {
      setToast(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-3">
      <h2 className="text-xl font-bold">Previous Purchases</h2>
      {items.length === 0 ? (
        <Card><p className="text-slate-600">No purchases yet.</p></Card>
      ) : (
        items.map((it) => (
          <Card key={it.id}>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden grid place-items-center">
                {it.image_url ? <img src={it.image_url} alt={it.title} className="object-cover w-full h-full" /> : <span className="text-sm text-slate-400">No Image</span>}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{it.title}</div>
                <div className="text-sm text-slate-500">₹{Number(it.price).toFixed(2)}</div>
              </div>
              <div className="text-sm text-slate-500">{new Date(it.purchased_at || Date.now()).toLocaleString()}</div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function ProfilePage({ token, user, setUser, setToast }) {
  const [form, setForm] = useState({ username: user?.username || "", email: user?.email || "" });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm({ username: user?.username || "", email: user?.email || "" });
  }, [user]);

  const save = async () => {
    const errs = {};
    if (!form.username || form.username.length < 3) errs.username = "Username too short";
    if (!form.email || !emailRegex.test(form.email)) errs.email = "Invalid email";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const res = await api("/api/users/me", { method: "PUT", body: form, token });
      setUser(res.user || res);
      localStorage.setItem("user", JSON.stringify(res.user || res));
      setToast("Profile updated");
    } catch (e) {
      setToast(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-3">
      <h2 className="text-xl font-bold">Your Profile</h2>
      <Card>
        <div className="space-y-3">
          <div>
            <Label>Username</Label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            {errors.username && <p className="text-rose-600 text-sm mt-1">{errors.username}</p>}
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {errors.email && <p className="text-rose-600 text-sm mt-1">{errors.email}</p>}
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ===================== ROOT APP =====================
export default function App() {
  const { token, user, saveAuth, logout, setUser } = useAuth();
  const [current, setCurrent] = useState("feed");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (token && !user) {
      api("/api/users/me", { token })
        .then((u) => setUser(u.user || u))
        .catch(() => {});
    }
  }, [token]);

  if (!token) {
    return <AuthScreen onAuthed={saveAuth} setToast={setToast} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header current={current} setCurrent={setCurrent} onLogout={logout} />

      {current === "feed" && <BrowsePage token={token} setToast={setToast} />}
      {current === "add" && <AddPage token={token} setToast={setToast} />}
      {current === "my" && <MyListings token={token} setToast={setToast} />}
      {current === "cart" && <CartPage token={token} setToast={setToast} />}
      {current === "orders" && <OrdersPage token={token} setToast={setToast} />}
      {current === "profile" && (
        <ProfilePage token={token} user={user} setUser={setUser} setToast={setToast} />
      )}

      <Toast message={toast} onClose={() => setToast("")} />

      <footer className="text-center text-xs text-slate-500 py-8">EcoFinds • Built for Odoo Hackathon</footer>
    </div>
  );
}

/**
 * HOW TO RUN (no build tools):
 * ---------------------------------------------
 * 1) Create an index.html with React + Tailwind CDNs:
 *
 * <!doctype html>
 * <html>
 * <head>
 *   <meta charset="utf-8" />
 *   <meta name="viewport" content="width=device-width, initial-scale=1" />
 *   <script src="https://cdn.tailwindcss.com"></script>
 *   <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
 *   <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
 *   <title>EcoFinds</title>
 * </head>
 * <body class="min-h-screen">
 *   <div id="root"></div>
 *   <script type="module">
 *     import App from './App.jsx'; // rename this file to App.jsx
 *     import { createElement } from 'react';
 *     import { createRoot } from 'https://esm.sh/react-dom/client';
 *     const root = createRoot(document.getElementById('root'));
 *     root.render(createElement(App));
 *   </script>
 * </body>
 * </html>
 *
 * 2) Serve this folder with any static server (e.g., `python -m http.server 5173`).
 * 3) Change API_BASE to your backend origin. Ensure CORS is enabled server-side.
 * 4) Profit ✨
 */
