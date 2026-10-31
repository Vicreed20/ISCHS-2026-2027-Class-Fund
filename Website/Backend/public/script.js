/* =========================================================
   FUNDS (placeholder values; replaced by the server on load)
   ========================================================= */
const FUNDS = {
   raised: 18500,
   goal: 25000,
   donors: 112,
   updated: "October 20, 2026"
};

const money = n => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const $ = id => document.getElementById(id);
const button = $("reveal-button");
const details = $("funds-details");
const amount = $("funds-amount");
const fill = $("progress-fill");

let percent = 0;
let revealed = false;

// The admin panel saves dates as YYYY-MM-DD; show them as "October 20, 2026"
function prettyDate(s) {
   if (!s) return "";
   if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;       // already formatted text
   const [y, m, d] = s.split("-").map(Number);
   return new Date(y, m - 1, d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Fill in everything except the amount (that appears on click)
function fillFunds() {
   percent = FUNDS.goal > 0 ? Math.min(100, Math.round((FUNDS.raised / FUNDS.goal) * 100)) : 0;

   $("goal-text").textContent = money(FUNDS.goal);
   $("stat-current").textContent = money(FUNDS.raised);
   $("stat-remaining").textContent = money(Math.max(0, FUNDS.goal - FUNDS.raised));
   $("stat-donors").textContent = FUNDS.donors;
   $("stat-average").textContent = money(FUNDS.donors > 0 ? Math.round(FUNDS.raised / FUNDS.donors) : 0);
   $("updated-text").textContent = prettyDate(FUNDS.updated);

   // If the box is already open when new numbers arrive, refresh what's showing
   if (revealed) {
      amount.textContent = money(FUNDS.raised);
      fill.style.width = percent + "%";
      $("percent-text").textContent = percent + "%";
      $("progress").setAttribute("aria-valuenow", percent);
   }
}
fillFunds();

function countUp(target, duration = 1200, onDone) {
   const start = performance.now();
   function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);          // ease-out
      amount.textContent = money(Math.round(target * eased));
      if (t < 1) {
         requestAnimationFrame(tick);
      } else if (onDone) {
         onDone();
      }
   }
   requestAnimationFrame(tick);
}

button.addEventListener("click", () => {
   revealed = !revealed;
   button.classList.toggle("revealed", revealed);
   button.setAttribute("aria-expanded", revealed);
   details.classList.toggle("open", revealed);
   details.setAttribute("aria-hidden", !revealed);

   if (revealed) {
      celebrateStart();                                   // pop + first burst
      countUp(FUNDS.raised, 1200, celebrateFinale);       // chime + corner cannons at the end
      fill.style.width = percent + "%";
      $("percent-text").textContent = percent + "%";
      $("progress").setAttribute("aria-valuenow", percent);
   } else {
      amount.textContent = "";
      fill.style.width = "0";
   }
});

/* =========================================================
   CONFETTI
   ========================================================= */
const canvas = document.getElementById("confetti-canvas");
const ctx = canvas.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const COLORS = ["#FACC15", "#2563EB", "#60A5FA", "#7C3AED", "#F97316", "#22C55E", "#EC4899"];
let particles = [];
let animating = false;

function resizeCanvas() {
   const dpr = window.devicePixelRatio || 1;
   canvas.width = window.innerWidth * dpr;
   canvas.height = window.innerHeight * dpr;
   ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // draw in CSS pixels on sharp screens
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const rand = (min, max) => Math.random() * (max - min) + min;

/* Shoot confetti from (x, y). `angle` is the direction in degrees
   (-90 = straight up), `spread` is how wide the cone is. */
function burst(x, y, { count = 120, angle = -90, spread = 70, power = 1 } = {}) {
   for (let i = 0; i < count; i++) {
      const dir = (angle + rand(-spread / 2, spread / 2)) * Math.PI / 180;
      const speed = rand(7, 17) * power;
      particles.push({
         x, y,
         vx: Math.cos(dir) * speed,
         vy: Math.sin(dir) * speed,
         size: rand(7, 13),
         color: COLORS[Math.floor(Math.random() * COLORS.length)],
         round: Math.random() < 0.25,          // some circles, mostly rectangles
         rot: rand(0, Math.PI * 2),
         vr: rand(-0.3, 0.3),
         wobble: rand(0, Math.PI * 2),         // makes pieces flutter
         vw: rand(0.1, 0.35),
         life: rand(110, 170)
      });
   }
   if (particles.length > 700) particles.splice(0, particles.length - 700);   // safety cap
   if (!animating) { animating = true; requestAnimationFrame(frame); }
}

function frame() {
   ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

   particles = particles.filter(p => p.life > 0 && p.y < window.innerHeight + 40);

   for (const p of particles) {
      p.vx *= 0.985;                 // air drag
      p.vy = p.vy * 0.985 + 0.32;    // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.wobble += p.vw;
      p.life--;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.wobble));            // flip effect
      ctx.globalAlpha = Math.min(1, p.life / 40);  // fade out at the end
      ctx.fillStyle = p.color;
      if (p.round) {
         ctx.beginPath();
         ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
         ctx.fill();
      } else {
         ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
   }

   if (particles.length) {
      requestAnimationFrame(frame);
   } else {
      animating = false;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
   }
}

