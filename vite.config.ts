import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { readFileSync } from 'node:fs';
import { demoInstallable, sansLesImagesDeLaDemo } from './vite-plugin-demo-installable';

// Version de l'application, écrite dans les fichiers de simulation (voir src/lib/version.ts).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

// Le mode « web » construit la démo en ligne, publiée sur GitHub Pages sous /simulateur-independant-fr/, installable
// et utilisable hors ligne (manifeste et service worker : voir vite-plugin-demo-installable.ts et l'ADR 012). Les
// captures de l'aide à l'installation de la démo restent hors de l'application de bureau.
export default defineConfig(({ mode }) => ({
	plugins: [react(), tailwindcss(), tsconfigPaths(), ...(mode === 'web' ? [demoInstallable()] : [sansLesImagesDeLaDemo()])],
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
		// Les copies de travail parallèles (.claude/worktrees) et les sorties de compilation ne concernent pas la page
		// servie : les surveiller la rechargerait à chaque compilation faite ailleurs.
		watch: { ignored: ['**/.claude/**', '**/dist/**', '**/dist-web/**', '**/dist-react/**', '**/dist-electron/**'] },
	},
}));
