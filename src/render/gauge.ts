import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { Sample } from "../stats/types.js";

const SIZE = 144;

export interface RenderOptions {
  sample: Sample;
  history: number[];
  warnThreshold: number;
  critThreshold: number;
  maxValue?: number;
  /** Force a specific palette regardless of value. Useful for ping failure = "crit". */
  paletteOverride?: "ok" | "warn" | "crit";
}

interface Palette {
  bgTop: string;
  bgBottom: string;
  ringTrack: string;
  ringFg: string;
  ringGlow: string;
  accent: string;
  labelColor: string;
  mainColor: string;
  subColor: string;
}

const PALETTE_CRIT: Palette = {
  bgTop: "#2a0d12",
  bgBottom: "#0a0406",
  ringTrack: "#2c1419",
  ringFg: "#ff5a6a",
  ringGlow: "rgba(255,90,106,0.55)",
  accent: "#ff8090",
  labelColor: "#ffb0b8",
  mainColor: "#ffffff",
  subColor: "#ff98a2",
};

const PALETTE_WARN: Palette = {
  bgTop: "#2a1e08",
  bgBottom: "#0a0704",
  ringTrack: "#2c2314",
  ringFg: "#ffc24d",
  ringGlow: "rgba(255,194,77,0.55)",
  accent: "#ffda85",
  labelColor: "#ffdfa0",
  mainColor: "#ffffff",
  subColor: "#ffcb7a",
};

const PALETTE_OK: Palette = {
  bgTop: "#0a1f17",
  bgBottom: "#040a08",
  ringTrack: "#132921",
  ringFg: "#4ade80",
  ringGlow: "rgba(74,222,128,0.5)",
  accent: "#86efac",
  labelColor: "#a8f0c0",
  mainColor: "#ffffff",
  subColor: "#7fd9a0",
};

const PALETTE_INACTIVE: Palette = {
  bgTop: "#1a1a1e",
  bgBottom: "#0a0a0c",
  ringTrack: "#26262c",
  ringFg: "#555560",
  ringGlow: "rgba(120,120,135,0.25)",
  accent: "#8a8a96",
  labelColor: "#9a9aa6",
  mainColor: "#c8c8d2",
  subColor: "#6a6a76",
};

function palette(
  value: number,
  warn: number,
  crit: number,
  override?: "ok" | "warn" | "crit",
): Palette {
  if (override === "crit") return PALETTE_CRIT;
  if (override === "warn") return PALETTE_WARN;
  if (override === "ok") return PALETTE_OK;
  if (!Number.isFinite(value)) return PALETTE_INACTIVE;
  if (value >= crit) return PALETTE_CRIT;
  if (value >= warn) return PALETTE_WARN;
  return PALETTE_OK;
}

function formatValue(sample: Sample): string {
  if (!Number.isFinite(sample.value)) return "—";
  if (sample.unit === "%" || sample.unit === "ms")
    return `${Math.round(sample.value)}`;
  if (sample.value >= 100) return sample.value.toFixed(0);
  if (sample.value >= 10) return sample.value.toFixed(1);
  return sample.value.toFixed(2);
}

function roundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundedBar(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawIcon(
  ctx: SKRSContext2D,
  label: string,
  x: number,
  y: number,
  color: string,
) {
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
      for (const o of [-s / 2 - 2, s / 2 + 2]) {
        ctx.beginPath();
        ctx.moveTo(x - s / 4, y + o);
        ctx.lineTo(x - s / 4, y + (o > 0 ? o + 2 : o - 2));
        ctx.moveTo(x + s / 4, y + o);
        ctx.lineTo(x + s / 4, y + (o > 0 ? o + 2 : o - 2));
        ctx.stroke();
      }
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
      for (let i = -1; i <= 1; i++) {
        ctx.strokeRect(x - s / 2, y - s / 2 + i * 4, s, 2.5);
      }
      break;
    }
    case "DISK": {
      ctx.beginPath();
      ctx.ellipse(x, y - 3, s / 2, 1.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s / 2, y - 3);
      ctx.lineTo(x - s / 2, y + 3);
      ctx.moveTo(x + s / 2, y - 3);
      ctx.lineTo(x + s / 2, y + 3);
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
      // Two pillars: left = download (tall), right = upload (short)
      const bw = 3.5;  // bar width
      const gap = 2;
      const lx = x - gap - bw / 2;
      const rx = x + gap + bw / 2;
      const base = y + s / 2;
      const dlH = s * 0.9;  // download pillar height
      const ulH = s * 0.55; // upload pillar height

      // download pillar (left)
      roundedBar(ctx, lx - bw / 2, base - dlH, bw, dlH, 1.5);
      ctx.fill();
      // download arrow
      ctx.beginPath();
      ctx.moveTo(lx, base - dlH - 1);
      ctx.lineTo(lx - 2.5, base - dlH + 2);
      ctx.lineTo(lx + 2.5, base - dlH + 2);
      ctx.closePath();
      ctx.fill();

      // upload pillar (right)
      roundedBar(ctx, rx - bw / 2, base - ulH, bw, ulH, 1.5);
      ctx.fill();
      // upload arrow
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

function drawSparkline(
  ctx: SKRSContext2D,
  history: number[],
  max: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  if (history.length < 2) return;
  const points = history.map((v, i) => {
    const px = x + (i / (history.length - 1)) * w;
    const clamped = Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0));
    const py = y + h - (clamped / max) * h;
    return { px, py };
  });

  ctx.save();
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, color + "55");
  grad.addColorStop(1, color + "00");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(points[0]!.px, y + h);
  for (const p of points) ctx.lineTo(p.px, p.py);
  ctx.lineTo(points[points.length - 1]!.px, y + h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py)));
  ctx.stroke();
  ctx.restore();
}

