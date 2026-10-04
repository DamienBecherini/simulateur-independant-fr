import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Le mode « web » construit la démo en ligne, publiée sur GitHub Pages sous /simulateur-independant-fr/.
export default defineConfig(({ mode }) => ({
	plugins: [react(), tailwindcss(), tsconfigPaths()],
	base: mode === 'web' ? '/simulateur-independant-fr/' : './',
	build: {
		outDir: mode === 'web' ? 'dist-web' : 'dist-react',
	},
	server: {
		port: 3524,
		strictPort: true,
	},
}));
