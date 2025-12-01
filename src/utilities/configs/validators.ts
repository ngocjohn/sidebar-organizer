import { CONFIG_NAME, STORAGE } from '@constants';
import { HaExtened, SidebarConfig } from '@types';
import { getDefaultPanel } from '@utilities/panel';

import * as LOGGER from '../logger';
import { getHiddenPanels, getStorageConfig, setStorage, sidebarUseConfigFile } from '../storage-utils';

export const validateConfig = (config: SidebarConfig, hidden?: string[]): SidebarConfig => {
  let hiddenPanels: string[] = [];
  if (!hidden) {
    hiddenPanels = getHiddenPanels();
  } else {
    hiddenPanels = hidden;
  }

  if (hiddenPanels.length === 0) return config;

  const newConfig = { ...config };
  const updatedGroups: Record<string, string[]> = {};

  for (const [key, groupItems] of Object.entries(config.custom_groups || {})) {
    updatedGroups[key] = groupItems.filter((item) => !hiddenPanels.includes(item));
  }

  const updatedBottomItems = (config.bottom_items || []).filter((item) => !hiddenPanels.includes(item));

  newConfig.hidden_items = hiddenPanels;
  newConfig.custom_groups = updatedGroups;
  newConfig.bottom_items = updatedBottomItems;

  // console.log('validateConfig', newConfig);
  return newConfig;
};

export const removeHiddenItems = (config: SidebarConfig, hidden?: string[]): SidebarConfig => {
  let hiddenPanels: string[] = [];
  if (!hidden) {
    hiddenPanels = getHiddenPanels();
  } else {
    hiddenPanels = hidden;
  }
  console.log('hidden to remove', hiddenPanels);
  const hiddenToRemove = new Set(hiddenPanels);

  // Remove invalid items from custom groups, bottom items, and hidden items
  const cleanItems = (items: string[]) => items.filter((item) => !hiddenToRemove.has(item));

  const updatedGroups = Object.fromEntries(
    Object.entries(config.custom_groups || {}).map(([key, items]) => [key, cleanItems(items)])
  );

  const updatedBottomItems = (config.bottom_items || []).filter((item) => !hiddenToRemove.has(item));
  console.log('updatedBottomItems', updatedBottomItems, 'updatedGroups', updatedGroups);

  const validatedConfig: SidebarConfig = {
    ...config,
    custom_groups: updatedGroups,
    bottom_items: updatedBottomItems,
    hidden_items: hiddenPanels,
  };
  console.log('removeHiddenItems', validatedConfig);
  return validatedConfig;
};

export const getDuplikatedItems = (custom: string[], bottom: string[]): string[] => {
  const duplikatedItems =
    custom.filter((item, index) => custom.indexOf(item) !== index) && custom.filter((item) => bottom.includes(item));
  return duplikatedItems;
};

export const isDefaultIncluded = (defaultPanel: string | undefined, custom: string[], bottom: string[]): boolean => {
  return Boolean(defaultPanel && (custom.includes(defaultPanel) || bottom.includes(defaultPanel)));
};

export type INVALID_CONFIG = {
  valid: boolean;
  config: SidebarConfig;
  duplikatedItems: string[];
  invalidItems: string[];
  noTitleItems: string[];
  hasDefaultInGroupsOrBottom?: boolean;
};

