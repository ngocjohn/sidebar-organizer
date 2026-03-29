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

export const VISIBILITY_OBJECT_SCHEMA = memoize((type: string, selectOptions: SelectSelector) => {
  return [
    {
      title: TYPE_LABELS[type] || type,
      type: 'expandable',
      expanded: true,
      flatten: true,
      required: false,
      name: type,
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
                  required: true,
                },
                value: {
                  label: 'Visibility Template',
                  selector: { template: { preview: true } },
                  required: true,
                },
              },
            },
          },
        },
      ] as const,
    },
  ] as const;
});
