const jwt = require("jsonwebtoken");
const { db } = require("./db");

const COOKIE = "ischs_token";
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = { httpOnly: true, sameSite: "lax", secure: isProd };

function issue(res, user) {
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie(COOKIE, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function clear(res) {
  res.clearCookie(COOKIE, cookieOptions);
}

// Looks the user up in the database on every request, so deleted users
// and role changes take effect immediately.
async function loadUser(req) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.get(
      "SELECT id, first_name AS firstName, last_name AS lastName, email, role FROM users WHERE id = ?",
      [payload.id]
    );
    return user || null;
  } catch (e) {
    return null;
  }
}

async function requireLogin(req, res, next) {
  const user = await loadUser(req);
  if (!user) return res.status(401).json({ error: "Please log in." });
  req.user = user;
  next();
}

async function requireAdmin(req, res, next) {
  const user = await loadUser(req);
  if (!user) return res.status(401).json({ error: "Please log in." });
  if (user.role !== "admin") return res.status(403).json({ error: "Admins only." });
  req.user = user;
  next();
}

module.exports = { issue, clear, loadUser, requireLogin, requireAdmin };