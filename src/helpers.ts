import YAML from 'yaml';

import { CONFIG_NAME, CONFIG_PATH, NAMESPACE_TITLE, PANEL_ICONS, STORAGE } from './const';
import { DividerColorSettings, HaExtened, PanelInfo, SidebarConfig } from './types';
import { color2rgba, randomId, setStorage } from './utils';

const HELPERS = (window as any).loadCardHelpers ? (window as any).loadCardHelpers() : undefined;
let helpers: any;
if ((window as any).loadCardHelpers) {
  helpers = await (window as any).loadCardHelpers();
} else if (HELPERS) {
  helpers = HELPERS;
}

export const getStorageConfig = (): SidebarConfig | undefined => {
  const config = localStorage.getItem(STORAGE.UI_CONFIG);
  if (!config || JSON.parse(config).length === 0) return undefined;
  return JSON.parse(config);
};

export const sidebarUseConfigFile = (): boolean => {
  const useJson = localStorage.getItem(STORAGE.USE_CONFIG_FILE) || '""';
  return JSON.parse(useJson) === 'true';
};

export const fetchLocalConfig = async (): Promise<SidebarConfig | undefined> => {
  const errorNotFound = `${CONFIG_NAME} not found. Make sure you have a valid ${CONFIG_NAME}.yaml file in your www folder.`;
  const randomUrl = `${CONFIG_PATH}?hash=${randomId()}`;
  try {
    const response = await fetch(randomUrl, { cache: 'no-store' });
    const yamlStr = await response.text();
    const data = YAML.parse(yamlStr);
    // console.log('data', data);
    return data;
  } catch (e) {
    console.error(`${errorNotFound}`, e);
    return undefined;
  }
};

export const fetchConfig = async (): Promise<SidebarConfig | undefined> => {
  if (sidebarUseConfigFile()) {
    return fetchLocalConfig();
  }
  return getStorageConfig();
};

export const isColorMissing = (colors: DividerColorSettings): boolean => {
  const requiredKeys: (keyof DividerColorSettings)[] = [
    'divider_color',
    'background_color',
    'border_top_color',
    'scrollbar_thumb_color',
    'custom_sidebar_background_color',
  ];

  const result = requiredKeys.some((key) => colors[key] === undefined || colors[key] === null);
  if (result) {
    console.log(
      'isColorMissing',
      result,
      'missing',
      requiredKeys.filter((key) => colors[key] === undefined || colors[key] === null)
    );
  }
  return result;
};

const isStoragePanelEmpty = (): boolean => {
  const storagePanel = localStorage.getItem(STORAGE.PANEL_ORDER);
  return !storagePanel || JSON.parse(storagePanel).length === 0;
};

export const _handleFirstPanels = (paperListbox: HTMLElement): void => {
  if (!isStoragePanelEmpty()) return;

  const children = paperListbox.children;
  const spacerIndex = Array.from(children).findIndex((child) => child.classList.contains('spacer'));
  const panelOrder = Array.from(children)
    .slice(0, spacerIndex)
    .map((child) => child.getAttribute('data-panel'));
  setStorage(STORAGE.PANEL_ORDER, panelOrder);
};

export const getCssValue = (cssKey: string, element?: HTMLElement): string => {
  if (element) {
    return window.getComputedStyle(element).getPropertyValue(cssKey);
  }
  return window.getComputedStyle(document.documentElement).getPropertyValue(cssKey);
};

export const getCssFromElValue = (element: HTMLElement, cssKey: string): string => {
  return window.getComputedStyle(element).getPropertyValue(cssKey);
};

export const getDefaultThemeColors = (element?: HTMLElement): DividerColorSettings => {
  const getCssValue = (cssKey: string): string => {
    if (element) {
      return window.getComputedStyle(element).getPropertyValue(cssKey);
    }
    return window.getComputedStyle(document.documentElement).getPropertyValue(cssKey);
  };
  const divider_color = getCssValue('--divider-color');
  const scrollbarColor = getCssValue('--scrollbar-thumb-color');
  const custom_sidebar_background_color = getCssValue('--sidebar-background-color');
  const textColor = getCssValue('--sidebar-text-color');

  const background_color = color2rgba(divider_color, 3) || divider_color;
  const border_top_color = divider_color;
  const scrollbar_thumb_color = scrollbarColor;

  return {
    divider_color,
    background_color,
    border_top_color,
    scrollbar_thumb_color,
    custom_sidebar_background_color,
    divider_text_color: textColor,
  };
};

export const getPreviewItems = (hass: HaExtened['hass'], config: SidebarConfig) => {
  const hassPanels = hass?.panels;
  const defaultPanel = hass.defaultPanel;

  // Helper function to create PanelInfo items
  const createPanelItems = (items: string[]): PanelInfo[] => {
    return items.map((item) => ({
      title: hass.localize(`panel.${hassPanels[item]?.title}`) || hassPanels[item]?.title || item,
      icon: hassPanels[item]?.icon || PANEL_ICONS[item],
    }));
  };

  // Default Lovelace panel
  const _panelItems: Record<string, PanelInfo[]> = {
    defaultPage: [
      {
        title: hassPanels[defaultPanel]?.title || hass.localize('panel.states'),
        icon: hassPanels[defaultPanel]?.icon || PANEL_ICONS.lovelace,
      },
    ],
  };

  const firstGroup = Object.entries(config.custom_groups || {})[0];
  const lastGroup = Object.entries(config.custom_groups || {})?.slice(-1)[0];

  // Panels for custom groups
  if (firstGroup) {
    _panelItems[firstGroup[0]] = createPanelItems(firstGroup[1]);
  }
  if (lastGroup && lastGroup[0] !== firstGroup[0]) {
    _panelItems[lastGroup[0]] = createPanelItems(lastGroup[1]);
  }

  // Bottom panels
  _panelItems['bottomItems'] = createPanelItems(config.bottom_items || []);
  _panelItems['bottomSystem'] = createPanelItems(['developer-tools', 'config']);

  // console.log(_panelItems);
  return _panelItems;
};

export const showConfirmDialog = async (
  element: HTMLElement,
  message: string,
  confirmText: string,
  cancelText?: string
): Promise<boolean> => {
  const result = await helpers.showConfirmationDialog(element, {
    title: NAMESPACE_TITLE,
    text: message,
    confirmText,
    dismissText: cancelText ? cancelText : 'Cancel',
  });

  console.log('showConfirmDialog', result);
  return result;
};

export const showPromptDialog = async (
  element: HTMLElement,
  text: string,
  placeholder: string,
  confirmText: string
): Promise<string | null> => {
  const result = await helpers.showPromptDialog(element, {
    title: NAMESPACE_TITLE,
    text,
    placeholder,
    confirmText,
    inputType: 'string',
    defaultValue: '',
  });

  console.log('showPromptDialog', result);
  return result;
};

export const showAlertDialog = async (element: HTMLElement, message: string): Promise<void> => {
  await helpers.showAlertDialog(element, {
    title: NAMESPACE_TITLE,
    text: message,
  });
};
