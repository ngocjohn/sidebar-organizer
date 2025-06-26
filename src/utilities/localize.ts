import { HomeAssistant } from 'custom-card-helpers';

function t(hass: HomeAssistant, key: string) {
  return hass.localize(key);
}
enum PATH {
  UI_COMMON = 'ui.common.',
  UI_LOVELACE = 'ui.panel.lovelace.',
}
export const TRANSLATED = (hass: HomeAssistant) => ({
  BTN_LABEL: {
    CANCEL: t(hass, `${PATH.UI_COMMON}cancel`),
    DELETE: t(hass, `${PATH.UI_COMMON}delete`),
    SAVE: t(hass, `${PATH.UI_COMMON}save`),
    DOWNLOAD: t(hass, `${PATH.UI_COMMON}download`),
    SHOW_CODE_EDITOR: t(hass, `${PATH.UI_LOVELACE}editor.edit_card.show_code_editor`),
    SHOW_VISUAL_EDITOR: t(hass, `${PATH.UI_LOVELACE}editor.edit_card.show_visual_editor`),
  },
});

export const TRANSLATED_LABEL = {
  BTN_LABEL: {
    CANCEL: 'Cancel',
    DELETE: 'Delete',
    SAVE: 'Save',
    DOWNLOAD: 'Download',
    SHOW_CODE_EDITOR: 'Show code editor',
    SHOW_VISUAL_EDITOR: 'Show visual editor',
    UPLOAD: 'Upload Config File',
    USE_CONFIG_FILE: 'Use Config File',
    COPY_TO_CLIPBOARD: 'Copy to Clipboard',
    CHECK_VALIDITY: 'Check validity',
    AUTO_CORRECT: 'Auto-correct',
    EDIT: 'Edit',
    SAVE_MIGRATE: 'Save & Migrate to storage',
  },
};
