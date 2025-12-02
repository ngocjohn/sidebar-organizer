import { SidebarConfig } from '@types';

import { version, repository } from '../../package.json';

export * from './dom';
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
  HA_VERSION = 'ha-version',
  BLOCK_SIDEBAR_EDIT = 'blockSidebarEdit',
}

export enum HA_EVENT {
  SETTHEME = 'settheme',
  DEFAULT_PANEL = 'hass-default-panel',
  DIALOG_CLOSED = 'dialog-closed',
  LOCATION_CHANGED = 'location-changed',
  SHOW_DIALOG = 'show-dialog',
  SIDEBAR_CONFIG_SAVED = 'save-sidebar-organizer-config',
  HASS_EDIT_SIDEBAR = 'hass-edit-sidebar',
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
  new_items: [],
};

export const ALERT_MSG = {
  ITEMS_DIFFERENT: 'The items in config file do not match the items in the sidebar. Check console for more details.',
  CONFIG_VALID: 'The configuration is valid.',
  CONFIG_INVALID: 'The configuration is invalid. Below are the errors found in the configuration.',
  INFO_EDIT_UPLOAD_CONFIG:
    'You can edit invalid items in the editor and validate the configuration again. You can also upload a new config file.',
  CONFIG_EMPTY: 'You dont have any configuration yet.',
  USE_CONFIG_FILE: `Currently Sidebar Organizer uses the config file. If config is valid, you can save and migrate it to the browser's local storage.`,
  NAME_EXISTS: 'The name already exists. Choose another name.',
  CONFIRM_DELETE: 'Are you sure you want to delete the current configuration?',
  NOT_COMPATIBLE: 'Sidebar Organizer is not compatible with this version of Home Assistant',
  VERSION_INFO: `More info: ${REPO_URL}/issues/16`,
  HAS_SIDEBAR_CONFIG_WARNING: `You have a saved sidebar configuration in your browser's local storage. Modifying the sidebar using the built-in Home Assistant dialog will disable Sidebar Organizer configuration and reset the sidebar to its default state. Do you want to edit the sidebar using Sidebar Organizer instead?`,
  INVALID_UPLOADED_CONFIG:
    'The uploaded config is invalid with some errors. Fix them in the editor or upload a new config file.',
  CONFIG_CHANGED: 'The configuration has been changed. Do you want to save it?',
  CLEAN_USER_DATA: `For using sidebar organizer you need to clear your synced settings in this user's Home Assistant profile.`,
  CLEAN_SUCCESS_RELOAD: `Your synced settings have been cleared successfully.  Click 'OK' reload the page to apply the changes.`,
  LEGACY_EDIT_WARNING:
    'You have Sidebar Organizer installed. It is recommended to use Sidebar Organizer Dialog to edit the sidebar. Do you want to open Sidebar Organizer Dialog instead?',
  FRONTEND_MODULE: 'You may experience issues when plugin is not loaded as a module.',
  INSTALLATION_LINK: `See: ${REPO_URL}#installation`,
};
