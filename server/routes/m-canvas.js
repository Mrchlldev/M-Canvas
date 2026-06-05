import express from "express";
import { bratGen } from "brat-canvas";
import { bratVid } from "brat-canvas/video";
import { generateIQC } from "iqc-canvas";
import { createRequire } from "module";
import fs from "fs/promises";
import path from "path";

import { generateFakeTweet } from "../lib/fake-tweet.js";
import { generateNokiaQuote } from "../lib/nokia-quote.js";

const require = createRequire(import.meta.url);
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fakeFFModule = require("fake-ff");
const fakeMLModule = require("fake-ml");
const generateFF = fakeFFModule.default || fakeFFModule;
const generateMLCard = fakeMLModule.default || fakeMLModule;

const router = express.Router();

const CANVAS = {
  width: 1254,
  height: 1254
};

const TEXT_STYLE = {
  fontFamily: "Poppins",
  maxFontSize: 90,
  minFontSize: 22,
  lineHeight: 1.18,
  color: "#111111",
  align: "center"
};

const BRAT_FONT_URL =
  "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Poppins.ttf";

const BRAT_TEMPLATES = {
  zeejkt48: {
    type: "zeejkt48-brat-image",
    filename: "brat-zeejkt48.png",
    imageUrl:
      "https://c.termai.cc/i119/uPny.jpg",
    safeZone: {
      a: 655,
      b: 1118,
      c: 282,
      d: 993
    }
  },
  goyounjung: {
    type: "goyounjung-brat-image",
    filename: "brat-goyounjung.png",
    imageUrl:
      "https://c.termai.cc/i193/ga61t.jpg",
    safeZone: {
      a: 655,
      b: 1118,
      c: 282,
      d: 993
    }
  },
  wasawho: {
    type: "wasawho-brat-image",
    filename: "brat-wasawho.png",
    imageUrl:
      "https://raw.githubusercontent.com/Mrchlldev/Mrchllaja/refs/heads/main/brat/New%20Project%2062%20%5B574BAEE%5D.png",
    safeZone: {
      a: 655,
      b: 1118,
      c: 282,
      d: 993
    }
  },
  freyajkt48: {
    type: "freyajkt48-brat-image",
    filename: "brat-freyajkt48.png",
    imageUrl: "https://c.termai.cc/i119/vIxK.jpg",
    safeZone: {
      a: 655,
      b: 1118,
      c: 282,
      d: 993
    }
  },
  vermeil: {
    type: "vermile-brat-image",
    filename: "brat-vermeil.png",
    imageUrl:
      "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Vermile.jpg",
    safeZone: {
      a: 655,
      b: 1118,
      c: 282,
      d: 993
    }
  },
  gojo: {
    type: "gojo-brat-image",
    filename: "brat-gojo.png",
    imageUrl:
      "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Gojo.jpeg",
    safeZone: {
      a: 660,
      b: 1180,
      c: 270,
      d: 990
    }
  }
};

let fontRegistered = false;

async function downloadBuffer(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Gagal download: ${res.status} ${res.statusText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getSafeRect(zone) {
  return {
    x: zone.c,
    y: zone.a,
    w: zone.d - zone.c,
    h: zone.b - zone.a,
    centerX: (zone.c + zone.d) / 2,
    centerY: (zone.a + zone.b) / 2
  };
}

function setFont(ctx, size) {
  ctx.font = `${size}px ${TEXT_STYLE.fontFamily}`;
}


async function readGeneratedImage(filePath) {
  if (!filePath) {
    throw new Error("Path hasil gambar tidak ditemukan");
  }

  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  return await fs.readFile(resolvedPath);
}

function parsePositiveNumber(value, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return Math.floor(number);
}

function getCurrentDate() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, "0"),
    String(now.getMonth() + 1).padStart(2, "0"),
    now.getFullYear()
  ].join("/");
}

function getCurrentTime() {
  const now = new Date();
  return [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0")
  ].join(":");
}

