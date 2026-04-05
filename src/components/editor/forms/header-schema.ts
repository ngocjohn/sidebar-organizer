import { SidebarAppearanceConfig, TextTransformations } from '@types';
import memoizeOne from 'memoize-one';

interface BooleanItem<T = string> {
  type: 'boolean';
  name: T;
  label?: string;
  helper?: string;
  default?: boolean;
}

const BOOLEAN_OPTIONS = [
  {
    name: 'hide_header_toggle',
    helper: 'Toggle button for collapsing/expanding groups',
  },
  {
    name: 'animation_off',
    label: 'Disable Animation',
    helper: 'Disable slide-in/slide-out animation for group toggling',
  },
  {
    name: 'move_settings_from_fixed',
    helper: 'Move the Settings item from the fixed panels to be user-configurable',
    default: false,
  },
  {
    name: 'force_transparent_background',
    helper: 'Force apply transparent background (fully transparent)',
  },
];

const commonBooleanSchema = (name?: BooleanItem['name'][]) => {
  if (!name) {
    name = BOOLEAN_OPTIONS.map((b) => b.name);
  }
  const list: BooleanItem[] = [];
  name.forEach((n) => {
    const b = BOOLEAN_OPTIONS.find((bb) => bb.name === n);
    if (b) {
      list.push({
        name: b.name,
        label: b.label,
        helper: b.helper,
        default: b.default || false,
        type: 'boolean',
      });
    }
  });
  return list;
};

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
            ...commonBooleanSchema(['hide_header_toggle', 'animation_off']),
            ...(!delayDisabled
              ? [
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
                ]
              : []),
            ...commonBooleanSchema(['move_settings_from_fixed', 'force_transparent_background']),
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
            {
              name: 'width',
              label: 'Custom Width',
              helper:
                'Set a custom width for the sidebar, allows values with css units (e.g., 300px or 20%), or a number (which will be treated as pixels)',
              type: 'string',
            },
          ] as const,
        },
      ],
    },
  ] as const;
});
