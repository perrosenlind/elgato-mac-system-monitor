import { writeFileSync } from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const SIZE = 144;

function palettePick(value, warn, crit, override) {
  const CRIT = {
    bgTop: "#2a0d12", bgBottom: "#0a0406", ringTrack: "#2c1419", ringFg: "#ff5a6a",
    ringGlow: "rgba(255,90,106,0.55)", labelColor: "#ffb0b8", mainColor: "#ffffff", subColor: "#ff98a2",
  };
  const WARN = {
    bgTop: "#2a1e08", bgBottom: "#0a0704", ringTrack: "#2c2314", ringFg: "#ffc24d",
    ringGlow: "rgba(255,194,77,0.55)", labelColor: "#ffdfa0", mainColor: "#ffffff", subColor: "#ffcb7a",
  };
  const OK = {
    bgTop: "#0a1f17", bgBottom: "#040a08", ringTrack: "#132921", ringFg: "#4ade80",
    ringGlow: "rgba(74,222,128,0.5)", labelColor: "#a8f0c0", mainColor: "#ffffff", subColor: "#7fd9a0",
  };
  const GREY = {
    bgTop: "#1a1a1e", bgBottom: "#0a0a0c", ringTrack: "#26262c", ringFg: "#555560",
    ringGlow: "rgba(120,120,135,0.25)", labelColor: "#9a9aa6", mainColor: "#c8c8d2", subColor: "#6a6a76",
  };
  if (override === "crit") return CRIT;
  if (override === "warn") return WARN;
  if (override === "ok") return OK;
  if (!Number.isFinite(value)) return GREY;
  if (value >= crit) return CRIT;
  if (value >= warn) return WARN;
  return OK;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundedBar(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawIcon(ctx, label, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const s = 10;
  switch (label) {
    case "CPU": {
      ctx.strokeRect(x - s / 2, y - s / 2, s, s);
      ctx.strokeRect(x - s / 4, y - s / 4, s / 2, s / 2);
      break;
    }
    case "GPU": {
      ctx.strokeRect(x - s / 2 - 1, y - s / 2, s + 2, s);
      ctx.beginPath();
      ctx.arc(x - 2, y, 1.5, 0, Math.PI * 2);
      ctx.arc(x + 2, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "MEM": {
      for (let i = -1; i <= 1; i++) ctx.strokeRect(x - s / 2, y - s / 2 + i * 4, s, 2.5);
      break;
    }
    case "DISK": {
      ctx.beginPath();
      ctx.ellipse(x, y - 3, s / 2, 1.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s / 2, y - 3); ctx.lineTo(x - s / 2, y + 3);
      ctx.moveTo(x + s / 2, y - 3); ctx.lineTo(x + s / 2, y + 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y + 3, s / 2, 1.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "PING": {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x, y + 3, 2 + i * 3, Math.PI * 1.2, Math.PI * 1.8);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y + 3, 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "DOWN":
    case "UP":
    case "NET": {
      const bw = 3.5, gap = 2;
      const lx = x - gap - bw / 2, rx = x + gap + bw / 2;
      const base = y + s / 2;
      const dlH = s * 0.9, ulH = s * 0.55;
      roundedBar(ctx, lx - bw / 2, base - dlH, bw, dlH, 1.5);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(lx, base - dlH - 1);
      ctx.lineTo(lx - 2.5, base - dlH + 2);
      ctx.lineTo(lx + 2.5, base - dlH + 2);
      ctx.closePath();
      ctx.fill();
      roundedBar(ctx, rx - bw / 2, base - ulH, bw, ulH, 1.5);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(rx, base - ulH - 3);
      ctx.lineTo(rx - 2.5, base - ulH);
      ctx.lineTo(rx + 2.5, base - ulH);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function render({ label, value, unit, secondary, history, warn, crit, max, paletteOverride }) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  const pal = palettePick(value, warn, crit, paletteOverride);

  const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
  bg.addColorStop(0, pal.bgTop);
  bg.addColorStop(1, pal.bgBottom);
  ctx.fillStyle = bg;
  roundedRect(ctx, 0, 0, SIZE, SIZE, 18);
  ctx.fill();

  // border
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  roundedRect(ctx, 0.5, 0.5, SIZE - 1, SIZE - 1, 17.5);
  ctx.stroke();

  // icon + label
  const labelY = 16;
  ctx.font = "700 12px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lw = ctx.measureText(label).width;
  drawIcon(ctx, label, SIZE / 2 - lw / 2 - 10, labelY, pal.labelColor);
  ctx.fillStyle = pal.labelColor;
  ctx.fillText(label, SIZE / 2 + 6, labelY);

  // ring
  const cx = SIZE / 2, cy = 74, radius = 38;
  const start = Math.PI * 0.75, end = Math.PI * 2.25;
  ctx.lineCap = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = pal.ringTrack;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, end);
  ctx.stroke();
  if (Number.isFinite(value)) {
    ctx.shadowColor = pal.ringGlow;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = pal.ringFg;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + (end - start) * Math.max(0, Math.min(1, value / (max ?? 100))));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // main number
  ctx.fillStyle = pal.mainColor;
  ctx.font = "700 36px Helvetica, Arial, sans-serif";
  ctx.fillText(Number.isFinite(value) ? String(Math.round(value)) : "—", cx, cy - 2);
  ctx.fillStyle = pal.subColor;
  ctx.font = "600 11px Helvetica, Arial, sans-serif";
  ctx.fillText(unit, cx, cy + 20);

  if (secondary) {
    ctx.font = "500 9px Helvetica, Arial, sans-serif";
    ctx.fillText(secondary, cx, 122);
  }

  // sparkline fill + line
  const sx = 10, sy = 130, sw = SIZE - 20, sh = 10;
  const sparkMax = max ?? 100;
  if (history.length > 1) {
    const pts = history.map((v, i) => ({
      px: sx + (i / (history.length - 1)) * sw,
      py: sy + sh - (Math.max(0, Math.min(sparkMax, v)) / sparkMax) * sh,
    }));
    const grad = ctx.createLinearGradient(0, sy, 0, sy + sh);
    grad.addColorStop(0, pal.ringFg + "55");
    grad.addColorStop(1, pal.ringFg + "00");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pts[0].px, sy + sh);
    pts.forEach(p => ctx.lineTo(p.px, p.py));
    ctx.lineTo(pts[pts.length - 1].px, sy + sh);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = pal.ringFg;
    ctx.lineWidth = 1.4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py));
    ctx.stroke();
  }

  return canvas.toBuffer("image/png");
}

function fakeHistory(len, base, jitter) {
  const out = [];
  let v = base;
  for (let i = 0; i < len; i++) {
    v = Math.max(0, v + (Math.random() - 0.5) * jitter);
    out.push(v);
  }
  return out;
}

// Include 8 samples: the 6 metrics + ping failure (red) + ping degrading (yellow)
const samples = [
  { label: "CPU", value: 23, unit: "%", history: fakeHistory(30, 20, 15), warn: 60, crit: 85, max: 100 },
  { label: "GPU", value: 72, unit: "%", history: fakeHistory(30, 60, 20), warn: 60, crit: 85, max: 100 },
  { label: "MEM", value: 94, unit: "%", secondary: "30.1/32G", history: fakeHistory(30, 90, 4), warn: 70, crit: 90, max: 100 },
  { label: "DISK", value: 45, unit: "%", secondary: "450/1000G", history: fakeHistory(30, 45, 1), warn: 80, crit: 92, max: 100 },
  { label: "PING", value: 23, unit: "ms", secondary: "1.1.1.1", history: fakeHistory(30, 22, 8), warn: 60, crit: 150, max: 200 },
  { label: "DOWN", value: 184, unit: "Mbps", secondary: "en0", history: fakeHistory(30, 120, 80), warn: 500, crit: 900, max: 1000 },
  { label: "PING", value: NaN, unit: "NO REPLY", secondary: "10.0.0.99", history: fakeHistory(30, 0, 0), warn: 60, crit: 150, max: 200, paletteOverride: "crit" },
  { label: "PING", value: NaN, unit: "TIMEOUT", secondary: "10.0.0.99", history: [...fakeHistory(25, 22, 8), NaN, NaN, NaN, NaN, NaN], warn: 60, crit: 150, max: 200, paletteOverride: "warn" },
];

const cols = 4;
const rows = 2;
const pad = 16;
const composite = createCanvas(cols * SIZE + (cols + 1) * pad, rows * SIZE + (rows + 1) * pad);
const cctx = composite.getContext("2d");
cctx.fillStyle = "#2a2a2e";
cctx.fillRect(0, 0, composite.width, composite.height);

for (let i = 0; i < samples.length; i++) {
  const s = samples[i];
  const buf = render(s);
  const img = await loadImage(buf);
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = pad + col * (SIZE + pad);
  const y = pad + row * (SIZE + pad);
  cctx.drawImage(img, x, y);
}

writeFileSync("/tmp/elgato-deck-preview.png", composite.toBuffer("image/png"));
console.log("wrote /tmp/elgato-deck-preview.png");
