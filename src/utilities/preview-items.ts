import { PANEL_ICONS } from '@constants';

import { HaExtened, SidebarConfig, PanelInfo, Panels } from '../types';

export const getPreviewItems = (hass: HaExtened['hass'], config: SidebarConfig) => {
  const hassPanels = hass?.panels as Panels;
  const defaultPanel = hass.defaultPanel;

  // Helper function to create PanelInfo items
  const createPanelItems = (items: string[]): PanelInfo[] => {
    return items.map((item) => ({
      title: hass.localize(`panel.${hassPanels[item]?.title}`) || hassPanels[item]?.title || item,
      icon: hassPanels[item]?.icon || PANEL_ICONS[item],
    }));
  };

  // Default Lovelace panel
  const _panelItems: Record<string, PanelInfo[]> = {
    defaultPage: [
      {
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
  _panelItems['bottomSystem'] = createPanelItems(['developer-tools', 'config']);

  // console.log(_panelItems);
  return _panelItems;
};
