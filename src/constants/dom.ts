export enum SELECTOR {
  SIDEBAR_SCROLLBAR = 'ha-md-list.ha-scrollbar',
  SPACER = '.spacer',
  USER = '.user',
  MENU = '.menu',
  MENU_TITLE = '.title',
  DIVIDER = '.divider',
  DIVIDER_ADDED = 'div.divider[added]',
  SIDEBAR_CONFIG_DIALOG = '#sidebar-organizer-config-dialog',
  SELECTED = '.selected',
  HEADER_TOGGLE_ICON = 'ha-icon.collapse-toggle',
  ADDED_CONTENT = '.added-content',
  BADGE = '.badge',
  NOTIFY_ICON = 'ha-icon.badge',
  HA_SVG_ICON = 'ha-svg-icon',
  ITEM_TEXT = '.item-text',
  ITEM_PROFILE = 'ha-md-list-item[href="/profile"]',
  DEV_TOOLS = 'ha-md-list-item[data-panel="developer-tools"]',
  USER_ITEM = 'ha-md-list-item.user',
  ACTION_SLOT = 'div[slot="actions"]',
  HA_DIALOG_FOOTER = 'ha-dialog-footer',
  FOOTER = 'footer',
}
export enum ELEMENT {
  ITEM = 'ha-md-list-item',
  HA_SVG_ICON = 'ha-svg-icon',
  HA_ICON = 'ha-icon',
  HA_ICON_BUTTON = 'ha-icon-button',
  ANCHOR = 'a',
  BUTTON = 'button',
  MD_RIPPLE = 'md-ripple',
  USER_BADGE = 'ha-user-badge',
  SIDEBAR_CONFIG_DIALOG = 'sidebar-organizer-config-dialog',
  SIDEBAR_CONFIG_DIALOG_WRAPPER = 'sidebar-organizer-dialog',
  HA_BUTTON = 'ha-button',
  ADDED_DIVIDER = 'div.divider[added]',
  DIVIDER = 'div.divider',
  CONFIG_DASHBOARDS = 'ha-config-lovelace-dashboards',
  DIALOG_EDIT_SIDEBAR = 'dialog-edit-sidebar',
  ITEMS_DISPLAY_EDITOR = 'ha-items-display-editor',
  HA_MD_LIST = 'ha-md-list',
}

export enum CLASS {
  COLLAPSED = 'collapsed',
  SELECTED = 'selected',
  SPACER = 'spacer',
  BADGE = 'badge',
  LARGE_BADGE = 'large-badge',
  NO_VISIBLE = 'no-visible',
  BADGE_NUMBER = 'badge-number',
  COLLAPSE_TOGGLE = 'collapse-toggle',
  ACTIVE = 'active',
  ADDED_CONTENT = 'added-content',
}

export enum ATTRIBUTE {
  ROLE = 'role',
  PROCESSED = 'data-processed',
  TAB_INDEX = 'tabindex',
  DISABLED = 'disabled',
  HREF = 'href',
  SLOT = 'slot',
  TYPE = 'type',
  DATA_NOTIFICATION = 'data-notification',
  DATA_PANEL = 'data-panel',
  NEW_ITEM = 'new-item',
  GRID_ITEM = 'grid-item',
  BOTTOM = 'bottom',
  MOVED = 'moved',
  UNGROUPED = 'ungrouped',
  GROUP = 'group',
  ADDED = 'added',
}

export enum SLOT {
  PRIMARY_ACTION = 'primaryAction',
  SECONDARY_ACTION = 'secondaryAction',
}

export enum CUSTOM_EVENT {
  CONFIG_DIFF = 'config-diff',
  UI_EDITOR = 'ui-editor',
}

export enum EVENT {
  MOUSEENTER = 'mouseenter',
  MOUSELEAVE = 'mouseleave',
  TOUCHSTART = 'touchstart',
  MOUSEDOWN = 'mousedown',
}

export enum MDI {
  PLUS = 'mdi:plus',
  MINUS = 'mdi:minus',
}

export const SHOW_AFTER_BOTTOM = ['/developer-tools', '/config'];
