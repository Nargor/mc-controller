// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt',
  ],

  // Nitro server config
  nitro: {
    experimental: {
      websocket: true,
    },
  },

  // Tailwind dark mode
  tailwindcss: {
    config: {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            dark: {
              50:  '#f8f8f8',
              100: '#e8e8e8',
              200: '#d0d0d0',
              300: '#a8a8a8',
              400: '#707070',
              500: '#505050',
              600: '#383838',
              700: '#282828',
              750: '#222222',
              800: '#1e1e1e',
              900: '#141414',
              950: '#0a0a0a',
            },
            mc: {
              green:  '#4ade80',
              blue:   '#38bdf8',
              red:    '#f87171',
              yellow: '#fbbf24',
              purple: '#c084fc',
            },
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
          },
        },
      },
    },
  },

  // Server-only env vars (never sent to client)
  runtimeConfig: {
    databasePath:    process.env.DATABASE_PATH    || './data/mc-controller.db',
    mcDataPath:      process.env.MC_DATA_PATH     || './data/servers',
    // Path as seen by the Docker daemon. Set this when /data is a bind mount.
    mcDataHostPath:  process.env.MC_DATA_HOST_PATH || '',
    portRangeStart:  parseInt(process.env.PORT_RANGE_START  || '25565'),
    portRangeEnd:    parseInt(process.env.PORT_RANGE_END    || '25600'),
    curseforgeApiKey: process.env.CURSEFORGE_API_KEY || '',
    jwtSecret:       process.env.JWT_SECRET       || 'dev_secret_change_me_in_prod',
    dockerSocket:    process.env.DOCKER_SOCKET    || '/var/run/docker.sock',
    // Public (accessible on client — nothing sensitive)
    public: {},
  },

  app: {
    head: {
      title: 'MC Controller',
      htmlAttrs: { lang: 'th' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },
})
