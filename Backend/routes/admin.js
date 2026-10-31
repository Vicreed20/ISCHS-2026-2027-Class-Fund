const express = require("express");
const { db, saveSite, defaultSite, logAction } = require("../db");
const { requireAdmin } = require("../auth");
const { validateSite } = require("../validators");

const router = express.Router();
router.use(requireAdmin);

// Save everything the admin panel edits
router.put("/site", (req, res) => {
  const { errors, value } = validateSite(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0], details: errors });

  saveSite(value);
  logAction(req.user, "update_site",
    `${value.events.length} events, ${value.faq.length} FAQ items, raised $${value.funds.raised} of $${value.funds.goal}`);
  res.json(value);
});

router.post("/site/reset", (req, res) => {
  const fresh = defaultSite();
  saveSite(fresh);
  logAction(req.user, "reset_site", "Restored default site data");
  res.json(fresh);
});

// Who changed what, and when (latest 100)
router.get("/audit", (req, res) => {
  const entries = db.prepare(
    "SELECT id, user_email AS userEmail, action, detail, created_at AS createdAt FROM audit_log ORDER BY id DESC LIMIT 100"
  ).all();
  res.json({ entries });
});

// User management
router.get("/users", (req, res) => {
  const users = db.prepare(
    "SELECT id, first_name AS firstName, last_name AS lastName, email, role, created_at AS createdAt FROM users ORDER BY id"
  ).all();
  res.json({ users });
});

router.patch("/users/:id/role", (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const role = req.body && req.body.role;
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid user id." });
  if (role !== "user" && role !== "admin") return res.status(400).json({ error: "Role must be 'user' or 'admin'." });
  if (id === req.user.id) return res.status(400).json({ error: "You can't change your own role." });

  const target = db.prepare("SELECT id, email FROM users WHERE id = ?").get(id);
  if (!target) return res.status(404).json({ error: "User not found." });

  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  logAction(req.user, "change_role", `${target.email} is now ${role}`);
  res.json({ ok: true });
});

router.delete("/users/:id", (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid user id." });
  if (id === req.user.id) return res.status(400).json({ error: "You can't delete your own account." });

  const target = db.prepare("SELECT id, email FROM users WHERE id = ?").get(id);
  if (!target) return res.status(404).json({ error: "User not found." });

  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  logAction(req.user, "delete_user", target.email);
  res.json({ ok: true });
});

module.exports = router;