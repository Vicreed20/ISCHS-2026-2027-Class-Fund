const $ = id => document.getElementById(id);
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let data = null;      // filled from the server
let dirty = false;

$("save").disabled = true;   // enabled once data has loaded

/* ---------- Server helper ---------- */
async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  let body = null;
  try { body = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = new Error((body && body.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

/* ---------- Status, toast, save ---------- */
function setDirty(v) {
  dirty = v;
  $("status").textContent = v ? "Unsaved changes" : "All changes saved";
  $("status").className = v ? "dirty" : "";
}

function toast(msg, ms = 2200) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove("show"), ms);
}

function handleAuthError(e) {
  if (e.status === 401 || e.status === 403) { location.href = "/login.html"; return true; }
  return false;
}

async function save() {
  if (!data) return;
  const btn = $("save");
  btn.disabled = true;
  try {
    data = await api("/api/admin/site", { method: "PUT", body: JSON.stringify(data) });
    populate();
    setDirty(false);
    toast("Saved!");
  } catch (e) {
    if (!handleAuthError(e)) toast(e.message, 5000);
  } finally {
    btn.disabled = false;
  }
}

window.addEventListener("beforeunload", e => {
  if (dirty) { e.preventDefault(); e.returnValue = ""; }
});

/* ---------- Tabs ---------- */
document.addEventListener("click", e => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t === tab));
  document.querySelectorAll(".panel").forEach(p => p.hidden = p.id !== "panel-" + tab.dataset.tab);
});

/* ---------- Funds ---------- */
const money = n => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function preview() {
  const { raised, goal } = data.funds;
  const pct = goal > 0 ? Math.min(100, Math.round(raised / goal * 100)) : 0;
  $("pv-bar").style.width = pct + "%";
  $("pv-pct").firstChild.textContent = pct + "%";
  $("pv-left").firstChild.textContent = money(Math.max(0, goal - raised));
}

["raised", "goal" ].forEach(k => {
  $(k).addEventListener("input", e => {
    if (!data) return;
    let v = Math.max(0, Number(e.target.value) || 0);
    data.funds[k] = v;
    setDirty(true);
    preview();
  });
});

$("updated").addEventListener("input", e => {
  if (!data) return;
  data.funds.updated = e.target.value;
  setDirty(true);
});

$("today").addEventListener("click", () => {
  if (!data) return;
  $("updated").value = data.funds.updated = todayStr();
  setDirty(true);
});

/* ---------- Helpers for dynamic forms ---------- */
function field(label, value, onInput, opts = {}) {
  const wrap = document.createElement("label");
  wrap.className = "f" + (opts.wide ? " wide" : "");
  wrap.append(label);
  const input = document.createElement(opts.textarea ? "textarea" : "input");
  if (!opts.textarea) input.type = opts.type || "text";
  input.value = value || "";
  input.addEventListener("input", () => { onInput(input.value); setDirty(true); });
  wrap.append(input);
  return wrap;
}

function delBtn(text, fn) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn btn-del";
  b.textContent = text;
  b.addEventListener("click", fn);
  return b;
}

function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/* ---------- Events ---------- */
function renderEvents() {
  const list = $("events-list");
  list.replaceChildren();

  if (!data.events.length) {
    const e = document.createElement("div");
    e.className = "empty";
    e.textContent = "No events yet. Add your first one below.";
    list.append(e);
  }

  data.events.forEach((ev, i) => {
    const card = document.createElement("div");
    card.className = "item";

    const top = document.createElement("div");
    top.className = "item-top";

    const title = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = ev.title || "Untitled event";
    const badge = document.createElement("span");

    const setBadge = () => {
      const t = new Date();
      const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
      const past = ev.date && today >= parseDate(ev.date);
      badge.className = "badge " + (past ? "past" : "up");
      badge.textContent = past ? "Already Past" : "Upcoming";
    };
    setBadge();
    title.append(strong, badge);

    top.append(title, delBtn("Delete", () => {
      if (confirm(`Delete "${ev.title || "this event"}"?`)) {
        data.events.splice(i, 1);
        setDirty(true);
        renderEvents();
      }
    }));

    const grid = document.createElement("div");
    grid.className = "grid";
    grid.append(
      field("Title", ev.title, v => { ev.title = v; strong.textContent = v || "Untitled event"; }),
      field("Date", ev.date, v => { ev.date = v; setBadge(); }, { type: "date" }),
      field("Time", ev.time, v => ev.time = v),
      field("Location", ev.location, v => ev.location = v),
      field("Emoji", ev.emoji, v => ev.emoji = v),
      field("Image path (optional)", ev.image, v => ev.image = v),
      field("Description", ev.description, v => ev.description = v, { textarea: true, wide: true })
    );

    card.append(top, grid);
    list.append(card);
  });
}

