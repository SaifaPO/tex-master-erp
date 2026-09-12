import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relativna cesta k JS/CSS namiesto absolutnej "/assets/..." — appka bezi na dvoch roznych
  // adresach naraz (priamo na Verceli aj cez Shopify App Proxy na shop.pbtprint.sk/apps/dtf-metraz),
  // s absolutnou cestou by assety fungovali len na jednej z nich.
  base: './',
})
