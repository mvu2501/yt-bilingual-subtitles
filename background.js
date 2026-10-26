// Service worker: nhận câu tiếng Anh từ content.js, gọi dịch vụ dịch, trả về tiếng Việt.
// Phải gọi từ đây (không gọi trực tiếp từ content.js) để tránh bị chặn CORS.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "translate") {
    const url =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx&sl=en&tl=vi&dt=t&q=" +
      encodeURIComponent(msg.text);

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        // Kết quả có dạng [[["câu dịch", "câu gốc", ...], ...], ...]
        const translated = data[0].map((part) => part[0]).join("");
        sendResponse({ ok: true, text: translated });
      })
      .catch((err) => sendResponse({ ok: false, error: String(err) }));

    return true; // báo cho Chrome biết là sẽ trả lời bất đồng bộ
  }
});
