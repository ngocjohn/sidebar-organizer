import { CONFIG_NAME, STORAGE } from '@constants';
import { HaExtened, PANEL_TYPE, SidebarConfig, SidebardPanelConfig } from '@types';
import { getPanelsNotShownInSidebar } from '@utilities/compute-panels';
import { cleanItemsFromConfig } from '@utilities/configs/clean-items';
import { getDefaultPanelUrlPath } from '@utilities/panel';
import { pick } from 'es-toolkit/compat';

import * as LOGGER from '../logger';
import { getHiddenPanels, getStorageConfig, setStorage, sidebarUseConfigFile } from '../storage-utils';

export type INVALID_CONFIG = {
  valid: boolean;
  config: SidebarConfig;
  duplicateItems?: string[];
  invalidItems?: string[];
  noTitleItems?: string[];
  hasDefaultInGroupsOrBottom?: boolean;
};

export type InvalidItemKeys = Exclude<keyof INVALID_CONFIG, 'valid' | 'config'>;
export const INVALID_ITEM_KEYS: InvalidItemKeys[] = [
  'duplicateItems',
  'invalidItems',
  'noTitleItems',
  'hasDefaultInGroupsOrBottom',
];

export const InvalidItemLabels: Record<InvalidItemKeys, string> = {
  duplicateItems: 'Duplicated items',
  invalidItems: 'Items not exist',
  noTitleItems: 'Items not showing in sidebar',
  hasDefaultInGroupsOrBottom: 'Default panel included',
};

export const validateConfig = (config: SidebarConfig, hidden?: string[]): SidebarConfig => {
  const hiddenPanels: string[] = hidden || getHiddenPanels();
  if (!hiddenPanels.length) return config;

  const configToUpdate = pick(config, [
    PANEL_TYPE.CUSTOM,
    PANEL_TYPE.BOTTOM,
    PANEL_TYPE.BOTTOM_GRID,
  ]) as SidebardPanelConfig;
  const updatedPanels = cleanItemsFromConfig(configToUpdate, hiddenPanels);
  let defaultCollapsed = [...(config.default_collapsed || [])];
  defaultCollapsed = defaultCollapsed.filter((item) => updatedPanels.custom_groups?.[item]);
  const validatedConfig: SidebarConfig = {
    ...config,
    ...updatedPanels,
    ...(defaultCollapsed.length > 0 && { default_collapsed: defaultCollapsed }),
    hidden_items: hiddenPanels,
  };

  return validatedConfig;
};

export const getAllConfigItems = (config: SidebarConfig): string[] => {
  const newItems = Array.from(config.new_items || []).map((item) => item.title!);
  return [
    ...Object.values(config.custom_groups || {}).flat(),
    ...(config.bottom_items || []),
    ...(config.bottom_grid_items || []),
    ...(config.hidden_items || []),
  ].filter((item) => !newItems.includes(item));
};

export const findDuplicateItems = (custom: string[], bottom: string[], bottomGrid: string[]): string[] => {
  let duplicateItemList: string[] = [];
  const itemCount: { [key: string]: number } = {};

  const allItems = [...custom, ...bottom, ...bottomGrid];

  allItems.forEach((item) => {
    itemCount[item] = (itemCount[item] || 0) + 1;
  });

  duplicateItemList = Object.keys(itemCount).filter((item) => itemCount[item] > 1);

  return duplicateItemList;
};

export const isDefaultIncluded = (
  defaultPanel: string | undefined,
  custom: string[],
  bottom: string[],
  grid: string[]
): boolean => {
  return Boolean(
    defaultPanel && (custom.includes(defaultPanel) || bottom.includes(defaultPanel) || grid.includes(defaultPanel))
  );
};

