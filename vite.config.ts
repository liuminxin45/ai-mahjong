import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api/llm/kimi': {
        target: 'https://api.kimi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/llm\/kimi/, '/coding/v1'),
      },
      '/api/llm/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/llm\/openai/, '/v1'),
      },
      '/api/llm/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/llm\/deepseek/, '/v1'),
      },
      '/api/llm/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/llm\/anthropic/, '/v1'),
      },
    },
  },
});
