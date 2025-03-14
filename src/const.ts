import { version, repository } from '../package.json';

export const NAMESPACE = 'sidebar-organizer';
export const NAMESPACE_TITLE = 'Sidebar Organizer';
export const VERSION = `v${version}`;
export const REPO_URL = `${repository.url}`;

export const CONFIG_NAME = 'sidebar-organizer';
export const CONFIG_PATH = '/local/sidebar-organizer.yaml';

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
    first_group: [
      { title: 'Item 1', icon: 'mdi:numeric-1' },
      { title: 'Item 2', icon: 'mdi:numeric-2' },
    ],
    second_group: [
      { title: 'Item 3', icon: 'mdi:numeric-3' },
      { title: 'Item 4', icon: 'mdi:numeric-4' },
    ],
  },
};
