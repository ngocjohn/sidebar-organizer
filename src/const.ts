import { version, repository } from '../package.json';

export const NAMESPACE = 'sidebar-organizer';
export const NAMESPACE_TITLE = 'Sidebar Organizer';
export const VERSION = `v${version}`;
export const REPO_URL = `${repository.url}`;

export const CONFIG_NAME = 'sidebar-organizer';
export const CONFIG_PATH = '/local/sidebar-organizer.yaml';

export enum STORAGE {
  UI_CONFIG = 'sidebarOrganizerConfig',
  USE_CONFIG_FILE = 'sidebarOrganizerUseConfigFile',
  PANEL_ORDER = 'sidebarPanelOrder',
  COLLAPSE = 'sidebarCollapsedGroups',
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
