const boot = document.getElementById("boot");
const bootBar = document.getElementById("boot-bar");
const deck = document.getElementById("deck");
const stage = document.getElementById("stage");
const layerA = document.getElementById("layer-a");
const layerB = document.getElementById("layer-b");
const chromeEl = document.getElementById("chrome");
const counter = document.getElementById("counter");
const progress = document.getElementById("progress");
const sectionLabel = document.getElementById("section-label");
const hint = document.getElementById("hint");
const slideVideo = document.getElementById("slide-video");
const overview = document.getElementById("overview");
const overviewGrid = document.getElementById("overview-grid");
const help = document.getElementById("help");

const PAGE_COUNT = 71;
const SECTIONS = [
  { until: 13, label: "Journey" },
  { until: 37, label: "Canvas" },
  { until: 49, label: "Workbench" },
  { until: 69, label: "Member portal" },
  { until: Infinity, label: "" },
];

const FRAME_NARROW = {
  left: 735 / 1920,
  top: 130 / 1080,
  width: 1087 / 1920,
  height: 786 / 1080,
  radius: 17 / 1920,
};

const FRAME_WIDE_NOW = {
  left: 737 / 1920,
  top: 148 / 1080,
  width: 1087 / 1920,
  height: 785 / 1080,
  radius: 14 / 1920,
};

const FRAME_WIDE_WB = {
  left: 735 / 1920,
  top: 168 / 1080,
  width: 1087 / 1920,
  height: 785 / 1080,
  radius: 18 / 1920,
};

