const API_URL = "http://localhost:4000/api";
const socket = io("http://localhost:4000");


function getToken() {
  return localStorage.getItem("token");
}


function saveToken(token) {
  localStorage.setItem("token", token);
}


async function api(endpoint, method = "GET", body = null, auth = false) {
  const headers = {};
  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (auth && getToken()) {
    headers["Authorization"] = `Bearer ${getToken()}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : null,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "API error");
  }
  return res.json();
}
