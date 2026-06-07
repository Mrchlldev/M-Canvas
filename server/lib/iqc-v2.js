import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts, loadImage } = require("@napi-rs/canvas");
const EmojiDbLib = require("emoji-db");

const emojiDb = new EmojiDbLib({ useDefaultDb: true });

const EMOJI_URLS = {
    apple: "https://raw.githubusercontent.com/SaurusAraAra/mentahan/refs/heads/main/lainnya/emoji-apple-image.json",
    blob: "https://raw.githubusercontent.com/SaurusAraAra/mentahan/refs/heads/main/lainnya/emoji-blob-image.json",
    google: "https://raw.githubusercontent.com/SaurusAraAra/mentahan/refs/heads/main/lainnya/emoji-google-image.json",
    joypixels: "https://raw.githubusercontent.com/SaurusAraAra/mentahan/refs/heads/main/lainnya/emoji-joypixels-image.json",
    twitter: "https://raw.githubusercontent.com/SaurusAraAra/mentahan/refs/heads/main/lainnya/emoji-twitter-image.json"
};

const BG_URL = "https://raw.githubusercontent.com/SaurusAraAra/mentahan/main/images/background-iqc.png";
const FONT_URL = "https://raw.githubusercontent.com/SaurusAraAra/mentahan/main/font/SFPRODISPLAYREGULAR.otf";

const TMP_DIR = path.join(os.tmpdir(), "mcanvas-iqc-v2");
const FONT_PATH = path.join(TMP_DIR, "SFPRODISPLAYREGULAR.otf");
const BG_PATH = path.join(TMP_DIR, "background-iqc.png");

const emojiJsonCache = new Map();
let fontRegistered = false;
let bgBuffer = null;

async function downloadBuffer(url) {
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`Gagal download asset: ${res.status} ${res.statusText}`);
    }

    return Buffer.from(await res.arrayBuffer());
}

async function getCachedFile(url, filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        return fs.readFileSync(filePath);
    }

    const buffer = await downloadBuffer(url);
    fs.writeFileSync(filePath, buffer);

    return buffer;
}

