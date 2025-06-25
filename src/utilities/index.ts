export * from './dom-utils';
export * from './custom-styles';
export * from './show-dialog-box';
export * from './colors';
export * from './preview-items';
export * from './storage-utils';
export * from './logger';
export * from './ws-templates';
export * from './apply-theme';
export * from './is-icon';
export * from './localize';
export * from './tap-action';
export * from './frontend';
export * from './action';
import memoizeOne from 'memoize-one';

export const localizeWeekdays = memoizeOne((language: string, short: boolean): string[] => {
  const days: string[] = [];
  const format = new Intl.DateTimeFormat(language, {
    weekday: short ? 'short' : 'long',
    timeZone: 'UTC',
  });
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.UTC(1970, 0, 1 + 3 + i));
    days.push(format.format(date));
  }
  return days;
});

export const localizeMonths = memoizeOne((language: string, short: boolean): string[] => {
  const months: string[] = [];
  const format = new Intl.DateTimeFormat(language, {
    month: short ? 'short' : 'long',
    timeZone: 'UTC',
  });
  for (let i = 0; i < 12; i++) {
    const date = new Date(Date.UTC(1970, 0 + i, 1));
    months.push(format.format(date));
  }
  return months;
});
