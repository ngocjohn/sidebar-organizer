import type { HomeAssistant } from '../types/ha';
import type { NewItemConfig, PanelInfo, SidebarPanelItem } from '@types';

import { ATTRIBUTE, CLASS, ELEMENT } from '@constants';

import { ACTION_TYPES, addHandlerActions } from './tap-action';

/** Panel to show when no panel is picked. */
export const DEFAULT_PANEL = 'lovelace';

export const getLegacyDefaultPanelUrlPath = (): string | null => {
  const defaultPanel = window.localStorage.getItem('defaultPanel');
  return defaultPanel ? JSON.parse(defaultPanel) : null;
};

export const getDefaultPanelUrlPath = (hass: HomeAssistant): string =>
  hass.userData?.default_panel || hass.systemData?.default_panel || getLegacyDefaultPanelUrlPath() || DEFAULT_PANEL;

export const getDefaultPanel = (hass: HomeAssistant): PanelInfo => {
  const panel = getDefaultPanelUrlPath(hass);

  return (panel ? hass.panels[panel] : undefined) ?? hass.panels[DEFAULT_PANEL];
};

export const getPanelNameTranslationKey = (panel: PanelInfo) => {
  if (panel.url_path === 'lovelace') {
    return 'panel.states' as const;
  }

  if (panel.url_path === 'profile') {
    return 'panel.profile' as const;
  }

  return `panel.${panel.title}` as const;
};

export const getPanelTitle = (hass: HomeAssistant, panel: PanelInfo): string | undefined => {
  const translationKey = getPanelNameTranslationKey(panel);

  return hass.localize(translationKey) || panel.title || undefined;
};

export const getPanelTitleFromUrlPath = (hass: HomeAssistant, urlPath: string): string | undefined => {
  if (!hass.panels) {
    return undefined;
  }

  const panel = Object.values(hass.panels).find((p: PanelInfo): boolean => p.url_path === urlPath);

  if (!panel) {
    return undefined;
  }

  return getPanelTitle(hass, panel);
};

export const getPanelIcon = (panel: PanelInfo): string | undefined => {
  if (!panel.icon) {
    switch (panel.component_name) {
      case 'profile':
        return 'mdi:account';
      case 'lovelace':
        return 'mdi:view-dashboard';
    }
  }

  return panel.icon || undefined;
};

export const FIXED_PANELS = ['profile', 'config'];
export const SHOW_AFTER_SPACER_PANELS = ['developer-tools'];
export const BUILT_IN_PANELS = ['home', 'light', 'climate', 'security', 'lovelace'];

export const isBuiltInPanel = (urlPath: string): boolean => BUILT_IN_PANELS.includes(urlPath);

export const computeNewItem = (
  hass: HomeAssistant,
  itemConfig: NewItemConfig,
  builtIn: boolean = false
): SidebarPanelItem => {
  let title = itemConfig.title;
  let icon = itemConfig.icon;
  let urlPath = itemConfig.url_path;

  if (builtIn) {
    itemConfig = itemConfig as PanelInfo;
    title = getPanelTitle(hass, itemConfig) || title;
    icon = itemConfig.icon;
    urlPath = `/${itemConfig.url_path}`;
  }

  const hasAction = ACTION_TYPES.some((action) => itemConfig[action] !== undefined);

  const item = document.createElement(ELEMENT.ITEM) as SidebarPanelItem;
  item.setAttribute(ATTRIBUTE.TYPE, 'link');

  item.href = hasAction ? '#' : (urlPath ?? '#');
  item.target = itemConfig.target ?? '';
  item.setAttribute(ATTRIBUTE.DATA_PANEL, builtIn ? itemConfig.url_path! : title!);
  item.setAttribute(ATTRIBUTE.NEW_ITEM, '');
  item.setAttribute('has-action', hasAction.toString());
  item.tabIndex = -1;

  const span = document.createElement('span');
  span.classList.add('item-text');
  span.setAttribute('slot', 'headline');
  span.innerText = title!;

  item.appendChild(span);

  const haIcon = document.createElement(ELEMENT.HA_ICON) as any;
  haIcon.setAttribute(ATTRIBUTE.SLOT, 'start');
  haIcon.icon = icon!;

  item.prepend(haIcon);
  if (hasAction) {
    addHandlerActions(item, itemConfig);
  }
  return item;
};

export const computeBadge = (): HTMLElement => {
  const badge = document.createElement('span');
  badge.classList.add(CLASS.BADGE);
  badge.classList.add(CLASS.NO_VISIBLE); // Start hidden
  badge.setAttribute(ATTRIBUTE.SLOT, 'end');
  return badge;
};

export const computeNotifyIcon = (): HTMLElement => {
  const notifyIcon = document.createElement('ha-icon');
  notifyIcon.classList.add(CLASS.BADGE);
  notifyIcon.classList.add(CLASS.NO_VISIBLE); // Start hidden
  notifyIcon.setAttribute(ATTRIBUTE.SLOT, 'end');
  return notifyIcon;
};
