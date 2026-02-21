const db = require("./database");
const crypto = require("crypto");

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function login(username, password) {
  try {
    if (!username || !password) {
      throw new Error("Username and password are required");
    }
    const cleanUsername = String(username).trim();
    const rawPassword = String(password);
    const hashedPassword = hashPassword(rawPassword);

    const row = db.queryOne("SELECT id, username, role, password FROM users WHERE username = ?", [cleanUsername]);
    if (!row) {
      throw new Error("Invalid credentials");
    }

    const isValid = row.password === hashedPassword || row.password === rawPassword;
    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    if (row.password === rawPassword) {
      db.execute("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, row.id]);
    }

    const user = { id: row.id, username: row.username, role: row.role };
    if (!user) {
      throw new Error("Invalid credentials");
    }
    return user;
  } catch (error) {
    console.error("authService.login error:", error);
    throw error;
  }
}

function signup(username, password, confirmPassword) {
  try {
    const cleanUsername = String(username || "").trim();
    const pwd = String(password || "").trim();
    const confirm = String(confirmPassword || "").trim();

    if (!cleanUsername || !pwd || !confirm) {
      throw new Error("All fields are required");
    }
    if (pwd !== confirm) {
      throw new Error("Passwords do not match");
    }
    if (pwd.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const existing = db.queryOne("SELECT id FROM users WHERE username = ?", [cleanUsername]);
    if (existing) {
      throw new Error("Username already exists");
    }

    const hashedPassword = hashPassword(pwd);
    const result = db.execute("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [cleanUsername, hashedPassword, "admin"]);
    return db.queryOne("SELECT id, username, role FROM users WHERE id = ?", [result.lastInsertRowid]);
  } catch (error) {
    console.error("authService.signup error:", error);
    throw error;
  }
}

module.exports = {
  login,
  signup,
};
