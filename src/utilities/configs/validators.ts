import { CONFIG_NAME, STORAGE } from '@constants';
import { HaExtened, SidebarConfig } from '@types';

import { getHiddenPanels, getStorageConfig, setStorage, sidebarUseConfigFile } from '../storage-utils';

export const validateConfig = (config: SidebarConfig): SidebarConfig => {
  const hiddenPanels = getHiddenPanels();
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

export const isItemsValid = (config: SidebarConfig, hass: HaExtened['hass']): boolean => {
  const errorDiff = `${CONFIG_NAME}: Config is not valid. Please check your configuration.`;

  const items = [
    ...Object.values(config?.custom_groups || {}).flat(),
    ...(config?.bottom_items || []),
    ...(config?.hidden_items || []),
  ];
  if (items.length === 0) {
    return false;
  }

  const panelItems = Object.keys(hass.panels);
  // console.log('config: %O\nha-panels: %O', items, panelItems);

  const isValid = items.every((item: string) => panelItems.includes(item));
  console.log('isConfigValid', isValid);
  if (!isValid) {
    const diff = items.filter((item: string) => !panelItems.includes(item));
    console.warn(`${errorDiff}\nDifferring items: ${diff.toLocaleString()}`);
  }
  return isValid;
};

export const _changeStorageConfig = (config: SidebarConfig): void => {
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
