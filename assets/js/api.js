const API = {
  getToken() {
    return localStorage.getItem("ptp_token") || "";
  },

  setToken(token) {
    if (token) localStorage.setItem("ptp_token", token);
  },

  clearToken() {
    localStorage.removeItem("ptp_token");
  },

  async request(url, options = {}) {
    const token = this.getToken();
    const headers = Object.assign({}, options.headers || {});
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err) {
      throw new Error(err.message || 'Network error');
    }

    // If unauthorized, clear stored token and redirect to login
    if (res.status === 401) {
      this.clearToken();
      try {
        // safe redirect to login page
        window.location.href = '/login.html';
      } catch (e) {
        console.warn('redirect failed', e);
      }
      throw new Error('Unauthorized - redirected to login');
    }

    const json = await res.json().catch(() => ({ success: false, message: "Invalid response" }));
    if (!res.ok) {
      const message = json && json.message ? json.message : 'Request failed';
      throw new Error(message);
    }

    // Some endpoints use { success:false } convention
    if (json && typeof json.success !== 'undefined' && !json.success) {
      // treat missing shop id as unauthorized to enforce new token regeneration
      if (res.status === 401 || (json.message && /shop id not found/i.test(String(json.message)))) {
        this.clearToken();
        window.location.href = '/login.html';
        throw new Error('Unauthorized - redirected to login');
      }
      throw new Error(json.message || 'Request failed');
    }

    return json.data;
  },

  get(url) {
    return this.request(url);
  },

  post(url, body) {
    return this.request(url, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  },

  put(url, body) {
    return this.request(url, {
      method: "PUT",
      body: JSON.stringify(body || {}),
    });
  },
};