function splitLongWord(ctx, word, maxWidth) {
  const chars = [...word];
  const parts = [];
  let current = "";

  for (const char of chars) {
    const test = current + char;

    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
    } else {
      parts.push(current);
      current = char;
    }
  }

  if (current) parts.push(current);

  return parts;
}

function wrapParagraph(ctx, paragraph, maxWidth) {
  const words = paragraph.split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;

    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
    } else {
      const parts = splitLongWord(ctx, word, maxWidth);
      lines.push(...parts.slice(0, -1));
      current = parts.at(-1) || "";
    }
  }

  if (current) lines.push(current);

  return lines;
}

function wrapText(ctx, text, maxWidth) {
  return text.split("\n").flatMap((paragraph) => {
    const clean = paragraph.trim();

    if (!clean) return [""];

    return wrapParagraph(ctx, clean, maxWidth);
  });
}

function fitText(ctx, text, rect) {
  for (
    let size = TEXT_STYLE.maxFontSize;
    size >= TEXT_STYLE.minFontSize;
    size--
  ) {
    setFont(ctx, size);

    const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
    const lines = wrapText(ctx, text, rect.w);
    const totalHeight = lines.length * lineHeight;

    if (totalHeight <= rect.h) {
      return {
        size,
        lines,
        lineHeight,
        totalHeight
      };
    }
  }

  const size = TEXT_STYLE.minFontSize;
  setFont(ctx, size);

  const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
  const lines = wrapText(ctx, text, rect.w);
  const maxLines = Math.max(1, Math.floor(rect.h / lineHeight));
  const clipped = lines.slice(0, maxLines);

  if (lines.length > maxLines && clipped.length) {
    let last = clipped[clipped.length - 1];

    while (last.length > 0 && ctx.measureText(`${last}...`).width > rect.w) {
      last = last.slice(0, -1);
    }

    clipped[clipped.length - 1] = `${last}...`;
  }

  return {
    size,
    lines: clipped,
    lineHeight,
    totalHeight: clipped.length * lineHeight
  };
}

function drawCenteredText(ctx, text, zone) {
  const rect = getSafeRect(zone);
  const fitted = fitText(ctx, text, rect);
  const startY = rect.y + (rect.h - fitted.totalHeight) / 2;

  ctx.save();

  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  setFont(ctx, fitted.size);
  ctx.fillStyle = TEXT_STYLE.color;
  ctx.textAlign = TEXT_STYLE.align;
  ctx.textBaseline = "top";

  fitted.lines.forEach((line, index) => {
    const y = startY + index * fitted.lineHeight;
    ctx.fillText(line, rect.centerX, y);
  });

  ctx.restore();
}

async function registerBratFont() {
  if (fontRegistered) return;

  const fontBuffer = await downloadBuffer(BRAT_FONT_URL);
  GlobalFonts.register(fontBuffer, TEXT_STYLE.fontFamily);

  fontRegistered = true;
}