const VIDEOS = {
  27: { src: "./media/canvas-solution-1.mp4", ...FRAME_NARROW },
  28: { src: "./media/canvas-solution-2.mp4", ...FRAME_NARROW },
  29: { src: "./media/canvas-solution-3.mp4", ...FRAME_NARROW },
  30: { src: "./media/canvas-solution-4.mp4", ...FRAME_NARROW },
  33: { src: "./media/canvas-near.mp4", ...FRAME_WIDE_NOW },
  34: { src: "./media/canvas-next.mp4", ...FRAME_WIDE_NOW },
  35: { src: "./media/canvas-later.mp4", ...FRAME_WIDE_NOW },
  43: { src: "./media/legacy-workbench.mov", ...FRAME_WIDE_WB },
  45: { src: "./media/workbench-north-star.mov", ...FRAME_WIDE_WB },
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let index = 0;
let front = layerA;
let back = layerB;
let showing = false;
let pending = null;
let chromeTimer = 0;
let wheelLock = false;
let overviewBuilt = false;
let activeVideoSrc = "";

const GATE_STORAGE = "deck-unlocked";
const GATE_PASSWORD = "jujube";
let unlocked = sessionStorage.getItem(GATE_STORAGE) === "1";

function pad(n) {
  return String(n).padStart(2, "0");
}

function slideSrc(pageNumber) {
  return `./slides/${pad(pageNumber)}.jpg`;
}

function sectionFor(pageNumber) {
  return SECTIONS.find((s) => pageNumber <= s.until)?.label || "";
}

function loadImage(el, pageNumber) {
  return new Promise((resolve, reject) => {
    const src = slideSrc(pageNumber);
    if (el.getAttribute("src") === src && el.complete && el.naturalWidth) {
      resolve();
      return;
    }
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Missing ${src}`));
    el.src = src;
  });
}

function preload(pageNumber) {
  if (pageNumber < 1 || pageNumber > PAGE_COUNT) return;
  const img = new Image();
  img.src = slideSrc(pageNumber);
  const spec = VIDEOS[pageNumber];
  if (spec) {
    const warm = document.createElement("video");
    warm.preload = "auto";
    warm.muted = true;
    warm.src = spec.src;
  }
}

function updateChrome() {
  const pageNumber = index + 1;
  counter.textContent = `${pad(pageNumber)}  /  ${pad(PAGE_COUNT)}`;
  progress.style.width = `${(pageNumber / PAGE_COUNT) * 100}%`;
  sectionLabel.textContent = sectionFor(pageNumber);
  history.replaceState(null, "", `#${pageNumber}`);
}

function showChromeBriefly() {
  chromeEl.classList.add("is-on");
  window.clearTimeout(chromeTimer);
  chromeTimer = window.setTimeout(() => chromeEl.classList.remove("is-on"), 1800);
}

function layoutSlideVideo() {
  const spec = VIDEOS[index + 1];
  if (!spec) {
    slideVideo.classList.remove("is-on");
    slideVideo.pause();
    activeVideoSrc = "";
    return;
  }

  const slideRect = front.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  slideVideo.style.left = `${slideRect.left - stageRect.left + slideRect.width * spec.left}px`;
  slideVideo.style.top = `${slideRect.top - stageRect.top + slideRect.height * spec.top}px`;
  slideVideo.style.width = `${slideRect.width * spec.width}px`;
  slideVideo.style.height = `${slideRect.height * spec.height}px`;
  slideVideo.style.borderRadius = `${slideRect.width * spec.radius}px`;
  slideVideo.classList.add("is-on");

  if (activeVideoSrc !== spec.src) {
    slideVideo.src = spec.src;
    slideVideo.currentTime = 0;
    activeVideoSrc = spec.src;
  }
  slideVideo.play().catch(() => {});
}

async function show(pageIndex, { instant = false } = {}) {
  pending = {
    pageIndex: Math.max(0, Math.min(PAGE_COUNT - 1, pageIndex)),
    instant,
  };
  if (showing) return;
  showing = true;
  try {
    while (pending) {
      const job = pending;
      pending = null;
      index = job.pageIndex;
      if (reduceMotion || job.instant) {
        await loadImage(front, index + 1);
      } else {
        await loadImage(back, index + 1);
        back.classList.add("is-visible");
        front.classList.remove("is-visible");
        const swap = front;
        front = back;
        back = swap;
      }
      updateChrome();
      layoutSlideVideo();
      if (!job.instant) showChromeBriefly();
      preload(index + 2);
      preload(index);
    }
  } finally {
    showing = false;
  }
}

function go(delta) {
  show(index + delta);
}

function parseHash() {
  const n = Number.parseInt(location.hash.replace("#", ""), 10);
  if (Number.isFinite(n) && n >= 1) return n - 1;
  return 0;
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

function openOverview() {
  overview.hidden = false;
  if (!overviewBuilt) {
    overviewGrid.innerHTML = "";
    for (let n = 1; n <= PAGE_COUNT; n += 1) {
      const btn = document.createElement("button");
      btn.className = "thumb";
      btn.type = "button";
      btn.dataset.page = String(n);
      const img = document.createElement("img");
      img.src = slideSrc(n);
      img.alt = "";
      const label = document.createElement("span");
      label.textContent = `${pad(n)}  ${sectionFor(n)}`.trim();
      btn.append(img, label);
      btn.addEventListener("click", () => {
        closeOverview();
        show(n - 1, { instant: true });
      });
      overviewGrid.append(btn);
    }
    overviewBuilt = true;
  }
  overviewGrid.querySelectorAll(".thumb").forEach((el) => {
    el.classList.toggle("is-current", Number(el.dataset.page) === index + 1);
  });
}

function closeOverview() {
  overview.hidden = true;
}

function openHelp() {
  help.hidden = false;
}

function closeHelp() {
  help.hidden = true;
}

function onKey(event) {
  if (!unlocked) return;
  const overlayOpen = !overview.hidden || !help.hidden;
  if (event.key === "Escape") {
    closeOverview();
    closeHelp();
    return;
  }
  if (overlayOpen) return;

  const keys = {
    ArrowRight: () => go(1),
    ArrowDown: () => go(1),
    PageDown: () => go(1),
    " ": () => go(1),
    ArrowLeft: () => go(-1),
    ArrowUp: () => go(-1),
    PageUp: () => go(-1),
    Home: () => show(0),
    End: () => show(PAGE_COUNT - 1),
    f: () => toggleFullscreen(),
    F: () => toggleFullscreen(),
    o: () => openOverview(),
    O: () => openOverview(),
    "?": () => openHelp(),
  };

  const action = keys[event.key];
  if (!action) return;
  event.preventDefault();
  action();
}

function onWheel(event) {
  if (!unlocked || !overview.hidden || !help.hidden || wheelLock) return;
  if (Math.abs(event.deltaY) < 18) return;
  wheelLock = true;
  go(event.deltaY > 0 ? 1 : -1);
  window.setTimeout(() => {
    wheelLock = false;
  }, 520);
}

async function bootDeck() {
  boot.hidden = false;
  bootBar.style.width = "40%";
  deck.hidden = false;
  await show(parseHash(), { instant: true });
  bootBar.style.width = "100%";
  window.setTimeout(() => {
    boot.classList.add("is-gone");
    hint.hidden = false;
    window.setTimeout(() => boot.remove(), 480);
  }, 80);
  preload(2);
}

function unlockDeck() {
  unlocked = true;
  sessionStorage.setItem(GATE_STORAGE, "1");
  document.getElementById("gate").hidden = true;
  bootDeck().catch((err) => {
    boot.hidden = false;
    const role = boot.querySelector(".boot__role");
    if (role) role.textContent = "Could not load the deck. Run Preview.cmd.";
    console.error(err);
  });
}

document.getElementById("gate-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("gate-password");
  const error = document.getElementById("gate-error");
  if (input.value.trim() === GATE_PASSWORD) {
    error.hidden = true;
    unlockDeck();
    return;
  }
  error.hidden = false;
  input.value = "";
  input.focus();
});

document.getElementById("hit-prev").addEventListener("click", () => go(-1));
document.getElementById("hit-next").addEventListener("click", () => go(1));
document.getElementById("btn-overview").addEventListener("click", openOverview);
document.getElementById("btn-close-overview").addEventListener("click", closeOverview);
document.getElementById("btn-full").addEventListener("click", toggleFullscreen);
document.getElementById("btn-close-help").addEventListener("click", closeHelp);

window.addEventListener("keydown", onKey);
window.addEventListener("wheel", onWheel, { passive: true });
window.addEventListener("mousemove", () => {
  if (unlocked) showChromeBriefly();
});
window.addEventListener("hashchange", () => {
  if (!unlocked) return;
  const next = parseHash();
  if (next !== index) show(next, { instant: true });
});
window.addEventListener("resize", () => layoutSlideVideo());

let touchX = null;
window.addEventListener("touchstart", (event) => {
  touchX = event.changedTouches[0].clientX;
}, { passive: true });
window.addEventListener("touchend", (event) => {
  if (!unlocked || touchX == null) return;
  const dx = event.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) < 48) return;
  go(dx < 0 ? 1 : -1);
}, { passive: true });

if (unlocked) {
  document.getElementById("gate").hidden = true;
  unlockDeck();
} else {
  window.setTimeout(() => document.getElementById("gate-password").focus(), 50);
}
