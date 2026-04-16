import si from "systeminformation";
import type { MetricModule, Sample, ThresholdSettings } from "./types.js";

export type NetworkSettings = ThresholdSettings & {
  iface: string;
  direction: "down" | "up" | "both";
  unit: "auto" | "bps" | "Kbps" | "Mbps" | "Gbps";
};

const UNIT_DIVISORS: Record<string, number> = {
  bps: 1,
  Kbps: 1_000,
  Mbps: 1_000_000,
  Gbps: 1_000_000_000,
};

const UNIT_ORDER = ["bps", "Kbps", "Mbps", "Gbps"];

function toBits(bytesPerSec: number): number {
  return bytesPerSec * 8;
}

function formatBits(
  bits: number,
  fixedUnit: string,
): { value: number; unit: string } {
  if (fixedUnit && fixedUnit !== "auto") {
    const div = UNIT_DIVISORS[fixedUnit] ?? 1_000_000;
    return { value: bits / div, unit: fixedUnit };
  }
  if (bits >= 1_000_000_000) return { value: bits / 1_000_000_000, unit: "Gbps" };
  if (bits >= 1_000_000) return { value: bits / 1_000_000, unit: "Mbps" };
  if (bits >= 1_000) return { value: bits / 1_000, unit: "Kbps" };
  return { value: bits, unit: "bps" };
}

/** Pick the best shared unit for two bit values in auto mode. */
function pickSharedUnit(dlBits: number, ulBits: number): string {
  const maxBits = Math.max(dlBits, ulBits);
  if (maxBits >= 1_000_000_000) return "Gbps";
  if (maxBits >= 1_000_000) return "Mbps";
  if (maxBits >= 1_000) return "Kbps";
  return "bps";
}

// Cache interface speed (Mbps) — refreshed every 30s
const speedCache = new Map<string, { speed: number; ts: number }>();
const SPEED_TTL = 30_000;

async function getLinkSpeedMbps(iface: string): Promise<number | null> {
  const cached = speedCache.get(iface);
  if (cached && Date.now() - cached.ts < SPEED_TTL) return cached.speed || null;

  const ifaces = await si.networkInterfaces();
  const list = Array.isArray(ifaces) ? ifaces : [ifaces];
  const entry = list.find((i) => i.iface === iface);
  const speed = entry?.speed ?? null;
  if (speed) speedCache.set(iface, { speed, ts: Date.now() });
  return speed;
}

export const networkMetric: MetricModule<NetworkSettings> = {
  async sample(settings): Promise<Sample> {
    const iface = settings.iface || (await si.networkInterfaceDefault());
    const stats = await si.networkStats(iface);
    const s = stats[0];
    if (!s) {
      return { value: NaN, unit: "", label: "NET", secondary: "n/a" };
    }

    const userUnit = settings.unit || "auto";
    const dlBits = toBits(Math.max(0, s.rx_sec));
    const ulBits = toBits(Math.max(0, s.tx_sec));

    // In auto mode, force both DL and UL to use the same unit
    const resolvedUnit =
      userUnit === "auto" ? pickSharedUnit(dlBits, ulBits) : userUnit;

    const dl = formatBits(dlBits, resolvedUnit);
    const ul = formatBits(ulBits, resolvedUnit);

    const direction = settings.direction || "down";
    const primary = direction === "up" ? ul : dl;
    const label = direction === "up" ? "UP" : direction === "both" ? "NET" : "DOWN";

    // Link speed for bar scaling, converted to the display unit
    const speedMbps = await getLinkSpeedMbps(iface);
    let linkMax: number | undefined;
    if (speedMbps) {
      const div = UNIT_DIVISORS[resolvedUnit] ?? 1_000_000;
      linkMax = (speedMbps * 1_000_000) / div;
    }

    return {
      value: primary.value,
      unit: primary.unit,
      label,
      secondary: iface,
      extra: { value: ul.value, unit: ul.unit, label: "UP" },
      linkMax,
    };
  },
};
