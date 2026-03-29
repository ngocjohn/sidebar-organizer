import * as SEC from './editor';

declare global {
  interface Window {
    SoDialogPreview: SEC.SidebarDialogPreview;
    SoDialogPanels: SEC.SidebarDialogPanels;
    SoDialogNewItems: SEC.SidebarDialogNewItems;
    SoDialogColors: SEC.SidebarDialogColors;
    SoPanelAll: SEC.SoPanelAll;
    SoPanelVisibility: SEC.SoPanelVisibility;
  }
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectSelector {
  select: {
    multiple?: boolean;
    custom_value?: boolean;
    mode?: 'list' | 'dropdown' | 'box';
    options: readonly string[] | readonly SelectOption[];
    translation_key?: string;
    sort?: boolean;
    reorder?: boolean;
    box_max_columns?: number;
  } | null;
}
