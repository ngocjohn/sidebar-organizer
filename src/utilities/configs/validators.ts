import { CONFIG_NAME, STORAGE } from '@constants';
import { HaExtened, PANEL_TYPE, SidebarConfig, SidebardPanelConfig } from '@types';
import { cleanConfig, cleanItemsFromAllPanels, cleanItemsFromConfig } from '@utilities/configs/clean-items';
import { comparePanelItems } from '@utilities/dashboard';
import { getDefaultPanelUrlPath } from '@utilities/panel';
import { pick } from 'es-toolkit/compat';

import { getHiddenPanels, getStorageConfig, setStorage, sidebarUseConfigFile } from '../storage-utils';

export interface BASE_VALIDATION_RESULT {
  valid: boolean;
  config: SidebarConfig;
}
export interface VALIDATION_RESULT_DETAILS {
  repeatedItems?: string[];
  invalidItems?: string[];
  noTitleItems?: string[];
  hasDefaultInGroupsOrBottom?: boolean;
}
export type INVALID_CONFIG = BASE_VALIDATION_RESULT & VALIDATION_RESULT_DETAILS;

export type InvalidItemKeys = keyof VALIDATION_RESULT_DETAILS;

export const INVALID_ITEM_KEYS: InvalidItemKeys[] = [
  'repeatedItems',
  'invalidItems',
  'noTitleItems',
  'hasDefaultInGroupsOrBottom',
];

export const InvalidItemLabels: Record<InvalidItemKeys, string> = {
  repeatedItems: 'Duplicated items',
  invalidItems: 'Invalid items',
  noTitleItems: 'Items not showing in sidebar',
  hasDefaultInGroupsOrBottom: 'Default panel included',
};

