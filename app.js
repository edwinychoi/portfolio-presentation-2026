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
const videoSlot = document.getElementById("video-slot");
const slideVideo = document.getElementById("slide-video");
const videoPlay = document.getElementById("video-play");
const videoSeek = document.getElementById("video-seek");
const videoTime = document.getElementById("video-time");
const overview = document.getElementById("overview");
const overviewGrid = document.getElementById("overview-grid");
const help = document.getElementById("help");

const PAGE_COUNT = 65;
const SECTIONS = [
  { until: 11, label: "Journey" },
  { until: 47, label: "Canvas" },
  { until: Infinity, label: "Workbench" },
];

const FRAME_SIDE = {
  left: 737 / 1920,
  top: 127 / 1080,
  width: 1087 / 1920,
  height: 786 / 1080,
  radius: 17 / 1920,
};

const FRAME_SIDE_WB = {
  left: 735 / 1920,
  top: 147 / 1080,
  width: 1087 / 1920,
  height: 786 / 1080,
  radius: 17 / 1920,
};

const FRAME_CENTER = {
  left: 319 / 1920,
  top: 103 / 1080,
  width: 1282 / 1920,
  height: 927 / 1080,
  radius: 17 / 1920,
};

const VIDEOS = {
  25: { src: "./media/translated-ideas-canvas.mp4", vw: 1440, vh: 1024, ...FRAME_SIDE },
  26: { src: "./media/canvas-ingests-specifications.mp4", vw: 1432, vh: 1032, ...FRAME_SIDE },
  27: { src: "./media/see-relationships.mp4", vw: 1432, vh: 1032, ...FRAME_SIDE },
  28: { src: "./media/range-of-users.mp4", vw: 1432, vh: 1032, ...FRAME_SIDE },
  29: { src: "./media/preview-component.mp4", vw: 1432, vh: 1032, ...FRAME_SIDE },
  38: { src: "./media/now-mvp.mp4", vw: 1432, vh: 1032, ...FRAME_CENTER },
  41: { src: "./media/next-mvp.mp4", vw: 1432, vh: 1032, ...FRAME_CENTER },
  44: { src: "./media/later-mvp.mp4", vw: 1440, vh: 1024, ...FRAME_CENTER },
  58: { src: "./media/aligned-product-leadership.mp4", vw: 1440, vh: 1024, ...FRAME_SIDE_WB },
  63: { src: "./media/user-scoped-agents.mp4", vw: 1440, vh: 1024, ...FRAME_CENTER },
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
let seekingVideo = false;

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

function fitEqualPad(frameW, frameH, videoW, videoH) {
  if (!videoW || !videoH) {
    return { x: 0, y: 0, w: frameW, h: frameH };
  }
  const ar = videoW / videoH;
  const pad = (frameW - ar * frameH) / (2 * (1 - ar));
  if (Number.isFinite(pad) && pad >= 0 && pad < Math.min(frameW, frameH) / 2) {
    return { x: pad, y: pad, w: frameW - 2 * pad, h: frameH - 2 * pad };
  }
  const scale = Math.min(frameW / videoW, frameH / videoH);
  const w = videoW * scale;
  const h = videoH * scale;
  return { x: (frameW - w) / 2, y: (frameH - h) / 2, w, h };
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function updateVideoControls() {
  const duration = slideVideo.duration || 0;
  const current = slideVideo.currentTime || 0;
  if (!seekingVideo && duration) {
    videoSeek.value = String(Math.round((current / duration) * 1000));
  }
  videoTime.textContent = duration
    ? `${formatTime(current)} / ${formatTime(duration)}`
    : "0:00";
  videoSlot.classList.toggle("is-paused", slideVideo.paused);
  videoPlay.setAttribute("aria-label", slideVideo.paused ? "Play" : "Pause");
}

function toggleVideoPlay() {
  if (slideVideo.paused) slideVideo.play().catch(() => {});
  else slideVideo.pause();
}

function layoutSlideVideo() {
  const spec = VIDEOS[index + 1];
  if (!spec) {
    videoSlot.classList.remove("is-on");
    slideVideo.pause();
    activeVideoSrc = "";
    return;
  }

  const slideRect = front.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const frameW = slideRect.width * spec.width;
  const frameH = slideRect.height * spec.height;
  videoSlot.style.left = `${slideRect.left - stageRect.left + slideRect.width * spec.left}px`;
  videoSlot.style.top = `${slideRect.top - stageRect.top + slideRect.height * spec.top}px`;
  videoSlot.style.width = `${frameW}px`;
  videoSlot.style.height = `${frameH}px`;
  videoSlot.style.borderRadius = `${slideRect.width * spec.radius}px`;
  videoSlot.classList.add("is-on");

  const vw = slideVideo.videoWidth || spec.vw;
  const vh = slideVideo.videoHeight || spec.vh;
  const placed = fitEqualPad(frameW, frameH, vw, vh);
  slideVideo.style.left = `${placed.x}px`;
  slideVideo.style.top = `${placed.y}px`;
  slideVideo.style.width = `${placed.w}px`;
  slideVideo.style.height = `${placed.h}px`;

  if (activeVideoSrc !== spec.src) {
    slideVideo.src = spec.src;
    slideVideo.currentTime = 0;
    activeVideoSrc = spec.src;
  }
  slideVideo.play().catch(() => {});
  updateVideoControls();
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
    " ": () => {
      if (videoSlot.classList.contains("is-on") && videoSlot.matches(":hover")) {
        toggleVideoPlay();
        return;
      }
      go(1);
    },
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

slideVideo.addEventListener("loadedmetadata", () => layoutSlideVideo());
slideVideo.addEventListener("timeupdate", updateVideoControls);
slideVideo.addEventListener("play", updateVideoControls);
slideVideo.addEventListener("pause", updateVideoControls);
videoPlay.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleVideoPlay();
});
videoSeek.addEventListener("pointerdown", () => {
  seekingVideo = true;
});
videoSeek.addEventListener("input", () => {
  const duration = slideVideo.duration || 0;
  if (!duration) return;
  slideVideo.currentTime = (Number(videoSeek.value) / 1000) * duration;
  updateVideoControls();
});
videoSeek.addEventListener("change", () => {
  seekingVideo = false;
});
videoSeek.addEventListener("pointerup", () => {
  seekingVideo = false;
});
videoSlot.addEventListener("click", (event) => {
  if (event.target.closest(".video-controls")) return;
  toggleVideoPlay();
});
videoSlot.addEventListener("wheel", (event) => {
  event.stopPropagation();
}, { passive: true });

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
