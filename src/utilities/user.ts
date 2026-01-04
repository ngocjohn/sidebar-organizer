import type { HomeAssistant } from 'types/ha';

type Credential = {
  type: string;
};

interface User {
  id: string;
  username: string | null;
  name: string;
  is_owner: boolean;
  is_active: boolean;
  local_only: boolean;
  system_generated: boolean;
  group_ids: string[];
  credentials: Credential[];
}

export const fetchUsers = async (hass: HomeAssistant) =>
  hass.callWS<User[]>({
    type: 'config/auth/list',
  });
