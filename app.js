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
const ytWrap = document.getElementById("yt-wrap");
const videoPlay = document.getElementById("video-play");
const videoSeek = document.getElementById("video-seek");
const videoTime = document.getElementById("video-time");
const overview = document.getElementById("overview");
const overviewGrid = document.getElementById("overview-grid");
const help = document.getElementById("help");

const PAGE_COUNT = 69;
const SECTIONS = [
  { until: 11, label: "Journey" },
  { until: 48, label: "Canvas" },
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

// Crop 1195x861 + 23px even matte. Taller than FRAME_CENTER so all four sides match.
const FRAME_MVP = {
  left: 319 / 1920,
  top: 103 / 1080,
  width: 1282 / 1920,
  height: 936.5 / 1080,
  radius: 17 / 1920,
};

const FRAME_WB_SHOT = {
  left: 810 / 1920,
  top: 254 / 1080,
  width: 982 / 1920,
  height: 572 / 1080,
  radius: 16 / 1920,
};

// 2276x1558 recording + 23px even matte. The slide's black box is shortened to match.
const FRAME_PROTO = {
  left: 737 / 1920,
  top: 154 / 1080,
  width: 1087 / 1920,
  height: 759 / 1080,
  radius: 17 / 1920,
};

// Crop 1440x1014 + 23px even matte. Taller than the previous Claude hole so all four sides match.
const FRAME_CLAUDE = {
  left: 319 / 1920,
  top: 103 / 1080,
  width: 1282 / 1920,
  height: 917 / 1080,
  radius: 17 / 1920,
};

// Non-black content inside the source file. Fitted and centered in the frame.
const CROP_SIDE_UI = { x: 0, y: 14, w: 1432, h: 1018 };
// Browser window inside the black canvas, minus the clipped tab strip (rows 79-91),
// so it starts at the toolbar. Scale it to fill like later-mvp.
const CROP_MVP_UI = { x: 131, y: 92, w: 1195, h: 861 };
const CROP_CLAUDE = { x: 0, y: 0, w: 1440, h: 1014 };
const YT_SOURCE_W = 1920;
const YT_SOURCE_H = 1080;

const VIDEOS = {
  26: { src: "./media/translated-ideas-canvas.mp4", vw: 1440, vh: 1024, ...FRAME_SIDE },
  27: { src: "./media/canvas-ingests-specifications.mp4", vw: 1432, vh: 1032, crop: CROP_SIDE_UI, ...FRAME_SIDE },
  28: { src: "./media/see-relationships.mp4", vw: 1432, vh: 1032, crop: CROP_SIDE_UI, ...FRAME_SIDE },
  29: { src: "./media/range-of-users.mp4", vw: 1432, vh: 1032, crop: CROP_SIDE_UI, ...FRAME_SIDE },
  30: { src: "./media/preview-component.mp4", vw: 1432, vh: 1032, crop: CROP_SIDE_UI, ...FRAME_SIDE },
  39: { src: "./media/now-mvp.mp4", vw: 1432, vh: 1032, crop: CROP_MVP_UI, clipToCrop: true, ...FRAME_MVP },
  42: { src: "./media/next-mvp.mp4", vw: 1432, vh: 1032, crop: CROP_MVP_UI, clipToCrop: true, ...FRAME_MVP },
  45: { src: "./media/later-mvp.mp4", vw: 1440, vh: 1024, ...FRAME_CENTER },
  51: {
    youtube: "LhFhbQDodZI",
    start: 40,
    vw: 1920,
    vh: 1080,
    ...FRAME_WB_SHOT,
  },
  60: { src: "./media/aligned-pms-cpo.mp4", vw: 1440, vh: 1024, ...FRAME_SIDE_WB },
  67: { src: "./media/workbench-prototype.mp4", vw: 2276, vh: 1558, ...FRAME_PROTO },
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
let ytPlayer = null;
let ytApiReady = null;
let ytTick = 0;

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
}

// Warm only the neighbors' videos and cancel the rest. Abandoned warm-ups hold
// open connections, which can starve the playing video of data mid-playback.
const warmVideos = new Map();

function warmNeighborVideos(pageNumber) {
  const wanted = new Set(
    [VIDEOS[pageNumber + 1]?.src, VIDEOS[pageNumber - 1]?.src].filter(Boolean),
  );
  for (const [src, warm] of warmVideos) {
    if (wanted.has(src)) continue;
    warm.removeAttribute("src");
    warm.load();
    warmVideos.delete(src);
  }
  for (const src of wanted) {
    if (warmVideos.has(src)) continue;
    const warm = document.createElement("video");
    warm.preload = "auto";
    warm.muted = true;
    warm.src = src;
    warmVideos.set(src, warm);
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

function fitCentered(frameW, frameH, videoW, videoH, minPad) {
  const pad = Math.max(0, minPad);
  const innerW = Math.max(1, frameW - 2 * pad);
  const innerH = Math.max(1, frameH - 2 * pad);
  if (!videoW || !videoH) {
    return { x: pad, y: pad, w: innerW, h: innerH };
  }
  const scale = Math.min(innerW / videoW, innerH / videoH);
  const w = videoW * scale;
  const h = videoH * scale;
  return {
    x: (frameW - w) / 2,
    y: (frameH - h) / 2,
    w,
    h,
  };
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function currentSpec() {
  return VIDEOS[index + 1];
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiReady) return ytApiReady;
  ytApiReady = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.append(script);
  });
  return ytApiReady;
}

function youtubeTimes(spec) {
  const start = spec.start || 0;
  const duration = Math.max(0, (ytPlayer?.getDuration?.() || 0) - start);
  const current = Math.max(0, (ytPlayer?.getCurrentTime?.() || 0) - start);
  return { start, duration, current };
}

function stopYouTubeTick() {
  window.clearInterval(ytTick);
  ytTick = 0;
}

function startYouTubeTick() {
  if (ytTick) return;
  ytTick = window.setInterval(updateVideoControls, 250);
}

function pauseYouTube() {
  stopYouTubeTick();
  try {
    ytPlayer?.pauseVideo?.();
  } catch {
    /* player may not be ready */
  }
}

function updateVideoControls() {
  const spec = currentSpec();
  if (spec?.youtube && ytPlayer?.getCurrentTime) {
    const { duration, current } = youtubeTimes(spec);
    if (!seekingVideo && duration) {
      videoSeek.value = String(Math.round((current / duration) * 1000));
    }
    videoTime.textContent = duration
      ? `${formatTime(current)} / ${formatTime(duration)}`
      : "0:00";
    const playing = ytPlayer.getPlayerState?.() === window.YT?.PlayerState?.PLAYING;
    videoSlot.classList.toggle("is-paused", !playing);
    videoPlay.setAttribute("aria-label", playing ? "Pause" : "Play");
    return;
  }

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
  const spec = currentSpec();
  if (spec?.youtube && ytPlayer?.playVideo) {
    const playing = ytPlayer.getPlayerState?.() === window.YT?.PlayerState?.PLAYING;
    if (playing) ytPlayer.pauseVideo();
    else ytPlayer.playVideo();
    updateVideoControls();
    return;
  }
  if (slideVideo.paused) slideVideo.play().catch(() => {});
  else slideVideo.pause();
}

function placeMedia(el, placed) {
  el.style.left = `${placed.x}px`;
  el.style.top = `${placed.y}px`;
  el.style.width = `${placed.w}px`;
  el.style.height = `${placed.h}px`;
}

function scaleYouTubeIframe(placed) {
  const iframe = ytWrap.querySelector("iframe");
  if (!iframe) return;
  const scale = placed.w / YT_SOURCE_W;
  iframe.setAttribute("width", String(YT_SOURCE_W));
  iframe.setAttribute("height", String(YT_SOURCE_H));
  iframe.style.width = `${YT_SOURCE_W}px`;
  iframe.style.height = `${YT_SOURCE_H}px`;
  iframe.style.transform = `scale(${scale})`;
  iframe.style.transformOrigin = "top left";
}

function requestYouTubeHd(player) {
  try {
    player.setPlaybackQuality?.("hd1080");
    const levels = player.getAvailableQualityLevels?.() || [];
    const best = ["hd2160", "hd1440", "hd1080", "hd720"].find((q) => levels.includes(q));
    if (best) player.setPlaybackQuality(best);
  } catch {
    /* YouTube may ignore quality hints */
  }
}

async function ensureYouTube(spec) {
  await loadYouTubeApi();
  const start = spec.start || 0;
  if (ytPlayer?.loadVideoById) {
    ytPlayer.mute();
    ytPlayer.loadVideoById({
      videoId: spec.youtube,
      startSeconds: start,
      suggestedQuality: "hd1080",
    });
    requestYouTubeHd(ytPlayer);
    return;
  }
  ytPlayer = new window.YT.Player("yt-host", {
    width: YT_SOURCE_W,
    height: YT_SOURCE_H,
    videoId: spec.youtube,
    playerVars: {
      autoplay: 1,
      mute: 1,
      start,
      controls: 0,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      vq: "hd1080",
      origin: window.location.origin,
    },
    events: {
      onReady(event) {
        const specNow = currentSpec();
        const placed = {
          x: parseFloat(ytWrap.style.left) || 0,
          y: parseFloat(ytWrap.style.top) || 0,
          w: parseFloat(ytWrap.style.width) || YT_SOURCE_W,
          h: parseFloat(ytWrap.style.height) || YT_SOURCE_H,
        };
        scaleYouTubeIframe(placed);
        event.target.mute();
        requestYouTubeHd(event.target);
        event.target.seekTo(specNow?.start || start, true);
        event.target.playVideo();
        startYouTubeTick();
        updateVideoControls();
      },
      onStateChange(event) {
        const specNow = currentSpec();
        const startAt = specNow?.start || 0;
        if (event.data === window.YT.PlayerState.ENDED) {
          event.target.seekTo(startAt, true);
          event.target.playVideo();
        }
        if (event.data === window.YT.PlayerState.PLAYING) {
          requestYouTubeHd(event.target);
          startYouTubeTick();
        }
        updateVideoControls();
      },
    },
  });
}

function layoutSlideVideo() {
  const spec = currentSpec();
  if (!spec) {
    videoSlot.classList.remove("is-on");
    slideVideo.pause();
    pauseYouTube();
    ytWrap.hidden = true;
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

  const minPad = 23 * (slideRect.width / 1920);

  if (spec.youtube) {
    slideVideo.pause();
    slideVideo.removeAttribute("src");
    slideVideo.style.display = "none";
    ytWrap.hidden = false;
    const placed = fitCentered(frameW, frameH, spec.vw, spec.vh, minPad);
    placeMedia(ytWrap, placed);
    scaleYouTubeIframe(placed);
    const key = `yt:${spec.youtube}:${spec.start || 0}`;
    if (activeVideoSrc !== key) {
      activeVideoSrc = key;
      ensureYouTube(spec);
    } else {
      startYouTubeTick();
      try {
        ytPlayer?.playVideo?.();
      } catch {
        /* ignore */
      }
    }
    updateVideoControls();
    return;
  }

  pauseYouTube();
  ytWrap.hidden = true;
  slideVideo.style.display = "";

  const srcW = slideVideo.videoWidth || spec.vw;
  const srcH = slideVideo.videoHeight || spec.vh;
  const sx = srcW / spec.vw;
  const sy = srcH / spec.vh;
  const crop = spec.crop
    ? {
        x: spec.crop.x * sx,
        y: spec.crop.y * sy,
        w: spec.crop.w * sx,
        h: spec.crop.h * sy,
      }
    : { x: 0, y: 0, w: srcW, h: srcH };
  const placed = fitCentered(frameW, frameH, crop.w, crop.h, minPad);
  const scale = placed.w / crop.w;
  slideVideo.style.left = `${placed.x - crop.x * scale}px`;
  slideVideo.style.top = `${placed.y - crop.y * scale}px`;
  slideVideo.style.width = `${srcW * scale}px`;
  slideVideo.style.height = `${srcH * scale}px`;
  // Hide source pixels outside the crop so they don't show through the matte.
  slideVideo.style.clipPath = spec.clipToCrop
    ? `inset(${crop.y * scale}px ${(srcW - crop.x - crop.w) * scale}px ${(srcH - crop.y - crop.h) * scale}px ${crop.x * scale}px)`
    : "";

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
      warmNeighborVideos(index + 1);
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
  await show(0, { instant: true });
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
  const label = document.getElementById("gate-label");
  if (input.value.trim() === GATE_PASSWORD) {
    label.textContent = "Password";
    label.classList.remove("is-retry");
    input.classList.remove("is-invalid");
    input.removeAttribute("aria-invalid");
    unlockDeck();
    return;
  }
  label.textContent = "Retry password";
  label.classList.add("is-retry");
  input.classList.add("is-invalid");
  input.setAttribute("aria-invalid", "true");
  input.value = "";
  input.focus();
});

document.getElementById("gate-password").addEventListener("input", () => {
  const input = document.getElementById("gate-password");
  if (!input.classList.contains("is-invalid")) return;
  input.classList.remove("is-invalid");
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
  const spec = currentSpec();
  const ratio = Number(videoSeek.value) / 1000;
  if (spec?.youtube && ytPlayer?.seekTo) {
    const { start, duration } = youtubeTimes(spec);
    if (!duration) return;
    ytPlayer.seekTo(start + ratio * duration, true);
    updateVideoControls();
    return;
  }
  const duration = slideVideo.duration || 0;
  if (!duration) return;
  slideVideo.currentTime = ratio * duration;
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
