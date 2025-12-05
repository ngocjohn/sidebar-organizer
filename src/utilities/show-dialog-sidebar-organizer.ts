import { ELEMENT } from '@constants';
import { SidebarConfig } from '@types';

import { fireEvent } from './fire_event';

export interface SidebarConfigDialogParams {
  config: SidebarConfig;
}
export const loadSidebarOrganizerDialog = () => import('../components/sidebar-organizer-dialog');

export const showDialogSidebarOrganizer = (el: HTMLElement, dialogParam: SidebarConfigDialogParams): void => {
  fireEvent(el, 'show-dialog', {
    dialogTag: ELEMENT.SIDEBAR_CONFIG_DIALOG_WRAPPER,
    dialogImport: loadSidebarOrganizerDialog,
    dialogParams: dialogParam,
  });
};
