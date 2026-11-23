import { getPublicRuntimeConfig } from './runtime-config.mjs';
import { pathToFileURL } from 'node:url';

const failure = 'Release settings check failed; runtime configuration is invalid.';

export function validateRuntimeSettings(environment = process.env) {
  // Exercise the same reader as the browser configuration route. Do not return
  // or log its values in the deployment preflight.
  getPublicRuntimeConfig(environment);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== '--runtime') throw new Error(failure);
    validateRuntimeSettings();
    console.log('Release runtime settings=OK; runtime payment configuration=matched');
  } catch {
    // Even malformed environment values must never appear in release logs.
    console.error(failure);
    process.exitCode = 1;
  }
}
