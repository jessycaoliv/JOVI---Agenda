import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' faz o site funcionar em https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/
export default defineConfig({
  plugins: [react()],
  base: './',
});
