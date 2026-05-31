import { Canvas, loadImage } from "skia-canvas";

function abbrNumber(value = 0) {
  const n = Number(value);
  if (n < 1000) return String(n);
  if (n < 1e6) return `${+(n / 1000).toFixed(1)}K`;
  if (n < 1e9) return `${+(n / 1e6).toFixed(1)}M`;
  return `${+(n / 1e9).toFixed(1)}B`;
}

async function loadAvatar(url) {
  if (!url) return null;

  try {
    return await loadImage(url);
  } catch {
    return null;
  }
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = String(text || "").split("\n");

  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ");
    let line = "";

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;

      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }

    if (line) lines.push(line);
  }

  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function circleImage(ctx, img, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

export async function generateFakeTweet(options = {}) {
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

  const width = 600;
  const padding = 20;
  const avatarSize = 54;
  const maxTextWidth = width - padding * 2;

  const measureCanvas = new Canvas(width, 900);
  const measureCtx = measureCanvas.getContext("2d");

  measureCtx.font = "23px Arial";
  const tweetLines = wrapText(measureCtx, text, maxTextWidth);
  const textHeight = tweetLines.length * 32;

  const height = 210 + textHeight;

  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = t.bg;
  roundRect(ctx, 0, 0, width, height, 18);
  ctx.fill();

  ctx.strokeStyle = t.border;
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, width - 1, height - 1, 18);
  ctx.stroke();

  const avatarImg = await loadAvatar(avatar);

  if (avatarImg) {
    circleImage(ctx, avatarImg, padding, padding, avatarSize);
  } else {
    ctx.fillStyle = "#1d9bf0";
    ctx.beginPath();
    ctx.arc(
      padding + avatarSize / 2,
      padding + avatarSize / 2,
      avatarSize / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      String(name).charAt(0).toUpperCase(),
      padding + avatarSize / 2,
      padding + avatarSize / 2
    );
  }

  const userX = padding + avatarSize + 12;

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  ctx.fillStyle = t.text;
  ctx.font = "bold 17px Arial";
  ctx.fillText(name, userX, padding + 2);

  const nameWidth = ctx.measureText(name).width;

  if (verified) {
    ctx.fillStyle = "#1d9bf0";
    ctx.beginPath();
    ctx.arc(userX + nameWidth + 14, padding + 11, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✓", userX + nameWidth + 14, padding + 11);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = t.sub;
  ctx.font = "15px Arial";
  ctx.fillText(`@${String(username).replace(/^@/, "")}`, userX, padding + 25);

  let y = padding + avatarSize + 18;

  ctx.fillStyle = t.text;
  ctx.font = "23px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  for (const line of tweetLines) {
    ctx.fillText(line, padding, y);
    y += 32;
  }

  y += 14;

  ctx.fillStyle = t.sub;
  ctx.font = "15px Arial";
  ctx.fillText(`${time} · ${date} · ${client}`, padding, y);

  y += 38;

  ctx.strokeStyle = t.border;
  ctx.beginPath();
  ctx.moveTo(padding, y - 16);
  ctx.lineTo(width - padding, y - 16);
  ctx.stroke();

  ctx.font = "15px Arial";

  ctx.fillStyle = t.text;
  ctx.font = "bold 15px Arial";
  ctx.fillText(abbrNumber(retweets), padding, y);

  ctx.fillStyle = t.sub;
  ctx.font = "15px Arial";
  ctx.fillText(" Retweets", padding + ctx.measureText(abbrNumber(retweets)).width + 4, y);

  ctx.fillStyle = t.text;
  ctx.font = "bold 15px Arial";
  ctx.fillText(abbrNumber(quotes), padding + 150, y);

  ctx.fillStyle = t.sub;
  ctx.font = "15px Arial";
  ctx.fillText(" Quotes", padding + 150 + ctx.measureText(abbrNumber(quotes)).width + 4, y);

  ctx.fillStyle = t.text;
  ctx.font = "bold 15px Arial";
  ctx.fillText(abbrNumber(likes), padding + 270, y);

  ctx.fillStyle = t.sub;
  ctx.font = "15px Arial";
  ctx.fillText(" Likes", padding + 270 + ctx.measureText(abbrNumber(likes)).width + 4, y);

  return await canvas.toBuffer("png");
}
