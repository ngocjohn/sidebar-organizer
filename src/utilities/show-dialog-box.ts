import { NAMESPACE_TITLE } from '@constants';
const HELPERS = (window as any).loadCardHelpers ? (window as any).loadCardHelpers() : undefined;
let helpers: any;
if ((window as any).loadCardHelpers) {
  helpers = await (window as any).loadCardHelpers();
} else if (HELPERS) {
  helpers = HELPERS;
}

export const showConfirmDialog = async (
  element: HTMLElement,
  message: string,
  confirmText: string,
  cancelText?: string
): Promise<boolean> => {
  const result = await helpers.showConfirmationDialog(element, {
    title: NAMESPACE_TITLE,
    text: message,
    confirmText,
    dismissText: cancelText ? cancelText : 'Cancel',
  });

  console.log('showConfirmDialog', result);
  return result;
};

export const showPromptDialog = async (
  element: HTMLElement,
  text: string,
  placeholder: string,
  confirmText: string
): Promise<string | null> => {
  const result = await helpers.showPromptDialog(element, {
    title: NAMESPACE_TITLE,
    text,
    placeholder,
    confirmText,
    inputType: 'string',
    defaultValue: '',
  });

  console.log('showPromptDialog', result);
  return result;
};

export const showAlertDialog = async (element: HTMLElement, message: string): Promise<void> => {
  await helpers.showAlertDialog(element, {
    title: NAMESPACE_TITLE,
    text: message,
  });
};
