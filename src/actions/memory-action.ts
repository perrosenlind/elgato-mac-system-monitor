import { action } from "@elgato/streamdeck";
import { memoryMetric, type MemorySettings } from "../stats/memory.js";
import { BaseStatAction } from "./base-stat-action.js";

@action({ UUID: "com.perrosenlind.sysmon.memory" })
export class MemoryAction extends BaseStatAction<MemorySettings> {
  constructor() {
    super({
      metricId: "memory",
      module: memoryMetric,
      defaults: { refreshMs: 2000, warnThreshold: 70, critThreshold: 90 },
      settingsKey: () => "default",
      maxValue: 100,
    });
  }
}
