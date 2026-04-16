import { action } from "@elgato/streamdeck";
import { gpuMetric, type GpuSettings } from "../stats/gpu.js";
import { BaseStatAction } from "./base-stat-action.js";

@action({ UUID: "com.perrosenlind.sysmon.gpu" })
export class GpuAction extends BaseStatAction<GpuSettings> {
  constructor() {
    super({
      metricId: "gpu",
      module: gpuMetric,
      defaults: { refreshMs: 2000, warnThreshold: 60, critThreshold: 85 },
      settingsKey: () => "default",
      maxValue: 100,
    });
  }
}
