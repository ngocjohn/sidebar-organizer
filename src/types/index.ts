import { ActionConfig } from '@utilities/action';

import { HomeAssistant } from './ha';

export type HA = HomeAssistant;

export interface HomeAssistantElement extends HTMLElement {
  hass: HomeAssistant;
}

export interface HaExtened extends HTMLElement {
  hass: HomeAssistant;
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
  group?: string;
}

export interface Sidebar extends HTMLElement {
  alwaysExpand: boolean;
  _mouseLeaveTimeout?: number;
  _showTooltip: (anchor: HTMLElement) => void;
  _hideTooltip: () => void;
  hassSubscribe: (callback: (data: any) => void) => () => void;
}

export interface PanelInfo {
  component_name?: string;
  icon: string | null;
  title: string | null;
  url_path?: string;
  config_panel_domain?: string;
  notification?: string;
  default_visible?: boolean;
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
  custom_styles?: Record<string, string>;
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

export interface SidebarAppearanceConfig {
  header_title?: string;
  hide_header_toggle?: boolean;
  animation_off?: boolean;
  animation_delay?: number;
}

export interface SidebarColorConfig {
  border_radius?: number;
  light?: DividerColorSettings;
  dark?: DividerColorSettings;
  custom_theme?: CustomTheme;
}

export type CustomGroups = {
  [groupName: string]: string[];
};

export interface SidebardPanelConfig {
  custom_groups?: CustomGroups;
  bottom_items?: string[];
  hidden_items?: string[];
}
export const PanelTypes = ['custom_groups', 'bottom_items', 'hidden_items'] as const;
export type PanelType = (typeof PanelTypes)[number];

export enum PANEL_TYPE {
  CUSTOM = 'custom_groups',
  BOTTOM = 'bottom_items',
  HIDDEN = 'hidden_items',
}
export interface SidebarConfig extends SidebardPanelConfig, SidebarAppearanceConfig {
  default_collapsed?: string[];
  color_config?: SidebarColorConfig;
  notification?: NotificationConfig;
  new_items?: NewItemConfig[];
}
