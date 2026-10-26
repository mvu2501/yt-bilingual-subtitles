// Chạy bên trong trang YouTube.
// Ý tưởng: đọc phụ đề tiếng Anh mà YouTube đang hiện (.ytp-caption-segment),
// nhờ background.js dịch sang tiếng Việt, rồi vẽ 2 dòng của riêng mình lên video.

(() => {
  let enabled = true;
  let lastText = "";
  let timer = null;
  let scheduled = false;
  const cache = new Map(); // nhớ các câu đã dịch để không dịch lại
  let overlay = null;
  let enEl = null;
  let viEl = null;

  // ---- Bật / tắt ----
  function applyEnabled() {
    document.documentElement.classList.toggle("ytbi-on", enabled);
    if (!enabled && overlay) overlay.style.display = "none";
    if (enabled) {
      lastText = "";
      update();
    }
  }

  chrome.storage.sync.get({ enabled: true }, (data) => {
    enabled = data.enabled;
    applyEnabled();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
      enabled = changes.enabled.newValue;
      applyEnabled();
    }
  });

  // ---- Tạo khung hiển thị phụ đề trên video ----
  function ensureOverlay() {
    const player = document.querySelector(".html5-video-player");
    if (!player) return null;

    if (overlay && overlay.parentElement === player) return overlay;

    overlay = document.createElement("div");
    overlay.id = "ytbi-overlay";

    enEl = document.createElement("div");
    enEl.className = "ytbi-en";

    viEl = document.createElement("div");
    viEl.className = "ytbi-vi";

    overlay.append(enEl, viEl);
    player.appendChild(overlay);
    return overlay;
  }

  // ---- Đọc phụ đề tiếng Anh hiện tại của YouTube ----
  function readCaption() {
    const segs = document.querySelectorAll(
      ".ytp-caption-window-container .ytp-caption-segment"
    );
    return Array.from(segs)
      .map((s) => s.textContent.trim())
      .filter(Boolean)
      .join(" ");
  }

  // ---- Dịch (có cache) ----
  function translate(text) {
    if (cache.has(text)) return Promise.resolve(cache.get(text));
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "translate", text }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) return resolve("");
        cache.set(text, res.text);
        resolve(res.text);
      });
    });
  }

  // ---- Cập nhật hiển thị ----
  function update() {
    if (!enabled) return;

    const text = readCaption();
    if (text === lastText) return;
    lastText = text;

    if (!ensureOverlay()) return;

    if (!text) {
      overlay.style.display = "none";
      return;
    }

    overlay.style.display = "";
    enEl.textContent = text;

    const cached = cache.get(text);
    viEl.textContent = cached || "";

    if (!cached) {
      clearTimeout(timer);
      // Đợi 250ms để phụ đề tự động (cuộn từng chữ) ổn định rồi mới dịch
      timer = setTimeout(async () => {
        const vi = await translate(text);
        if (text === lastText) viEl.textContent = vi;
      }, 250);
    }
  }

  // YouTube thay đổi DOM rất liên tục, nên gom lại mỗi khung hình một lần
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  }

  new MutationObserver(scheduleUpdate).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Khi chuyển sang video khác (YouTube không tải lại trang)
  document.addEventListener("yt-navigate-finish", () => {
    lastText = "";
    if (overlay) overlay.style.display = "none";
  });
})();
