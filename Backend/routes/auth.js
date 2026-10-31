const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { db } = require("../db");
const { issue, clear, requireLogin } = require("../auth");
const { validateSignup } = require("../validators");

const router = express.Router();

// Slows down password guessing: 20 attempts per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in 15 minutes." }
});

// Compared against when an email doesn't exist, so response time doesn't reveal which emails are registered
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const publicUser = u => ({
  id: u.id,
  firstName: u.firstName ?? u.first_name,
  lastName: u.lastName ?? u.last_name,
  email: u.email,
  role: u.role
});

router.post("/signup", limiter, async (req, res) => {
  const { errors, value } = validateSignup(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0], details: errors });

  try {
    if (await db.get("SELECT id FROM users WHERE email = ?", [value.email])) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Could not create your account." });
  }

  try {
    const hash = await bcrypt.hash(value.password, 12);
    // New accounts are ALWAYS regular users. Role is never read from the request.
    const info = await db.run(
      "INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)",
      [value.firstName, value.lastName, value.email, hash]
    );

    const user = { id: Number(info.lastInsertRowid), firstName: value.firstName, lastName: value.lastName, email: value.email, role: "user" };
    issue(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    console.error(e);
    res.status(500).json({ error: "Could not create your account." });
  }
});

router.post("/login", limiter, async (req, res) => {
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!email || !password || password.length > 200) {
    return res.status(400).json({ error: "Please enter your email and password." });
  }

  try {
    const row = await db.get("SELECT * FROM users WHERE email = ?", [email]);
    const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
    if (!row || !ok) return res.status(401).json({ error: "Incorrect email or password." });

    issue(res, row);
    res.json({ user: publicUser(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not log you in." });
  }
});

router.post("/logout", (req, res) => {
  clear(res);
  res.json({ ok: true });
});

router.get("/me", requireLogin, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;