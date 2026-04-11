// declaration.d.ts
import type * as SEC from './components/editor';

declare global {
  interface Window {
    SoDialogPreview: SEC.SidebarDialogPreview;
    SoDialogPanels: SEC.SidebarDialogPanels;
    SoDialogNewItems: SEC.SidebarDialogNewItems;
    SoDialogColors: SEC.SidebarDialogColors;
    SoPanelAll: SEC.SoPanelAll;
    SoPanelVisibility: SEC.SoPanelVisibility;
    SoDialogCustomCards: SEC.SidebarDialogCustomCards;
  }
}

declare module 'tinycolor2';
