import { CONFIG_NAME, STORAGE } from '@constants';
import { HaExtened, SidebarConfig } from '@types';

import { getHiddenPanels, getStorageConfig, setStorage, sidebarUseConfigFile } from '../storage-utils';

// export const validateConfig = (config: SidebarConfig): SidebarConfig => {
//   const hiddenPanels = getHiddenPanels();
//   if (hiddenPanels.length === 0) return config;

//   const _config = { ...config };
//   const _groups = { ...(config.custom_groups || {}) };
//   let _items = [...(config.bottom_items || [])];

//   hiddenPanels.forEach((panel) => {
//     Object.entries(_groups).forEach(([key, value]) => {
//       if (value.includes(panel)) {
//         _groups[key] = value.filter((item) => item !== panel);
//       }
//     });
//     _items = _items.filter((item) => item !== panel);
//   });

//   _config.hidden_items = hiddenPanels;
//   _config.custom_groups = _groups;
//   _config.bottom_items = _items;
//   console.log('validateConfig', _config);
//   return _config;
// };

// export const isItemsValid = (config: SidebarConfig, hass: HaExtened['hass']): boolean => {
//   const errorDiff = `${CONFIG_NAME}: Config is not valid. Please check your configuration.`;
//   let configValid = true;
//   const items = [
//     ...Object.values(config?.custom_groups || {}).flat(),
//     ...(config?.bottom_items || []),
//     ...(config?.hidden_items || []),
//   ];
//   if (items.length === 0) {
//     configValid = false;
//   }

//   const panelItems = Object.keys(hass.panels);
//   // console.log('config: %O\nha-panels: %O', items, panelItems);

//   const isValid = items.every((item: string) => panelItems.includes(item));

//   if (!isValid) {
//     const diff = items.filter((item: string) => !panelItems.includes(item));
//     console.warn(`${errorDiff}\nDifferring items: ${diff.toLocaleString()}`);
//     configValid = false;
//   }

//   // item has no title, that means is now showing in sidebar
//   const itemInHassButNoTitle = items.filter((item: string) => {
//     return hass.panels[item] && !hass.panels[item].title;
//   });
//   if (itemInHassButNoTitle.length > 0) {
//     console.warn(
//       `${CONFIG_NAME}: Some items are not showing in sidebar. Please check your configuration.\nDifferring items: ${itemInHassButNoTitle.toLocaleString()}`
//     );
//     configValid = false;
//   }
//   console.log('configValid', configValid);
//   console.log('isItemsValid', isValid);
//   console.log('itemInHassButNoTitle', itemInHassButNoTitle);
//   // if there is no item in hass but no title, then is valid
//   // if there is item in hass but no title, then is not valid

//   return configValid;
// };

// export const tryCorrectConfig = (config: SidebarConfig, hass: HaExtened['hass']): SidebarConfig => {
//   console.log('tryCorrectConfig', config);
//   const haPanels = Object.keys(hass.panels);

//   const items = [
//     ...Object.values(config?.custom_groups || {}).flat(),
//     ...(config?.bottom_items || []),
//     ...(config?.hidden_items || []),
//   ];

//   const diff = items.filter((item) => !haPanels.includes(item));
//   console.log('diff', diff);

//   // item has no title, that means is now showing in sidebar
//   const itemInHassButNoTitle = items.filter((item: string) => {
//     return hass.panels[item] && !hass.panels[item].title;
//   });

//   const _config = { ...config };
//   const _groups = { ...(config.custom_groups || {}) };
//   let _bottomItems = [...(config.bottom_items || [])];
//   let _hiddenItems = [...(config.hidden_items || [])];

//   // remove diff items
//   diff.forEach((item) => {
//     Object.entries(_groups).forEach(([key, value]) => {
//       if (value.includes(item)) {
//         _groups[key] = value.filter((i) => i !== item);
//       }
//     });
//     _bottomItems = _bottomItems.filter((i) => i !== item);
//     _hiddenItems = _hiddenItems.filter((i) => i !== item);
//   });

//   if (itemInHassButNoTitle.length > 0) {
//     // remove item in hass but no title
//     itemInHassButNoTitle.forEach((item) => {
//       Object.entries(_groups).forEach(([key, value]) => {
//         if (value.includes(item)) {
//           _groups[key] = value.filter((i) => i !== item);
//         }
//       });
//       _bottomItems = _bottomItems.filter((i) => i !== item);
//       _hiddenItems = _hiddenItems.filter((i) => i !== item);
//     });
//   }

//   _config.custom_groups = _groups;
//   _config.bottom_items = _bottomItems;
//   _config.hidden_items = _hiddenItems;

//   setStorage(STORAGE.UI_CONFIG, _config);
//   setStorage(STORAGE.HIDDEN_PANELS, _hiddenItems);
//   console.log('after tryCorrectConfig', _config);
//   return _config;
// };

// export const _changeStorageConfig = (config: SidebarConfig): void => {
//   if (sidebarUseConfigFile()) return;
//   const currentConfig = getStorageConfig();
//   const isConfigDifferent = JSON.stringify(currentConfig) !== JSON.stringify(config);
//   if (isConfigDifferent) {
//     console.log('changeStorageConfig', config);
//     setStorage(STORAGE.UI_CONFIG, config);
//   } else {
//     return;
//   }
// };

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
    console.warn(`${CONFIG_NAME}: Config is not valid. Diff items: ${invalidItems.join(', ')}`);
  }

  if (noTitleItems.length > 0) {
    console.warn(`${CONFIG_NAME}: Items not showing in sidebar: ${noTitleItems.join(', ')}`);
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
