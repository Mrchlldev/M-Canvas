import { Canvas, loadImage, FontLibrary } from 'skia-canvas';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
    pos: {
        saldo: { x: 62,  y: 325 },
        koin:  { x: 115, y: 400 },
        pill:  { x: 50,  y: 510 },
    },
    fontSize: {
        rp: 34,
        saldo: 95,
        koin: 34,
        pill: 34,
    },
    icon: {
        eye:    { w: 60, h: 60 },
        report: { w: 30, h: 30 },
        next:   { w: 30, h: 30 },
    },
    pill: {
        height: 48,
        paddingLeft: 14,
        paddingRight: 14,
        gapIconText: 10,
        gapTextArrow: 16,
    },
    gap: {
        rpToAngka: 8,
        angkaToEye: 20,
        eyeOffsetY: 12,
    },
    color: {
        report: 'rgba(196, 227, 245)',
        eye:    'rgba(204, 226, 240)',
    },
    baseUrl: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main',
};

function numberFormatRupiah(number) {
    return Number(number).toLocaleString('id-ID');
}

function downloadAsset(url, dest) {
    return new Promise((resolve, reject) => {
        const doGet = (targetUrl) => {
            https.get(targetUrl, (res) => {
                if ([301, 302].includes(res.statusCode)) {
                    return doGet(res.headers.location);
                }
                const file = fs.createWriteStream(dest);
                res.pipe(file);
                file.on('finish', () => file.close(resolve));
                file.on('error', (err) => {
                    fs.unlink(dest, () => reject(err));
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => reject(err));
            });
        };
        doGet(url);
    });
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
}

function tintIcon(ctx, img, x, y, w, h, color) {
    const off = new Canvas(w, h);
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, w, h);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = color;
    octx.fillRect(0, 0, w, h);
    ctx.drawImage(off, x, y, w, h);
}

async function generateFakeGopay(data = {}) {
    const fontDir = path.join(__dirname, '../fonts');
    const imgDir  = path.join(__dirname, '../assets');

    if (!fs.existsSync(fontDir)) fs.mkdirSync(fontDir, { recursive: true });
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

    const B = CONFIG.baseUrl;

    const assets = {
        bg:         { url: `${B}/Image/quality_restoration_20260501080321276.jpg`, path: path.join(imgDir, 'bg.jpg') },
        fontReg:    { url: `${B}/Font/rupa_sans_regular.ttf`, path: path.join(fontDir, 'reg.ttf') },
        fontSb:     { url: `${B}/Font/rupa_sans_semi_bold.ttf`, path: path.join(fontDir, 'sb.ttf') },
        fontSerif:  { url: `${B}/Font/rupa_serif_semi_bold.ttf`, path: path.join(fontDir, 'serif.ttf') },
        iconReport: { url: `${B}/Image/bar-chart_6687624.svg`, path: path.join(imgDir, 'report.svg') },
        iconEye:    { url: `${B}/Image/icChat16ReadMessage.svg`, path: path.join(imgDir, 'eye.svg') },
        iconNext:   { url: `${B}/Image/icNavigation16NextIos.svg`, path: path.join(imgDir, 'next.svg') },
    };

    if (fs.existsSync(assets.iconReport.path)) {
        fs.unlinkSync(assets.iconReport.path);
    }

    for (const asset of Object.values(assets)) {
        if (!fs.existsSync(asset.path)) {
            await downloadAsset(asset.url, asset.path);
        }
    }

    FontLibrary.use('RupaSans', [assets.fontReg.path, assets.fontSb.path]);
    FontLibrary.use('RupaSerif', [assets.fontSerif.path]);

    const bg = await loadImage(assets.bg.path);
    const iconReport = await loadImage(assets.iconReport.path);
    const iconEye = await loadImage(assets.iconEye.path);
    const iconNext = await loadImage(assets.iconNext.path);

    const canvas = new Canvas(bg.width, bg.height);
    const ctx = canvas.getContext('2d');

    const { pos, fontSize, icon, pill, gap, color } = CONFIG;

    ctx.drawImage(bg, 0, 0);

    ctx.fillStyle = '#fff';

    ctx.font = `800 ${fontSize.rp}px RupaSans`;
    ctx.fillText('Rp', pos.saldo.x, pos.saldo.y - 38);
    const rpW = ctx.measureText('Rp').width;

    ctx.font = `800 ${fontSize.saldo}px RupaSerif`;
    const angkaX = pos.saldo.x + rpW + gap.rpToAngka;
    ctx.fillText(Number(data.saldo).toLocaleString('id-ID'), angkaX, pos.saldo.y);
    const angkaW = ctx.measureText(Number(data.saldo).toLocaleString('id-ID')).width;

    const eyeX = angkaX + angkaW + gap.angkaToEye;
    const eyeMidY = pos.saldo.y - (fontSize.saldo / 2) + gap.eyeOffsetY;
    tintIcon(ctx, iconEye, eyeX, eyeMidY - (icon.eye.h / 2), icon.eye.w, icon.eye.h, color.eye);

    ctx.fillStyle = '#fff';

    ctx.font = `800 ${fontSize.koin}px RupaSans`;
    ctx.fillText(Number(data.koin).toLocaleString('id-ID'), pos.koin.x, pos.koin.y);
    const koinAngkaW = ctx.measureText(Number(data.koin).toLocaleString('id-ID')).width;

    ctx.font = `400 ${fontSize.koin}px RupaSans`;
    ctx.fillText(' Coins', pos.koin.x + koinAngkaW, pos.koin.y);

    ctx.font = `800 ${fontSize.pill}px RupaSans`;
    const rpTerpakaiText = `Rp${Number(data.terpakai).toLocaleString('id-ID')}`;
    const rpTerpakaiW = ctx.measureText(rpTerpakaiText).width;

    ctx.font = `400 ${fontSize.pill}px RupaSans`;
    const sisaText = ` udah terpakai di ${data.bulan}`;
    const sisaW = ctx.measureText(sisaText).width;

    const textW = rpTerpakaiW + sisaW;
    const pillW = pill.paddingLeft + icon.report.w + pill.gapIconText + textW + pill.gapTextArrow + icon.next.w + pill.paddingRight;

    const pillCenterY = pos.pill.y + (pill.height / 2);
    const textBaseY = pillCenterY + (fontSize.pill / 3);
    const textStartX = pos.pill.x + pill.paddingLeft + icon.report.w + pill.gapIconText;

    tintIcon(ctx, iconReport, pos.pill.x + pill.paddingLeft, pillCenterY - (icon.report.h / 2), icon.report.w, icon.report.h, color.report);
    tintIcon(ctx, iconNext, pos.pill.x + pillW - pill.paddingRight - icon.next.w, pillCenterY - (icon.next.h / 2), icon.next.w, icon.next.h, '#fff');

    ctx.fillStyle = '#fff';
    ctx.font = `600 ${fontSize.pill}px RupaSans`;
    ctx.fillText(rpTerpakaiText, textStartX, textBaseY);

    ctx.font = `400 ${fontSize.pill}px RupaSans`;
    ctx.fillText(sisaText, textStartX + rpTerpakaiW, textBaseY);

    return await canvas.toBuffer('jpeg', { quality: 1 });
}