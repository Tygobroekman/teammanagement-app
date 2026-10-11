import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relatieve base: werkt op GitHub Pages ongeacht de reponaam.
export default defineConfig({
  base: './',
  plugins: [react()],
})
