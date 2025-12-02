import './main';
import { infoFrontendModule } from '@utilities/logger';
const NAME_RGX = /sidebar-organizer.js/i;

const loadedScripts = Array.from(document.scripts);
const resources: string[] = [];

for (const script of loadedScripts) {
  if (script?.innerText?.trim()?.startsWith('import(')) {
    const imports = script.innerText.split(';')?.map((e) => e.trim());
    for (const imp of imports) {
      resources.push(imp.replace(/^import\(\"/, '').replace(/\"\);/, ''));
    }
  }
}
if (resources.some((res) => NAME_RGX.test(res))) {
  // console.log('%cSidebar Organizer is loaded as a module.', 'color: green; font-weight: bold;');
} else {
  const dashResource = loadedScripts.find((s) => NAME_RGX.test(s.src))?.src;
  const hacsUrl = dashResource?.match(/\/hacsfiles.*$/)?.[0];
  infoFrontendModule(hacsUrl);
}
