document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const msg = document.getElementById("loginMsg");
  msg.textContent = "";

  if (!username || !password) {
    msg.textContent = "Please enter username and password.";
    return;
  }

  try {
    // 🔥 IMPORTANT: use API wrapper correctly
    const data = await API.post("/auth/login", { username, password });

    if (data) {
      // Save token if backend returns it
      if (data.token) {
        localStorage.setItem("ptp_token", data.token);
      }

      window.location.href = "/dashboard.html";
    }

  } catch (error) {
    console.error("Login error:", error);
    msg.textContent = error.message || "Login failed";
  }
});