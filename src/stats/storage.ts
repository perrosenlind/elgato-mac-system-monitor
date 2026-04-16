import si from "systeminformation";
import type { MetricModule, Sample, ThresholdSettings } from "./types.js";

export type StorageSettings = ThresholdSettings & {
  mountPoint: string;
};

export const storageMetric: MetricModule<StorageSettings> = {
  async sample(settings): Promise<Sample> {
    const fs = await si.fsSize();
    const mount = settings.mountPoint || "/System/Volumes/Data";
    const target =
      fs.find((f) => f.mount === mount) ??
      // Fallback: find the largest used volume (skips tiny system partitions)
      fs.filter((f) => !f.mount.includes("TimeMachine")).sort((a, b) => b.used - a.used)[0] ??
      fs[0];
    if (!target) {
      return { value: NaN, unit: "%", label: "DISK", secondary: "n/a" };
    }
    const gbUsed = target.used / 1024 ** 3;
    const gbTotal = target.size / 1024 ** 3;
    return {
      value: target.use,
      unit: "%",
      label: "DISK",
      secondary: `${gbUsed.toFixed(0)}/${gbTotal.toFixed(0)}G`,
    };
  },
};
