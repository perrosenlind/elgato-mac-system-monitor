import streamDeck, {
  SingletonAction,
  type DidReceiveSettingsEvent,
  type JsonObject,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { renderGauge, type RenderOptions } from "../render/gauge.js";
import { subscribe, type Subscription } from "../stats/sampler.js";
import type { MetricModule, Sample, ThresholdSettings } from "../stats/types.js";

export interface BaseStatConfig<TSettings extends ThresholdSettings & JsonObject,> {
  metricId: string;
  module: MetricModule<TSettings>;
  defaults: TSettings;
  settingsKey: (settings: TSettings) => string;
  maxValue?: number;
  /** Optional hook to override palette based on sample + history. */
  paletteForSample?: (sample: Sample, history: number[]) => RenderOptions["paletteOverride"];
  /** Optional custom renderer — replaces the default gauge entirely. */
  customRender?: (sample: Sample, history: number[], settings: TSettings) => string;
}

export abstract class BaseStatAction<
  TSettings extends ThresholdSettings & JsonObject,
> extends SingletonAction<TSettings> {
  private readonly subs = new Map<string, Subscription>();

  protected constructor(private readonly config: BaseStatConfig<TSettings>) {
    super();
  }

  private merged(settings: Partial<TSettings> | undefined): TSettings {
    return { ...this.config.defaults, ...(settings ?? {}) } as TSettings;
  }

  override async onWillAppear(ev: WillAppearEvent<TSettings>): Promise<void> {
    await this.resubscribe(ev.action.id, this.merged(ev.payload.settings), (img) =>
      ev.action.setImage(img),
    );
  }

  override onWillDisappear(ev: WillDisappearEvent<TSettings>): void {
    const sub = this.subs.get(ev.action.id);
    if (sub) {
      sub.unsubscribe();
      this.subs.delete(ev.action.id);
    }
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<TSettings>,
  ): Promise<void> {
    await this.resubscribe(ev.action.id, this.merged(ev.payload.settings), (img) =>
      ev.action.setImage(img),
    );
  }

  override async onKeyDown(ev: KeyDownEvent<TSettings>): Promise<void> {
    const sub = this.subs.get(ev.action.id);
    if (sub) await sub.refresh();
  }

  private async resubscribe(
    actionId: string,
    settings: TSettings,
    setImage: (img: string) => Promise<void> | void,
  ): Promise<void> {
    this.subs.get(actionId)?.unsubscribe();
    const sub = subscribe<TSettings>({
      metricId: this.config.metricId,
      module: this.config.module,
      settings,
      settingsKey: this.config.settingsKey(settings),
      intervalMs: Math.max(500, Math.min(10_000, settings.refreshMs ?? 2000)),
      subscriberId: actionId,
      onSample: (sample, history) => {
        try {
          const img = this.config.customRender
            ? this.config.customRender(sample, history, settings)
            : renderGauge({
                sample,
                history,
                warnThreshold: settings.warnThreshold,
                critThreshold: settings.critThreshold,
                maxValue: this.config.maxValue,
                paletteOverride: this.config.paletteForSample?.(sample, history),
              });
          void setImage(img);
        } catch (err) {
          streamDeck.logger.error(`render failed for ${this.config.metricId}`, err);
        }
      },
    });
    this.subs.set(actionId, sub);
  }
}
