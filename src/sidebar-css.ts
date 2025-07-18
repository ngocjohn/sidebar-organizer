import { css } from 'lit';
export const DIVIDER_ADDED_STYLE = css`
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

  :host .divider[added] {
    padding: 0;
    box-sizing: border-box;
    margin: var(--divider-margin-radius);
    width: 248px;
  }
  :host(:not([expanded])) .divider[added] {
    margin: 0 !important;
  }

  :host([expanded]) .ha-scrollbar .divider[ungrouped] {
    padding-top: 1px;
    opacity: 0.5;
  }

  :host ha-md-list-item > ha-icon.badge {
    --mdc-icon-size: 20px !important;
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
    text-transform: capitalize;
    &:hover {
      color: var(--primary-color);
      background-color: rgb(from var(--primary-color) r g b / 0.1);
    }
  }

  :host .divider.collapsed[added][aria-selected='true'] {
    background-color: rgb(from var(--sidebar-selected-icon-color) r g b / 0.12);
  }

  :host .divider[added] .added-content > span,
  :host .divider[added] .added-content > ha-icon {
    pointer-events: none;
    transition: all 150ms ease;
  }

  :host .divider[added] .added-content.collapsed > ha-icon {
    transform: rotate(-90deg);
  }

  :host .divider[added] .added-content > span {
    transform: translateX(30px);
  }
  :host .divider[added]:hover .added-content.collapsed > span {
    transform: translateX(30px);
  }
  :host .divider[added] .added-content.collapsed > span {
    transform: translateX(10px);
  }

  :host([expanded]) .ha-scrollbar .divider[added]::before {
    display: none !important;
  }

  :host(:not([expanded])) .divider.collapsed[added]::before {
    content: '';
    display: none;
  }

  :host(:not([expanded])) .divider .added-content {
    display: none;
  }

  a:not(.iron-selected):hover > paper-icon-item {
    background-color: rgb(from var(--sidebar-selected-icon-color) r g b / 0.2);
  }

  :host ha-md-list-item:has([group]) {
    transition: all;
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
    animation-fill-mode: both;
  }

  @keyframes slideIn {
    from {
      max-height: 0px;
      opacity: 0.3;
    }
    to {
      max-height: 1000px;
      opacity: 1;
    }
  }

  :host ha-md-list-item.slideOut {
    animation-name: slideOut;
    animation-duration: 0.3s;
    animation-fill-mode: both;
  }
  @keyframes slideOut {
    from {
      max-height: 1000px;
      opacity: 1;
    }
    to {
      max-height: 0px;
      opacity: 0;
    }
  }
`;

export const DIALOG_STYLE = css`
  ha-dialog {
    --mdc-dialog-max-width: 90vw;
    --mdc-dialog-min-height: 700px;
    --dialog-backdrop-filter: blur(2px);
    --justify-action-buttons: space-between;
    --dialog-content-padding: 0 1rem;
  }
  sidebar-organizer-config-dialog {
    width: calc(90vw - 48px);
    max-width: 1000px;
    margin-left: auto;
    margin-right: auto;
    display: flex;
    flex-direction: column;
  }

  ha-dialog[large] {
    --mdc-dialog-min-width: 90vw;
    --mdc-dialog-max-width: 90vw;
  }
  ha-dialog[large] sidebar-organizer-config-dialog {
    max-width: none;
    width: 100%;
  }

  @media all and (max-width: 450px), all and (max-height: 500px) {
    ha-dialog {
      height: 100%;
      --mdc-dialog-max-height: 100%;
      --dialog-surface-top: 0px;
      --mdc-dialog-max-width: 100vw;
    }
    sidebar-organizer-config-dialog {
      width: 100%;
      max-width: 100%;
    }
  }
  @media all and (min-width: 451px) and (min-height: 501px) {
    ha-dialog[large] sidebar-organizer-config-dialog {
      max-width: none;
      width: 100%;
    }
  }
  @media all and (max-width: 600px), all and (max-height: 500px) {
    ha-dialog,
    ha-dialog[large] {
      --mdc-dialog-min-width: 100vw;
      --mdc-dialog-max-width: 100vw;
      --mdc-dialog-min-height: 100%;
      --mdc-dialog-max-height: 100%;
      --vertical-align-dialog: flex-end;
      --ha-dialog-border-radius: 0;
    }
    sidebar-organizer-config-dialog {
      width: 100%;
      max-width: none;
    }
  }
`;
