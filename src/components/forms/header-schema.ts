export const headerSchema = [
  {
    name: '',
    type: 'expandable',
    expanded: true,
    flatten: true,
    title: 'Header Configuration',
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
        ],
      },
    ],
  },
] as const;
