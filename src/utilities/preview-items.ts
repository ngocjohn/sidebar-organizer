import { PANEL_ICONS } from '@constants';
import { SidebarConfigDialog } from 'components/sidebar-dialog';

import { HaExtened, SidebarConfig, PanelInfo, Panels, NewItemConfig } from '../types';

export const getPreviewItems = (dialog: SidebarConfigDialog, config: SidebarConfig) => {
  const hass = dialog.hass as HaExtened['hass'];
  const hassPanels = hass?.panels as Panels;
  const defaultPanel = hass.defaultPanel;

  const createPanelItems = (items: string[]) => {
    return _createPanelItems(hass, [...items], dialog);
  };

  // Default Lovelace panel
  const _panelItems: Record<string, PanelInfo[]> = {
    defaultPage: [
      {
        component_name: hassPanels[defaultPanel]?.title || hass.localize('panel.states'),
        title: hassPanels[defaultPanel]?.title || hass.localize('panel.states'),
        icon: hassPanels[defaultPanel]?.icon || PANEL_ICONS.lovelace,
      },
    ],
  };

  const firstGroup = Object.entries(config.custom_groups || {})[0];
  const lastGroup = Object.entries(config.custom_groups || {})?.slice(-1)[0];

  // Panels for custom groups
  if (firstGroup) {
    _panelItems[firstGroup[0]] = createPanelItems(firstGroup[1]);
  }
  if (lastGroup && lastGroup[0] !== firstGroup[0]) {
    _panelItems[lastGroup[0]] = createPanelItems(lastGroup[1]);
  }

  let moreGroups = Object.entries(config.custom_groups || {}).slice(1, -1);
  if (moreGroups.length > 0) {
    moreGroups.forEach((group) => {
      _panelItems[group[0]] = createPanelItems(group[1]);
    });
  }

  // Bottom panels
  _panelItems['bottomItems'] = createPanelItems(config.bottom_items || []);

  // Ungrouped panels
  _panelItems['bottomSystem'] = createPanelItems(['developer-tools', 'config']);

  // console.log(_panelItems);
  return _panelItems;
};

// Helper function to create PanelInfo items
export const _createPanelItems = (
  hass: HaExtened['hass'],
  items: string[],
  dialog: SidebarConfigDialog
): PanelInfo[] => {
  const hassPanels = hass?.panels as Panels;
  const newItemConfig = dialog?._newItemMap as Map<string, NewItemConfig>;

  const itemsList = items.map((item) => {
    if (newItemConfig.has(item)) {
      return {
        ...newItemConfig.get(item),
        component_name: item,
      } as NewItemConfig;
    } else {
      return {
        component_name: item,
        title: hass.localize(`panel.${hassPanels[item]?.title}`) || hassPanels[item]?.title || item,
        icon: hassPanels[item]?.icon || PANEL_ICONS[item],
      };
    }
  });
  return itemsList;
};