async function createCustomBrat(text, templateKey) {
  const template = BRAT_TEMPLATES[templateKey];

  if (!template) {
    throw new Error("Template brat tidak ditemukan");
  }

  await registerBratFont();

  const imageBuffer = await downloadBuffer(template.imageUrl);
  const image = await loadImage(imageBuffer);

  const canvas = createCanvas(CANVAS.width, CANVAS.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(image, 0, 0, CANVAS.width, CANVAS.height);
  drawCenteredText(ctx, text, template.safeZone);

  return {
    buffer: await canvas.encode("png"),
    mimeType: "image/png",
    filename: template.filename,
    type: template.type
  };
}

router.get("/", (req, res) => {
  res.json({
    status: true,
    name: "M-Canvas API",
    endpoints: [
      {
        name: "Brat Image",
        method: "GET",
        path: "/api/m-canvas/brat",
        query: {
          text: "string"
        }
      },
      {
        name: "Brat Video",
        method: "GET",
        path: "/api/m-canvas/brat-video",
        query: {
          text: "string"
        }
      },
      {
        name: "Brat Vermeil",
        method: "GET",
        path: "/api/m-canvas/brat-vermeil",
        query: {
          text: "string"
        }
      },
      {
        name: "Brat Gojo",
        method: "GET",
        path: "/api/m-canvas/brat-gojo",
        query: {
          text: "string"
        }
      },
      {
        name: "Brat Go Youn Jung",
        method: "GET",
        path: "/api/m-canvas/brat-goyounjung",
        query: {
          text: "string"
        }
      },
      {
        name: "Brat Zee JKT48",
        method: "GET",
        path: "/api/m-canvas/brat-zeejkt48",
        query: {
          text: "string"
        }
      },
      {
        name: "IQC Canvas",
        method: "GET",
        path: "/api/m-canvas/iqc",
        query: {
          text: "string",
          time: "string",
          battery: "string",
          charging: "true/false",
          operator: "true/false",
          timebar: "true/false",
          wifi: "true/false"
        }
      },
      {
        name: "Fake FF",
        method: "GET",
        path: "/api/m-canvas/fake-ff",
        query: {
          username: "string",
          lobby: "number optional"
        }
      },
      {
        name: "Fake ML",
        method: "GET",
        path: "/api/m-canvas/fake-ml",
        query: {
          avatar: "string",
          username: "string",
          rank: "string",
          border: "number"
        }
      }
    ]
  });
});

router.get("/brat", async (req, res) => {
  try {
    const text = normalizeText(req.query.text || "Hello World");

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text wajib diisi"
      });
    }

    const buffer = await bratGen(text);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="brat.png"');

    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate Brat Image"
    });
  }
});

router.get("/brat-video", async (req, res) => {
  try {
    const text = normalizeText(req.query.text || "Hello World");

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text wajib diisi"
      });
    }

    const buffer = await bratVid(text, {
      outputFormat: "mp4"
    });

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", 'inline; filename="brat-video.mp4"');

    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate Brat Video"
    });
  }
});

router.get("/brat-wasawho", async (req, res) => {
  try {
    const text = normalizeText(req.query.text || "Halo semuanya");

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text wajib diisi"
      });
    }

    const result = await createCustomBrat(text, "wasawho");

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.filename}"`
    );

    return res.send(result.buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate Brat Wasawho"
    });
  }
});

router.get("/brat-goyounjung", async (req, res) => {
  try {
    const text = normalizeText(req.query.text || "Halo semuanya");

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text wajib diisi"
      });
    }

    const result = await createCustomBrat(text, "goyounjung");

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.filename}"`
    );

    return res.send(result.buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate Brat Go Youn Jung"
    });
  }
});

router.get("/brat-freyajkt48", async (req, res) => {
  try {
    const text = normalizeText(req.query.text || "Halo semuanya");

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text wajib diisi"
      });
    }

    const result = await createCustomBrat(text, "freyajkt48");

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.filename}"`
    );

    return res.send(result.buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate Brat Freya JKT48"
    });
  }
});

router.get("/brat-zeejkt48", async (req, res) => {
  try {
    const text = normalizeText(req.query.text || "Halo semuanya");

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text wajib diisi"
      });
    }

    const result = await createCustomBrat(text, "zeejkt48");

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.filename}"`
    );

    return res.send(result.buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate Brat Zee JKT48"
    });
  }
});

router.get("/brat-vermeil", async (req, res) => {
  try {
    const text = normalizeText(req.query.text || "Halo semuanya");

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text wajib diisi"
      });
    }

    const result = await createCustomBrat(text, "vermeil");

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.filename}"`
    );

    return res.send(result.buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate Brat Vermeil"
    });
  }
});

router.get("/brat-gojo", async (req, res) => {
  try {
    const text = normalizeText(req.query.text || "Halo cuy");

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text wajib diisi"
      });
    }

    const result = await createCustomBrat(text, "gojo");

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.filename}"`
    );

    return res.send(result.buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate Brat Gojo"
    });
  }
});

