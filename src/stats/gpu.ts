import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { MetricModule, Sample, ThresholdSettings } from "./types.js";

const execAsync = promisify(exec);

export type GpuSettings = ThresholdSettings;

let cache: { t: number; value: number } | null = null;

async function readIoregGpuUtilization(): Promise<number> {
  const now = Date.now();
  if (cache && now - cache.t < 900) return cache.value;
  const { stdout } = await execAsync(
    "/usr/sbin/ioreg -r -d 1 -w 0 -c IOAccelerator",
    { maxBuffer: 2 * 1024 * 1024 },
  );
  const match = stdout.match(/"Device Utilization %"\s*=\s*(\d+)/);
  const value = match ? Number(match[1]) : NaN;
  cache = { t: now, value };
  return value;
}

export const gpuMetric: MetricModule<GpuSettings> = {
  async sample(): Promise<Sample> {
    try {
      const value = await readIoregGpuUtilization();
      if (Number.isNaN(value)) {
        return { value: NaN, unit: "", label: "GPU", secondary: "n/a" };
      }
      return { value, unit: "%", label: "GPU" };
    } catch {
      return { value: NaN, unit: "", label: "GPU", secondary: "err" };
    }
  },
};