/* =========================================================
   SOUND (generated in the browser, no audio files needed)
   ========================================================= */
let audioCtx = null;
let soundOn = true;

function getAudio() {
   if (!soundOn) return null;
   if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
   }
   if (audioCtx.state === "suspended") audioCtx.resume();
   return audioCtx;
}

/* Party-popper "pop": a short burst of filtered noise plus a low thump */
function playPop() {
   const ac = getAudio();
   if (!ac) return;
   const now = ac.currentTime;

   const length = Math.floor(ac.sampleRate * 0.3);
   const buffer = ac.createBuffer(1, length, ac.sampleRate);
   const data = buffer.getChannelData(0);
   for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);   // fading noise
   }
   const noise = ac.createBufferSource();
   noise.buffer = buffer;

   const filter = ac.createBiquadFilter();
   filter.type = "bandpass";
   filter.frequency.value = 1800;

   const noiseGain = ac.createGain();
   noiseGain.gain.setValueAtTime(0.5, now);
   noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
   noise.connect(filter).connect(noiseGain).connect(ac.destination);
   noise.start(now);

   const thump = ac.createOscillator();
   const thumpGain = ac.createGain();
   thump.frequency.setValueAtTime(180, now);
   thump.frequency.exponentialRampToValueAtTime(40, now + 0.15);
   thumpGain.gain.setValueAtTime(0.6, now);
   thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
   thump.connect(thumpGain).connect(ac.destination);
   thump.start(now);
   thump.stop(now + 0.2);
}

/* Happy rising chime: C - E - G - high C */
function playChime() {
   const ac = getAudio();
   if (!ac) return;
   const notes = [523.25, 659.25, 783.99, 1046.5];
   notes.forEach((freq, i) => {
      const start = ac.currentTime + i * 0.09;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (i === notes.length - 1 ? 0.9 : 0.35));
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + 1);
   });
}

/* =========================================================
   CELEBRATIONS
   ========================================================= */
function celebrateStart() {
   const r = button.getBoundingClientRect();
   playPop();
   if (!reduceMotion) {
      burst(r.left + r.width / 2, r.top + r.height / 2, { count: 130, angle: -90, spread: 80 });
   }
}

function celebrateFinale() {
   playChime();
   if (!reduceMotion) {
      const w = window.innerWidth, h = window.innerHeight;
      burst(0, h, { count: 100, angle: -60, spread: 40, power: 1.5 });   // left corner cannon
      burst(w, h, { count: 100, angle: -120, spread: 40, power: 1.5 });  // right corner cannon
   }
}

/* Sound on/off toggle */
const soundToggle = document.getElementById("sound-toggle");
soundToggle.addEventListener("click", () => {
   soundOn = !soundOn;
   soundToggle.setAttribute("aria-pressed", soundOn);
   soundToggle.textContent = soundOn ? "🔊 Sound on" : "🔇 Sound off";
   if (soundOn) playPop();   // quick preview
});

/* =========================================================
   EVENTS (placeholders; replaced by the server on load)
   ========================================================= */
