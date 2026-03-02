import type { SidebarOrganizer } from '../sidebar-organizer';

import { NAMESPACE_TITLE } from '@constants';
import { clearSidebarOrganizerStorage } from '@utilities/configs/misc';
import { clearBrowserCache } from '@utilities/dom-utils';
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

const ACTION_LIST: {
  headline: string;
  supportingText?: string;
  action: string;
  btnText?: string;
  variant?: string;
}[] = [
  {
    headline: 'Settings dialog',
    supportingText: 'Open the settings dialog to customize your sidebar.',
    action: 'open_dialog',
    btnText: 'Open',
  },
  {
    headline: 'Clear frontend cache',
    supportingText: 'Clear the frontend cache to fix potential issues.',
    action: 'clear_cache',
    btnText: 'Clear',
  },
  {
    headline: 'Delete saved configuration',
    supportingText: "Delete the saved configuration in the browser's local storage.",
    action: 'delete_configuration',
    btnText: 'Delete',
    variant: 'danger',
  },
] as const;

@customElement('so-profile-section')
export class SoProfileSection extends LitElement {
  @property({ attribute: false }) public organizer!: SidebarOrganizer;

  protected createRenderRoot() {
    return this;
  }
  public connectedCallback() {
    super.connectedCallback();
  }

  public disconnectedCallback() {
    super.disconnectedCallback();
  }

  protected render() {
    return html`
      <ha-card .header=${NAMESPACE_TITLE}>
        <div class="card-content">
          The following settings are used to control the behavior of the Sidebar Organizer plugin.
        </div>
        <ha-md-list>
          ${ACTION_LIST.map((action) => {
            const isDisabled = action.action === 'delete_configuration' && !this.organizer._hasSidebarConfig;
            return html`
              ${action.action === 'delete_configuration' ? html`<wa-divider style="--spacing: 0;"></wa-divider>` : ''}
              <ha-md-list-item>
                <span slot="headline">${action.headline}</span>
                ${action.supportingText ? html`<span slot="supporting-text">${action.supportingText}</span>` : ''}
                <ha-button
                  slot="end"
                  appearance="plain"
                  size="small"
                  variant=${action.variant || 'brand'}
                  .disabled=${isDisabled}
                  @click=${() => this._handleAction(action.action)}
                >
                  ${action.btnText}
                </ha-button>
              </ha-md-list-item>
            `;
          })}
        </ha-md-list>
      </ha-card>
    `;
  }

  private _handleAction = async (action: string) => {
    switch (action) {
      case 'open_dialog':
        this.organizer._dialogManager._showConfigDialogEditor();
        break;
      case 'delete_configuration':
        const confirmed = await this.organizer._dialogManager._confirm(
          'Are you sure you want to delete the saved configuration? This action cannot be undone.',
          'Delete',
          'Cancel'
        );
        if (confirmed) {
          clearSidebarOrganizerStorage();
          if (!this.organizer._hasSidebarConfig) {
            this.organizer._reloadWindow(3000);
          }
        }
        break;
      case 'clear_cache':
        clearBrowserCache();
        break;
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'so-profile-section': SoProfileSection;
  }
}
