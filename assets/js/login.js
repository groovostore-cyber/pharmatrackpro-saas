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
    const data = await API.post("/api/auth/login", { username, password });
    API.setToken(data.token);
    
    // Store email for trial activation (if available)
    if (data.email) {
      localStorage.setItem("userEmail", data.email);
    }

    // Handle subscription status-based redirects
    if (data.subscriptionStatus === "inactive") {
      // Redirect to trial activation page
      window.location.href = "activate-trial.html";
    } else if (data.subscriptionStatus === "expired") {
      // Redirect to payment/upgrade page
      window.location.href = "payment.html";
    } else if (data.subscriptionStatus === "suspended") {
      // Show error and block access
      msg.textContent = "Your account has been suspended. Please contact support.";
    } else {
      // Redirect to dashboard for trial, active, or superadmin users
      window.location.href = "dashboard.html";
    }
  } catch (error) {
    console.error(error);
    msg.textContent = error.message || "Invalid credentials";
  }
});

