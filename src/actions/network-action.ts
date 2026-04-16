import { action } from "@elgato/streamdeck";
import { renderBars } from "../render/bars.js";
import { networkMetric, type NetworkSettings } from "../stats/network.js";
import type { Sample } from "../stats/types.js";
import { BaseStatAction } from "./base-stat-action.js";

const HISTORY_LEN = 30;
const uploadHistories = new Map<string, number[]>();

@action({ UUID: "com.perrosenlind.sysmon.network" })
export class NetworkAction extends BaseStatAction<NetworkSettings> {
  constructor() {
    super({
      metricId: "network",
      module: networkMetric,
      defaults: {
        refreshMs: 1500,
        warnThreshold: 500,
        critThreshold: 900,
        iface: "",
        direction: "both",
        unit: "auto",
      },
      settingsKey: (s) => `${s.iface}|${s.direction}|${s.unit}`,
      customRender: (sample: Sample, history: number[], settings: NetworkSettings): string => {
        const key = sample.secondary ?? "default";
        let ulHist = uploadHistories.get(key);
        if (!ulHist) {
          ulHist = [];
          uploadHistories.set(key, ulHist);
        }
        const ulVal = sample.extra?.value ?? 0;
        ulHist.push(Number.isFinite(ulVal) ? ulVal : 0);
        if (ulHist.length > HISTORY_LEN) ulHist.shift();

        return renderBars({
          sample,
          history,
          uploadHistory: ulHist.slice(),
          mode: settings.direction || "both",
        });
      },
    });
  }
}
