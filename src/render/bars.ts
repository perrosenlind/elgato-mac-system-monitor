import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { Sample } from "../stats/types.js";

const SIZE = 144;

export interface BarRenderOptions {
  sample: Sample;
  history: number[];
  uploadHistory: number[];
  /** "both" = two bars, "down" = single DL bar, "up" = single UL bar. Default "both". */
  mode?: "both" | "down" | "up";
}

function roundedRect(
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

function formatVal(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "0";
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function drawBar(
  ctx: SKRSContext2D,
  x: number,
  w: number,
  barAreaBottom: number,
  h: number,
  color: string,
  arrowDir: "down" | "up",
) {
  // Bar with gradient
  const grad = ctx.createLinearGradient(0, barAreaBottom - h, 0, barAreaBottom);
  grad.addColorStop(0, color);
  grad.addColorStop(1, color + "44");
  ctx.fillStyle = grad;
  roundedRect(ctx, x, barAreaBottom - h, w, h, 5);
  ctx.fill();
  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color + "22";
  roundedRect(ctx, x, barAreaBottom - h, w, h, 5);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Arrow
  const cx = x + w / 2;
  const ay = barAreaBottom - h + 12;
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  if (arrowDir === "down") {
    ctx.moveTo(cx, ay + 6);
    ctx.lineTo(cx - 5, ay);
    ctx.lineTo(cx + 5, ay);
  } else {
    ctx.moveTo(cx, ay - 2);
    ctx.lineTo(cx - 5, ay + 4);
    ctx.lineTo(cx + 5, ay + 4);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function renderBars(opts: BarRenderOptions): string {
  const { sample, mode = "both" } = opts;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
  bg.addColorStop(0, "#0d1520");
  bg.addColorStop(1, "#050a10");
  ctx.fillStyle = bg;
  roundedRect(ctx, 0, 0, SIZE, SIZE, 18);
  ctx.fill();

  // Border
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  roundedRect(ctx, 0.5, 0.5, SIZE - 1, SIZE - 1, 17.5);
  ctx.stroke();

  const dlColor = "#38bdf8";
  const ulColor = "#a78bfa";

  const dlVal = sample.value;
  const dlUnit = sample.unit;
  const ulVal = sample.extra?.value ?? 0;
  const ulUnit = sample.extra?.unit ?? sample.unit;

  const barAreaTop = 28;
  const barAreaBottom = 104;
  const barAreaH = barAreaBottom - barAreaTop;

  function barH(v: number, peak: number): number {
    if (!Number.isFinite(v) || v <= 0) return 4;
    return Math.max(4, (v / peak) * barAreaH);
  }

  ctx.textAlign = "center";

  // Use link speed as max when available, otherwise auto-scale from history
  const linkMax = sample.linkMax;

  if (mode === "both") {
    // --- Dual bar layout ---
    const allVals = [
      ...opts.history.filter((v) => Number.isFinite(v)),
      ...opts.uploadHistory.filter((v) => Number.isFinite(v)),
      Number.isFinite(dlVal) ? dlVal : 0,
      Number.isFinite(ulVal) ? ulVal : 0,
    ];
    const peakVal = linkMax && linkMax > 0
      ? linkMax
      : Math.max(1, ...allVals) * 1.15;
    const barW = 36;
    const gap = 16;
    const dlX = SIZE / 2 - gap / 2 - barW;
    const ulX = SIZE / 2 + gap / 2;

    drawBar(ctx, dlX, barW, barAreaBottom, barH(dlVal, peakVal), dlColor, "down");
    drawBar(ctx, ulX, barW, barAreaBottom, barH(ulVal, peakVal), ulColor, "up");

    // Values
    ctx.textBaseline = "top";
    ctx.fillStyle = dlColor;
    ctx.font = "700 13px -apple-system, Helvetica, Arial, sans-serif";
    ctx.fillText(formatVal(dlVal), dlX + barW / 2, barAreaBottom + 4);
    ctx.fillStyle = dlColor + "aa";
    ctx.font = "500 8px -apple-system, Helvetica, Arial, sans-serif";
    ctx.fillText(dlUnit, dlX + barW / 2, barAreaBottom + 19);

    ctx.fillStyle = ulColor;
    ctx.font = "700 13px -apple-system, Helvetica, Arial, sans-serif";
    ctx.fillText(formatVal(ulVal), ulX + barW / 2, barAreaBottom + 4);
    ctx.fillStyle = ulColor + "aa";
    ctx.font = "500 8px -apple-system, Helvetica, Arial, sans-serif";
    ctx.fillText(ulUnit, ulX + barW / 2, barAreaBottom + 19);

    // Headers
    ctx.textBaseline = "middle";
    ctx.font = "600 10px -apple-system, Helvetica, Arial, sans-serif";
    ctx.fillStyle = dlColor + "cc";
    ctx.fillText("DL", dlX + barW / 2, 14);
    ctx.fillStyle = ulColor + "cc";
    ctx.fillText("UL", ulX + barW / 2, 14);
  } else {
    // --- Single bar layout ---
    const isUp = mode === "up";
    const val = isUp ? ulVal : dlVal;
    const unit = isUp ? ulUnit : dlUnit;
    const color = isUp ? ulColor : dlColor;
    const hist = isUp ? opts.uploadHistory : opts.history;
    const label = isUp ? "UPLOAD" : "DOWNLOAD";

    const allVals = [
      ...hist.filter((v) => Number.isFinite(v)),
      Number.isFinite(val) ? val : 0,
    ];
    const peakVal = linkMax && linkMax > 0
      ? linkMax
      : Math.max(1, ...allVals) * 1.15;
    const barW = 52;
    const barX = SIZE / 2 - barW / 2;

    drawBar(ctx, barX, barW, barAreaBottom, barH(val, peakVal), color, isUp ? "up" : "down");

    // Value
    ctx.textBaseline = "top";
    ctx.fillStyle = color;
    ctx.font = "700 18px -apple-system, Helvetica, Arial, sans-serif";
    ctx.fillText(formatVal(val), SIZE / 2, barAreaBottom + 2);
    ctx.fillStyle = color + "aa";
    ctx.font = "500 10px -apple-system, Helvetica, Arial, sans-serif";
    ctx.fillText(unit, SIZE / 2, barAreaBottom + 22);

    // Header
    ctx.textBaseline = "middle";
    ctx.font = "600 10px -apple-system, Helvetica, Arial, sans-serif";
    ctx.fillStyle = color + "cc";
    ctx.fillText(label, SIZE / 2, 14);
  }

  // Interface name
  if (sample.secondary) {
    ctx.fillStyle = "#6a7a8a";
    ctx.font = "500 9px -apple-system, Helvetica, Arial, sans-serif";
    ctx.textBaseline = "bottom";
    ctx.textAlign = "center";
    ctx.fillText(sample.secondary, SIZE / 2, SIZE - 4);
  }

  const png = canvas.toBuffer("image/png");
  return `data:image/png;base64,${png.toString("base64")}`;
}
