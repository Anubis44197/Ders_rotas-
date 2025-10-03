import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_GOOGLE_AI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GOOGLE_AI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'charts-vendor': ['recharts'],
              'ai-vendor': ['@google/genai'],
              'firebase-vendor': ['firebase/app', 'firebase/firestore']
            }
          }
        },
        chunkSizeWarningLimit: 600
      }
    };
});
