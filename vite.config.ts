import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { readFileSync } from 'node:fs';

// Version de l'application, écrite dans les fichiers de simulation (voir src/lib/version.ts).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

// Le mode « web » construit la démo en ligne, publiée sur GitHub Pages sous /simulateur-independant-fr/.
export default defineConfig(({ mode }) => ({
	plugins: [react(), tailwindcss(), tsconfigPaths()],
	define: {
		__APP_VERSION__: JSON.stringify(version),
	},
	base: mode === 'web' ? '/simulateur-independant-fr/' : './',
	build: {
		outDir: mode === 'web' ? 'dist-web' : 'dist-react',
	},
	server: {
		port: 3524,
		strictPort: true,
	},
}));
