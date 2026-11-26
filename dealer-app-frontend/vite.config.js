import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Forward API calls to dealer-app-backend, so the browser sees one origin:
    // the session cookie just works and no CORS setup is needed.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  // Unit and component tests (npm test). Tests live next to the code as *.test.js(x).
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    restoreMocks: true,
  },
})
