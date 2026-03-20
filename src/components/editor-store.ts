import { SidebarConfig } from '@types';

import { SidebarConfigDialog } from './sidebar-dialog';

export class EditorStore {
  public editorDialog: SidebarConfigDialog;
  public sidebarConfig: SidebarConfig;

  constructor(editorDialog: SidebarConfigDialog, sidebarConfig: SidebarConfig) {
    this.editorDialog = editorDialog;
    this.sidebarConfig = sidebarConfig;
  }
}
