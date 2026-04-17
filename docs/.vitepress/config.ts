import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Sifter',
  description: 'AI-powered document extraction engine',
  head: [['link', { rel: 'icon', href: '/logo.svg' }]],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'SDK', link: '/sdk' },
      { text: 'API', link: '/api' },
      { text: 'GitHub', link: 'https://github.com/bfortunato/sifter' }
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Core Concepts', link: '/concepts' },
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Python SDK', link: '/sdk' },
          { text: 'REST API', link: '/api' },
          { text: 'Webhooks', link: '/webhooks' },
        ]
      },
      {
        text: 'Deployment',
        items: [
          { text: 'Self-Hosting', link: '/self-hosting' },
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/bfortunato/sifter' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Sifter'
    }
  }
})
