require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32 ||
  process.env.JWT_SECRET.startsWith("paste-")
) {
  console.error("Set a real JWT_SECRET in .env (at least 32 random characters).");
  process.exit(1);
}

const { loadUser } = require("./auth");
const { db, ready, logAction } = require("./db");

// Free hosting has no shell, so the admin account is created from environment
// variables every time the server starts (if it doesn't exist yet).
async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) return;
  const bcrypt = require("bcryptjs");
  const existing = await db.get("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) {
    await db.run("UPDATE users SET role = 'admin' WHERE id = ?", [existing.id]);
    return;
  }
  await db.run(
    "INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')",
    [process.env.ADMIN_FIRST_NAME || "Admin", process.env.ADMIN_LAST_NAME || "User", email, bcrypt.hashSync(password, 12)]
  );
  await logAction(null, "seed_admin", email);
  console.log("Admin account created for " + email);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, "..", "docs");
const isProd = process.env.NODE_ENV === "production";

// Needed when deployed behind a host's HTTPS proxy so cookies and rate limits work
if (isProd) app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: null
    }
  }
}));

app.use(express.json({ limit: "300kb" }));
app.use(cookieParser());

// API responses should never be cached
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/site", require("./routes/site"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

// Only admins can even load the admin page (this route must come before express.static)
app.get("/admin.html", async (req, res) => {
  const user = await loadUser(req);
  if (!user || user.role !== "admin") return res.redirect("/login.html");
  res.sendFile(path.join(PUBLIC, "admin.html"));
});

app.use(express.static(PUBLIC));
app.get("/", (req, res) => res.sendFile(path.join(PUBLIC, "index.html")));

// Error handler
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON." });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "That request is too large." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

ready
  .then(seedAdmin)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("Could not start (check your database settings):", err);
    process.exit(1);
  });