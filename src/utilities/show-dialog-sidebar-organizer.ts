import { ELEMENT } from '@constants';

import { fireEvent, HASSDomEvent, ValidHassDomEvent } from './fire_event';

declare global {
  // for fire event
  interface HASSDomEvents {
    'close-dialog': undefined;
    'dialog-closed': DialogClosedParams;
  }
  // for add event listener
  interface HTMLElementEventMap {
    'show-dialog': HASSDomEvent<ShowDialogParams<unknown>>;
    'dialog-closed': HASSDomEvent<DialogClosedParams>;
  }
}

export const loadSidebarOrganizerDialog = () => import('../components/sidebar-organizer-dialog');

export const showDialogSidebarOrganizer = (el: HTMLElement): void => {
  fireEvent(el, 'show-dialog', {
    dialogTag: ELEMENT.SIDEBAR_CONFIG_DIALOG_WRAPPER,
    dialogImport: loadSidebarOrganizerDialog,
    dialogParams: {},
  });
};

export interface HassDialog<T = HASSDomEvents[ValidHassDomEvent]> extends HTMLElement {
  showDialog(params: T);
  closeDialog?: () => boolean;
}

interface ShowDialogParams<T> {
  dialogTag: keyof HTMLElementTagNameMap;
  dialogImport: () => Promise<unknown>;
  dialogParams: T;
  addHistory?: boolean;
}

export interface DialogClosedParams {
  dialog: string;
}
