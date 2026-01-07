import { CONFIG_NAME, STORAGE } from '@constants';
import { HaExtened, PANEL_TYPE, SidebarConfig, SidebardPanelConfig } from '@types';
import { cleanItemsFromConfig } from '@utilities/configs/clean-items';
import { getDefaultPanel } from '@utilities/panel';
import { pick } from 'es-toolkit/compat';

import * as LOGGER from '../logger';
import { getHiddenPanels, getStorageConfig, setStorage, sidebarUseConfigFile } from '../storage-utils';

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
    default_collapsed: defaultCollapsed,
    hidden_items: hiddenPanels,
  };
  console.log('%cVALIDATORS:', 'color: #bada55;', { config, hiddenPanels, validatedConfig });

  return validatedConfig;
};

export const getDuplikatedItems = (custom: string[], bottom: string[], bottomGrid: string[]): string[] => {
  let duplikatedItems: string[] = [];
  const itemCount: { [key: string]: number } = {};

  const allItems = [...custom, ...bottom, ...bottomGrid];

  allItems.forEach((item) => {
    itemCount[item] = (itemCount[item] || 0) + 1;
  });

  duplikatedItems = Object.keys(itemCount).filter((item) => itemCount[item] > 1);

  return duplikatedItems;
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
    ...(config.bottom_grid_items || []),
    ...(config.hidden_items || []),
  ];
  // console.log('allItems to validate', allItems);
  if (allItems.length === 0) {
    return log ? { valid: true, config, duplikatedItems: [], invalidItems: [], noTitleItems: [] } : true;
  }
  const newConfigItems = Array.from(config.new_items || []).map((item) => item.title!);
  allItems = allItems.filter((item) => !newConfigItems.includes(item));

  const defaultPanel = getDefaultPanel(hass).url_path;
  const customGroups = Object.values(config.custom_groups || {}).flat();
  const bottomItems = config.bottom_items || [];
  const bottomGridItems = config.bottom_grid_items || [];

  // Check if default panel is in custom groups or bottom items
  const hasDefaultInGroupsOrBottom = isDefaultIncluded(defaultPanel, customGroups, bottomItems, bottomGridItems);
  // Find duplicated items
  const duplikatedItems = getDuplikatedItems(customGroups, bottomItems, bottomGridItems);

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
    ...(config.bottom_grid_items || []),
    ...(config.hidden_items || []),
  ];
  const newConfigItems = Array.from(config.new_items || []).map((item) => item.title!);
  // Filter out new items from allItems
  allItems = allItems.filter((item) => !newConfigItems.includes(item));

  const defaultPanel = getDefaultPanel(hass).url_path;
  const customGroups = Object.values(config.custom_groups || {}).flat();
  const bottomItems = config.bottom_items || [];
  const bottomGridItems = config.bottom_grid_items || [];

  // Find duplicated items
  const duplikatedItems = getDuplikatedItems(customGroups, bottomItems, bottomGridItems);
  const hasDefaultInGroupsOrBottom = isDefaultIncluded(defaultPanel, customGroups, bottomItems, bottomItems);

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

  // Remove invalid items from custom groups, bottom items, bottom grid items and hidden items
  const configToUpdate = pick(config, [
    PANEL_TYPE.CUSTOM,
    PANEL_TYPE.BOTTOM,
    PANEL_TYPE.BOTTOM_GRID,
    PANEL_TYPE.HIDDEN,
  ]) as SidebardPanelConfig;
  const updatedPanels = cleanItemsFromConfig(configToUpdate, invalidItems);

  let updatedGroups = updatedPanels.custom_groups || {};
  if (duplikatedItems.length > 0) {
    // clean again to remove duplicates after removing invalid items
    updatedGroups = cleanItemsFromConfig({ custom_groups: updatedGroups }, [...duplikatedItems]).custom_groups || {};
  }

  const correctedConfig: SidebarConfig = {
    ...config,
    ...updatedPanels,
    custom_groups: updatedGroups,
  };

  console.log('correctedConfig', { correctedConfig });
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
