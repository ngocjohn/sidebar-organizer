import type { SidebarOrganizer } from '../sidebar-organizer';

import { CONFIG_NAME, NAMESPACE_TITLE, REPO_URL } from '@constants';
import { clearSidebarOrganizerStorage } from '@utilities/configs/misc';
import { clearBrowserCache, fileDownload, nextRender } from '@utilities/dom-utils';
import { CoreFrontendUserData, subscribeFrontendUserData } from '@utilities/index';
import { getDefaultPanelUrlPath } from '@utilities/panel';
import { UnsubscribeFunc } from 'home-assistant-js-websocket/dist/types';
import { css, html, LitElement, PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import YAML from 'yaml';

type ActionType = 'open_dialog' | 'clear_cache' | 'download_config' | 'delete_config';
const ACTION_LIST: {
  headline: string;
  supportingText?: string;
  action: ActionType;
  btnText?: string;
  variant?: string;
  canDisable?: boolean;
}[] = [
  {
    headline: 'Settings dialog',
    supportingText: 'Open the settings dialog to customize your sidebar.',
    action: 'open_dialog',
    btnText: 'Open',
    canDisable: false,
  },
  {
    headline: 'Clear frontend cache',
    supportingText: 'Clear the frontend cache to fix potential issues.',
    action: 'clear_cache',
    btnText: 'Clear',
    canDisable: false,
  },
  {
    headline: 'Download configuration',
    supportingText: 'Download the current configuration as a yaml file.',
    action: 'download_config',
    btnText: 'Download',
    canDisable: true,
  },
  {
    headline: 'Delete saved configuration',
    supportingText: "Delete the saved configuration in the browser's local storage.",
    action: 'delete_config',
    btnText: 'Delete',
    variant: 'danger',
    canDisable: true,
  },
] as const;

@customElement('so-profile-section')
export class SoProfileSection extends LitElement {
  @property({ attribute: false }) public organizer!: SidebarOrganizer;

  public _coreUserData?: CoreFrontendUserData | null;
  private _unsubCoreData?: Promise<UnsubscribeFunc>;

  public connectedCallback() {
    super.connectedCallback();
    if (this.organizer.hass) {
      this._getCoreData();
    }
  }

  public disconnectedCallback() {
    super.disconnectedCallback();
    if (this._unsubCoreData) {
      this._unsubCoreData.then((unsub) => unsub());
      this._unsubCoreData = undefined;
    }
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
    if (!this._unsubCoreData) {
      this._getCoreData();
    }
  }
  public _getCoreData() {
    if (!this.organizer._pluginConfigured) {
      return;
    }
    const defaultPanel = getDefaultPanelUrlPath(this.organizer.hass);
    //info
    console.log(
      '%cSO-PROFILE-SECTION:%c ℹ️ Subscribing to core frontend user data',
      'color: #40c057;',
      'color: #228be6;',
      defaultPanel
    );

    this._unsubCoreData = subscribeFrontendUserData(this.organizer.hass.connection, 'core', async ({ value }) => {
      this._coreUserData = value;
      // console.log('%cSO-PROFILE-SECTION:', 'color: #4dabf7;', 'Received core frontend user data:', value);
      const userDefaultPanel = value?.default_panel;
      const hasChangeInDefaultPanel = Boolean(userDefaultPanel && defaultPanel !== userDefaultPanel);
      if (hasChangeInDefaultPanel) {
        console.log(
          '%cSO-PROFILE-SECTION:',
          'color: #4dabf7;',
          'User default panel changed to',
          userDefaultPanel,
          'from',
          defaultPanel
        );
        this.organizer._store._needReloadToast();
        return;
      }
      await nextRender();
      this.organizer._checkDiffs();
    });
  }

  protected render() {
    return html`
      <ha-card>
        <div class="card-header">
          ${NAMESPACE_TITLE}
          <ha-icon icon="mdi:github" @click=${() => window.open(`${REPO_URL}`, '_blank')}></ha-icon>
        </div>
        <div class="card-content">
          The following settings are used to control the behavior of the Sidebar Organizer plugin.
        </div>
        <ha-md-list>
          ${ACTION_LIST.map((action) => {
            const isDisabled = action.canDisable && !this.organizer._hasSidebarConfig;
            return html`
              ${action.action === 'delete_config' ? html`<wa-divider style="--spacing: 0;"></wa-divider>` : ''}
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

  private _handleAction = async (action: ActionType) => {
    switch (action) {
      case 'open_dialog':
        this.organizer._dialogManager._showConfigDialogEditor();
        break;
      case 'delete_config':
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
      case 'download_config':
        const yamlStr = YAML.stringify(this.organizer._config);
        // Create a blob from the data
        const blob = new Blob([yamlStr], { type: 'application/x-yaml' });
        const url = URL.createObjectURL(blob);
        const filename = `${CONFIG_NAME + '_' + new Date().toISOString().replace(/:/g, '-').split('.', 1).join()}`;
        if (__DEBUG__) {
          fileDownload(url, `${filename}-dev.yaml`);
        } else {
          fileDownload(url, `${filename}.yaml`);
        }
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 0);
        break;
    }
  };
  static styles = css`
    ha-card .card-header {
      display: flex;
      justify-content: space-between;
    }
    ha-card .card-header ha-icon {
      color: var(--secondary-text-color);
      cursor: pointer;
      &:hover {
        color: var(--primary-color);
      }
    }
    ha-md-list {
      background: 0 0;
      padding-top: 0;
      padding-bottom: 0;
    }
    /* .card-content {
    } */
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'so-profile-section': SoProfileSection;
  }
}
