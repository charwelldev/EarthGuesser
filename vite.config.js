import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        outDir: 'dist', // Output folder
        assetsDir: '',  // Keep assets in the root of dist
    },
    base: '/EarthGuesser' // Replace with your GitHub repo name for correct paths
});