document.getElementById("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirm = document.getElementById("confirmPassword").value.trim();
  const msg = document.getElementById("signupMsg");
  msg.textContent = "";

  if (!username || !password || !confirm) {
    msg.textContent = "All fields required";
    return;
  }

  if (password !== confirm) {
    msg.textContent = "Passwords do not match";
    return;
  }

  try {
    // 🔥 IMPORTANT FIX HERE
await API.post("/auth/signup", {
  username,
  password,
  confirmPassword: confirm
});
msg.classList.remove("danger");
msg.classList.add("success");
msg.textContent = "Account created successfully";
    setTimeout(() => {
      window.location.href = "/login.html";
    }, 800);

  } catch (error) {
    console.error("Signup error:", error);
    msg.textContent = error.message || "Signup failed";
  }
});