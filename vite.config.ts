import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `--mode preview` inlines everything into one HTML file for a shareable preview.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'preview' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'preview' ? 'dist-preview' : 'dist' },
}))
