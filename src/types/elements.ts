import { SidebarPanelItem } from '@types';

export interface ElementsStore {
  topItemsContainer: HTMLElement;
  bottomItemsContainer: HTMLElement | null;
  topItems: NodeListOf<SidebarPanelItem>;
  bottomItems: NodeListOf<SidebarPanelItem> | null;
}
