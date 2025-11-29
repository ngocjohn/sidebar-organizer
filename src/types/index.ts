import { ActionConfig } from '@utilities/action';

import { HomeAssistant } from './ha';

export type HA = HomeAssistant;

export interface HaExtened extends HTMLElement {
  hass: HA;
}

export interface Router extends HTMLElement {
  routerOptions: {
    routes: Record<
      string,
      {
        load: () => Promise<void>;
        tag: string;
      }
    >;
  };
}

export interface Route {
  prefix: string;
  path: string;
}

export interface PartialPanelResolver extends Router {
  narrow: boolean;
  route: Route;
  panel?: PanelInfo;
}

export interface SidebarPanelItem extends HTMLElement {
  href: string;
  target: string;
  newItem?: boolean;
  'data-panel'?: string;
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
  custom_styles?: CustomStyles;
}

export interface CustomStyles {
  [key: string]: string;
}

export type ThemeMode = 'light' | 'dark';
export interface CustomTheme {
  theme?: string;
  mode?: ThemeMode;
}

export interface NotificationConfig {
  [key: string]: string;
}

export interface NewItemConfig extends PanelInfo {
  target?: '_blank' | '_self';
  entity?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  group?: string;
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
  animation_off?: boolean;
  animation_delay?: number;
}
