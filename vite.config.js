import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', '@supabase/supabase-js', 'recharts'],
  },
  server: {
    warmup: {
      clientFiles: ['./src/main.jsx', './src/AuthProvider.jsx', './src/LoginPage.jsx'],
    },
  },
})
