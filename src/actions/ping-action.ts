import { action } from "@elgato/streamdeck";
import { pingMetric, type PingSettings } from "../stats/ping.js";
import { BaseStatAction } from "./base-stat-action.js";

@action({ UUID: "com.perrosenlind.sysmon.ping" })
export class PingAction extends BaseStatAction<PingSettings> {
  constructor() {
    super({
      metricId: "ping",
      module: pingMetric,
      defaults: {
        refreshMs: 3000,
        warnThreshold: 60,
        critThreshold: 150,
        host: "1.1.1.1",
        timeoutMs: 2000,
      },
      settingsKey: (s) => s.host,
      paletteForSample: (sample, history) => {
        if (!Number.isFinite(sample.value)) {
          // Check if we've had recent good pings — if so, recovering/degrading = yellow
          const recentGood = history
            .slice(-5)
            .some((v) => Number.isFinite(v) && v > 0);
          return recentGood ? "warn" : "crit";
        }
        return undefined; // fall through to normal threshold logic
      },
    });
  }
}
