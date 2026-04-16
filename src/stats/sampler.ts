import type { MetricModule, Sample } from "./types.js";

const HISTORY_LEN = 30;

interface Entry {
  key: string;
  intervalMs: number;
  timer: NodeJS.Timeout;
  history: number[];
  last?: Sample;
  subscribers: Map<string, (sample: Sample, history: number[]) => void>;
}

const entries = new Map<string, Entry>();

function entryKey(metricId: string, settingsKey: string, intervalMs: number) {
  return `${metricId}|${intervalMs}|${settingsKey}`;
}

export interface Subscription {
  unsubscribe(): void;
  refresh(): Promise<void>;
}

export function subscribe<TSettings>(opts: {
  metricId: string;
  module: MetricModule<TSettings>;
  settings: TSettings;
  settingsKey: string;
  intervalMs: number;
  subscriberId: string;
  onSample: (sample: Sample, history: number[]) => void;
}): Subscription {
  const { metricId, module, settings, settingsKey, intervalMs, subscriberId, onSample } = opts;
  const key = entryKey(metricId, settingsKey, intervalMs);

  let entry = entries.get(key);

  const runSample = async () => {
    const current = entries.get(key);
    if (!current) return;
    try {
      const sample = await module.sample(settings);
      current.last = sample;
      current.history.push(Number.isFinite(sample.value) ? sample.value : 0);
      if (current.history.length > HISTORY_LEN) current.history.shift();
      for (const cb of current.subscribers.values()) {
        cb(sample, current.history.slice());
      }
    } catch (err) {
      for (const cb of current.subscribers.values()) {
        cb(
          { value: NaN, unit: "", label: "err", secondary: String(err) },
          current.history.slice(),
        );
      }
    }
  };

  if (!entry) {
    entry = {
      key,
      intervalMs,
      timer: setInterval(() => void runSample(), intervalMs),
      history: [],
      subscribers: new Map(),
    };
    entries.set(key, entry);
    void runSample();
  }

  entry.subscribers.set(subscriberId, onSample);
  if (entry.last) onSample(entry.last, entry.history.slice());

  return {
    unsubscribe() {
      const current = entries.get(key);
      if (!current) return;
      current.subscribers.delete(subscriberId);
      if (current.subscribers.size === 0) {
        clearInterval(current.timer);
        entries.delete(key);
      }
    },
    refresh: runSample,
  };
}
