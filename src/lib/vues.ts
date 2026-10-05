// src/lib/vues.ts
// Affichage « Trois vues » (proposition B de l'étude d'allègement de l'écran) : la page partagée en trois vues, chacune
// avec son adresse (#situation, #resultats, #comparer), pour que le retour arrière, les liens et le rechargement de
// la page retrouvent la vue.

export type Vue = "situation" | "resultats" | "comparer"

interface DescriptionDeVue {
  valeur: Vue
  /** Nom de la vue : onglet sur ordinateur, titre de la vue et de la fenêtre. */
  libelle: string
  /** Nom court de l'onglet sur téléphone ; il reprend un mot du nom, pour que l'onglet garde le même nom vocal. */
  libelleCourt: string
}

/** Les vues, dans l'ordre des onglets et de l'impression. */
export const VUES: readonly DescriptionDeVue[] = [
  { valeur: "situation", libelle: "Ma situation", libelleCourt: "Situation" },
  { valeur: "resultats", libelle: "Mes résultats", libelleCourt: "Résultats" },
  { valeur: "comparer", libelle: "Comparer et optimiser", libelleCourt: "Comparer" }
]

export const VUE_PAR_DEFAUT: Vue = "situation"

/**
 * Détails vers lesquels mènent les liens de la barre de résumé, avec leur vue : connus d'avance, ils retrouvent leur
 * vue au rechargement de la page, avant même que le détail soit affiché (les résultats arrivent après le calcul).
 */
const DETAILS: Readonly<Record<string, Vue>> = {
  bilan: "resultats",
  "resultats-titre": "resultats",
  "comparateur-verdict": "comparer",
  "comparateur-titre": "comparer"
}

const estUneVue = (nom: string): nom is Vue => VUES.some(v => v.valeur === nom)

/** Ce que désigne une adresse : une vue, et éventuellement le détail à montrer dans cette vue. */
export interface Destination {
  vue: Vue
  /** Identifiant de l'élément à montrer ; absent pour une vue seule, qui s'ouvre en haut de la page. */
  detail?: string
}

/**
 * Destination d'une adresse (`location.hash`) : une vue (« #resultats »), un détail connu (« #bilan »), ou n'importe
 * quel élément de la page, dont la vue est donnée par `vueDeLElement`. `null` si l'adresse ne mène à aucune vue
 * (adresse vide, élément introuvable ou hors des vues) : la vue affichée ne change pas.
 */
export function destinationDeLAdresse(adresse: string, vueDeLElement: (id: string) => Vue | null): Destination | null {
  let nom = adresse.replace(/^#/, "")
  try {
    nom = decodeURIComponent(nom)
  } catch {
    // Adresse mal encodée : lue telle quelle.
  }
  if (!nom) return null
  if (estUneVue(nom)) return { vue: nom }
  const vue = DETAILS[nom] ?? vueDeLElement(nom)
  return vue ? { vue, detail: nom } : null
}

export function libelleDeLaVue(vue: Vue): string {
  return VUES.find(v => v.valeur === vue)?.libelle ?? vue
}

/** Titre de la fenêtre (onglet du navigateur, barre des tâches) : la vue d'abord, puis la simulation. */
export function titreDeLaFenetre(vue: Vue, nomDeLaSimulation: string): string {
  return `${libelleDeLaVue(vue)} — ${nomDeLaSimulation}`
}

/** Vue suivante ou précédente dans les onglets, en boucle ; la première ou la dernière pour Début et Fin. */
export function vueVoisine(vue: Vue, touche: string): Vue | null {
  const indice = VUES.findIndex(v => v.valeur === vue)
  const n = VUES.length
  const cible = { ArrowRight: indice + 1, ArrowLeft: indice - 1 + n, Home: 0, End: n - 1 }[touche]
  return cible === undefined ? null : VUES[cible % n].valeur
}
