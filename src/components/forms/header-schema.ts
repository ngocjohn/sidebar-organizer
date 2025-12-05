import { SidebarAppearanceConfig } from '@types';
import memoizeOne from 'memoize-one';

export const headerSchema = (delayDisabled = false) =>
  [
    {
      name: '',
      type: 'expandable',
      expanded: true,
      flatten: true,
      title: 'Configuration',
      icon: 'mdi:format-text',
      schema: [
        {
          name: '',
          type: 'grid',
          schema: [
            {
              name: 'header_title',
              label: 'Header Title',
              type: 'string',
              default: '',
            },
            {
              name: 'hide_header_toggle',
              label: 'Hide Header Toggle',
              type: 'boolean',
              helper: 'Toggle button for collapsing/expanding groups',
              default: false,
            },
          ] as const,
        },
        {
          name: '',
          type: 'grid',
          schema: [
            {
              name: 'animation_off',
              label: 'Disable Animation',
              type: 'boolean',
              helper: 'Disable slide-in/slide-out animation for group toggling',
              default: false,
            },
            {
              name: 'animation_delay',
              label: 'Animation Delay (ms)',
              type: 'integer',
              helper: 'Delay for each item (default: 50ms)',
              default: 50,
              disabled: delayDisabled,
              valueMin: 0,
              valueMax: 100,
            },
          ] as const,
        },
      ],
    },
  ] as const;

export const BASE_APPEARANCE_SCHEMA = memoizeOne((data: SidebarAppearanceConfig) => {
  const delayDisabled = data?.animation_off === true;
  return [
    {
      title: 'Appearance Settings',
      type: 'expandable',
      expanded: true,
      flatten: true,
      icon: 'mdi:format-text',
      schema: [
        {
          type: 'grid',
          schema: [
            {
              name: 'header_title',
              type: 'string',
            },
            {
              name: 'hide_header_toggle',
              type: 'boolean',
              helper: 'Toggle button for collapsing/expanding groups',
              default: false,
            },
            {
              name: 'animation_off',
              label: 'Disable Animation',
              type: 'boolean',
              helper: 'Disable slide-in/slide-out animation for group toggling',
              default: false,
            },
            {
              name: 'animation_delay',
              label: 'Animation Delay (ms)',
              type: 'integer',
              helper: 'Delay for each item (default: 50ms)',
              default: 50,
              disabled: delayDisabled,
              valueMin: 0,
              valueMax: 100,
            },
          ] as const,
        },
      ],
    },
  ] as const;
});
