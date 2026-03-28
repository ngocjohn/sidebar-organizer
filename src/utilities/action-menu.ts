import { html, TemplateResult } from 'lit';

export interface MenuItemConfig {
  title: string;
  action: string;
  icon?: string;
  disabled?: boolean;
  clickCallback?: () => any;
  divider?: boolean;
  warning?: boolean;
}
export const ActionTypes = ['edit-items', 'preview-item', 'delete', 'divider', 'uncategorized-as-group'] as const;
export type ActionType = (typeof ActionTypes)[number];

export const DefaultActionMenu: MenuItemConfig[] = [
  { title: 'Edit items', action: 'edit-items', icon: 'mdi:pencil' },
  { title: 'Show in preview', action: 'preview-item', icon: 'mdi:information-outline' },
  { title: 'Delete', action: 'delete', icon: 'mdi:trash-can-outline' },
  { title: 'Rename', action: 'rename', icon: 'mdi:rename-box' },
  { title: 'Collapse by default', action: 'collapsed-group', icon: 'mdi:eye-minus-outline' },
  { title: 'Add to pinned groups', action: 'pinned-group', icon: 'mdi:pin-outline' },
  { title: 'Include in group orders', action: 'uncategorized-as-group' },
  { divider: true, title: '', action: 'divider' },
];

export const createActionsMenu = (overrides?: Partial<MenuItemConfig>[]): MenuItemConfig[] => {
  const defaultActions = DefaultActionMenu;
  if (!overrides) {
    return defaultActions;
  }
  const merged = defaultActions.map((action) => {
    const override = overrides.find((o) => o.action === action.action);
    if (override) {
      return { ...action, ...override };
    }
    return action;
  });
  // Add any additional actions that are not in the default list
  overrides.forEach((override) => {
    if (!merged.find((m) => m.action === override.action)) {
      merged.push(override as MenuItemConfig);
    }
  });
  return merged;
};

export const computeActionList = (actions: ActionType[]): MenuItemConfig[] => {
  return createActionsMenu()
    .filter((action) => actions.includes(action.action as ActionType))
    .sort((a, b) => {
      return actions.indexOf(a.action as ActionType) - actions.indexOf(b.action as ActionType);
    });
};

export const _renderActionItem = ({
  item,
  onClick,
  option,
}: {
  item: MenuItemConfig;
  onClick?: () => void;
  option?: any;
}): TemplateResult => {
  if (item.divider) {
    return html`<wa-divider></wa-divider>`;
  }
  if (item.action === 'uncategorized-as-group') {
    return html`
      <ha-dropdown-item
        .value=${item.action}
        .data=${option}
        @click=${item.clickCallback ? item.clickCallback : onClick}
        ?disabled=${option?.disabled}
        type="checkbox"
        .checked=${option?.checked}
      >
        <ha-icon slot="icon" .icon=${item.icon}></ha-icon>
        ${item.title}
      </ha-dropdown-item>
    `;
  }
  const isWarningItem = item.warning || /(delete|remove|clear)/i.test(item.action);
  return html`
    <ha-dropdown-item
      .value=${item.action}
      .data=${option}
      @click=${item.clickCallback ? item.clickCallback : onClick}
      ?disabled=${option?.disabled}
      .variant=${isWarningItem ? 'danger' : undefined}
    >
      <ha-icon slot="icon" .icon=${item.icon}></ha-icon>
      ${item.title}
    </ha-dropdown-item>
  `;
};
