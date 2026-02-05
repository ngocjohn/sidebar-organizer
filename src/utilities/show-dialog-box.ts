import { NAMESPACE_TITLE } from '@constants';
import { TemplateResult } from 'lit';

export interface BaseDialogBoxParams {
  confirmText?: string;
  text?: string | TemplateResult;
  title?: string;
  warning?: boolean;
}

export type DialogType = 'confirm' | 'prompt' | 'alert';

export enum DIALOG {
  CONFIRM = 'confirm',
  PROMPT = 'prompt',
  ALERT = 'alert',
}

export interface AlertDialogParams extends BaseDialogBoxParams {
  confirm?: () => void;
}

export interface ConfirmationDialogParams extends BaseDialogBoxParams {
  dismissText?: string;
  confirm?: () => void;
  cancel?: () => void;
  destructive?: boolean;
}

export interface PromptDialogParams extends BaseDialogBoxParams {
  inputLabel?: string;
  dismissText?: string;
  inputType?: string;
  defaultValue?: string;
  placeholder?: string;
  confirm?: (out?: string) => void;
  cancel?: () => void;
  inputMin?: number | string;
  inputMax?: number | string;
}

export interface DialogBoxParams extends ConfirmationDialogParams, PromptDialogParams {
  confirm?: (out?: string) => void;
  confirmation?: boolean;
  prompt?: boolean;
}

export const showConfirmDialog = async (
  element: HTMLElement,
  message: string,
  confirmText: string,
  cancelText?: string
): Promise<boolean> => {
  // Check if loadCardHelpers is available (older HA versions)
  if (typeof (window as any).loadCardHelpers === 'function') {
    const helpers = await (window as any).loadCardHelpers();
    const result = await helpers.showConfirmationDialog(element, {
      title: NAMESPACE_TITLE,
      text: message,
      confirmText,
      dismissText: cancelText ? cancelText : 'Cancel',
    });

    console.log('showConfirmDialog', result);
    return result;
  }

  // Fallback for HA 2026.2+ where loadCardHelpers is not available
  // Use the native confirm dialog
  return new Promise<boolean>((resolve) => {
    const confirmed = window.confirm(`${NAMESPACE_TITLE}\n\n${message}`);
    resolve(confirmed);
  });
};

export const showPromptDialog = async (
  element: HTMLElement,
  text: string,
  placeholder: string,
  confirmText: string,
  cancelText?: string
): Promise<string | null> => {
  // Check if loadCardHelpers is available (older HA versions)
  if (typeof (window as any).loadCardHelpers === 'function') {
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
  }

  // Fallback for HA 2026.2+ where loadCardHelpers is not available
  // Use the native prompt dialog
  return new Promise<string | null>((resolve) => {
    const result = window.prompt(`${NAMESPACE_TITLE}\n\n${text}`, placeholder);
    resolve(result);
  });
};

export const showAlertDialog = async (element: HTMLElement, message: string, confirmText?: string): Promise<void> => {
  // Check if loadCardHelpers is available (older HA versions)
  if (typeof (window as any).loadCardHelpers === 'function') {
    const helpers = await (window as any).loadCardHelpers();
    await helpers.showAlertDialog(element, {
      title: NAMESPACE_TITLE,
      text: message,
      confirmText,
    });
    return;
  }

  // Fallback for HA 2026.2+ where loadCardHelpers is not available
  // Use the native alert dialog
  return new Promise<void>((resolve) => {
    window.alert(`${NAMESPACE_TITLE}\n\n${message}`);
    resolve();
  });
};

interface CreateDialogBoxTypes {
  confirm: ConfirmationDialogParams;
  prompt: PromptDialogParams;
  alert: AlertDialogParams;
}

export const createDialogBox = <T extends DialogType>(type: T, params: CreateDialogBoxTypes[T]): DialogBoxParams => {
  return {
    ...params,
    title: params.title ?? NAMESPACE_TITLE,
    confirmation: type === 'confirm',
    prompt: type === 'prompt',
  };
};

export const showDialogBox = async <T extends DialogType>(
  element: HTMLElement,
  type: T,
  params: CreateDialogBoxTypes[T]
): Promise<void | string | boolean> => {
  // Check if loadCardHelpers is available (older HA versions)
  if (typeof (window as any).loadCardHelpers === 'function') {
    const helpers = await (window as any).loadCardHelpers();
    switch (type) {
      case 'confirm':
        return await helpers.showConfirmationDialog(element, createDialogBox(type, params as ConfirmationDialogParams));
      case 'prompt':
        return await helpers.showPromptDialog(element, createDialogBox(type, params as PromptDialogParams));
      case 'alert':
        return await helpers.showAlertDialog(element, createDialogBox(type, params as AlertDialogParams));
    }
  }

  // Fallback for HA 2026.2+ where loadCardHelpers is not available
  const dialogParams = createDialogBox(type, params);
  switch (type) {
    case 'confirm':
      return window.confirm(`${dialogParams.title}\n\n${dialogParams.text}`);
    case 'prompt':
      const promptParams = dialogParams as any;
      const result = window.prompt(`${dialogParams.title}\n\n${dialogParams.text}`, promptParams.placeholder || promptParams.defaultValue || '');
      return result !== null ? result : '';
    case 'alert':
      window.alert(`${dialogParams.title}\n\n${dialogParams.text}`);
      return;
  }
};