export const validateConfig = (config: SidebarConfig, hidden?: string[]): SidebarConfig => {
  const hiddenPanels: string[] = hidden || getHiddenPanels();
  if (!hiddenPanels.length) return cleanConfig(config);
  const configToUpdate = pick(config, [
    PANEL_TYPE.CUSTOM_GROUPS,
    PANEL_TYPE.BOTTOM_ITEMS,
    PANEL_TYPE.BOTTOM_GRID_ITEMS,
  ]) as SidebardPanelConfig;
  const updatedPanels = cleanItemsFromConfig(configToUpdate, hiddenPanels);
  let defaultCollapsed = [...(config.default_collapsed || [])];
  defaultCollapsed = defaultCollapsed.filter((item) => updatedPanels.custom_groups?.[item]);
  const validatedConfig: SidebarConfig = {
    ...config,
    ...updatedPanels,
    ...(defaultCollapsed.length > 0 && { default_collapsed: defaultCollapsed }),
    ...(hiddenPanels.length > 0 && { hidden_items: hiddenPanels }),
  };

  return cleanConfig(validatedConfig);
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

export const findDuplicateItems = (allItems: string[]): string[] => {
  let duplicateItemList: string[] = [];
  const itemCount: { [key: string]: number } = {};

  allItems.forEach((item) => {
    itemCount[item] = (itemCount[item] || 0) + 1;
  });

  duplicateItemList = Object.keys(itemCount).filter((item) => itemCount[item] > 1);

  return duplicateItemList;
};

export const isDefaultIncluded = (defaultPanel: string | undefined, allItems: string[]): boolean => {
  return Boolean(defaultPanel && allItems.includes(defaultPanel));
};

export const isItemsValid = async (
  config: SidebarConfig,
  hass: HaExtened['hass'],
  log: boolean = false
): Promise<boolean | INVALID_CONFIG> => {
  if (getAllConfigItems(config).length === 0) {
    return log ? { valid: true, config } : true;
  }
  const configResult = await isConfigValid(config, hass);

  if (!configResult.valid) {
    const logTitle = `${CONFIG_NAME}: Config is not valid.`;
    console.groupCollapsed(`%c${logTitle}`, 'color: #ff9800;');
    INVALID_ITEM_KEYS.forEach((key) => {
      const items = configResult[key] as string[];
      if (items && items.length > 0) {
        console.log(`${InvalidItemLabels[key]}:`, items);
      }
    });
    if (configResult.hasDefaultInGroupsOrBottom) {
      const defaultPanel = getDefaultPanelUrlPath(hass);
      console.log(
        `${InvalidItemLabels.hasDefaultInGroupsOrBottom}: ${defaultPanel} should not be included in custom groups or bottom items.`
      );
    }
    console.groupEnd();
  }

  return log ? configResult : configResult.valid;
};

export const getValidDetails = async (
  config: SidebarConfig,
  hass: HaExtened['hass']
): Promise<VALIDATION_RESULT_DETAILS> => {
  const haPanelKeys = Object.keys(hass.panels);
  const defaultPanel = getDefaultPanelUrlPath(hass);

  let allItems = getAllConfigItems(config);

  const flattenedGroups = [
    ...Object.values(config.custom_groups || {}).flat(),
    ...(config.bottom_items || []),
    ...(config.bottom_grid_items || []),
  ];

  // Find duplicated items
  const duplicateItems = findDuplicateItems(flattenedGroups);
  const hasDefaultInGroupsOrBottom = isDefaultIncluded(defaultPanel, flattenedGroups);

  const nonHaPanelItems = allItems.filter((item) => !haPanelKeys.includes(item));
  const removedPanels = await comparePanelItems(hass, allItems).then(({ removed }) => removed || []);

  const invalidItems = new Set([...nonHaPanelItems, ...removedPanels]);

  if (hasDefaultInGroupsOrBottom && defaultPanel) {
    invalidItems.add(defaultPanel);
  }

  return {
    repeatedItems: duplicateItems,
    invalidItems: Array.from(invalidItems),
    noTitleItems: removedPanels,
    hasDefaultInGroupsOrBottom,
  };
};

export const isConfigValid = async (config: SidebarConfig, hass: HaExtened['hass']): Promise<INVALID_CONFIG> => {
  const validationDetails = await getValidDetails(config, hass);
  return {
    valid: Object.values(validationDetails).every((value) => {
      if (Array.isArray(value)) {
        return value.length === 0;
      }
      return !value;
    }),
    config,
    ...validationDetails,
  };
};

export const tryCorrectConfig = async (
  invalidConfig: SidebarConfig,
  hass: HaExtened['hass']
): Promise<SidebarConfig> => {
  const validationDetails = await getValidDetails(invalidConfig, hass);
  const { repeatedItems = [], invalidItems = [] } = validationDetails;

  if (repeatedItems.length === 0 && invalidItems.length === 0) {
    console.log('%cVALIDATORS:%c Config is valid. No correction needed.', 'color: #4caf50;', 'color: #388e3c;');
    return cleanConfig(invalidConfig);
  }

  // Remove invalid items from custom groups, bottom items, bottom grid items and hidden items

  const updatedPanels = cleanItemsFromAllPanels(invalidConfig, invalidItems);
  let updatedGroups = updatedPanels.custom_groups || {};
  if (repeatedItems.length > 0) {
    // clean again to remove duplicates after removing invalid items
    updatedGroups = cleanItemsFromConfig({ custom_groups: updatedGroups }, repeatedItems).custom_groups || {};
  }

  const validatedSidebarConfig: SidebarConfig = cleanConfig({
    ...invalidConfig,
    ...updatedPanels,
    custom_groups: updatedGroups,
  });

  console.groupCollapsed('%cVALIDATORS:%c Config correction result', 'color: #4caf50;', 'color: #388e3c;');
  console.log('Validation details:', validationDetails);
  console.log({ invalidConfig, validatedSidebarConfig });
  console.groupEnd();

  return validatedSidebarConfig;
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

const ALLOWED_UNITS = ['%', 'em', 'ex', 'px', 'rem', 'vh', 'vmax', 'vmin', 'vw'];
const WIDTH_REGEX = new RegExp(`^\\s*(\\d+(\\.\\d+)?)(\\s*(${ALLOWED_UNITS.join('|')})?)\\s*$`);

export const _computeWidth = (width?: number | string): string | undefined => {
  if (!width) return undefined;
  // check if width has units, if not parse it as number and add 'px' unit, if it has units, validate the unit and return the value with unit

  const match = WIDTH_REGEX.exec(String(width));
  if (!match) {
    console.warn(
      `%cVALIDATORS:%c Invalid width value "${width}". Please provide a valid CSS size (e.g. "250px", "20%", "15em").`,
      'color: #ff9800;',
      'color: #ff5722;'
    );
    return undefined;
  }

  const value = match[1];
  const unit = match[4] || 'px'; // default to 'px' if no unit is provided

  return `${value}${unit}`;
};
