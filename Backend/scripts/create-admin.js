const readline = require("readline/promises");
const bcrypt = require("bcryptjs");
const { db, logAction } = require("../db");
const { EMAIL_RE, passwordProblems } = require("../validators");

(async () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const email = (await rl.question("Admin email: ")).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error("That is not a valid email address.");

    // If they already signed up on the site, just promote them
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
      logAction(null, "promote_admin", email);
      console.log(`${email} already had an account and is now an admin.`);
      return;
    }

    const first = (await rl.question("First name: ")).trim();
    const last = (await rl.question("Last name: ")).trim();
    if (!first || !last) throw new Error("First and last name are required.");

    const password = await rl.question("Password (8-25 chars, upper, lower, number, special): ");
    const problems = passwordProblems(password);
    if (problems.length) throw new Error(problems.join(" "));

    const hash = await bcrypt.hash(password, 12);
    db.prepare(
      "INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')"
    ).run(first, last, email, hash);
    logAction(null, "create_admin", email);
    console.log(`Admin account created for ${email}.`);
  } catch (e) {
    console.error("Error:", e.message);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
})();
