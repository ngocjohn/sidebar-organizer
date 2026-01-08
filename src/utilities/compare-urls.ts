import { NAMESPACE } from '@constants';
import { getPromisableResult } from 'get-promisable-result';
import { HomeAssistant } from 'types/ha';

import pjson from '../../package.json';
import { getConfigUrl } from './dom-utils';
import { generateHash } from './generate-hash';

const NAME_RGX = /sidebar-organizer.js/i;
const HACS_URL_RGX = /\/hacsfiles.*$/;
const HACS_TAG_RGX = /[?&]hacstag=(\d+)/;

const loadedScripts = document.scripts;

const loadedUrl = await getPromisableResult<string>(
  () => {
    const script = Array.from(loadedScripts).find((s) => NAME_RGX.test(s.src));
    return script?.src || '';
  },
  (result: string) => result.length > 0,
  {
    retries: 100,
    delay: 50,
    shouldReject: false,
  }
);

export function compareHacsTagDiff(hass: HomeAssistant): void {
  const configUrl = getConfigUrl(loadedScripts);
  if (!loadedUrl || !configUrl) {
    return;
  }

  const hacsUrlMatch = loadedUrl?.match(HACS_URL_RGX)?.[0];

  if (!hacsUrlMatch) {
    return;
  }

  const loadedTagMatch = loadedUrl.match(HACS_TAG_RGX)?.[1];
  const configTagMatch = configUrl.match(HACS_TAG_RGX)?.[1];
  console.log(
    '%cCOMPARE-URLS:',
    'color: #4dabf7;',
    `Loaded HACS tag: ${loadedTagMatch}, Config HACS tag: ${configTagMatch}`
  );
  if (!loadedTagMatch || !configTagMatch) {
    return;
  }
  if (loadedTagMatch !== configTagMatch) {
    hacsPathWarning(loadedTagMatch, configTagMatch, hass);
    return;
  }
}

function hacsPathWarning(loadedTag: string, configTag: string, hass: HomeAssistant): void {
  if ((window as any).so_hacstag_warning) return;
  (window as any).so_hacstag_warning = true;

  const msgTitle = `${NAMESPACE.toUpperCase()} (${pjson.version}) WARNING`;
  const msg = 'Plugin already loaded from frontend module!';
  const details = [
    'Plugin is being loaded twice with different resource URLs.',
    'Update resource URLs including hacstag to match exactly.',
  ];
  const urlsDetails = [`Dashboard resource URL: ?hacstag=${loadedTag}`, `Config resource URL: ?hacstag=${configTag}`];

  console.groupCollapsed(`%c${msgTitle}${msg}`, 'color: red; font-weight: bold;');
  [...details, ...urlsDetails].forEach((line) => console.info(line));
  console.groupEnd();

  const notification = `${details.join(' ')}\n\n${urlsDetails.map((line) => '**' + line + '**').join('\n\n')}\n\nSee [documentation](${pjson.repository.url}#installation) for more info.`;

  console.log('%cCOMPARE-URLS:', 'color: #4dabf7;', notification.toString());

  const notificationId = 'so_hacstag_warning_' + generateHash(hass.user?.id || 'unknown');
  console.log('%cCOMPARE-URLS:', 'color: #4dabf7;', `Notification ID: ${notificationId}`);
  hass.callService('persistent_notification', 'create', {
    notification_id: notificationId,
    title: msgTitle,
    message: notification,
  });
}
