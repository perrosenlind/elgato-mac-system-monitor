import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createCanvas } from "@napi-rs/canvas";

const OUT = "com.perrosenlind.sysmon.sdPlugin/imgs";

// Stream Deck asks for @1x (72), @2x (144), @3x (288). Supplying the base name
// (without suffix) + the @2x variant covers it — the app falls back when missing.
const SIZES = [
  { suffix: "", size: 72 },
  { suffix: "@2x", size: 144 },
];

function write(path, size, draw) {
  mkdirSync(dirname(path), { recursive: true });
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  draw(ctx, size);
  writeFileSync(path, canvas.toBuffer("image/png"));
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

function bg(ctx, size, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  roundedRect(ctx, 0, 0, size, size, size * 0.13);
  ctx.fill();
}

function label(ctx, size, text, color) {
  ctx.fillStyle = color;
  ctx.font = `700 ${Math.round(size * 0.18)}px -apple-system, Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, size * 0.82);
}

function ring(ctx, size, color, pct) {
  const cx = size / 2;
  const cy = size * 0.45;
  const r = size * 0.28;
  const start = Math.PI * 0.75;
  const end = Math.PI * 2.25;
  ctx.lineCap = "round";
  ctx.lineWidth = size * 0.07;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.08;
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, start + (end - start) * pct);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

const ICONS = {
  "actions/cpu": {
    colors: ["#0a1f17", "#040a08", "#4ade80"],
    label: "CPU",
    pct: 0.35,
  },
  "actions/gpu": {
    colors: ["#2a1e08", "#0a0704", "#ffc24d"],
    label: "GPU",
    pct: 0.7,
  },
  "actions/memory": {
    colors: ["#0a1f17", "#040a08", "#4ade80"],
    label: "MEM",
    pct: 0.5,
  },
  "actions/storage": {
    colors: ["#0a1f17", "#040a08", "#4ade80"],
    label: "DISK",
    pct: 0.45,
  },
  "actions/ping": {
    colors: ["#0a1f17", "#040a08", "#4ade80"],
    label: "PING",
    pct: 0.25,
  },
  "actions/network": {
    colors: ["#0a1f17", "#040a08", "#4ade80"],
    label: "NET",
    pct: 0.6,
  },
  plugin: {
    colors: ["#101018", "#05050a", "#7dd3fc"],
    label: "SYS",
    pct: 0.75,
  },
  category: {
    colors: ["#101018", "#05050a", "#7dd3fc"],
    label: "SYS",
    pct: 0.75,
  },
};

for (const [name, cfg] of Object.entries(ICONS)) {
  for (const { suffix, size } of SIZES) {
    write(`${OUT}/${name}${suffix}.png`, size, (ctx, s) => {
      bg(ctx, s, cfg.colors[0], cfg.colors[1]);
      ring(ctx, s, cfg.colors[2], cfg.pct);
      label(ctx, s, cfg.label, cfg.colors[2]);
    });
  }
  console.log(`  ${name}.png`);
}

console.log(`\nwrote icons to ${OUT}/`);
