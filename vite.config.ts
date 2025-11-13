import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig(({ mode }) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    return {
      server: {
        port: 3000,
        host: '0.0.0.0'
      },
      plugins: [react()],
      optimizeDeps: {
        include: ['@duckdb/duckdb-wasm', '@google/genai']
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      }
    };
});
