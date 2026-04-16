import si from "systeminformation";
import type { MetricModule, Sample, ThresholdSettings } from "./types.js";

export type MemorySettings = ThresholdSettings;

export const memoryMetric: MetricModule<MemorySettings> = {
  async sample(): Promise<Sample> {
    const mem = await si.mem();
    const used = mem.active;
    const pct = (used / mem.total) * 100;
    const gbUsed = used / 1024 ** 3;
    const gbTotal = mem.total / 1024 ** 3;
    return {
      value: pct,
      unit: "%",
      label: "MEM",
      secondary: `${gbUsed.toFixed(1)}/${gbTotal.toFixed(0)}G`,
    };
  },
};
