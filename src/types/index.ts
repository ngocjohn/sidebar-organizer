import { ActionConfig, HomeAssistant } from 'custom-card-helpers';

interface defaultPanel extends HomeAssistant {
  defaultPanel: string;
}

export interface ThemeSettings {
  theme?: string;
  // Radio box selection for theme picker. Do not use in Lovelace rendering as
  // it can be undefined == auto.
  // Property hass.themes.darkMode carries effective current mode.
  dark?: boolean;
  primaryColor?: string;
  accentColor?: string;
}

export interface ThemeVars {
  // Incomplete
  'primary-color': string;
  'text-primary-color': string;
  'accent-color': string;
  [key: string]: string;
}

export type Theme = ThemeVars & {
  modes?: {
    light?: ThemeVars;
    dark?: ThemeVars;
  };
};
export type LocalizeFunc = (key: string, ...args: any[]) => string;

export interface Themes {
  default_theme: string;
  default_dark_theme: string | null;
  themes: Record<string, Theme>;
  // Currently effective dark mode. Will never be undefined. If user selected "auto"
  // in theme picker, this property will still contain either true or false based on
  // what has been determined via system preferences and support from the selected theme.
  darkMode: boolean;
  // Currently globally active theme name
  theme: string;
}

export type HA = HomeAssistant & {
  loadFragmentTranslation: (fragment: string) => Promise<LocalizeFunc | undefined>;
  themes: Themes;
};

export interface HaExtened extends HTMLElement {
  hass: HA & defaultPanel & { selectedTheme: ThemeSettings | null };
}

export interface Route {
  prefix: string;
  path: string;
}

export interface PartialPanelResolver extends HTMLElement {
  narrow: boolean;
  route?: Route | null;
  panel?: PanelInfo;
}

export interface SidebarPanelItem extends HTMLElement {
  href: string;
  target: string;
}

export interface PanelInfo {
  component_name?: string;

  icon: string | null;
  title: string | null;
  url_path?: string;
  config_panel_domain?: string;
  notification?: string;
}
export type Panels = Record<string, PanelInfo>;

export interface DividerColorSettings {
  background_color?: string;
  border_top_color?: string;
  custom_sidebar_background_color?: string;
  divider_color?: string;
  divider_text_color?: string;
  scrollbar_thumb_color?: string;
  sidebar_icon_color?: string;
  custom_styles?: Array<CustomStyles>;
}

export interface CustomStyles {
  [key: string]: string;
}

export type CustomTheme = {
  theme?: string;
  mode?: 'auto' | 'dark' | 'light';
};

export interface NotificationConfig {
  [key: string]: string;
}

export interface NewItemConfig extends PanelInfo {
  target?: '_blank' | '_self';
  entity?: string;
  tap_action?: ActionConfig;
}

export interface SidebarConfig {
  bottom_items?: string[];
  custom_groups?: {
    [key: string]: string[];
  };
  hidden_items?: string[];
  default_collapsed?: string[];
  header_title?: string;
  hide_header_toggle?: boolean;
  color_config?: {
    border_radius?: number;
    light?: DividerColorSettings;
    dark?: DividerColorSettings;
    custom_theme?: CustomTheme;
  };
  notification?: NotificationConfig;
  new_items?: NewItemConfig[];
}
