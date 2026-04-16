import { action } from "@elgato/streamdeck";
import { cpuMetric, type CpuSettings } from "../stats/cpu.js";
import { BaseStatAction } from "./base-stat-action.js";

@action({ UUID: "com.perrosenlind.sysmon.cpu" })
export class CpuAction extends BaseStatAction<CpuSettings> {
  constructor() {
    super({
      metricId: "cpu",
      module: cpuMetric,
      defaults: { refreshMs: 2000, warnThreshold: 60, critThreshold: 85 },
      settingsKey: () => "default",
      maxValue: 100,
    });
  }
}
