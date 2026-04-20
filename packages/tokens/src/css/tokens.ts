export { generateDarkTheme } from './themes/dark';
export { generateLightTheme } from './themes/light';

export function tokensToCssProperties(
  obj: Readonly<Record<string, string>>,
  prefix: string,
): string {
  return Object.entries(obj)
    .map(([key, value]) => {
      const prop = key.startsWith('--') ? key : `--${prefix}-${key}`;
      return `${prop}: ${value};`;
    })
    .join('\n');
}
