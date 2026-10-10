import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { firebaseBuildDiagnostics, validateBuildEnvironment } from './server/payments/environment';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  let firebaseValidated: boolean;
  try { firebaseValidated = validateBuildEnvironment(env); }
  catch (error) {
    console.error('Firebase build configuration diagnostics:', JSON.stringify(firebaseBuildDiagnostics(env, process.env)));
    throw error;
  }
  // Hosted Firebase deployments must be isolated. Payment credentials are runtime-only.
  // Unconfigured local builds stay
  // offline rather than silently using the existing Production Firebase config.
  if (!firebaseValidated) {
    console.warn('Local Firebase disabled: a distinct safe non-production Firebase configuration is required to enable it.');
  }
  return {
    define: { 'import.meta.env.VITE_FIREBASE_ENV_VALIDATED': JSON.stringify(String(firebaseValidated)) },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
