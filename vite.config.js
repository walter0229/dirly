import { defineConfig } from 'vite';

export default defineConfig({
  base: '/dirly/', // GitHub 저장소 이름에 맞춰 절대 경로로 수정
  build: {
    outDir: 'dist',
  },
});
