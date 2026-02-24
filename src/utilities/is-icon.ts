const isIconRegex = /^[a-z0-9]+:[a-z0-9\-]+$/;

export const isIcon = (value: string): boolean => isIconRegex.test(value);
export const getFallbackIcon = (groupName: string): string => {
  return `mdi:alpha-${groupName[0].toLowerCase()}-box`;
};