import { CustomStyles } from '@types';
import { DividerColorSettings } from '@types';

import { color2rgba } from './colors';

const cleanCss = (cssString: string): string | void => {
  if (!cssString) return;

  const cleanedString = cssString
    .replace(/\s*!important/g, '')
    .replace(/;/g, '')
    .replace(/:/g, '');
  return cleanedString;
};

export const convertCustomStyles = (customStyles: CustomStyles): string | null => {
  if (!customStyles || Object.keys(customStyles).length === 0) {
    return null;
  }
  let cssString = ':host {';

  // Iterate over the customStyles object and build the CSS string
  Object.entries(customStyles).forEach(([key, value]) => {
    if (value != null) {
      // Ensure value is not null or undefined
      cssString += `${key}: ${cleanCss(value)} !important;`;
    }
  });

  cssString += '}';
  console.log(cssString);
  return cssString;
};

export const convertPreviewCustomStyles = (customStyles: CustomStyles): { [key: string]: string } | null => {
  if (!customStyles || Object.keys(customStyles).length === 0) {
    return null;
  }

  const styleObj: { [key: string]: string } = {};

  // Iterate over the customStyles object and build the style object
  Object.entries(customStyles).forEach(([key, value]) => {
    if (value != null) {
      // Ensure value is not null or undefined
      styleObj[key] = `${cleanCss(value)} !important`;
    }
  });

  return styleObj;
};

export const getDefaultThemeColors = (element?: HTMLElement): DividerColorSettings => {
  const styles = window.getComputedStyle(element ?? document.documentElement);

  const divider_color = styles.getPropertyValue('--divider-color');
  const defaultScrollbarThumbColor = styles.getPropertyValue('--scrollbar-thumb-color');
  const background_color = color2rgba(divider_color, 3) || divider_color;
  const border_top_color = divider_color;
  const scrollbar_thumb_color = color2rgba(divider_color, 3) || defaultScrollbarThumbColor;

  return {
    divider_color,
    background_color,
    border_top_color,
    scrollbar_thumb_color,
    custom_sidebar_background_color: styles.getPropertyValue('--sidebar-background-color'),
    divider_text_color: styles.getPropertyValue('--sidebar-text-color'),
    sidebar_icon_color: styles.getPropertyValue('--sidebar-icon-color'),
  };
};