router.get("/iqc", async (req, res) => {
  try {
    const text = normalizeText(req.query.text || "Hello World");
    const time = String(req.query.time || "00.00").trim();

    const battery = String(req.query.battery || "100").trim();

    const charging = String(req.query.charging || "false") === "true";
    const operator = String(req.query.operator || "true") !== "false";
    const timebar = String(req.query.timebar || "true") !== "false";
    const wifi = String(req.query.wifi || "true") !== "false";

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text wajib diisi"
      });
    }

    const result = await generateIQC(text, time, {
      baterai: [charging, battery],
      operator,
      timebar,
      wifi
    });

    const imageBuffer = result?.image;

    if (!result?.success || !Buffer.isBuffer(imageBuffer)) {
      return res.status(500).json({
        status: false,
        message: "Gagal mengambil buffer gambar IQC",
        result: {
          success: result?.success || false,
          mimeType: result?.mimeType || null,
          message: result?.message || null
        }
      });
    }

    res.setHeader("Content-Type", result.mimeType || "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="iqc.png"');

    return res.send(imageBuffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate IQC Canvas"
    });
  }
});

router.get("/nokia-quote", async (req, res) => {
  try {
    const header = String(
      req.query.header || "Ditzzx"
    ).trim();

    const text = String(
      req.query.text || "Halo Dunia"
    ).trim();

    const sender = String(
      req.query.sender || "Anonymous"
    ).trim();

    const date = String(
      req.query.date || getCurrentDate()
    ).trim();

    const time = String(
      req.query.time || getCurrentTime()
    ).trim();

    const buffer = await generateNokiaQuote({
      header,
      text,
      sender,
      date,
      time
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="nokia-quote.png"'
    );

    return res.send(buffer);

  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message
    });
  }
});
router.get("/fake-tweet", async (req, res) => {
  try {
    const buffer = await generateFakeTweet({
      name: req.query.name || "Marcel",
      username: req.query.username || "mrchlldev",
      text: req.query.text || "Halo Dunia",
      avatar: req.query.avatar || "",
      verified: String(req.query.verified || "true") !== "false",
      theme: req.query.theme || "light",
      retweets: Number(req.query.retweets || 0),
      quotes: Number(req.query.quotes || 0),
      likes: Number(req.query.likes || 0),
      time: req.query.time || "10:30 AM",
      date: req.query.date || "May 31, 2026",
      client: req.query.client || "Twitter for Android"
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="fake-tweet.png"');

    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message
    });
  }
});

router.get("/fake-ff", async (req, res) => {
  try {
    const username = String(req.query.username || "Ditzzx").trim();
    const lobbyQuery = req.query.lobby;

    if (!username) {
      return res.status(400).json({
        status: false,
        message: "Parameter username wajib diisi"
      });
    }

    const options = {
      username
    };

    if (lobbyQuery !== undefined && String(lobbyQuery).trim() !== "") {
      options.lobby = parsePositiveNumber(lobbyQuery, 1);
    }

    const result = await generateFF(options);

    if (result?.status && result.status !== "success") {
      return res.status(result?.code || 500).json({
        status: false,
        message: result?.message || "Gagal generate Fake FF"
      });
    }

    const buffer = await readGeneratedImage(result?.result);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="fake-ff.png"');

    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate Fake FF"
    });
  }
});

router.get("/fake-ml", async (req, res) => {
  try {
    const avatar = String(req.query.avatar || "").trim();
    const username = String(req.query.username || "Ditzzx").trim();
    const rank = String(req.query.rank || "imo").trim();
    const border = parsePositiveNumber(req.query.border || 1, 1);

    if (!avatar) {
      return res.status(400).json({
        status: false,
        message: "Parameter avatar wajib diisi"
      });
    }

    if (!username) {
      return res.status(400).json({
        status: false,
        message: "Parameter username wajib diisi"
      });
    }

    const result = await generateMLCard({
      avatar,
      username,
      rank,
      border
    });

    if (result?.status && result.status !== "success") {
      return res.status(result?.code || 500).json({
        status: false,
        message: result?.message || "Gagal generate Fake ML"
      });
    }

    const buffer = await readGeneratedImage(result?.result);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="fake-ml.png"');

    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate Fake ML"
    });
  }
});

export default router;
