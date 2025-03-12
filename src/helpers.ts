import { applyThemesOnElement } from 'custom-card-helpers';
import YAML from 'yaml';

import { CONFIG_NAME, CONFIG_PATH, NAMESPACE_TITLE, PANEL_ICONS, STORAGE } from './const';
import { DividerColorSettings, HaExtened, PanelInfo, SidebarConfig } from './types';
import { color2rgba, getStorage, randomId, setStorage } from './utils';

const HELPERS = (window as any).loadCardHelpers ? (window as any).loadCardHelpers() : undefined;
let helpers: any;
if ((window as any).loadCardHelpers) {
  helpers = await (window as any).loadCardHelpers();
} else if (HELPERS) {
  helpers = HELPERS;
}

export const getHiddenPanels = (): string[] => {
  const hiddenPanels = localStorage.getItem(STORAGE.HIDDEN_PANELS);
  return hiddenPanels ? JSON.parse(hiddenPanels) : [];
};

export const getStorageConfig = (): SidebarConfig | undefined => {
  const config = localStorage.getItem(STORAGE.UI_CONFIG);
  if (!config || JSON.parse(config).length === 0) return undefined;
  return JSON.parse(config);
};

export const sidebarUseConfigFile = (): boolean => {
  const useJson = localStorage.getItem(STORAGE.USE_CONFIG_FILE) || '""';
  return JSON.parse(useJson) === 'true';
};

export const fetchFileConfig = async (): Promise<SidebarConfig | undefined> => {
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
  const hiddenPanels = getHiddenPanels();
  let config = sidebarUseConfigFile() ? await fetchFileConfig() : getStorageConfig();
  if (config) {
    config = validateConfig(config, hiddenPanels);
    _changeStorageConfig(config);
  }
  return config;
};

export const getStoragePanelOrder = (): Boolean => {
  const storagePanel = getStorage(STORAGE.PANEL_ORDER) || '[]';
  if (!storagePanel || JSON.parse(storagePanel).length === 0) return false;
  return true;
};

const _changeStorageConfig = (config: SidebarConfig): void => {
  if (sidebarUseConfigFile()) return;
  const currentConfig = getStorageConfig();
  const isConfigDifferent = JSON.stringify(currentConfig) !== JSON.stringify(config);
  if (isConfigDifferent) {
    console.log('changeStorageConfig', config);
    setStorage(STORAGE.UI_CONFIG, config);
  } else {
    return;
  }
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
  const iconColor = getCssValue('--sidebar-icon-color');

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
    sidebar_icon_color: iconColor,
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

export const validateConfig = (config: SidebarConfig, hiddenPanels: string[]): SidebarConfig => {
  if (hiddenPanels.length === 0) return config;
  const _config = { ...config };
  const _groups = { ...(config.custom_groups || {}) };
  let _items = [...(config.bottom_items || [])];

  hiddenPanels.forEach((panel) => {
    Object.entries(_groups).forEach(([key, value]) => {
      if (value.includes(panel)) {
        _groups[key] = value.filter((item) => item !== panel);
      }
    });
    _items = _items.filter((item) => item !== panel);
  });

  _config.hidden_items = hiddenPanels;
  _config.custom_groups = _groups;
  _config.bottom_items = _items;
  // console.log('validateConfig', _config);
  return _config;
};

export const applyTheme = (element: any, hass: HaExtened['hass'], theme: string, mode?: string): void => {
  if (!element) return;
  console.log('applyTheme', theme, mode);
  const themeData = hass.themes.themes[theme];
  if (themeData) {
    // Filter out only top-level properties for CSS variables and the modes property
    const filteredThemeData = Object.keys(themeData)
      .filter((key) => key !== 'modes')
      .reduce(
        (obj, key) => {
          obj[key] = themeData[key];
          return obj;
        },
        {} as Record<string, string>
      );

    if (!mode) {
      mode = hass.themes.darkMode ? 'dark' : 'light';
      // Get the current mode (light or dark)
    } else {
      mode = mode;
    }
    const modeData = themeData.modes && typeof themeData.modes === 'object' ? themeData.modes[mode] : {};
    // Merge the top-level and mode-specific variables
    // const allThemeData = { ...filteredThemeData, ...modeData };
    const allThemeData = { ...filteredThemeData, ...modeData };
    const allTheme = { default_theme: hass.themes.default_theme, themes: { [theme]: allThemeData } };
    applyThemesOnElement(element, allTheme, theme, false);
  }
};

export const getCollapsedItems = (
  customGroups: SidebarConfig['custom_groups'] = {},
  defaultCollapsed: SidebarConfig['default_collapsed'] = []
): Set<string> => {
  const sidebarCollapsed = JSON.parse(getStorage(STORAGE.COLLAPSE) || '[]');
  const groupKeys = Object.keys(customGroups);

  // Filter out collapsed items that don't exist in the group keys
  const validCollapsedItems = sidebarCollapsed.filter((key: string) => groupKeys.includes(key));

  // Update storage if the filtered items are different
  if (validCollapsedItems.length !== sidebarCollapsed.length) {
    setStorage(STORAGE.COLLAPSE, validCollapsedItems);
  }
  const collapsedItems = new Set([...validCollapsedItems, ...defaultCollapsed]);
  // console.log('getCollapsedItems', collapsedItems);
  return collapsedItems;
};

export const getInitPanelOrder = (paperListBox: HTMLElement): string[] | null => {
  if (!isStoragePanelEmpty()) {
    // console.log('panel order already set');
    return null;
  } else {
    const children = paperListBox.children;
    const spacerIndex = Array.from(children).findIndex((child) => child.classList.contains('spacer'));
    const panelOrder = Array.from(children)
      .slice(0, spacerIndex)
      .map((child) => child.getAttribute('data-panel'))
      .filter((panel) => panel !== null);
    setStorage(STORAGE.PANEL_ORDER, panelOrder);
    return panelOrder;
  }
};

export const resetPanelOrder = (paperListBox: HTMLElement): void => {
  const scrollbarItems = paperListBox!.querySelectorAll('a') as NodeListOf<HTMLElement>;
  const bottomItems = Array.from(scrollbarItems).filter((item) => item.hasAttribute('moved'));
  bottomItems.forEach((item) => {
    const nextItem = item.nextElementSibling;
    if (nextItem && nextItem.classList.contains('divider')) {
      paperListBox.removeChild(nextItem);
    }
    paperListBox.removeChild(item);
  });
};
