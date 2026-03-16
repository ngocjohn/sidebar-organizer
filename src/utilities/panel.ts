import type { HomeAssistant } from '../types/ha';
import type { NewItemConfig, PanelInfo, SidebarPanelItem } from '@types';
import type { Panels } from '@types';
import type { Connection } from 'home-assistant-js-websocket';

import { ATTRIBUTE, CLASS, ELEMENT } from '@constants';
import { createCollection } from 'home-assistant-js-websocket';

import { hasItemAction, NavigateActionConfig, UrlActionConfig } from './action';
import { ACTION_TYPES, addHandlerActions, getActionConfig } from './tap-action';

export const HOME_PANEL = 'home';
export const NOT_FOUND_PANEL = 'notfound';
export const PROFILE_PANEL = 'profile';
export const LOVELACE_PANEL = 'lovelace';

/** Panel to show when no panel is picked. */
export const DEFAULT_PANEL = HOME_PANEL;

export const PANEL_DASHBOARDS = ['home', 'light', 'security', 'climate', 'energy'] as string[];

export const hasLegacyOverviewPanel = (hass: HomeAssistant): boolean => Boolean(hass.panels.lovelace?.config);

export const getLegacyDefaultPanelUrlPath = (): string | null => {
  const defaultPanel = window.localStorage.getItem('defaultPanel');
  return defaultPanel ? JSON.parse(defaultPanel) : null;
};

export const getDefaultPanelUrlPath = (hass: HomeAssistant): string => {
  const defaultPanel =
    hass.userData?.default_panel || hass.systemData?.default_panel || getLegacyDefaultPanelUrlPath() || DEFAULT_PANEL;
  // If default panel is lovelace and no old overview exists, fall back to home
  if (defaultPanel === LOVELACE_PANEL && !hasLegacyOverviewPanel(hass)) {
    return DEFAULT_PANEL;
  }
  return defaultPanel;
};

export const getDefaultPanel = (hass: HomeAssistant): PanelInfo => {
  const panel = getDefaultPanelUrlPath(hass);

  return (panel ? hass.panels[panel] : undefined) ?? hass.panels[DEFAULT_PANEL] ?? hass.panels[NOT_FOUND_PANEL];
};

export const getPanelNameTranslationKey = (panel: PanelInfo) => {
  if ([PROFILE_PANEL, NOT_FOUND_PANEL].includes(panel.url_path!)) {
    return `panel.${panel.url_path}` as const;
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
    }
  }

  return panel.icon || undefined;
};

export const fetchPanels = (conn) =>
  conn.sendMessagePromise({
    type: 'get_panels',
  });

export const subscribeUpdates = (conn, store) =>
  conn.subscribeEvents(() => fetchPanels(conn).then((panels) => store.setState(panels, true)), 'panels_updated');

export const subscribePanels = (conn: Connection, onChange: (panels: Panels) => void) =>
  createCollection<Panels>('_pnl', fetchPanels, subscribeUpdates, conn, onChange);

export const FIXED_PANELS = [PROFILE_PANEL, 'config', NOT_FOUND_PANEL];
export const SHOW_AFTER_SPACER_PANELS = ['developer-tools'];
export const BUILT_IN_PANELS = ['home', 'light', 'climate', 'security'];

export const isBuiltInPanel = (urlPath: string): boolean => BUILT_IN_PANELS.includes(urlPath);

const isLocationPath = (urlPath: string): boolean => {
  return urlPath.startsWith('/');
};
const convertUrlActionToNavigateAction = (action: UrlActionConfig): NavigateActionConfig => {
  return {
    action: 'navigate',
    navigation_path: action.url_path,
  };
};

export const computeNewItem = (
  hass: HomeAssistant,
  itemConfig: NewItemConfig,
  builtIn: boolean = false
): SidebarPanelItem => {
  let title = itemConfig.title;
  let icon = itemConfig.icon;
  let urlPath = itemConfig.url_path;

  const itemActionConfig = getActionConfig(itemConfig);
  const hasAction = hasItemAction(itemActionConfig);

  const actionNeedConvert = ACTION_TYPES.find(
    (action) =>
      itemActionConfig[action]?.action === 'url' &&
      isLocationPath((itemActionConfig[action] as UrlActionConfig).url_path ?? '')
  );

  if (hasAction && actionNeedConvert) {
    itemActionConfig[actionNeedConvert] = convertUrlActionToNavigateAction(itemActionConfig[actionNeedConvert]);
  }

  if (builtIn) {
    itemConfig = itemConfig as PanelInfo;
    title = getPanelTitle(hass, itemConfig) || title;
    icon = itemConfig.icon;
    urlPath = `/${itemConfig.url_path}`;
  }

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
  span.innerText = title ?? 'unknown';

  item.appendChild(span);

  const haIcon = document.createElement(ELEMENT.HA_ICON) as any;
  haIcon.setAttribute(ATTRIBUTE.SLOT, 'start');
  haIcon.icon = icon ?? 'mdi:bookmark-outline';

  item.prepend(haIcon);

  if (hasAction) {
    addHandlerActions(item, itemActionConfig);
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
