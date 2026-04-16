import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MetricModule, Sample, ThresholdSettings } from "./types.js";

const execFileAsync = promisify(execFile);

export type PingSettings = ThresholdSettings & {
  host: string;
  timeoutMs: number;
};

export const pingMetric: MetricModule<PingSettings> = {
  async sample(settings): Promise<Sample> {
    const host = settings.host || "1.1.1.1";
    const timeoutSec = Math.max(1, Math.round((settings.timeoutMs || 2000) / 1000));
    try {
      const { stdout } = await execFileAsync(
        "/sbin/ping",
        ["-c", "1", "-t", String(timeoutSec), host],
        { timeout: (settings.timeoutMs || 2000) + 500 },
      );
      const match = stdout.match(/time=([\d.]+)\s*ms/);
      if (!match) {
        return { value: NaN, unit: "ms", label: "PING", secondary: host };
      }
      return {
        value: Number(match[1]),
        unit: "ms",
        label: "PING",
        secondary: host,
      };
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes("timed out")
          ? "TIMEOUT"
          : "NO REPLY";
      return { value: NaN, unit: msg, label: "PING", secondary: host };
    }
  },
};
