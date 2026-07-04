import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Lingoready API',
  description: 'Documentation & operations for the Lingoready backend',
  base: '/lingoready-api-docs/',
  srcExclude: ['node_modules'],
  themeConfig: {
    nav: [
      { text: 'Docs', link: '/docs/01-overview' },
      { text: 'API Reference', link: '/docs/03-api-reference' },
      { text: 'Status Page', link: 'https://jadapema.github.io/lingoready-status/' },
      { text: 'Roadmap', link: '/ROADMAP' },
      { text: 'App Docs', link: 'https://jadapema.github.io/lingoready-app-docs/' },
    ],
    sidebar: [
      {
        text: 'Understand',
        items: [
          { text: 'Overview', link: '/docs/01-overview' },
          { text: 'Architecture', link: '/docs/02-architecture' },
          { text: 'AI Pipeline & Latency', link: '/docs/06-ai-pipeline' },
          { text: 'Data Model', link: '/docs/05-data-model' },
        ],
      },
      {
        text: 'Integrate',
        items: [
          { text: 'REST Reference', link: '/docs/03-api-reference' },
          { text: 'WebSocket Protocol', link: '/docs/04-websocket-protocol' },
        ],
      },
      {
        text: 'Operate',
        items: [
          { text: 'Setup', link: '/docs/07-setup' },
          { text: 'Testing', link: '/docs/10-testing' },
          { text: 'Deployment & Runbooks', link: '/docs/08-deployment-operations' },
          { text: 'Security & Privacy', link: '/docs/09-security-privacy' },
        ],
      },
      {
        text: 'Project',
        items: [
          { text: 'Status', link: '/STATUS' },
          { text: 'Roadmap', link: '/ROADMAP' },
          { text: 'Changelog', link: '/CHANGELOG' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/Jadapema/lingoready-api' }],
    search: { provider: 'local' },
    footer: { message: 'Lingoready — AI voice coach for workplace English' },
  },
});
