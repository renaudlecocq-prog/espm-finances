import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Forcer tout BlockNote + floating-ui dans un chunk unique
          // pour éviter les problèmes de circular deps en prod
          if (
            id.includes('node_modules/@blocknote') ||
            id.includes('node_modules/@floating-ui')
          ) {
            return 'vendor-blocknote'
          }
          // Autres vendors dans un chunk séparé
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
})
