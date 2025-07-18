import { STORAGE } from '@constants';
import { SidebarConfig } from '@types';

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

export const getInitPanelOrder = (paperListBox: HTMLElement): string[] => {
  const children = paperListBox.children;
  const spacerIndex = Array.from(children).findIndex((child) => child.classList.contains('spacer'));
  const panelOrder = Array.from(children)
    .slice(0, spacerIndex)
    .map(
      (child) =>
        child.shadowRoot?.querySelector('a')?.getAttribute('href')?.replace('/', '') ||
        child.getAttribute('data-panel') ||
        null
    )
    .filter((panel) => panel !== null);
  setStorage(STORAGE.PANEL_ORDER, panelOrder);
  return panelOrder;
};

export const isBeforeChange = (): boolean => {
  const version = localStorage.getItem(STORAGE.HA_VERSION) || '';
  console.log('Current version:', version);
  const [year, major, patch] = version.split('.').map(Number); //eslint-disable-line

  if (year < 2025) return true;
  if (year > 2025) return false;

  // If year is 2025, check the major version
  return major < 5;
};