export const isItemsValid = (
  config: SidebarConfig,
  hass: HaExtened['hass'],
  log: boolean = false
): boolean | INVALID_CONFIG => {
  let allItems = [
    ...Object.values(config.custom_groups || {}).flat(),
    ...(config.bottom_items || []),
    ...(config.bottom_grid_items || []),
    ...(config.hidden_items || []),
  ];
  // console.log('allItems to validate', allItems);
  if (allItems.length === 0) {
    return log ? { valid: true, config } : true;
  }
  const newConfigItems = Array.from(config.new_items || []).map((item) => item.title!);
  allItems = allItems.filter((item) => !newConfigItems.includes(item));

  const defaultPanel = getDefaultPanelUrlPath(hass);
  const customGroups = Object.values(config.custom_groups || {}).flat();
  const bottomItems = config.bottom_items || [];
  const bottomGridItems = config.bottom_grid_items || [];

  // Check if default panel is in custom groups or bottom items
  const hasDefaultInGroupsOrBottom = isDefaultIncluded(defaultPanel, customGroups, bottomItems, bottomGridItems);
  // Find duplicated items
  const duplicateItems = findDuplicateItems(customGroups, bottomItems, bottomGridItems);
  const hiddenSidebarItems = getPanelsNotShownInSidebar(hass.panels, defaultPanel) || [];

  const haPanelKeys = Object.keys(hass.panels);

  const invalidItems = allItems.filter((item) => !haPanelKeys.includes(item));
  const noTitleItems = allItems.filter((item) => hiddenSidebarItems.includes(item));

  const valid =
    duplicateItems.length === 0 &&
    invalidItems.length === 0 &&
    noTitleItems.length === 0 &&
    !hasDefaultInGroupsOrBottom;

  const configResult: INVALID_CONFIG = {
    valid,
    config,
    duplicateItems,
    invalidItems,
    noTitleItems,
    hasDefaultInGroupsOrBottom,
  };

  if (!valid) {
    const logTitle = `${CONFIG_NAME}: Config is not valid.`;
    console.groupCollapsed(`%c${logTitle}`, 'color: #ff9800; font-weight: bold;');
    INVALID_ITEM_KEYS.forEach((key) => {
      const items = configResult[key] as string[];
      if (items && items.length > 0) {
        LOGGER.debug(`${InvalidItemLabels[key]}:`, items);
      }
    });
    if (hasDefaultInGroupsOrBottom) {
      LOGGER.debug(`Default panel "${defaultPanel}" should not be included in custom groups or bottom items.`); // default panel should not be included in groups or bottom
    }
    console.groupEnd();
  }

  if (log) {
    return configResult;
  }

  return valid;
};

export const tryCorrectConfig = (config: SidebarConfig, hass: HaExtened['hass']): SidebarConfig => {
  const haPanelKeys = Object.keys(hass.panels);
  let allItems = getAllConfigItems(config);

  const defaultPanel = getDefaultPanelUrlPath(hass);

  const customGroups = Object.values(config.custom_groups || {}).flat();
  const bottomItems = config.bottom_items || [];
  const bottomGridItems = config.bottom_grid_items || [];

  // Find duplicated items
  const duplicateItems = findDuplicateItems(customGroups, bottomItems, bottomGridItems);

  const hasDefaultInGroupsOrBottom = isDefaultIncluded(defaultPanel, customGroups, bottomItems, bottomGridItems);

  const hiddenSidebarItems = getPanelsNotShownInSidebar(hass.panels, defaultPanel) || [];

  const diffItems = allItems.filter((item) => !haPanelKeys.includes(item));
  const noTitleItems = allItems.filter((item) => hiddenSidebarItems.includes(item));

  const invalidItems = new Set([...diffItems, ...noTitleItems]);
  if (hasDefaultInGroupsOrBottom && defaultPanel) {
    invalidItems.add(defaultPanel);
  }

  const logValidation = {
    duplicateItems,
    diffItems,
    noTitleItems,
    invalidItems: Array.from(invalidItems),
    allItems,
    hasDefaultInGroupsOrBottom,
  };

  // Remove invalid items from custom groups, bottom items, bottom grid items and hidden items
  const configToUpdate = pick(config, [
    PANEL_TYPE.CUSTOM,
    PANEL_TYPE.BOTTOM,
    PANEL_TYPE.BOTTOM_GRID,
    PANEL_TYPE.HIDDEN,
  ]) as SidebardPanelConfig;
  const updatedPanels = cleanItemsFromConfig(configToUpdate, invalidItems);

  let updatedGroups = updatedPanels.custom_groups || {};
  if (duplicateItems.length > 0) {
    // clean again to remove duplicates after removing invalid items
    updatedGroups = cleanItemsFromConfig({ custom_groups: updatedGroups }, [...duplicateItems]).custom_groups || {};
  }

  const correctedConfig: SidebarConfig = {
    ...config,
    ...updatedPanels,
    custom_groups: updatedGroups,
  };

  console.debug('Config validation result:', logValidation, {
    originalConfig: config,
    correctedConfig,
  });

  return correctedConfig;
};

export const _changeStorageConfig = (config: SidebarConfig): void => {
  if (sidebarUseConfigFile()) return;

  const currentConfig = getStorageConfig();
  const isConfigDifferent = JSON.stringify(currentConfig) !== JSON.stringify(config);

  if (isConfigDifferent) {
    //info
    console.log('%cVALIDATORS:%c ℹ️ Config changed.. updating to storage', 'color: #4dabf7;', 'color: #228be6;', {
      currentConfig,
      newConfig: config,
    });

    setStorage(STORAGE.UI_CONFIG, config);
  }
};
