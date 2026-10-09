// src/web/pwa/manifeste.ts
// Ce qui rend la démo web installable : le manifeste d'application, les icônes, et la liste des fichiers que le
// service worker garde pour l'ouvrir hors ligne. Fonctions pures, utilisées à la compilation par le plugin
// vite-plugin-demo-installable.ts (voir l'ADR 012).

import { ANNEE_COURANTE } from "../../backend/regles/index.js"

/** Couleur de fond de la page en thème clair (`--background` de App.css) : barre de titre et écran de lancement. */
export const COULEUR_CLAIRE = "#f5f5f5"
/** Couleur de fond en thème sombre (`--background` de `.dark`). */
export const COULEUR_SOMBRE = "#0a0a0a"

/** Fichier du service worker, à la racine de la démo pour qu'il en couvre toutes les adresses. */
export const FICHIER_DU_SERVICE_WORKER = "sw.js"
export const FICHIER_DU_MANIFESTE = "manifest.webmanifest"
export const DOSSIER_DES_ICONES = "icones"

/** Les icônes, tirées de l'icône de l'application de bureau (templateIcon.png), dans src/web/pwa/icones. */
export const ICONES = [
  { fichier: "icone-192.png", taille: 192, usage: "any" },
  { fichier: "icone-512.png", taille: 512, usage: "any" },
  { fichier: "icone-masquable-192.png", taille: 192, usage: "maskable" },
  { fichier: "icone-masquable-512.png", taille: 512, usage: "maskable" }
] as const
/** Icône de l'écran d'accueil d'iOS, qui ne lit pas les icônes du manifeste. */
export const ICONE_APPLE = "apple-touch-icon.png"

export type ManifesteDApplication = ReturnType<typeof manifesteDeLaDemo>

/** Le manifeste de la démo publiée sous `base` (« /simulateur-independant-fr/ »). */
export function manifesteDeLaDemo(base: string) {
  return {
    id: base,
    name: "Simulateur indépendant FR",
    short_name: "Simulateur",
    description: `Simulation des revenus, cotisations et impôts d'un foyer d'indépendants en France (règles ${ANNEE_COURANTE}), hors ligne : les simulations restent sur cet appareil.`,
    lang: "fr",
    dir: "ltr",
    start_url: base,
    scope: base,
    display: "standalone",
    orientation: "any",
    theme_color: COULEUR_CLAIRE,
    background_color: COULEUR_CLAIRE,
    categories: ["finance", "productivity"],
    icons: ICONES.map(icone => ({ src: `${DOSSIER_DES_ICONES}/${icone.fichier}`, sizes: `${icone.taille}x${icone.taille}`, type: "image/png", purpose: icone.usage }))
  }
}

/** Les balises de index.html qui annoncent le manifeste, l'icône d'iOS et la couleur de la barre de titre selon le thème. */
export function balisesDeLaDemo(base: string) {
  return [
    { tag: "link", attrs: { rel: "manifest", href: `${base}${FICHIER_DU_MANIFESTE}` } },
    { tag: "link", attrs: { rel: "apple-touch-icon", href: `${base}${DOSSIER_DES_ICONES}/${ICONE_APPLE}` } },
    { tag: "meta", attrs: { name: "theme-color", media: "(prefers-color-scheme: light)", content: COULEUR_CLAIRE } },
    { tag: "meta", attrs: { name: "theme-color", media: "(prefers-color-scheme: dark)", content: COULEUR_SOMBRE } }
  ]
}

/**
 * Les fichiers publiés que le service worker met en cache à son installation : la page, les scripts, les styles, les
 * polices, les images et le manifeste. Sont écartés le service worker lui-même, les cartes de sources, et retours.json,
 * le badge du README, réécrit à chaque retour d'utilisateur et inutile à l'application. Chemins relatifs, triés.
 */
export function fichiersAMettreEnCache(fichiers: readonly string[]): string[] {
  return fichiers
    .map(fichier => fichier.split("\\").join("/"))
    .filter(fichier => fichier !== FICHIER_DU_SERVICE_WORKER && fichier !== "retours.json" && !fichier.endsWith(".map"))
    .sort((a, b) => a.localeCompare(b))
}
