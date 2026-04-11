import { ActionConfig } from '@utilities/action';

import { LovelaceCardConfig } from './frontend-lovelace';
import { HomeAssistant } from './ha';

export * from './ha';
export * from './elements';
export * from './frontend-lovelace';

declare global {
  var __DEV__: boolean;
  var __DEBUG__: boolean;
}

export type HA = HomeAssistant;

export interface HaExtened extends HTMLElement {
  hass: HomeAssistant;
  provideHass(element: HTMLElement): void;
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
  route?: Route | null;
  panel?: PanelInfo;
  hass: HomeAssistant;
  _updateRoutes: () => void;
}

export interface HaDrawer extends HTMLElement {
  open: boolean;
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

export interface HaMdList extends HTMLElement {
  slotItems: Array<SidebarPanelItem | (HTMLElement & { item?: SidebarPanelItem })>;
}

export interface PanelInfo {
  component_name?: string;
  icon: string | null;
  title: string | null;
  url_path?: string;
  config_panel_domain?: string;
  notification?: string;
  default_visible?: boolean;
  require_admin?: boolean;
  show_in_sidebar?: boolean;
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
export type NewItemConfigKeys = keyof NewItemConfig;

export const TextTransformations = ['none', 'capitalize', 'uppercase', 'lowercase'] as const;
export type TextTransformation = (typeof TextTransformations)[number];
export interface SidebarAppearanceConfig {
  header_title?: string;
  hide_header_toggle?: boolean;
  animation_off?: boolean;
  animation_delay?: number;
  accordion_mode?: boolean;
  text_transformation?: TextTransformation;
  move_settings_from_fixed?: boolean;
  force_transparent_background?: boolean;
  width?: number | string;
}
export const AppearanceConfigKeys = [
  'header_title',
  'hide_header_toggle',
  'animation_off',
  'animation_delay',
  'accordion_mode',
  'text_transformation',
  'move_settings_from_fixed',
  'force_transparent_background',
  'width',
] as const;

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
  bottom_grid_items?: string[];
  hidden_items?: string[];
}
export const PanelTypes = ['custom_groups', 'bottom_items', 'bottom_grid_items', 'hidden_items'] as const;
export type PanelType = (typeof PanelTypes)[number];

export type ItemShallowKeys = keyof SidebardPanelConfig & 'new_items';

export enum PANEL_TYPE {
  CUSTOM_GROUPS = 'custom_groups',
  BOTTOM_ITEMS = 'bottom_items',
  BOTTOM_GRID_ITEMS = 'bottom_grid_items',
  HIDDEN_ITEMS = 'hidden_items',
  UNCATEGORIZED_ITEMS = 'uncategorized_items',
}

export type PinnedGroupEntry = true | { icon?: string };
export type PinnedGroupsConfig = Record<string, PinnedGroupEntry>;

export interface VisibilitySectionConfig {
  [key: string]: string;
}

export interface VisibilityTemplateConfig {
  /**
   * A group entry applies to all panels in the group.
   */
  groups?: VisibilitySectionConfig;
  /**
   * Individual panel configuration. If a panel is included in a group with a visibility setting, the individual panel setting will be ignored in favor of the group setting.
   */
  items?: VisibilitySectionConfig;
}

export interface CardSectionArrangement {
  header_cards?: LovelaceCardConfig[];
  footer_cards?: LovelaceCardConfig[];
}

/**
 * Add custom cards to the top and bottom of the sidebar section.
 * - top_container: cards to be added to the top section of the sidebar.
 * - bottom_container: cards to be added to the bottom section of the sidebar.
 */
export interface CustomCardsConfig {
  top_container?: CardSectionArrangement;
  bottom_container?: CardSectionArrangement;
}

export interface SidebarConfig extends SidebardPanelConfig, SidebarAppearanceConfig {
  default_collapsed?: string[];
  color_config?: SidebarColorConfig;
  notification?: NotificationConfig;
  new_items?: NewItemConfig[];
  pinned_groups?: PinnedGroupsConfig;
  /**
   * Make remaining items as single group 'Uncategorized' with default order (if true) or custom order (if string[]).
   * - true: all items with default order (alphabetical).
   * - string[]: items in the specified order. Items not included in the array will be placed at the end of the 'Uncategorized' group in default order.
   */
  uncategorized_items?: boolean | string[];
  visibility_templates?: VisibilityTemplateConfig;
  custom_cards?: CustomCardsConfig;
  /**
   * Hide header when scrolling down and show it when scrolling up. This is a personal feature for the developer and not mentioned in the readme as it is not a core part of the plugin.
   */
  scroll_hide_header?: boolean;
}
