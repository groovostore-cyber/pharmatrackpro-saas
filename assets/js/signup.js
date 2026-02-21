function showError(message) {
  const msg = document.getElementById("signupMsg");
  msg.className = "danger";
  msg.textContent = message;
}

function showSuccess(message) {
  const msg = document.getElementById("signupMsg");
  msg.className = "success";
  msg.textContent = message;
}

document.getElementById("signupForm")?.addEventListener("submit", async function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirm = document.getElementById("confirmPassword").value.trim();

  if (!username || !password || !confirm) {
    showError("All fields required");
    return;
  }

  if (password !== confirm) {
    showError("Passwords do not match");
    return;
  }

  try {
    await API.post("/api/auth/signup", { username, password });
    showSuccess("Account created successfully");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 500);
  } catch (error) {
    console.error(error);
    showError(error.message || "Signup failed");
  }
});
