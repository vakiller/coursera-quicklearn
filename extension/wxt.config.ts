import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Coursera Vault Sync',
    description: 'Sync Coursera course transcripts and readings into an Obsidian vault as Markdown.',
    permissions: ['storage', 'tabs', 'scripting'],
    host_permissions: ['https://www.coursera.org/*'],
  },
});
