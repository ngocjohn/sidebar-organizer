import { ALERT_MSG, STORAGE } from '@constants';
import { PinnedGroupsConfig, SidebarConfig } from '@types';
import { getFallbackIcon } from '@utilities/is-icon';

import { getStorage, setStorage } from '../storage-utils';

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

export const isBeforeChange = (): boolean => {
  const version = localStorage.getItem(STORAGE.HA_VERSION) || '';
  const [year, major, patch] = version.split('.').map(Number); //eslint-disable-line
  let isBefore = false;

  if (year > 2025) isBefore = false;
  if (year < 2025 || (year === 2025 && major < 5)) isBefore = true;

  if (isBefore) {
    console.warn(ALERT_MSG.NOT_COMPATIBLE, '\n', ALERT_MSG.VERSION_INFO);
  }

  return isBefore;
};

export const atLeastVersion = (version: string, major: number, minor: number, patch?: number): boolean => {
  const [haMajor, haMinor, haPatch] = version.split('.', 3);

  return (
    Number(haMajor) > major ||
    (Number(haMajor) === major && (patch === undefined ? Number(haMinor) >= minor : Number(haMinor) > minor)) ||
    (patch !== undefined && Number(haMajor) === major && Number(haMinor) === minor && Number(haPatch) >= patch)
  );
};

export function clearSidebarOrganizerStorage(): void {
  const resetConfigPromise = async () => {
    new Promise<void>((resolve) => {
      [STORAGE.UI_CONFIG, STORAGE.PANEL_ORDER, STORAGE.COLLAPSE, STORAGE.HIDDEN_PANELS].forEach((key) => {
        window.localStorage.removeItem(key);
      });
      resolve();
    });
  };
  resetConfigPromise().then(() => {
    console.log('%cMISC:', 'color: #bada55;', ' Cleared Sidebar Organizer storage items.');
  });
}

interface NormalizedPinnedGroup {
  icon?: string;
}

export const normalizePinnedGroups = (config?: PinnedGroupsConfig): Record<string, NormalizedPinnedGroup> => {
  if (!config) return {};

  const result: Record<string, NormalizedPinnedGroup> = {};

  for (const [group, value] of Object.entries(config)) {
    if (value === true) {
      result[group] = {
        icon: getFallbackIcon(group),
      };
    } else {
      result[group] = {
        icon: value.icon,
      };
    }
  }

  return result;
};