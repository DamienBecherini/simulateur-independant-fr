// vite-plugin-demo-installable.ts
// Rend la démo web (vite build --mode web) installable et utilisable hors ligne, sans dépendance de plus (voir
// l'ADR 012) : il annonce le manifeste dans index.html, puis, une fois la démo écrite dans dist-web, y ajoute le
// manifeste, les icônes et le service worker (src/web/pwa/service-worker.ts, compilé par esbuild), avec la liste de
// tous les fichiers publiés et une version tirée de leur contenu. L'application de bureau n'utilise pas ce plugin.

import { build } from "esbuild"
import { createHash } from "node:crypto"
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import type { Plugin } from "vite"
import { balisesDeLaDemo, DOSSIER_DES_ICONES, FICHIER_DU_MANIFESTE, FICHIER_DU_SERVICE_WORKER, fichiersAMettreEnCache, ICONE_APPLE, ICONES, manifesteDeLaDemo } from "./src/web/pwa/manifeste.ts"

const SOURCES = fileURLToPath(new URL("./src/web/pwa/", import.meta.url))

/** Les fichiers du dossier, avec leur chemin relatif à `racine`. */
async function fichiersDuDossier(racine: string): Promise<string[]> {
  const entrees = await readdir(racine, { recursive: true, withFileTypes: true })
  return entrees.filter(entree => entree.isFile()).map(entree => relative(racine, join(entree.parentPath, entree.name)))
}

/** Version du cache : l'empreinte des noms et des contenus des fichiers publiés. */
async function empreinte(racine: string, fichiers: string[]): Promise<string> {
  const hachage = createHash("sha256")
  for (const fichier of fichiers) hachage.update(fichier).update(await readFile(join(racine, fichier)))
  return hachage.digest("hex").slice(0, 16)
}

async function compilerLeServiceWorker(fichiers: string[], version: string): Promise<string> {
  const resultat = await build({
    entryPoints: [join(SOURCES, "service-worker.ts")],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2020",
    minify: true,
    legalComments: "none",
    logLevel: "warning",
    define: { __FICHIERS_DU_CACHE__: JSON.stringify(fichiers), __VERSION_DU_CACHE__: JSON.stringify(version) }
  })
  return resultat.outputFiles[0].text
}

export function demoInstallable(): Plugin {
  let base = "/"
  return {
    name: "demo-installable",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml() {
      return balisesDeLaDemo(base).map(balise => ({ ...balise, injectTo: "head" as const }))
    },
    async writeBundle(options) {
      const sortie = options.dir
      if (!sortie) return
      await mkdir(join(sortie, DOSSIER_DES_ICONES), { recursive: true })
      for (const icone of [...ICONES.map(i => i.fichier), ICONE_APPLE]) await copyFile(join(SOURCES, "icones", icone), join(sortie, DOSSIER_DES_ICONES, icone))
      await writeFile(join(sortie, FICHIER_DU_MANIFESTE), JSON.stringify(manifesteDeLaDemo(base), null, 2))

      const fichiers = fichiersAMettreEnCache(await fichiersDuDossier(sortie))
      const version = await empreinte(sortie, fichiers)
      await writeFile(join(sortie, FICHIER_DU_SERVICE_WORKER), await compilerLeServiceWorker(fichiers, version))
    }
  }
}

/** Racines de composition de l'application de bureau et de la démo web (voir src/ui/plateforme.ts). */
export const ENTREE_DU_BUREAU = "/src/ui/main.tsx"
export const ENTREE_DE_LA_DEMO = "/src/web/main.tsx"

/**
 * Pour la démo web, en développement (vite --mode web) comme à la compilation : index.html charge la racine de
 * composition de la démo à la place de celle du bureau. L'application de bureau n'importe ainsi rien de src/web, et ne
 * contient ni le code ni les images de la démo, sans compter sur l'élimination du code mort.
 */
export function entreeDeLaDemo(): Plugin {
  return {
    name: "entree-de-la-demo",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (!html.includes(ENTREE_DU_BUREAU)) throw new Error(`index.html ne charge plus ${ENTREE_DU_BUREAU} : la démo web ne saurait pas quoi charger à sa place.`)
        return html.replace(ENTREE_DU_BUREAU, ENTREE_DE_LA_DEMO)
      }
    }
  }
}
