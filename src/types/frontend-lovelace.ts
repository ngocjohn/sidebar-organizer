export type LovelaceVisibilityCondition = Record<string, unknown>;

export interface LovelaceCardConfig {
  type: string;
  [key: string]: any;
  disabled?: boolean;
  visibility?: LovelaceVisibilityCondition[];
}

export interface LovelaceViewConfig {
  type?: string;
  cards?: LovelaceCardConfig[];
}
export type LovelaceViewRawConfig = LovelaceViewConfig;

export interface LovelaceDashboardBaseConfig {}

export interface LovelaceConfig extends LovelaceDashboardBaseConfig {
  background?: string;
  views: LovelaceViewRawConfig[];
}
