import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  optimizeDeps: {
    include: [
      '@blocknote/core',
      '@blocknote/react',
      '@blocknote/mantine',
      '@floating-ui/react',
      '@floating-ui/react-dom',
      '@floating-ui/dom',
      '@floating-ui/core',
    ],
  },
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
})
