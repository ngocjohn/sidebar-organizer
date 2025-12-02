import { NAMESPACE_TITLE } from '@constants';

export const showConfirmDialog = async (
  element: HTMLElement,
  message: string,
  confirmText: string,
  cancelText?: string
): Promise<boolean> => {
  const helpers = await (window as any).loadCardHelpers();
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
  confirmText: string,
  cancelText?: string
): Promise<string | null> => {
  const helpers = await (window as any).loadCardHelpers();
  const result = await helpers.showPromptDialog(element, {
    title: NAMESPACE_TITLE,
    text,
    placeholder,
    confirmText,
    inputType: 'string',
    defaultValue: '',
    cancelText: cancelText ? cancelText : 'Cancel',
    confirmation: true,
  });

  console.log('showPromptDialog', result);
  return result;
};

export const showAlertDialog = async (element: HTMLElement, message: string, confirmText?: string): Promise<void> => {
  const helpers = await (window as any).loadCardHelpers();
  await helpers.showAlertDialog(element, {
    title: NAMESPACE_TITLE,
    text: message,
    confirmText,
  });
};
