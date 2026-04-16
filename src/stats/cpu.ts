import si from "systeminformation";
import type { MetricModule, Sample, ThresholdSettings } from "./types.js";

export type CpuSettings = ThresholdSettings;

export const cpuMetric: MetricModule<CpuSettings> = {
  async sample(): Promise<Sample> {
    const load = await si.currentLoad();
    return {
      value: load.currentLoad,
      unit: "%",
      label: "CPU",
    };
  },
};
