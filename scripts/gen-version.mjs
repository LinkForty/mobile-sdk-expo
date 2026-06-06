// Regenerates src/version.ts from package.json so the SDK reports its real
// published version (exposed for SDK version diagnostics). Runs before every build.
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const out = `// AUTO-GENERATED at build from package.json by scripts/gen-version.mjs — do not edit by hand.
export const SDK_NAME = 'expo';
export const SDK_VERSION = '${pkg.version}';
`;
writeFileSync(new URL('../src/version.ts', import.meta.url), out);
