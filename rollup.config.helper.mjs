import { description, repository } from './package.json';

export function logCardInfo(version) {
  const verText = version;
  const repo = repository.url;
  const sponsor = 'https://github.com/sponsors/ngocjohn';

  const line1Part1 = '🗄️ SIDEBAR-ORGANIZER 🗄️';
  const line1Part2 = `${verText}`;
  const line2 = `${repo}`;

  const line1FullText = `${line1Part1} ${line1Part2}`;

  const maxLength = Math.max(Array.from(line1FullText).length, line2.length);

  // Center-align text with spaces at the start and end
  const centerWithPadding = (text, maxLength) => {
    const totalPadding = maxLength - Array.from(text).length;
    const sidePadding = Math.floor(totalPadding / 2); // Split padding evenly for centering
    const paddedText = ' '.repeat(1 + sidePadding) + text + ' '.repeat(1 + totalPadding - sidePadding);
    return paddedText;
  };

  const spaceBetween = ' ';
  const paddedLine1Part1 = centerWithPadding(
    line1Part1,
    maxLength - Array.from(line1Part2).length - spaceBetween.repeat(2).length
  );
  const paddedLine2 = centerWithPadding(line2, maxLength);

  return `
    console.groupCollapsed(
      "%c${paddedLine1Part1}%c${spaceBetween}${line1Part2}${spaceBetween}\\n%c${paddedLine2}",
      "color: cyan; background: black; font-weight: bold;",
      "color: darkblue; background: white; font-weight: bold;",
      ' background: dimgray'
    );
    console.info('${description}');
    console.info('If you like the project, consider supporting the developer: ${sponsor}');
    console.groupEnd();
  `;
}
