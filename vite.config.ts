import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        preserveSymlinks: true,
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules/recharts')) return 'charts-vendor';
              if (id.includes('node_modules/@google/genai')) return 'ai-vendor';
              if (
                id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/') ||
                id.includes('node_modules/lucide-react/') ||
                id.includes('node_modules/date-fns/')
              ) {
                return 'vendor';
              }
              return undefined;
            }
          }
        },
        chunkSizeWarningLimit: 600
      }
    };
});
