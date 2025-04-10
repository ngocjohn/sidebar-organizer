import { SidebarConfig } from '@types';

import { version, repository } from '../../package.json';

export const NAMESPACE = 'sidebar-organizer';
export const NAMESPACE_TITLE = 'Sidebar Organizer';
export const VERSION = `v${version}`;
export const REPO_URL = `${repository.url}`;

export const CONFIG_NAME = 'sidebar-organizer';
export const CONFIG_PATH = '/local/sidebar-organizer.yaml';

export enum PATH {
  LOVELACE_DASHBOARD = '/config/lovelace/dashboards',
}

export enum TAB_STATE {
  BASE = 'base',
  CODE = 'codeEditor',
}

export enum STORAGE {
  UI_CONFIG = 'sidebarOrganizerConfig',
  USE_CONFIG_FILE = 'sidebarOrganizerUseConfigFile',
  PANEL_ORDER = 'sidebarPanelOrder',
  COLLAPSE = 'sidebarCollapsedGroups',
  HIDDEN_PANELS = 'sidebarHiddenPanels',
}

export enum HA_EVENT {
  SETTHEME = 'settheme',
  DEFAULT_PANEL = 'hass-default-panel',
  DIALOG_CLOSED = 'dialog-closed',
  LOCATION_CHANGED = 'location-changed',
}

export const PANEL_ICONS = {
  'developer-tools': 'mdi:hammer',
  config: 'mdi:cog',
  lovelace: 'mdi:view-dashboard',
};

export const COLOR_CONFIG_KEYS = [
  { value: 'background_color', label: 'Background Color' },
  { value: 'border_top_color', label: 'Border Top Color' },
  { value: 'divider_color', label: 'Divider line color' },
  { value: 'scrollbar_thumb_color', label: 'Scrollbar thumb color' },
  { value: 'custom_sidebar_background_color', label: 'Sidebar background color' },
];

export const PREVIEW_MOCK_PANELS = {
  mockDefaultPage: [{ icon: 'mdi:home', title: 'Home' }],
  mockCustomGroups: {
    first_test_group: [
      { title: 'Example Item 1', icon: 'mdi:numeric-1' },
      { title: 'Example Item 2', icon: 'mdi:numeric-2' },
    ],
    second_test_group: [
      { title: 'Example Item 3', icon: 'mdi:numeric-3' },
      { title: 'Example Item 4', icon: 'mdi:numeric-4' },
    ],
  },
};

export const DEFAULT_CONFIG: SidebarConfig = {
  bottom_items: [],
  custom_groups: {},
  hide_header_toggle: false,
  default_collapsed: [],
  hidden_items: [],
};