export const isItemsValid = (
  config: SidebarConfig,
  hass: HaExtened['hass'],
  log: boolean = false
): boolean | INVALID_CONFIG => {
  let allItems = [
    ...Object.values(config.custom_groups || {}).flat(),
    ...(config.bottom_items || []),
    ...(config.hidden_items || []),
  ];

  if (allItems.length === 0) {
    return log ? { valid: false, config, duplikatedItems: [], invalidItems: [], noTitleItems: [] } : false;
  }
  const newConfigItems = Array.from(config.new_items || []).map((item) => item.title!);
  allItems = allItems.filter((item) => !newConfigItems.includes(item));

  const defaultPanel = getDefaultPanel(hass).url_path;
  const customGroups = Object.values(config.custom_groups || {}).flat();
  const bottomItems = config.bottom_items || [];

  // Check if default panel is in custom groups or bottom items
  const hasDefaultInGroupsOrBottom = isDefaultIncluded(defaultPanel, customGroups, bottomItems);
  // Find duplicated items
  const duplikatedItems = getDuplikatedItems(customGroups, bottomItems);

  const haPanelKeys = Object.keys(hass.panels);

  const invalidItems = allItems.filter((item) => !haPanelKeys.includes(item));
  const noTitleItems = allItems.filter((item) => hass.panels[item] && !hass.panels[item].title);

  const valid =
    duplikatedItems.length === 0 &&
    invalidItems.length === 0 &&
    noTitleItems.length === 0 &&
    !hasDefaultInGroupsOrBottom;

  if (duplikatedItems.length > 0) {
    LOGGER.warn(`${CONFIG_NAME}: Config is not valid. Duplicated items: ${duplikatedItems.join(', ')}`);
    console.table(duplikatedItems);
  }

  if (invalidItems.length > 0) {
    LOGGER.warn(`${CONFIG_NAME}: Config is not valid. Items not exist: ${invalidItems.join(', ')}`);
    console.table(invalidItems);
  }

  if (noTitleItems.length > 0) {
    LOGGER.warn(`${CONFIG_NAME}: Items not showing in sidebar: ${noTitleItems.join(', ')}`);
    console.table(noTitleItems);
  }
  if (hasDefaultInGroupsOrBottom) {
    LOGGER.warn(
      `${CONFIG_NAME}: Config is not valid. Default panel "${defaultPanel}" should not be in custom groups or bottom items.`
    );
    console.table([defaultPanel]);
  }

  if (log) {
    return { valid, config, duplikatedItems, invalidItems, noTitleItems, hasDefaultInGroupsOrBottom };
  }

  return valid;
};

export const tryCorrectConfig = (config: SidebarConfig, hass: HaExtened['hass']): SidebarConfig => {
  console.log({ invalidConfig: config });
  const haPanelKeys = Object.keys(hass.panels);
  let allItems = [
    ...Object.values(config.custom_groups || {}).flat(),
    ...(config.bottom_items || []),
    ...(config.hidden_items || []),
  ];
  const newConfigItems = Array.from(config.new_items || []).map((item) => item.title!);
  // Filter out new items from allItems
  allItems = allItems.filter((item) => !newConfigItems.includes(item));

  const defaultPanel = getDefaultPanel(hass).url_path;
  const customGroups = Object.values(config.custom_groups || {}).flat();
  const bottomItems = config.bottom_items || [];

  // Find duplicated items
  const duplikatedItems = getDuplikatedItems(customGroups, bottomItems);
  const hasDefaultInGroupsOrBottom = isDefaultIncluded(defaultPanel, customGroups, bottomItems);

  const diffItems = allItems.filter((item) => !haPanelKeys.includes(item));
  const noTitleItems = allItems.filter((item) => hass.panels[item] && !hass.panels[item].title);

  const invalidItems = new Set([...diffItems, ...noTitleItems]);
  if (hasDefaultInGroupsOrBottom && defaultPanel) {
    invalidItems.add(defaultPanel);
  }

  console.log('tryCorrectConfig', {
    diffItems,
    noTitleItems,
    hasDefaultInGroupsOrBottom,
    invalidItems: Array.from(invalidItems),
    allItems,
    haPanelKeys,
    duplikatedItems,
  });

  // Remove invalid items from custom groups, bottom items, and hidden items
  const cleanItems = (items: string[]) => items.filter((item) => !invalidItems.has(item));

  let updatedGroups = Object.fromEntries(
    Object.entries(config.custom_groups || {}).map(([key, items]) => [key, cleanItems(items)])
  );

  const updatedBottomItems = (config.bottom_items || []).filter((item) => !invalidItems.has(item));
  const updatedHiddenItems = (config.hidden_items || []).filter((item) => !invalidItems.has(item));

  if (duplikatedItems.length > 0) {
    console.log('Removing duplicated item from custom groups:', duplikatedItems);
    updatedGroups = Object.fromEntries(
      Object.entries(updatedGroups).map(([key, items]) => [
        key,
        items.filter((item) => !duplikatedItems.includes(item)),
      ])
    );
  }

  const correctedConfig: SidebarConfig = {
    ...config,
    custom_groups: updatedGroups,
    bottom_items: updatedBottomItems,
    hidden_items: updatedHiddenItems,
  };

  return correctedConfig;
};

export const _changeStorageConfig = (config: SidebarConfig): void => {
  if (sidebarUseConfigFile()) return;

  const currentConfig = getStorageConfig();
  const isConfigDifferent = JSON.stringify(currentConfig) !== JSON.stringify(config);

  if (isConfigDifferent) {
    console.log('changeStorageConfig', config);
    setStorage(STORAGE.UI_CONFIG, config);
  }
};
