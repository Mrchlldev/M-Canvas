import { createRequire } from "module";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";

const require = createRequire(import.meta.url);
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const ASSETS_DIR = path.join(os.tmpdir(), "mcanvas-rinchat");
const FONTS_DIR = path.join(ASSETS_DIR, "fonts");
const BG_DIR = path.join(ASSETS_DIR, "backgrounds");
const EMOJI_DIR = path.join(ASSETS_DIR, "emoji");

const RIN_BG_URL = "https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/iqc-hytam.png";
const APPLE_EMOJI_JSON_URL = "https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json";

const RIN_FONTS = [
    {
        url: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
        file: "Inter-Regular.ttf",
        family: "InterRegular"
    }
];

const EMOJI_REGEX = /(\p{Emoji_Modifier_Base}\p{Emoji_Modifier}|\p{Emoji_Presentation}\uFE0F?|\p{Emoji}\uFE0F|[\u{1F1E0}-\u{1F1FF}]{2}|\p{Extended_Pictographic}\uFE0F?)/gu;

let assetsReady = false;
let bgPath = "";
let emojiMapPath = "";
let appleEmojiMap = null;

const emojiImageCache = new Map();

async function download(url, dest) {
    if (fs.existsSync(dest)) return;

    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0"
        },
        redirect: "follow"
    });

    if (!res.ok) {
        throw new Error(`Gagal download asset: ${res.status} ${res.statusText}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    fs.mkdirSync(path.dirname(dest), {
        recursive: true
    });

    fs.writeFileSync(dest, buffer);
}

async function downloadBuffer(url) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0"
        },
        redirect: "follow"
    });

    if (!res.ok) {
        throw new Error(`Gagal download image: ${res.status} ${res.statusText}`);
    }

    return Buffer.from(await res.arrayBuffer());
}

async function prepareAssets() {
    if (assetsReady) return;

    fs.mkdirSync(FONTS_DIR, {
        recursive: true
    });

    fs.mkdirSync(BG_DIR, {
        recursive: true
    });

    fs.mkdirSync(EMOJI_DIR, {
        recursive: true
    });

    bgPath = path.join(BG_DIR, "iqc-hytam.png");
    emojiMapPath = path.join(EMOJI_DIR, "emoji-apple-image.json");

    for (const font of RIN_FONTS) {
        const fontPath = path.join(FONTS_DIR, font.file);

        await download(font.url, fontPath);
        GlobalFonts.registerFromPath(fontPath, font.family);
    }

    await download(RIN_BG_URL, bgPath);
    await download(APPLE_EMOJI_JSON_URL, emojiMapPath);
    await loadAppleEmojiMap();

    assetsReady = true;
}

function emojiToUnicode(emoji) {
    return [...emoji]
        .map((char) => char.codePointAt(0).toString(16).padStart(4, "0"))
        .join("-");
}

async function loadAppleEmojiMap() {
    if (appleEmojiMap) return appleEmojiMap;

    if (!emojiMapPath) {
        emojiMapPath = path.join(EMOJI_DIR, "emoji-apple-image.json");
    }

    await download(APPLE_EMOJI_JSON_URL, emojiMapPath);
    const raw = await fsp.readFile(emojiMapPath, "utf-8");
    appleEmojiMap = JSON.parse(raw);

    return appleEmojiMap;
}

async function getEmojiImage(emoji) {
    if (emojiImageCache.has(emoji)) return emojiImageCache.get(emoji);

    const map = await loadAppleEmojiMap();
    const base = emojiToUnicode(emoji);
    const withoutFe0f = base.replace(/-fe0f/gi, "");
    const variants = [
        base,
        withoutFe0f,
        `${withoutFe0f}-fe0f`,
        base.toUpperCase(),
        withoutFe0f.toUpperCase(),
        `${withoutFe0f.toUpperCase()}-FE0F`
    ];

    let b64 = null;

    for (const variant of variants) {
        if (map[variant]) {
            b64 = map[variant];
            break;
        }
    }

    if (!b64) return null;

    const img = await loadImage(Buffer.from(b64, "base64"));
    emojiImageCache.set(emoji, img);

    return img;
}

async function drawAppleEmoji(ctx, emoji, x, y, size) {
    const img = await getEmojiImage(emoji);

    if (!img) {
        ctx.fillText(emoji, x, y);
        return;
    }

    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
}

function measureTextCustom(ctx, text, fontSize) {
    const parts = String(text || "").split(EMOJI_REGEX);
    let totalWidth = 0;

    for (const part of parts) {
        if (!part) continue;

        EMOJI_REGEX.lastIndex = 0;

        if (EMOJI_REGEX.test(part)) {
            totalWidth += fontSize * 1.05;
        } else {
            totalWidth += ctx.measureText(part).width;
        }

        EMOJI_REGEX.lastIndex = 0;
    }

    return totalWidth;
}

async function drawTextWithEmojis(ctx, text, x, y, fontSize) {
    const parts = String(text || "").split(EMOJI_REGEX);
    let currentX = x;

    for (const part of parts) {
        if (!part) continue;

        EMOJI_REGEX.lastIndex = 0;

        if (EMOJI_REGEX.test(part)) {
            const emojiSize = fontSize * 1.05;
            await drawAppleEmoji(ctx, part, currentX + emojiSize / 2, y, emojiSize);
            currentX += emojiSize;
        } else {
            ctx.fillText(part, currentX, y);
            currentX += ctx.measureText(part).width;
        }

        EMOJI_REGEX.lastIndex = 0;
    }
}

function wrapText(ctx, text, maxWidth, fontSize) {
    ctx.font = `${fontSize}px InterRegular`;

    const words = String(text || "").split(" ");
    const lines = [];
    let cur = "";

    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        if (word.includes("\n")) {
            const parts = word.split("\n");

            for (let j = 0; j < parts.length; j++) {
                const test = cur + (cur ? " " : "") + parts[j];

                if (measureTextCustom(ctx, test, fontSize) > maxWidth && cur) {
                    lines.push(cur);
                    cur = parts[j];
                } else {
                    cur = test;
                }

                if (j < parts.length - 1) {
                    lines.push(cur);
                    cur = "";
                }
            }

            continue;
        }

        const test = cur + (cur ? " " : "") + word;

        if (measureTextCustom(ctx, test, fontSize) > maxWidth && i > 0) {
            lines.push(cur);
            cur = word;
        } else {
            cur = test;
        }
    }

    if (cur) lines.push(cur);

    return lines;
}

function roundedBubble(ctx, x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x + 8, y + h, x + 8, y + h - 8);
    ctx.lineTo(x + 8, y + rad);
    ctx.quadraticCurveTo(x + 8, y, x + rad, y);
    ctx.closePath();
}

function bubbleTail(ctx, x, y, h) {
    ctx.beginPath();
    ctx.moveTo(x + 12, y + h - 20);
    ctx.quadraticCurveTo(x - 2, y + h - 4, x - 8, y + h);
    ctx.quadraticCurveTo(x + 6, y + h, x + 22, y + h - 2);
    ctx.closePath();
}

function normalizeText(text) {
    return String(text || "")
        .replace(/\r/g, "")
        .replace(/[\t ]+/g, " ")
        .replace(/\n{4,}/g, "\n\n\n")
        .trim();
}

function normalizeEmojis(value) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean).slice(0, 6);

    return String(value || "👍,❤️,😂,😮,😢,🙏")
        .split(/[|, ]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6);
}

export async function generateRinChat(options = {}) {
    await prepareAssets();

    const txt = normalizeText(options.text || "Earth without art is just \"eh\" 🌍🎨✨");
    const timeStr = String(options.time || "16.34").trim();
    const imgUrl = String(options.image || options.imgUrl || "").trim();
    const caption = imgUrl ? normalizeText(options.caption ?? txt) : "";
    const emojis = normalizeEmojis(options.emojis);

    const BG_W = 941;
    const BG_H = 1671;
    const canvas = createCanvas(BG_W, BG_H);
    const ctx = canvas.getContext("2d");
    const bgImg = await loadImage(bgPath);

    ctx.drawImage(bgImg, 0, 0, BG_W, BG_H);

    ctx.fillStyle = "#ffffff";
    ctx.font = "27px InterRegular";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(timeStr, 463, 8);

    const chatFontSize = 30;
    const maxWidthLimit = 530;
    const minBubbleWidth = 280;
    const lineHeight = chatFontSize + 14;
    const paddingX = 30;
    const paddingY = 20;
    const rad = 28;
    const fixedX = 35;
    const fixedBaseY = 946;

    ctx.font = "22px InterRegular";
    const timeWidth = ctx.measureText(timeStr).width;

    let finalY;
    let finalBubbleHeight;
    let bubbleW;

    if (!imgUrl) {
        ctx.font = `${chatFontSize}px InterRegular`;
        const chatLines = wrapText(ctx, txt, maxWidthLimit, chatFontSize);
        let longestW = 0;

        for (const line of chatLines) {
            longestW = Math.max(longestW, measureTextCustom(ctx, line.trim(), chatFontSize));
        }

        bubbleW = Math.max(longestW + paddingX * 2, timeWidth + 75, 180);
        finalBubbleHeight = chatLines.length * lineHeight + paddingY + 12 + 22;
        finalY = fixedBaseY - finalBubbleHeight;

        ctx.fillStyle = "#1c1c1e";
        roundedBubble(ctx, fixedX, finalY, bubbleW, finalBubbleHeight, rad);
        ctx.fill();
        bubbleTail(ctx, fixedX, finalY, finalBubbleHeight);
        ctx.fill();

        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.font = `${chatFontSize}px InterRegular`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        for (let i = 0; i < chatLines.length; i++) {
            const lineY = finalY + paddingY + i * lineHeight + chatFontSize / 2;
            await drawTextWithEmojis(ctx, chatLines[i].trim(), fixedX + paddingX, lineY, chatFontSize);
        }

        ctx.restore();

        ctx.fillStyle = "#727278";
        ctx.font = "22px InterRegular";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText(timeStr, fixedX + bubbleW - 22, finalY + finalBubbleHeight - 38);
    } else {
        const imgBuf = imgUrl.startsWith("http") ? await downloadBuffer(imgUrl) : await fsp.readFile(imgUrl);
        const imgObj = await loadImage(imgBuf);
        const imgAspect = imgObj.width / imgObj.height;

        bubbleW = Math.min(Math.max(imgObj.width, minBubbleWidth), maxWidthLimit);
        let imgDrawH = Math.round(bubbleW / imgAspect);
        bubbleW = Math.max(bubbleW, timeWidth + 75);

        let captionLines = [];

        if (caption) {
            ctx.font = `${chatFontSize}px InterRegular`;
            captionLines = wrapText(ctx, caption, bubbleW - paddingX * 2, chatFontSize);
        }

        const captionH = captionLines.length > 0 ? paddingY + captionLines.length * lineHeight : 0;
        const timeRowH = 28;
        finalBubbleHeight = imgDrawH + captionH + timeRowH + (captionLines.length > 0 ? 4 : 0);
        finalY = fixedBaseY - finalBubbleHeight;

        ctx.fillStyle = "#1c1c1e";
        roundedBubble(ctx, fixedX, finalY, bubbleW, finalBubbleHeight, rad);
        ctx.fill();
        bubbleTail(ctx, fixedX, finalY, finalBubbleHeight);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(fixedX + rad, finalY);
        ctx.lineTo(fixedX + bubbleW - rad, finalY);
        ctx.quadraticCurveTo(fixedX + bubbleW, finalY, fixedX + bubbleW, finalY + rad);
        ctx.lineTo(fixedX + bubbleW, finalY + imgDrawH);
        ctx.lineTo(fixedX + 8, finalY + imgDrawH);
        ctx.lineTo(fixedX + 8, finalY + rad);
        ctx.quadraticCurveTo(fixedX + 8, finalY, fixedX + rad, finalY);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(imgObj, fixedX, finalY, bubbleW, imgDrawH);
        ctx.restore();

        if (captionLines.length > 0) {
            ctx.save();
            ctx.fillStyle = "#ffffff";
            ctx.font = `${chatFontSize}px InterRegular`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";

            for (let i = 0; i < captionLines.length; i++) {
                const lineY = finalY + imgDrawH + paddingY + i * lineHeight + chatFontSize / 2;
                await drawTextWithEmojis(ctx, captionLines[i].trim(), fixedX + paddingX, lineY, chatFontSize);
            }

            ctx.restore();
        }

        ctx.fillStyle = "#727278";
        ctx.font = "22px InterRegular";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(timeStr, fixedX + bubbleW - 22, finalY + finalBubbleHeight - timeRowH);
    }

    const emojiSize = Math.round(54 * 1.03);
    const emCardH = emojiSize + Math.round(44 * 1.03);
    const emCardW = Math.round(530 * 1.03);
    const emCardX = fixedX + 8;
    const emCardY = finalY - emCardH - 18;

    ctx.fillStyle = "#1c1c1e";
    ctx.beginPath();
    ctx.roundRect(emCardX, emCardY, emCardW, emCardH, [emCardH / 2]);
    ctx.fill();

    const startX = emCardX + 55;
    const spacingX = 76;
    const emojiCY = emCardY + emCardH / 2 + 2;

    for (let i = 0; i < Math.min(emojis.length, 6); i++) {
        await drawAppleEmoji(ctx, emojis[i], startX + i * spacingX, emojiCY, emojiSize);
    }

    ctx.fillStyle = "#8e8e93";
    ctx.font = `${Math.round(36 * 1.03)}px InterRegular`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", startX + 6 * spacingX - 8, emCardY + emCardH / 2 - 2);

    return await canvas.encode("png");
}