$("add-event").addEventListener("click", () => {
  if (!data) return;
  data.events.push({ title: "New event", date: todayStr(), time: "", location: "", description: "", emoji: "🎉", image: "" });
  setDirty(true);
  renderEvents();
  $("events-list").lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
});

/* ---------- Contact ---------- */
const CONTACT_FIELDS = [["c-email", "email"], ["c-phone", "phone"], ["c-location", "location"], ["c-hours", "hours"], ["c-response", "response"]];

CONTACT_FIELDS.forEach(([id, key]) => {
  $(id).addEventListener("input", e => {
    if (!data) return;
    data.contact[key] = e.target.value;
    setDirty(true);
  });
});

/* ---------- FAQ ---------- */
function renderFaq() {
  const list = $("faq-list");
  list.replaceChildren();

  if (!data.faq.length) {
    const e = document.createElement("div");
    e.className = "empty";
    e.textContent = "No questions yet. Add one below.";
    list.append(e);
  }

  data.faq.forEach((item, i) => {
    const card = document.createElement("div");
    card.className = "item";

    const top = document.createElement("div");
    top.className = "item-top";
    const strong = document.createElement("strong");
    strong.textContent = "Question " + (i + 1);
    top.append(strong, delBtn("Delete", () => {
      data.faq.splice(i, 1);
      setDirty(true);
      renderFaq();
    }));

    const grid = document.createElement("div");
    grid.className = "grid";
    grid.append(
      field("Question", item.q, v => item.q = v, { wide: true }),
      field("Answer", item.a, v => item.a = v, { textarea: true, wide: true })
    );

    card.append(top, grid);
    list.append(card);
  });
}

$("add-faq").addEventListener("click", () => {
  if (!data) return;
  data.faq.push({ q: "", a: "" });
  setDirty(true);
  renderFaq();
  $("faq-list").lastElementChild.querySelector("input").focus();
});

/* ---------- Fill the page from `data` ---------- */
function populate() {
  ["raised", "goal"].forEach(k => $(k).value = data.funds[k]);
  $("updated").value = data.funds.updated || "";
  CONTACT_FIELDS.forEach(([id, key]) => $(id).value = data.contact[key] || "");
  preview();
  renderEvents();
  renderFaq();
}

/* ---------- Save, backup, reset, log out ---------- */
$("save").addEventListener("click", save);

document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); }
});

$("export").addEventListener("click", () => {
  if (!data) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "ischs-backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("import").addEventListener("click", () => $("file").click());

$("file").addEventListener("change", e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    let parsed;
    try { parsed = JSON.parse(r.result); }
    catch (err) { toast("That file isn't a valid backup", 4000); return; }
    try {
      data = await api("/api/admin/site", { method: "PUT", body: JSON.stringify(parsed) });
      populate();
      setDirty(false);
      toast("Backup imported");
    } catch (err) {
      if (!handleAuthError(err)) toast(err.message, 5000);
    }
  };
  r.readAsText(f);
});

$("reset").addEventListener("click", async () => {
  if (!confirm("Reset everything to the default values? This can't be undone.")) return;
  try {
    data = await api("/api/admin/site/reset", { method: "POST" });
    populate();
    setDirty(false);
    toast("Reset to defaults");
  } catch (err) {
    if (!handleAuthError(err)) toast(err.message, 5000);
  }
});

$("logout").addEventListener("click", async () => {
  try { await api("/api/auth/logout", { method: "POST" }); } catch (e) {}
  location.href = "/login.html";
});

/* ---------- Start ---------- */
async function start() {
  try {
    const me = await api("/api/auth/me");
    if (me.user.role !== "admin") { location.href = "/login.html"; return; }
    $("who").textContent = `${me.user.firstName} ${me.user.lastName}`;
    data = await api("/api/site");
    populate();
    $("save").disabled = false;
  } catch (e) {
    if (!handleAuthError(e)) toast("Can't reach the server. Is it running?", 6000);
  }
}
start();