async function getEmojiJson(brand) {
    const key = EMOJI_URLS[brand] ? brand : "apple";

    if (emojiJsonCache.has(key)) {
        return emojiJsonCache.get(key);
    }

    const res = await fetch(EMOJI_URLS[key]);

    if (!res.ok) {
        throw new Error(`Gagal download emoji ${key}: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    emojiJsonCache.set(key, json);

    return json;
}

async function prepareAssets() {
    if (!fontRegistered) {
        const fontBuffer = await getCachedFile(FONT_URL, FONT_PATH);
        GlobalFonts.register(fontBuffer, "SFPRODISPLAYREGULAR");
        fontRegistered = true;
    }

    if (!bgBuffer) {
        bgBuffer = await getCachedFile(BG_URL, BG_PATH);
    }
}

function getTimeByTimezone(timezone = "Asia/Makassar") {
    return new Intl.DateTimeFormat("id-ID", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    })
        .format(new Date())
        .replace(".", ":");
}

function toBool(value, fallback = true) {
    if (value === undefined || value === null || value === "") return fallback;

    return String(value).toLowerCase() !== "false";
}

function getSegments(txt, ems) {
    const segs = [];
    const sorted = [...ems].sort((a, b) => a.offset - b.offset);
    let cur = 0;

    for (const e of sorted) {
        if (cur < e.offset) {
            for (const ch of txt.substring(cur, e.offset)) {
                segs.push({ type: "text", value: ch });
            }
        }

        segs.push({ type: "emoji", value: e.found, code: e.found });
        cur = e.offset + e.length;
    }

    if (cur < txt.length) {
        for (const ch of txt.substring(cur)) {
            segs.push({ type: "text", value: ch });
        }
    }

    return segs;
}

function roundedRect(ctx, x, y, w, h, r) {
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

function drawBattery(ctx, x, y, pct) {
    const lv = Math.min(100, Math.max(0, parseInt(pct, 10) || 0));
    const bW = 40;
    const bH = 24;
    const bR = 3.5;

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    roundedRect(ctx, x - bW, y - bH / 2, bW, bH, bR);
    ctx.stroke();

    const tW = 3.5;
    const tH = 13;
    const tR = 1.75;
    ctx.fillStyle = "#ffffff";
    roundedRect(ctx, x, y - tH / 2, tW, tH, tR);
    ctx.fill();

    const fm = 3.5;
    const fW = (bW - fm * 2) * lv / 100;
    const fH = bH - fm * 2;
    ctx.fillStyle = lv <= 20 ? "#ff3b30" : "#ffffff";
    roundedRect(ctx, x - bW + fm, y - fH / 2, fW, fH, 2);
    ctx.fill();

    ctx.font = "bold 14px SFPRODISPLAYREGULAR";
    ctx.fillStyle = lv <= 20 ? "#ffffff" : "#000000";
    ctx.textAlign = "center";
    ctx.fillText(String(lv), x - bW / 2, y + 4);
    ctx.textAlign = "right";
}

function drawWifi(ctx, x, y) {
    ctx.save();
    ctx.translate(x - 32, y - 22);
    ctx.scale(1.3, 1.3);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(1.5, 9);
    ctx.bezierCurveTo(1.5, 9, 5.5, 4.5, 12, 4.5);
    ctx.bezierCurveTo(18.5, 4.5, 22.5, 9, 22.5, 9);
    ctx.lineTo(19.5, 11.5);
    ctx.bezierCurveTo(19.5, 11.5, 16, 8.2, 12, 8.2);
    ctx.bezierCurveTo(8, 8.2, 4.5, 11.5, 4.5, 11.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5.5, 13);
    ctx.bezierCurveTo(5.5, 13, 8.5, 10.5, 12, 10.5);
    ctx.bezierCurveTo(15.5, 10.5, 18.5, 13, 18.5, 13);
    ctx.lineTo(16, 15);
    ctx.bezierCurveTo(16, 15, 13.5, 13.5, 12, 13.5);
    ctx.bezierCurveTo(10.5, 13.5, 8, 15, 8, 15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, 16.5);
    ctx.quadraticCurveTo(10, 16, 12, 16);
    ctx.quadraticCurveTo(14, 16, 15, 16.5);
    ctx.lineTo(12.3, 19.7);
    ctx.quadraticCurveTo(12, 20, 12, 20);
    ctx.quadraticCurveTo(12, 20, 11.7, 19.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawOperator(ctx, x, y) {
    const bars = [7, 11, 16, 21];
    const bW = 3.5;
    const bS = 5.5;
    const r = 1.5;
    const sx = x - 25;
    const sy = y - 16;

    ctx.fillStyle = "#ffffff";

    for (let i = 0; i < 4; i++) {
        const bH = bars[i];
        const bx = sx + i * bS;
        const by = sy + (21 - bH);

        ctx.beginPath();
        ctx.moveTo(bx, sy + 21);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
        ctx.lineTo(bx + bW - r, by);
        ctx.quadraticCurveTo(bx + bW, by, bx + bW, by + r);
        ctx.lineTo(bx + bW, sy + 21);
        ctx.closePath();
        ctx.fill();
    }
}

function drawStar(ctx, x, y) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "miter";
    ctx.beginPath();

    for (let i = 0; i < 5; i++) {
        const o = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const inn = ((i * 2 + 1) * Math.PI) / 5 - Math.PI / 2;
        const ox = x + Math.cos(o) * 16;
        const oy = y + Math.sin(o) * 16;
        const ix = x + Math.cos(inn) * 7;
        const iy = y + Math.sin(inn) * 7;

        i === 0 ? ctx.moveTo(ox, oy) : ctx.lineTo(ox, oy);
        ctx.lineTo(ix, iy);
    }

    ctx.closePath();
    ctx.stroke();
}

function drawReply(ctx, x, y) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const ox = x - 3;
    ctx.beginPath();
    ctx.moveTo(ox, y - 6);
    ctx.lineTo(ox, y - 13);
    ctx.lineTo(ox - 13, y);
    ctx.lineTo(ox, y + 13);
    ctx.lineTo(ox, y + 6);
    ctx.bezierCurveTo(ox + 9, y + 6, ox + 16, y + 9, ox + 20, y + 16);
    ctx.bezierCurveTo(ox + 18, y + 7, ox + 14, y - 2, ox, y - 6);
    ctx.stroke();
}

function drawForward(ctx, x, y) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const ox = x + 3;
    ctx.beginPath();
    ctx.moveTo(ox, y - 6);
    ctx.lineTo(ox, y - 13);
    ctx.lineTo(ox + 13, y);
    ctx.lineTo(ox, y + 13);
    ctx.lineTo(ox, y + 6);
    ctx.bezierCurveTo(ox - 9, y + 6, ox - 16, y + 9, ox - 20, y + 16);
    ctx.bezierCurveTo(ox - 18, y + 7, ox - 14, y - 2, ox, y - 6);
    ctx.stroke();
}

function drawCopy(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const sc = 0.23;
    const cx2 = -127;
    const cy2 = -105;
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    ctx.beginPath();
    ctx.moveTo(cx2 + 164, cy2 + 156);
    ctx.bezierCurveTo(cx2 + 164, cy2 + 164, cx2 + 158, cy2 + 170, cx2 + 150, cy2 + 170);
    ctx.lineTo(cx2 + 74, cy2 + 170);
    ctx.bezierCurveTo(cx2 + 66, cy2 + 170, cx2 + 60, cy2 + 164, cx2 + 60, cy2 + 156);
    ctx.lineTo(cx2 + 60, cy2 + 80);
    ctx.bezierCurveTo(cx2 + 60, cy2 + 72, cx2 + 66, cy2 + 66, cx2 + 74, cy2 + 66);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx2 + 90, cy2 + 54);
    ctx.bezierCurveTo(cx2 + 90, cy2 + 46, cx2 + 96, cy2 + 40, cx2 + 104, cy2 + 40);
    ctx.lineTo(cx2 + 180, cy2 + 40);
    ctx.bezierCurveTo(cx2 + 188, cy2 + 40, cx2 + 194, cy2 + 46, cx2 + 194, cy2 + 54);
    ctx.lineTo(cx2 + 194, cy2 + 130);
    ctx.bezierCurveTo(cx2 + 194, cy2 + 138, cx2 + 188, cy2 + 144, cx2 + 180, cy2 + 144);
    ctx.lineTo(cx2 + 104, cy2 + 144);
    ctx.bezierCurveTo(cx2 + 96, cy2 + 144, cx2 + 90, cy2 + 138, cx2 + 90, cy2 + 130);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
}

function drawComment(ctx, x, y) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const w = 30;
    const h = 22;
    const r = 4;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + r, y - h / 2);
    ctx.lineTo(x + w / 2 - r, y - h / 2);
    ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
    ctx.lineTo(x + w / 2, y + h / 2 - r);
    ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
    ctx.lineTo(x - w / 2 + 8, y + h / 2);
    ctx.lineTo(x - w / 2 + 3, y + h / 2 + 6);
    ctx.lineTo(x - w / 2 + 4, y + h / 2);
    ctx.lineTo(x - w / 2 + r, y + h / 2);
    ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
    ctx.lineTo(x - w / 2, y - h / 2 + r);
    ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    [-6, 0, 6].forEach(d => {
        ctx.beginPath();
        ctx.arc(x + d, y, 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawReport(ctx, x, y) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x - 15, y + 12);
    ctx.lineTo(x + 15, y + 12);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 1, y - 5, 2, 11);
    ctx.beginPath();
    ctx.arc(x, y + 8, 1.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawTrash(ctx, x, y) {
    ctx.strokeStyle = "#ff3b30";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 13);
    ctx.lineTo(x + 15, y - 13);
    ctx.stroke();
    ctx.strokeRect(x - 8, y - 18, 16, 5);
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 11);
    ctx.lineTo(x - 9, y + 13);
    ctx.lineTo(x + 9, y + 13);
    ctx.lineTo(x + 12, y - 11);
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x, y + 11);
    ctx.moveTo(x - 7, y - 5);
    ctx.lineTo(x - 5, y + 11);
    ctx.moveTo(x + 7, y - 5);
    ctx.lineTo(x + 5, y + 11);
    ctx.stroke();
}

async function createEmojiCache(txt, brand) {
    const emojiPrimary = await getEmojiJson(brand);
    const emojiApple = brand !== "apple" ? await getEmojiJson("apple") : null;
    const emojis = emojiDb.searchFromText({ input: txt, fixCodePoints: true });
    const emojiCache = new Map();

    await Promise.all(emojis.map(async emoji => {
        if (emojiCache.has(emoji.found)) return;

        try {
            const b64 = emojiPrimary[emoji.found] || (emojiApple && emojiApple[emoji.found]);

            if (b64) {
                const img = await loadImage(Buffer.from(b64, "base64"));
                emojiCache.set(emoji.found, img);
            }
        } catch {}
    }));

    return { emojis, emojiCache };
}

export async function generateIQCV2({
    text,
    time,
    battery = "80",
    showBattery = true,
    operator = true,
    timebar = true,
    wifi = true,
    brand = "apple"
}) {
    const txt = String(text || "").trim();

    if (!txt) {
        throw new Error("Parameter text wajib diisi");
    }

    await prepareAssets();

    const selectedBrand = EMOJI_URLS[brand] ? brand : "apple";
    const displayTime = String(time || getTimeByTimezone()).trim();
    const { emojis, emojiCache } = await createEmojiCache(txt, selectedBrand);

    const W = 680;
    const H = 1100;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const bgImg = await loadImage(bgBuffer);
    const sc = 1.05;
    const sw = W * sc;
    const sh = H * sc;
    const ox = (W - sw) / 2;
    const oy = (H - sh) / 2;

    ctx.save();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.drawImage(bgImg, ox, oy, sw, sh);
    ctx.filter = "blur(6px)";
    ctx.drawImage(bgImg, ox, oy, sw, sh);
    ctx.filter = "none";
    ctx.restore();

    ctx.fillStyle = "rgba(13,13,13,0.7)";
    ctx.fillRect(0, 0, W, H);

    const sY = 30;
    let curX = W - 30;
    ctx.textAlign = "left";

    if (timebar) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px SFPRODISPLAYREGULAR";
        ctx.fillText(displayTime, 30, sY);
    }

    ctx.textAlign = "right";

    if (showBattery) {
        drawBattery(ctx, curX, sY - 7, battery);
        curX -= 48;
    }

    if (wifi) {
        drawWifi(ctx, curX, sY);
        curX -= 35;
    }

    if (operator) {
        drawOperator(ctx, curX, sY);
        curX -= 35;
    }

    ctx.textAlign = "left";

    const FONT_SIZE = 24;
    const MAX_W = 540;
    const MIN_W = 100;
    const PAD = 40;
    const LH = 32;
    ctx.font = `${FONT_SIZE}px SFPRODISPLAYREGULAR`;

    const segs = getSegments(txt, emojis);
    const mSeg = s => s.type === "emoji" ? FONT_SIZE * 1.22 : ctx.measureText(s.value).width;
    const lines = [];
    let curLine = [];
    let curW = 0;
    let curWord = [];
    let curWW = 0;

    for (const seg of segs) {
        const segW = mSeg(seg);

        if (seg.type === "text" && (seg.value === " " || seg.value === "\n")) {
            if (curW + curWW > MAX_W - PAD) {
                if (curLine.length) lines.push(curLine);
                curLine = [...curWord];
                curW = curWW;
            } else {
                curLine.push(...curWord);
                curW += curWW;
            }

            curWord = [];
            curWW = 0;

            if (seg.value === " " && curW + segW <= MAX_W - PAD) {
                curLine.push(seg);
                curW += segW;
            }

            if (seg.value === "\n") {
                lines.push(curLine);
                curLine = [];
                curW = 0;
            }
        } else {
            curWord.push(seg);
            curWW += segW;
        }
    }

    if (curWord.length) {
        if (curW + curWW > MAX_W - PAD) {
            if (curLine.length) lines.push(curLine);
            lines.push(curWord);
        } else {
            curLine.push(...curWord);
            if (curLine.length) lines.push(curLine);
        }
    } else if (curLine.length) {
        lines.push(curLine);
    }

    let maxLW = 0;
    for (const line of lines) {
        let lw = 0;
        for (const s of line) lw += mSeg(s);
        maxLW = Math.max(maxLW, lw);
    }

    const bW2 = Math.max(MIN_W, Math.min(MAX_W, maxLW + PAD + 58));
    const bH = Math.max(60, lines.length * LH + 22);
    const bX = 22;
    const menuY = 430;
    const bY = menuY - bH - 20;
    const bRadius = 26;

    ctx.fillStyle = "#3a3a3a";
    roundedRect(ctx, bX, bY, bW2, bH, bRadius);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = `${FONT_SIZE}px SFPRODISPLAYREGULAR`;
    let ty = bY + 34;

    for (const line of lines) {
        let tx = bX + 24;

        for (const seg of line) {
            if (seg.type === "emoji") {
                const img = emojiCache.get(seg.code);

                if (img) {
                    ctx.drawImage(img, tx, ty - FONT_SIZE + FONT_SIZE * 0.15, FONT_SIZE * 1.22, FONT_SIZE * 1.22);
                }

                tx += FONT_SIZE * 1.22;
            } else {
                ctx.fillStyle = "#ffffff";
                ctx.fillText(seg.value, tx, ty);
                tx += ctx.measureText(seg.value).width;
            }
        }

        ty += LH;
    }

    ctx.fillStyle = "#999999";
    ctx.font = "18px SFPRODISPLAYREGULAR";
    ctx.textAlign = "right";
    ctx.fillText(displayTime, bX + bW2 - 14, bY + bH - 8);
    ctx.textAlign = "left";

    const mX = 20;
    const mW = 490;
    const mH = 560;
    const mR = 15;
    ctx.fillStyle = "#2a2a2a";
    roundedRect(ctx, mX, menuY, mW, mH, mR);
    ctx.fill();

    const items = [
        { text: "Beri Bintang", icon: drawStar },
        { text: "Balas", icon: drawReply },
        { text: "Teruskan", icon: drawForward },
        { text: "Salin", icon: drawCopy },
        { text: "Ucapkan", icon: drawComment },
        { text: "Laporkan", icon: drawReport },
        { text: "Hapus", icon: drawTrash, color: "#ff3b30" }
    ];

    items.forEach((item, i) => {
        const iy = menuY + i * 80;
        ctx.fillStyle = item.color || "#ffffff";
        ctx.font = "28px SFPRODISPLAYREGULAR";
        ctx.fillText(item.text, mX + 30, iy + 50);
        item.icon(ctx, mX + mW - 40, iy + 40);

        if (i < items.length - 1) {
            ctx.strokeStyle = "#3a3a3a";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(mX + 25, iy + 80);
            ctx.lineTo(mX + mW - 25, iy + 80);
            ctx.stroke();
        }
    });

    return canvas.toBuffer("image/png");
}

export function parseIQCV2Options(query) {
    return {
        text: String(query.text || query.q || "Halo namaku nanas 🤪").trim(),
        time: String(query.time || "").trim(),
        battery: String(query.battery || query.baterai || "80").trim(),
        showBattery: toBool(query.showBattery ?? query.batteryIcon ?? query.showBaterai, true),
        operator: toBool(query.operator, true),
        timebar: toBool(query.timebar, true),
        wifi: toBool(query.wifi, true),
        brand: String(query.brand || "apple").toLowerCase().trim()
    };
}
