import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const html2canvasPath = path.resolve(
  process.cwd(),
  "node_modules/html2canvas/dist/html2canvas.min.js"
);

const html2canvasCode = fs.readFileSync(html2canvasPath, "utf8");

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function abbrNumber(value = 0) {
  const n = Number(value);
  if (n < 1000) return String(n);
  if (n < 1e6) return `${+(n / 1e3).toFixed(1)}K`;
  if (n < 1e9) return `${+(n / 1e6).toFixed(1)}M`;
  return `${+(n / 1e9).toFixed(1)}B`;
}

export async function fakeTweet(options = {}) {
  const {
    name = "Marcel",
    username = "mrchlldev",
    text = "Halo Dunia",
    avatar = "",
    verified = true,
    theme = "light",
    retweets = 0,
    quotes = 0,
    likes = 0,
    time = "10:30 AM",
    date = "May 31, 2026",
    client = "Twitter for Android"
  } = options;

  const themes = {
    light: {
      bg: "#ffffff",
      text: "#0f1419",
      sub: "#536471",
      border: "#eff3f4"
    },
    dim: {
      bg: "#15202b",
      text: "#f7f9f9",
      sub: "#8b98a5",
      border: "#38444d"
    },
    dark: {
      bg: "#000000",
      text: "#e7e9ea",
      sub: "#71767b",
      border: "#2f3336"
    }
  };

  const t = themes[theme] || themes.light;

  const avatarHTML = avatar
    ? `<img class="avatar" src="${escapeHtml(avatar)}" crossorigin="anonymous" />`
    : `<div class="avatar fallback">${escapeHtml(name.charAt(0).toUpperCase())}</div>`;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 40px;
  background: transparent;
  font-family: Arial, Helvetica, sans-serif;
}

#tweet-card {
  width: 600px;
  background: ${t.bg};
  color: ${t.text};
  border: 1px solid ${t.border};
  border-radius: 18px;
  padding: 20px;
}

.header {
  display: flex;
  gap: 12px;
}

.avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #1d9bf0;
}

.fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 26px;
  font-weight: 700;
}

.user {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.name {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
}

.verified {
  width: 18px;
  height: 18px;
  background: #1d9bf0;
  color: #fff;
  border-radius: 50%;
  font-size: 12px;
  display: ${verified ? "flex" : "none"};
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.username {
  color: ${t.sub};
  font-size: 15px;
  margin-top: 2px;
}

.tweet-text {
  margin-top: 18px;
  font-size: 23px;
  line-height: 1.35;
  word-wrap: break-word;
}

.meta {
  margin-top: 20px;
  color: ${t.sub};
  font-size: 15px;
}

.meta span {
  color: ${t.text};
}

.numbers {
  display: flex;
  gap: 18px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid ${t.border};
  font-size: 15px;
  color: ${t.sub};
}

.numbers b {
  color: ${t.text};
}

.footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid ${t.border};
  color: ${t.sub};
  font-size: 14px;
}
</style>
</head>
<body>
  <div id="tweet-card">
    <div class="header">
      ${avatarHTML}
      <div class="user">
        <div class="name-row">
          <div class="name">${escapeHtml(name)}</div>
          <div class="verified">✓</div>
        </div>
        <div class="username">@${escapeHtml(username.replace(/^@/, ""))}</div>
      </div>
    </div>

    <div class="tweet-text">
      ${escapeHtml(text).replace(/\n/g, "<br>")}
    </div>

    <div class="meta">
      ${escapeHtml(time)} · ${escapeHtml(date)} · <span>${escapeHtml(client)}</span>
    </div>

    <div class="numbers">
      <div><b>${abbrNumber(retweets)}</b> Retweets</div>
      <div><b>${abbrNumber(quotes)}</b> Quotes</div>
      <div><b>${abbrNumber(likes)}</b> Likes</div>
    </div>

    <div class="footer">Fake Tweet Generator</div>
  </div>

  <script>${html2canvasCode}</script>
  <script>
    window.renderTweet = async function () {
      const element = document.getElementById("tweet-card");

      const canvas = await html2canvas(element, {
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        scale: 2,
        windowWidth: 700
      });

      return canvas.toDataURL("image/png");
    };
  </script>
</body>
</html>
`;

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: 700,
      height: 900,
      deviceScaleFactor: 1
    });

    await page.setContent(html, {
      waitUntil: "networkidle0"
    });

    const dataUrl = await page.evaluate(async () => {
      return await window.renderTweet();
    });

    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    return Buffer.from(base64, "base64");
  } finally {
    if (browser) await browser.close();
  }
}
