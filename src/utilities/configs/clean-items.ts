import type { SidebardPanelConfig } from '@types';

import { forEach } from 'es-toolkit/compat';

export const cleanItems = (items: string[], itemsToRemoveSet: Set<string>): string[] => {
  return items.filter((item) => !itemsToRemoveSet.has(item));
};

export function cleanItemsFromConfig(
  groups: SidebardPanelConfig,
  itemsToRemove: string[] | Set<string>
): SidebardPanelConfig {
  const itemsToRemoveSet: Set<string> = itemsToRemove instanceof Set ? itemsToRemove : new Set(itemsToRemove);

  const updatesConfig: SidebardPanelConfig = {};

  forEach(groups, (value, key) => {
    if (Array.isArray(value)) {
      updatesConfig[key] = cleanItems(value, itemsToRemoveSet);
    } else {
      updatesConfig[key] = {};
      forEach(value, (subValue, subKey) => {
        updatesConfig[key][subKey] = cleanItems(subValue, itemsToRemoveSet);
      });
    }
  });

  return updatesConfig;
}
