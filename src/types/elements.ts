import { SidebarPanelItem } from '@types';

export interface ElementsStore {
  topItemsContainer: HTMLElement;
  bottomItemsContainer: HTMLElement | null;
  topItems: NodeListOf<SidebarPanelItem>;
  bottomItems: NodeListOf<SidebarPanelItem> | null;
}

export interface HaTooltip extends HTMLElement {
  for: string | null;
  placement: string;
  show(): Promise<void>;
  hide(): Promise<void>;
}
