import { SidebarConfig } from '@types';
import { capitalize } from 'es-toolkit/compat';
import { html, TemplateResult } from 'lit';

import { HomeAssistant } from '../types/ha';

export const createHaForm = (component: any, schema: any, data?: any, options?: any): TemplateResult => {
  const DATA = data ?? ({ ...component._sidebarConfig } as SidebarConfig);
  const hass = component.hass || (component._hass as HomeAssistant);
  const handleChange = (ev: CustomEvent) => component._valueChanged(ev);

  return html` <ha-form
    .hass="${hass}"
    .data="${DATA}"
    .schema="${schema}"
    .configKey="${options?.configKey}"
    .computeLabel="${_computeLabel}"
    .computeHelper="${_computeHelper}"
    @value-changed="${handleChange}"
  ></ha-form>`;
};

function _computeLabel(schema: any): string | undefined {
  if (schema.name === 'entity' && !schema.context?.group_entity) {
    return undefined;
  }
  const label = schema.label || schema.name || schema.title || '';
  return capitalize(label.replace(/_/g, ' '));
}

function _computeHelper(schema: any): string | TemplateResult | undefined {
  return schema.helper || undefined;
}
