import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],resolve:{dedupe:['react','react-dom']},server:{port:5173,watch:{ignored:['**/work/**','**/artifacts/**','**/lib/**','**/coverage/**']}},build:{target:'es2022',rollupOptions:{output:{manualChunks:{react:['react','react-dom','react-router'],controls:['chatgpt-desktop-kit']}}}}});
