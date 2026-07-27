import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: set `base` to match your GitHub repo name, e.g. '/clarity-ledger/'
// If you're deploying to a *user/org* Pages site (username.github.io repo itself),
// set base back to '/'.
export default defineConfig({
  plugins: [react()],
  base: '/clarity-ledger/',
});
