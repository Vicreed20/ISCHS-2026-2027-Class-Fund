const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "ischs.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS site_data (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    user_email TEXT,
    action     TEXT NOT NULL,
    detail     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultSite() {
  return {
    funds: { raised: 18500, goal: 25000, donors: 112, updated: todayStr() },
    events: [
      { title: "Homecoming", date: "2026-10-23", time: "7:00 PM", location: "ISCHS Main Gym", description: "Spirit week wraps up with the big game and the dance.", emoji: "👑", image: "" },
      { title: "Senior Picnic", date: "2027-04-09", time: "11:00 AM", location: "Local Park Pavilion", description: "Food, games, and a relaxed afternoon with your class.", emoji: "🧺", image: "" },
      { title: "GradVenture", date: "2027-05-21", time: "6:00 PM", location: "Theme Park Trip", description: "An all-night celebration for graduating seniors.", emoji: "🎢", image: "" }
    ],
    contact: { email: "seniorfunds@ischs-example.org", phone: "(555) 555-0123", location: "ISCHS Main Office", hours: "Mon-Fri, 8:00 AM - 3:30 PM", response: "Within 2 school days" },
    faq: [
      { q: "Who do I email with questions?", a: "Email seniorfunds@ischs-example.org for anything about donations, events, or your account." },
      { q: "Are donations tax-deductible?", a: "We're not sure yet. Please ask the school office for the official answer." },
      { q: "How do refunds work?", a: "Email us with your name, the date, and the amount, and we'll review your request." }
    ]
  };
}

function getSite() {
  const row = db.prepare("SELECT value FROM site_data WHERE key = 'site'").get();
  if (row) {
    try { return JSON.parse(row.value); } catch (e) { /* fall through to defaults */ }
  }
  return defaultSite();
}

function saveSite(site) {
  db.prepare(`
    INSERT INTO site_data (key, value, updated_at) VALUES ('site', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(JSON.stringify(site));
}

function logAction(user, action, detail = "") {
  db.prepare("INSERT INTO audit_log (user_id, user_email, action, detail) VALUES (?, ?, ?, ?)")
    .run(user ? user.id : null, user ? user.email : null, action, detail);
}

module.exports = { db, getSite, saveSite, defaultSite, logAction };