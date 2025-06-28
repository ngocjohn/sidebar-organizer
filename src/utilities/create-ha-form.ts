import { SidebarConfig } from '@types';
import { HomeAssistant } from 'custom-card-helpers';
import { html, TemplateResult } from 'lit';

export const createHaForm = (component: any, schema: any, data?: any): TemplateResult => {
  const DATA = data ?? ({ ...component._sidebarConfig } as SidebarConfig);
  const hass = component.hass || (component._hass as HomeAssistant);
  const handleChange = (ev: CustomEvent) => component._valueChanged(ev);

  return html` <ha-form
    .hass="${hass}"
    .data="${DATA}"
    .schema="${schema}"
    .computeLabel="${(schema: any) => {
      return schema.label || '';
    }}"
    .computeHelper="${(schema: any) => {
      return schema.helper || '';
    }}"
    @value-changed="${handleChange}"
  ></ha-form>`;
};
