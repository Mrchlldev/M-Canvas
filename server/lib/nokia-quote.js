import { Canvas, loadImage, FontLibrary } from "skia-canvas";
import fs from "fs";
import path from "path";
import os from "os";

const WIDTH = 1086;
const HEIGHT = 1448;

const BG_URL =
  "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Image/file_00000000a9f47208a295c9c984f92b7a.jpeg";

const FONT_URL =
  "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Font/nokia-6000-series-medium.ttf";

let assetsReady = false;
let bgPath = "";

async function download(url, dest) {
  if (fs.existsSync(dest)) return;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed download: ${url}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  fs.writeFileSync(dest, buffer);
}

async function prepareAssets() {
  if (assetsReady) return;

  const dir = path.join(os.tmpdir(), "mcanvas-nokia");

  fs.mkdirSync(dir, {
    recursive: true
  });

  bgPath = path.join(dir, "bg.jpg");

  const fontPath = path.join(dir, "nokia.ttf");

  await download(BG_URL, bgPath);
  await download(FONT_URL, fontPath);

  FontLibrary.use("FontHeader", fontPath);
  FontLibrary.use("FontPesan", fontPath);
  FontLibrary.use("FontInfo", fontPath);

  assetsReady = true;
}

function wrapLine(ctx, text, maxWidth, fontSize, fontName) {
  ctx.font = `${fontSize}px ${fontName}`;

  const words = text.split(" ");

  const wrapped = [];

  let current = "";

  for (const word of words) {
    const test = current
      ? `${current} ${word}`
      : word;

    if (
      ctx.measureText(test).width > maxWidth &&
      current
    ) {
      wrapped.push(current);
      current = word;
    } else {
      current = test;
    }
  }

  if (current) {
    wrapped.push(current);
  }

  return wrapped;
}

function drawText(
  ctx,
  text,
  x,
  y,
  fontName,
  fontSize,
  color
) {
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${fontName}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  ctx.fillText(text, x, y);
}

export async function generateNokiaQuote({
  header,
  text,
  sender,
  date,
  time
}) {
  await prepareAssets();

  const canvas = new Canvas(
    WIDTH,
    HEIGHT
  );

  const ctx = canvas.getContext("2d");

  const bg = await loadImage(bgPath);

  ctx.drawImage(
    bg,
    0,
    0,
    WIDTH,
    HEIGHT
  );

  /*
   * HEADER
   */

  ctx.fillStyle = "#E8F0F0";
  ctx.font = "130px FontHeader";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 4; i++) {
    ctx.fillText(
      header,
      543 + i,
      200
    );
  }

  /*
   * PESAN
   */

  const fontSize = 63;
  const lineHeight = 110;

  const wrappedLines = wrapLine(
    ctx,
    text,
    1020,
    fontSize,
    "FontPesan"
  );

  let currentY = 320;

  for (const line of wrappedLines) {
    drawText(
      ctx,
      line,
      60,
      currentY,
      "FontPesan",
      fontSize,
      "#000000"
    );

    currentY += lineHeight;
  }

  /*
   * INFO
   */

  const infoY = 980;

  drawText(
    ctx,
    "Dari:",
    30,
    infoY,
    "FontInfo",
    48,
    "#000000"
  );

  drawText(
    ctx,
    sender,
    30,
    infoY + 80,
    "FontInfo",
    48,
    "#000000"
  );

  drawText(
    ctx,
    date,
    30,
    infoY + 160,
    "FontInfo",
    48,
    "#000000"
  );

  drawText(
    ctx,
    time,
    30,
    infoY + 240,
    "FontInfo",
    48,
    "#000000"
  );

  return await canvas.toBuffer("png");
}
