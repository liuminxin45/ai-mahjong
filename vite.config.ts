import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 5173,
      proxy: {
        '/api/llm/kimi/messages': {
          target: 'https://api.kimi.com',
          changeOrigin: true,
          secure: true,
          rewrite: () => '/coding/v1/messages',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (!proxyReq.getHeader('x-api-key') && env.KIMI_API_KEY) {
                proxyReq.setHeader('x-api-key', env.KIMI_API_KEY);
              }
              if (!proxyReq.getHeader('anthropic-version')) {
                proxyReq.setHeader('anthropic-version', '2023-06-01');
              }
            });
          },
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
  };
});
