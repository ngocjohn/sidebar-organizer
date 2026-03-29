import { memoize } from 'es-toolkit/compat';

import { SelectSelector } from '../../types';

const TYPE_LABELS: Record<string, string> = {
  items: 'Individual Items Configuration',
  groups: 'Groups Configuration',
};
const TYPE_SELECTOR_LABELS: Record<string, string> = {
  items: 'Select an item',
  groups: 'Select a group',
};
const TYPE_HELPER_TEXT: Record<string, string> = {
  groups: 'A group entry applies to all panels in the group.',
  items:
    'If a panel is included in a group with a visibility setting, the individual panel setting will be ignored in favor of the group setting.',
};
export const VISIBILITY_OBJECT_SCHEMA = memoize((type: string, selectOptions: SelectSelector) => {
  return [
    {
      title: TYPE_LABELS[type] || type,
      type: 'expandable',
      expanded: true,
      flatten: false,
      required: false,
      name: type,
      helper: TYPE_HELPER_TEXT[type] || '',
      schema: [
        {
          name: '',
          selector: {
            object: {
              label_field: 'name',
              description_field: 'value',
              multiple: true,
              fields: {
                name: {
                  label: TYPE_SELECTOR_LABELS[type] || 'Name',
                  selector: selectOptions,
                  required: false,
                },
                value: {
                  label: 'Visibility Template',
                  selector: { template: { preview: true } },
                  required: false,
                },
              },
            },
          },
        },
      ] as const,
    },
  ] as const;
});
