import { CONFIG_NAME, STORAGE } from '@constants';
import { HaExtened, SidebarConfig } from '@types';

import * as LOGGER from '../logger';
import { getHiddenPanels, getStorageConfig, setStorage, sidebarUseConfigFile } from '../storage-utils';

export const validateConfig = (config: SidebarConfig): SidebarConfig => {
  const hiddenPanels = getHiddenPanels();
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

export const isItemsValid = (config: SidebarConfig, hass: HaExtened['hass']): boolean => {
  const allItems = [
    ...Object.values(config.custom_groups || {}).flat(),
    ...(config.bottom_items || []),
    ...(config.hidden_items || []),
  ];

  if (allItems.length === 0) return false;

  const haPanelKeys = Object.keys(hass.panels);
  const invalidItems = allItems.filter((item) => !haPanelKeys.includes(item));
  const noTitleItems = allItems.filter((item) => hass.panels[item] && !hass.panels[item].title);

  if (invalidItems.length > 0) {
    // console.warn(`${CONFIG_NAME}: Config is not valid. Diff items: ${invalidItems.join(', ')}`);
    LOGGER.warn(`${CONFIG_NAME}: Config is not valid. Diff items: ${invalidItems.join(', ')}`);

    console.table(invalidItems);
  }

  if (noTitleItems.length > 0) {
    // console.warn(`${CONFIG_NAME}: Items not showing in sidebar: ${noTitleItems.join(', ')}`);
    LOGGER.warn(`${CONFIG_NAME}: Items not showing in sidebar: ${noTitleItems.join(', ')}`);

    console.table(noTitleItems);
  }

  const configValid = invalidItems.length === 0 && noTitleItems.length === 0;

  // console.log('configValid', configValid);
  return configValid;
};

export const tryCorrectConfig = (config: SidebarConfig, hass: HaExtened['hass']): SidebarConfig => {
  const haPanelKeys = Object.keys(hass.panels);
  const allItems = [
    ...Object.values(config.custom_groups || {}).flat(),
    ...(config.bottom_items || []),
    ...(config.hidden_items || []),
  ];

  const diffItems = allItems.filter((item) => !haPanelKeys.includes(item));
  const noTitleItems = allItems.filter((item) => hass.panels[item] && !hass.panels[item].title);

  const invalidItems = new Set([...diffItems, ...noTitleItems]);

  const cleanGroupItems = (group: string[]) => group.filter((item) => !invalidItems.has(item));
  const updatedGroups = Object.fromEntries(
    Object.entries(config.custom_groups || {}).map(([key, items]) => [key, cleanGroupItems(items)])
  );

  const updatedBottomItems = (config.bottom_items || []).filter((item) => !invalidItems.has(item));
  const updatedHiddenItems = (config.hidden_items || []).filter((item) => !invalidItems.has(item));

  const correctedConfig: SidebarConfig = {
    ...config,
    custom_groups: updatedGroups,
    bottom_items: updatedBottomItems,
    hidden_items: updatedHiddenItems,
  };

  setStorage(STORAGE.UI_CONFIG, correctedConfig);
  setStorage(STORAGE.HIDDEN_PANELS, updatedHiddenItems);

  console.log('after tryCorrectConfig', correctedConfig);
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