const EVENTS = [
   {
      title: "Homecoming",
      date: "2026-10-23",
      time: "7:00 PM",
      location: "ISCHS Main Gym",
      description: "Spirit week wraps up with the big game, the crowning of the court, and the dance.",
      emoji: "👑",
      image: ""
   },
   {
      title: "Senior Picnic",
      date: "2027-04-09",
      time: "11:00 AM",
      location: "Local Park Pavilion",
      description: "Food, games, and a relaxed afternoon with your class before the final stretch.",
      emoji: "🧺",
      image: ""
   },
   {
      title: "GradVenture",
      date: "2027-05-21",
      time: "6:00 PM",
      location: "Theme Park Trip",
      description: "An all-night celebration for graduating seniors. Rides, friends, and memories.",
      emoji: "🎢",
      image: ""
   }
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const grid = document.getElementById("events-grid");

// Parse "YYYY-MM-DD" as a LOCAL date (new Date("2026-10-23") would be UTC
// and can land on the wrong day).
function parseDate(str) {
   const [y, m, d] = str.split("-").map(Number);
   return new Date(y, m - 1, d);
}

function el(tag, className, text) {
   const node = document.createElement(tag);
   if (className) node.className = className;
   if (text !== undefined) node.textContent = text;   // textContent keeps admin input safe
   return node;
}

function countdownText(days) {
   if (days === 1) return "Tomorrow!";
   return `In ${days} days`;
}

function renderEvents() {
   const now = new Date();
   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
   grid.replaceChildren();

   if (!EVENTS.length) {
      grid.append(el("p", "events-empty", "No events right now. Check back soon!"));
      return;
   }

   [...EVENTS]
      .sort((a, b) => parseDate(a.date) - parseDate(b.date))
      .forEach(ev => {
         const eventDate = parseDate(ev.date);
         const isPast = today >= eventDate;          // the day arrives = Already Past
         const days = Math.round((eventDate - today) / 86400000);

         const card = el("article", "event-card" + (isPast ? " past" : ""));

         // Banner
         const banner = el("div", "event-banner");
         if (ev.image) {
            banner.style.background = `url("${encodeURI(ev.image)}") center / cover no-repeat`;
         } else {
            banner.append(el("span", "event-emoji", ev.emoji || "🎉"));
         }
         banner.append(el("span", "event-status", isPast ? "Already Past" : "Upcoming"));

         const chip = el("div", "event-date");
         chip.append(el("span", "month", MONTHS[eventDate.getMonth()]));
         chip.append(el("span", "day", eventDate.getDate()));
         banner.append(chip);

         // Body
         const body = el("div", "event-body");
         body.append(el("h3", "", ev.title));
         if (!isPast) body.append(el("span", "event-countdown", countdownText(days)));

         const meta = el("ul", "event-meta");
         if (ev.time) meta.append(el("li", "", "🕒 " + ev.time));
         if (ev.location) meta.append(el("li", "", "📍 " + ev.location));
         body.append(meta);
         if (ev.description) body.append(el("p", "event-desc", ev.description));

         card.append(banner, body);
         grid.append(card);
      });
}

renderEvents();
setInterval(renderEvents, 60 * 60 * 1000);   // re-check hourly so a page left open flips at midnight

/* =========================================================
   FAQ
   ========================================================= */
const questions = document.querySelectorAll(".faq-question");

function setOpen(btn, open) {
   const answer = document.getElementById(btn.getAttribute("aria-controls"));
   btn.setAttribute("aria-expanded", open);
   answer.classList.toggle("open", open);
}

questions.forEach(btn => {
   btn.addEventListener("click", () => {
      const willOpen = btn.getAttribute("aria-expanded") !== "true";
      questions.forEach(other => setOpen(other, false));   // one open at a time
      setOpen(btn, willOpen);
   });
});

// Open the first question by default
if (questions[0]) setOpen(questions[0], true);

/* =========================================================
   FOOTER
   ========================================================= */
document.getElementById("footer-year").textContent = new Date().getFullYear();

/* =========================================================
   LOAD LIVE DATA FROM THE SERVER
   Keep this at the very bottom so everything above exists.
   ========================================================= */
async function loadSiteData() {
   try {
      const res = await fetch("/api/site");
      if (!res.ok) return;
      const site = await res.json();

      if (site && site.funds) {
         Object.assign(FUNDS, site.funds);
         fillFunds();
      }
      if (site && Array.isArray(site.events)) {
         EVENTS.length = 0;
         EVENTS.push(...site.events);
         renderEvents();
      }
   } catch (e) {
      // Server not running or page opened as a file: keep the placeholders above
   }
}
loadSiteData();