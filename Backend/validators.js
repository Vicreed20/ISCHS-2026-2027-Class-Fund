const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Image: empty, a normal relative path, or an http(s) URL. Blocks things like "javascript:..."
const IMAGE_RE = /^(https?:\/\/[^\s"'<>]+|[\w\-. ()%/]+)$/;

function isRealDate(s) {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function str(value, max, label, errors, required = false) {
  if (value !== undefined && value !== null && typeof value !== "string") {
    errors.push(`${label} must be text.`);
    return "";
  }
  const s = (value || "").trim();
  if (required && !s) errors.push(`${label} is required.`);
  if (s.length > max) errors.push(`${label} must be ${max} characters or fewer.`);
  return s;
}

function num(value, label, errors, { min = 0, max = 1e9 } = {}) {
  const n = Number(value);
  if (value === "" || value === null || value === undefined || !Number.isFinite(n)) {
    errors.push(`${label} must be a number.`);
    return 0;
  }
  if (n < min || n > max) errors.push(`${label} must be between ${min} and ${max}.`);
  return n;
}

function passwordProblems(pw) {
  const p = typeof pw === "string" ? pw : "";
  const problems = [];
  if (p.length < 8 || p.length > 25) problems.push("Password must be 8 to 25 characters.");
  if (!/[A-Z]/.test(p)) problems.push("Password needs an uppercase letter.");
  if (!/[a-z]/.test(p)) problems.push("Password needs a lowercase letter.");
  if (!/[0-9]/.test(p)) problems.push("Password needs a number.");
  if (!/[^A-Za-z0-9]/.test(p)) problems.push("Password needs a special character.");
  return problems;
}

function validateSignup(body) {
  const b = body && typeof body === "object" ? body : {};
  const errors = [];
  const firstName = str(b.firstName, 50, "First name", errors, true);
  const lastName = str(b.lastName, 50, "Last name", errors, true);
  const email = str(b.email, 254, "Email", errors, true).toLowerCase();
  if (email && !EMAIL_RE.test(email)) errors.push("Please enter a valid email address.");
  const password = typeof b.password === "string" ? b.password : "";
  errors.push(...passwordProblems(password));
  return { errors, value: { firstName, lastName, email, password } };
}

// Checks the whole site object and returns a cleaned copy (unknown keys are dropped).
function validateSite(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { errors: ["Invalid data."], value: null };
  }

  // Funds
  const f = input.funds && typeof input.funds === "object" ? input.funds : {};
  const funds = {
    raised: num(f.raised, "Amount raised", errors, { min: 0, max: 1e9 }),
    goal: num(f.goal, "Goal", errors, { min: 1, max: 1e9 }),
    donors: num(f.donors, "Number of donors", errors, { min: 0, max: 1e7 }),
    updated: str(f.updated, 10, "Last updated", errors)
  };
  if (!Number.isInteger(funds.donors)) errors.push("Number of donors must be a whole number.");
  if (funds.updated && !isRealDate(funds.updated)) errors.push("Last updated must be a valid date.");

  // Events
  if (!Array.isArray(input.events)) errors.push("Events must be a list.");
  const rawEvents = Array.isArray(input.events) ? input.events : [];
  if (rawEvents.length > 50) errors.push("You can have at most 50 events.");
  const events = rawEvents.slice(0, 50).map((ev, i) => {
    const n = `Event ${i + 1}`;
    const e = ev && typeof ev === "object" ? ev : {};
    const date = str(e.date, 10, `${n} date`, errors, true);
    if (date && !isRealDate(date)) errors.push(`${n} date must be a valid date.`);
    const image = str(e.image, 300, `${n} image`, errors);
    if (image && !IMAGE_RE.test(image)) errors.push(`${n} image must be a file path or an http(s) link.`);
    return {
      title: str(e.title, 100, `${n} title`, errors, true),
      date,
      time: str(e.time, 40, `${n} time`, errors),
      location: str(e.location, 120, `${n} location`, errors),
      description: str(e.description, 600, `${n} description`, errors),
      emoji: str(e.emoji, 16, `${n} emoji`, errors),
      image
    };
  });

  // Contact
  const c = input.contact && typeof input.contact === "object" ? input.contact : {};
  const contact = {
    email: str(c.email, 254, "Contact email", errors, true),
    phone: str(c.phone, 40, "Contact phone", errors),
    location: str(c.location, 120, "Contact location", errors),
    hours: str(c.hours, 120, "Office hours", errors),
    response: str(c.response, 120, "Response time", errors)
  };
  if (contact.email && !EMAIL_RE.test(contact.email)) errors.push("Contact email is not a valid email address.");

  // FAQ
  if (!Array.isArray(input.faq)) errors.push("FAQ must be a list.");
  const rawFaq = Array.isArray(input.faq) ? input.faq : [];
  if (rawFaq.length > 50) errors.push("You can have at most 50 FAQ questions.");
  const faq = rawFaq.slice(0, 50).map((item, i) => {
    const n = `Question ${i + 1}`;
    const x = item && typeof item === "object" ? item : {};
    return {
      q: str(x.q, 200, `${n}`, errors, true),
      a: str(x.a, 2000, `${n} answer`, errors, true)
    };
  });

  return { errors, value: { funds, events, contact, faq } };
}

module.exports = { EMAIL_RE, passwordProblems, validateSignup, validateSite };