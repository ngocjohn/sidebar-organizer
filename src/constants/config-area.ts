export enum DIALOG_TAG {
  NEW_ITEMS = 'sidebar-dialog-new-items',
  COLORS = 'sidebar-dialog-colors',
  PANELS = 'sidebar-dialog-panels',
  PREVIEW = 'sidebar-dialog-preview',
  CODE_EDITOR = 'sidebar-dialog-code-editor',
  MENU = 'sidebar-dialog-menu',
}

export enum CONFIG_SECTION {
  GENERAL = 'general',
  APPEARANCE = 'appearance',
  PANELS = 'panels',
  NEW_ITEMS = 'new_items',
  PREVIEW = 'preview',
  CUSTOM_CARDS = 'custom_cards',
}

export type ConfigSectionType = (typeof CONFIG_SECTION)[keyof typeof CONFIG_SECTION];

export enum PANEL_AREA {
  ALL_ITEMS = 'all_items',
  BOTTOM_PANELS = 'bottom_panels',
  CUSTOM_GROUPS = 'custom_groups',
  VISIBILITY = 'visibility',
  NOTIFICATIONS = 'notifications',
}
export const PanelAreaKeys = ['all_items', 'bottom_panels', 'custom_groups', 'visibility', 'notifications'] as const;

export type PanelArea = (typeof PANEL_AREA)[keyof typeof PANEL_AREA];

export enum BOTTOM_SECTION {
  BOTTOM_ITEMS = 'bottom_items',
  BOTTOM_GRID_ITEMS = 'bottom_grid_items',
}
export const BottomSectionKeys = ['bottom_items', 'bottom_grid_items'] as const;
export type BottomSection = (typeof BOTTOM_SECTION)[keyof typeof BOTTOM_SECTION];

export enum VISIBILITY_SECTION {
  HIDDEN_ITEMS = 'hidden_items',
  VISIBILITY_TEMPLATES = 'visibility_templates',
}
export const VisibilitySectionKeys = ['hidden_items', 'visibility_templates'] as const;
export type VisibilitySection = (typeof VISIBILITY_SECTION)[keyof typeof VISIBILITY_SECTION];

export enum CUSTOM_CARD_SECTION {
  TOP_CONTAINER = 'top_container',
  BOTTOM_CONTAINER = 'bottom_container',
}
export const CustomCardSectionKeys = ['top_container', 'bottom_container'] as const;
export type CustomCardSection = (typeof CUSTOM_CARD_SECTION)[keyof typeof CUSTOM_CARD_SECTION];

export enum CARD_SECTION_ARRANGEMENT {
  HEADER_CARDS = 'header_cards',
  FOOTER_CARDS = 'footer_cards',
}
export const CardSectionArrangementKeys = ['header_cards', 'footer_cards'] as const;
export type CardSectionArrangementType = (typeof CARD_SECTION_ARRANGEMENT)[keyof typeof CARD_SECTION_ARRANGEMENT];

export type PanelAreaType =
  | PanelArea
  | BottomSection
  | VisibilitySection
  | CustomCardSection
  | CardSectionArrangementType;

export const CONFIG_AREA_LABELS: Record<PanelAreaType | ConfigSectionType | string, string> = {
  [CONFIG_SECTION.GENERAL]: 'Settings',
  [CONFIG_SECTION.APPEARANCE]: 'Appearance',
  [CONFIG_SECTION.PANELS]: 'Panels',
  [CONFIG_SECTION.NEW_ITEMS]: 'New Items',
  [CONFIG_SECTION.CUSTOM_CARDS]: 'Custom Cards',
  [PANEL_AREA.ALL_ITEMS]: 'All Items',
  [PANEL_AREA.BOTTOM_PANELS]: 'Bottom Panels',
  [PANEL_AREA.CUSTOM_GROUPS]: 'Custom Groups',
  [PANEL_AREA.VISIBILITY]: 'Visibility Settings',
  [PANEL_AREA.NOTIFICATIONS]: 'Notifications',
  [VISIBILITY_SECTION.HIDDEN_ITEMS]: 'Hidden Items',
  [VISIBILITY_SECTION.VISIBILITY_TEMPLATES]: 'Visibility Templates',
  [BOTTOM_SECTION.BOTTOM_ITEMS]: 'Bottom Items',
  [BOTTOM_SECTION.BOTTOM_GRID_ITEMS]: 'Bottom Grid Items',
  [CUSTOM_CARD_SECTION.TOP_CONTAINER]: 'Top Container',
  [CUSTOM_CARD_SECTION.BOTTOM_CONTAINER]: 'Bottom Container',
  [CARD_SECTION_ARRANGEMENT.HEADER_CARDS]: 'Header Cards',
  [CARD_SECTION_ARRANGEMENT.FOOTER_CARDS]: 'Footer Cards',
  ['uncategorized_items']: 'Uncategorized Items',
};

export const CONFIG_SECTIONS_MENU: Record<ConfigSectionType | string, { label: string; description: string }> = {
  [CONFIG_SECTION.GENERAL]: {
    label: CONFIG_AREA_LABELS[CONFIG_SECTION.GENERAL],
    description: 'General settings for the sidebar.',
  },
  [CONFIG_SECTION.APPEARANCE]: {
    label: CONFIG_AREA_LABELS[CONFIG_SECTION.APPEARANCE],
    description: 'Customize the look and feel of your sidebar.',
  },
  [CONFIG_SECTION.PANELS]: {
    label: CONFIG_AREA_LABELS[CONFIG_SECTION.PANELS],
    description: 'Organize your sidebar panels and their order.',
  },
  [CONFIG_SECTION.NEW_ITEMS]: {
    label: CONFIG_AREA_LABELS[CONFIG_SECTION.NEW_ITEMS],
    description: 'Add new items to your sidebar.',
  },
  [CONFIG_SECTION.CUSTOM_CARDS]: {
    label: CONFIG_AREA_LABELS[CONFIG_SECTION.CUSTOM_CARDS],
    description: 'Add any lovelace card to sidebar.',
  },
};
export interface TabsMenuItem {
  value: PanelAreaType | ConfigSectionType | string;
  label: string;
}

export const PanelAreaTabs: TabsMenuItem[] = [
  ...PanelAreaKeys.map((key) => ({ value: key, label: CONFIG_AREA_LABELS[key] || key })),
];
