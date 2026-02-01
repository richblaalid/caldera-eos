import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ember - Your AI Integrator',
    short_name: 'Ember',
    description: 'AI-powered EOS coaching and accountability for leadership teams',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#f97316',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/ember-logo.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/ember-logo.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  }
}