function drawRing(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  radius: number,
  pct: number,
  pal: Palette,
) {
  const start = Math.PI * 0.75;
  const end = Math.PI * 2.25;
  const clamped = Math.max(0, Math.min(1, pct));

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = pal.ringTrack;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, end);
  ctx.stroke();

  if (clamped > 0 && Number.isFinite(pct)) {
    ctx.shadowColor = pal.ringGlow;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = pal.ringFg;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + (end - start) * clamped);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderGauge(opts: RenderOptions): string {
  const { sample, history, warnThreshold, critThreshold, maxValue } = opts;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  const pal = palette(sample.value, warnThreshold, critThreshold, opts.paletteOverride);

  const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
  bg.addColorStop(0, pal.bgTop);
  bg.addColorStop(1, pal.bgBottom);
  ctx.fillStyle = bg;
  roundedRect(ctx, 0, 0, SIZE, SIZE, 18);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  roundedRect(ctx, 0.5, 0.5, SIZE - 1, SIZE - 1, 17.5);
  ctx.stroke();

  const labelY = 16;
  ctx.font = "700 12px -apple-system, Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const labelWidth = ctx.measureText(sample.label).width;
  const iconX = SIZE / 2 - labelWidth / 2 - 10;
  drawIcon(ctx, sample.label, iconX, labelY, pal.labelColor);
  ctx.fillStyle = pal.labelColor;
  ctx.fillText(sample.label, SIZE / 2 + 6, labelY);

  const cx = SIZE / 2;
  const cy = 74;
  const radius = 38;

  let pctForRing = 0;
  if (Number.isFinite(sample.value)) {
    const ceiling =
      maxValue ??
      (sample.unit === "%"
        ? 100
        : sample.unit === "ms"
          ? Math.max(critThreshold * 1.5, 200)
          : Math.max(critThreshold, sample.value));
    pctForRing = ceiling > 0 ? sample.value / ceiling : 0;
  } else {
    pctForRing = NaN;
  }
  drawRing(ctx, cx, cy, radius, pctForRing, pal);

  const main = formatValue(sample);
  ctx.fillStyle = pal.mainColor;
  ctx.font = "700 36px -apple-system, Helvetica, Arial, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(main, cx, cy - 2);

  if (sample.unit) {
    ctx.fillStyle = pal.subColor;
    ctx.font = "600 11px -apple-system, Helvetica, Arial, sans-serif";
    ctx.fillText(sample.unit, cx, cy + 20);
  }

  if (sample.secondary) {
    ctx.fillStyle = pal.subColor;
    ctx.font = "500 9px -apple-system, Helvetica, Arial, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(sample.secondary, cx, 122);
  }

  const sparkY = 130;
  const sparkH = 10;
  const sparkX = 10;
  const sparkW = SIZE - 20;
  const sparkMax =
    maxValue ??
    (sample.unit === "%"
      ? 100
      : Math.max(
          1,
          ...history.map((v) => (Number.isFinite(v) ? v : 0)),
          Number.isFinite(sample.value) ? sample.value : 0,
        ));
  drawSparkline(ctx, history, sparkMax, sparkX, sparkY, sparkW, sparkH, pal.ringFg);

  const png = canvas.toBuffer("image/png");
  return `data:image/png;base64,${png.toString("base64")}`;
}
