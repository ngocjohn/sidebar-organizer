import { SidebarAppearanceConfig, TextTransformations } from '@types';
import memoizeOne from 'memoize-one';

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
            ...(delayDisabled
              ? []
              : [
                  {
                    name: 'animation_delay',
                    label: 'Animation Delay (ms)',
                    selector: {
                      number: {
                        min: 0,
                        max: 100,
                        step: 10,
                        mode: 'slider',
                        unit_of_measurement: 'ms',
                      },
                    },
                    helper: 'Delay for each item (default: 50ms)',
                    default: 50,
                    disabled: delayDisabled,
                  },
                ]),

            {
              name: 'move_settings_from_fixed',
              label: 'Move Settings item from Fixed',
              type: 'boolean',
              helper: 'Move the Settings item from the fixed panels to be user-configurable',
              default: false,
            },
            {
              name: 'text_transformation',
              label: 'Text Transformation',
              default: 'capitalize',
              helper: 'Transform the text of group names',
              selector: {
                select: {
                  mode: 'dropdown',
                  options: [
                    ...TextTransformations.map((mode) => ({
                      value: mode,
                      label: mode.charAt(0).toUpperCase() + mode.slice(1),
                    })),
                  ],
                },
              },
            },
          ] as const,
        },
      ],
    },
  ] as const;
});
