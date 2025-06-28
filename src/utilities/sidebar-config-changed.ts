import { SidebarConfig } from '@types';

import { fireEvent } from './fire_event';

export interface ConfigChangedEvent {
  config: SidebarConfig;
}

declare global {
  interface HASSDomEvents {
    'sidebar-config-changed': ConfigChangedEvent;
  }
  interface HTMLElementEventMap {
    'sidebar-config-changed': ConfigChangedEvent;
  }
}

export interface SidebarConfigEvent extends Event {
  detail: {
    config: SidebarConfig;
  };
}

export const sidebarConfigChanged = (el: HTMLElement, config: SidebarConfig): void => {
  fireEvent(el, 'sidebar-config-changed', {
    config,
  });
};
