import type { JsonValue } from "@elgato/streamdeck";

export interface Sample {
  value: number;
  unit: string;
  label: string;
  secondary?: string;
  /** Extra numeric value for dual-bar metrics (e.g. download + upload). */
  extra?: { value: number; unit: string; label: string };
  /** Link speed in the same unit as value, for scaling bar max. */
  linkMax?: number;
}

export interface MetricModule<TSettings> {
  sample(settings: TSettings): Promise<Sample>;
}

export type ThresholdSettings = {
  refreshMs: number;
  warnThreshold: number;
  critThreshold: number;
  [key: string]: JsonValue;
};
