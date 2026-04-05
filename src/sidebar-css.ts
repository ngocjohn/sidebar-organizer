import { css } from 'lit';
export const DIVIDER_ADDED_STYLE = css`
  :host .divider[added] ha-tooltip {
    text-transform: var(--sidebar-text-transform, 'capitalize');
    --ha-tooltip-font-size: var(--ha-font-size-m);
    --ha-tooltip-line-height: var(--ha-line-height-normal);
    --ha-tooltip-font-weight: var(--ha-font-weight-medium, 500);
    --ha-tooltip-padding: var(--ha-space-1, 4px);
    --ha-tooltip-background-color: var(--so-tooltip-background-color, inherit);
    --ha-tooltip-text-color: var(--so-tooltip-text-color, inherit);
  }
  :host .tooltip {
    color: var(--so-tooltip-text-color, inherit);
    background-color: var(--so-tooltip-background-color, inherit);
  }
  :host .ha-scrollbar {
    padding: 0;
  }
  :host([expanded]) .divider {
    padding: 10px 0;
  }
  :host .divider[ungrouped] {
    padding: 0;
  }

  :host .divider::before {
    content: ' ';
    display: block;
    height: 1px;
    background-color: var(--divider-color);
  }
  :host .divider[bottom] {
    padding: 0;
  }

  :host .collapse-toggle {
    color: var(--primary-color);
    transition: transform 0.3s ease;
    cursor: pointer;
    opacity: 0.5;
    margin-right: 4px;
  }
  :host .collapse-toggle.active {
    color: var(--sidebar-icon-color);
    transform: rotate(90deg);
    transition: transform 0.3s ease;
  }
  :host .collapse-toggle:hover {
    color: var(--primary-color);
    opacity: 1;
  }

  :host([expanded]) .title.toggle {
    display: flex !important;
    justify-content: space-between;
    margin: 0;
  }

  :host([expanded]) .divider[added] {
    padding: 0;
    box-sizing: border-box;
    margin: var(--divider-margin-radius);
    width: calc(100% - var(--ha-space-2));
  }
  :host(:not([expanded])) .divider[added] {
    margin: 0 !important;
  }

  :host .ha-scrollbar .divider[ungrouped] {
    padding-top: 1px;
    opacity: 0.5;
  }

  :host ha-md-list-item > ha-icon.badge {
    --mdc-icon-size: 20px !important;
  }

  :host([expanded]) .menu {
    width: 100% !important;
  }
  :host([expanded]) ha-md-list-item {
    width: calc(100% - var(--ha-space-2)) !important;
  }

  :host([expanded]) .grid-container > ha-md-list-item[grid-item] > ha-icon.badge,
  :host([expanded]) .grid-container > ha-md-list-item[grid-item] > span.badge {
    position: absolute;
    top: 4px;
    left: 26px;
    border-radius: var(--ha-border-radius-md);
    font-size: 0.75em;
    line-height: var(--ha-line-height-expanded);
    padding: 0 var(--ha-space-1);
  }
  :host(:not([expanded])) ha-md-list-item[data-notification='true'] > ha-icon.badge,
  :host(:not([expanded])) ha-md-list-item[data-notification='true'] > span.badge {
    position: absolute;
    inset-inline-start: 20px;
    inset-inline-end: initial;
    left: auto;
    max-width: 30px;
    top: 0px;
  }

  :host(:not([expanded])) ha-md-list-item[data-notification='true'] > ha-icon.badge,
  :host(:not([expanded])) ha-md-list-item[data-notification='true'] > span.badge.badge-number {
    inset-inline-end: 4px !important;
  }
  :host(:not([expanded])) ha-md-list-item[data-notification='true'] > span.badge.large-badge {
    transform: translateX(50%);
    right: 22px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  ha-md-list-item[data-notification='true'] span.badge.no-visible {
    visibility: hidden !important;
    opacity: 0 !important;
  }
  ha-md-list-item[data-notification='true'] > ha-icon.badge {
    padding: 0 !important;
    color: var(--accent-color);
    background-color: transparent;
  }

  ha-md-list-item[data-notification='true'] > span.badge {
    /* padding: 0 5px !important; */
    border-radius: 20px;
    font-size: 0.85em;
  }
  :host([expanded]) .grid-container {
    display: grid;
    /* Use flexible minmax columns so grid items reflow with the available drawer width,
     * which keeps the layout responsive when --custom-sidebar-width is changed. */
    grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
    grid-gap: 4px 4px;
    width: calc(100% - var(--ha-space-2));
    padding: 0;
    margin: 0;
    overflow: clip;
    /* max-height: fit-content; */
    /* justify-content: flex-start; */
  }
  :host([expanded]) .grid-container > ha-md-list-item[grid-item] {
    width: 48px !important;
    height: 48px;
    /* justify-content: center;
    align-items: center; */
    /* margin: auto auto; */
  }

  :host .divider[added] .added-content {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    color: var(--side-divider-text-color, var(--sidebar-text-color));
    background-color: var(--divider-bg-color);
    letter-spacing: 1px;
    font-size: 1.1rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border-top: 1px solid var(--divider-border-top-color);
    border-radius: var(--divider-border-radius, none);
    box-sizing: border-box;
    padding-left: 12px;
    padding-inline-end: initial;
    min-height: 40px;
    text-transform: var(--sidebar-text-transform, 'capitalize');
    &:hover {
      color: var(--primary-color);
      background-color: rgb(from var(--primary-color) r g b / 0.1);
    }
  }

  :host .divider.collapsed[added][aria-selected='true'] {
    background-color: rgb(from var(--sidebar-selected-icon-color) r g b / 0.12);
  }

  :host .divider[added] .added-content span,
  :host .divider[added] .added-content ha-icon {
    pointer-events: none;
    transition: all 150ms ease;
  }

  :host .divider[added] .added-content.collapsed ha-icon:not([custom]) {
    transform: rotate(-90deg);
  }

  :host .divider[added] .added-content span {
    transform: translateX(var(--so-group-header-expanded-shift, 30px));
  }
  :host .divider[added]:hover .added-content.collapsed > span {
    transform: translateX(var(--so-group-header-hover-shift, 10px));
  }
  :host .divider[added] .added-content.collapsed > span {
    transform: translateX(var(--so-group-header-collapsed-shift, 10px));
  }

  :host([expanded]) .ha-scrollbar .divider[added]::before {
    display: none !important;
  }
  :host([expanded]) .divider[added] > ha-tooltip {
    display: none !important;
  }

  :host(:not([expanded])) .divider.collapsed[added]::before {
    content: '';
    display: none;
  }
  :host(:not([expanded])) .divider[added]::before {
    content: '';
    opacity: 0;
  }

  :host(:not([expanded])) .divider .added-content.default {
    display: none;
  }

  :host(:not([expanded])) .divider[added] .added-content {
    padding-inline-start: 2px;
    align-items: center;
    justify-content: center;
    border-left: 2px groove rgb(from var(--sidebar-selected-icon-color) r g b / 0.5);
    box-sizing: content-box;
    &.collapsed {
      border-left: hidden;
    }
  }

  :host(:not([expanded])) .divider[added] .added-content > ha-icon[custom] {
    margin: 0;
    padding: 0;
    color: var(--sidebar-icon-color);
  }

  a:not(.iron-selected):hover > paper-icon-item {
    background-color: rgb(from var(--sidebar-selected-icon-color) r g b / 0.2);
  }

  :host([expanded]) ha-md-list-item[group] {
    padding-left: var(--so-group-item-indent, 0px) !important;
  }
  :host ha-md-list-item:has([group]) {
    transition: all;
  }
  :host ha-md-list-item.selected[grid-item]::before {
    margin-block: 2px;
  }
  :host ha-md-list-item.collapsed {
    max-height: 0px !important;
    overflow: hidden;
    opacity: 0;
    padding: 0;
    margin: 0;
    border: none;
  }

  :host a[aria-selected='false']::before,
  :host a.configuration-container[aria-selected='false']::before {
    display: none;
  }

  :host(:not([expanded])) a.collapsed.iron-selected {
    max-height: 1000px;
  }

  :host ha-md-list-item.slideIn {
    animation-name: slideIn;
    animation-duration: 0.3s;
    animation-fill-mode: forwards;
  }

  @keyframes slideIn {
    from {
      max-height: 0px;
      opacity: 0.3;
    }
    to {
      max-height: 40px;
      opacity: 1;
    }
  }

  :host ha-md-list-item.slideOut {
    animation-name: slideOut;
    animation-duration: 0.3s;
  }
  @keyframes slideOut {
    from {
      max-height: 40px;
      opacity: 1;
    }
    to {
      max-height: 0px;
      opacity: 0;
    }
  }

  :host([narrow][expanded]) {
    -webkit-backdrop-filter: var(--so-backdrop-filter, none);
    backdrop-filter: var(--so-backdrop-filter, none);
  }
`;

export const DRAWER_STYLE = css`
  :host aside.mdc-drawer {
    background-color: transparent;
  }
`;

export const HA_MAIN_CUSTOM_WIDTH_STYLE = css`
  :host([expanded]:not([modal])) {
    --mdc-drawer-width: var(--custom-sidebar-width, calc(256px + var(--safe-area-inset-left, 0px)));
  }
`;

export const HUI_ROOT_STYLE = css`
  :host .header::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: var(--header-hide-progress, 0);
    background: linear-gradient(180deg, var(--primary-background-color, rgba(0, 0, 0, 0.5)) 0%, transparent 100%);
    transition: opacity 0.3s ease;
  }

  :host .header .toolbar {
    will-change: transform, opacity;

    transition:
      transform 0.3s cubic-bezier(0.6, -0.28, 0.735, 0.045),
      opacity 0.25s linear;
  }

  :host .header.scroll-hide,
  :host([scrolled]) .header.scroll-hide {
    box-shadow: none !important;
    background: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
`;
