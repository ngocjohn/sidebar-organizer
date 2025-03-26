import tinycolor from 'tinycolor2';

export const color2rgba = (color: string, alpha: number = 1): string | void => {
  const colorObj = tinycolor(color);
  if (!colorObj.isValid()) return;
  const newColor = colorObj.setAlpha(colorObj.getAlpha() / alpha).toRgbString();
  return newColor;
};

export const hex2rgb = (hex: string): [number, number, number] => {
  return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
};
