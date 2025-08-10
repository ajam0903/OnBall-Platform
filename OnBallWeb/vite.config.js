import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@shared/firebase/firebase': path.resolve(__dirname, './src/firebase.js'),
            '@shared': path.resolve(__dirname, '../shared')
        }
    }
})