import { action } from "@elgato/streamdeck";
import { storageMetric, type StorageSettings } from "../stats/storage.js";
import { BaseStatAction } from "./base-stat-action.js";

@action({ UUID: "com.perrosenlind.sysmon.storage" })
export class StorageAction extends BaseStatAction<StorageSettings> {
  constructor() {
    super({
      metricId: "storage",
      module: storageMetric,
      defaults: {
        refreshMs: 10_000,
        warnThreshold: 80,
        critThreshold: 92,
        mountPoint: "/System/Volumes/Data",
      },
      settingsKey: (s) => s.mountPoint,
      maxValue: 100,
    });
  }
}
