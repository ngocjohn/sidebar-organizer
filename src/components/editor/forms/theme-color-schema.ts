const THEME_MODE_OPTIONS = ['light', 'dark'] as const;

export const CUSTOM_THEME_SCHEMA = (modeDisabled = false) =>
  [
    {
      name: 'custom_theme',
      title: 'Custom Theme & Force Mode',
      icon: 'mdi:palette',
      type: 'expandable',
      expanded: true,
      flatten: false,
      schema: [
        {
          name: '',
          type: 'grid',
          flatten: false,
          schema: [
            {
              name: 'theme',
              label: 'Custom Theme',
              required: false,
              selector: { theme: { include_default: false } },
            },
            {
              name: 'mode',
              label: 'Force Mode',
              required: false,
              disabled: modeDisabled,
              selector: {
                select: {
                  mode: 'dropdown',
                  options: THEME_MODE_OPTIONS.map((mode) => ({
                    value: mode,
                    label: mode.charAt(0).toUpperCase() + mode.slice(1),
                  })),
                },
              },
            },
          ] as const,
        },
      ],
    },
  ] as const;
