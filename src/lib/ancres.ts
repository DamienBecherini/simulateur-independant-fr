// src/lib/ancres.ts
// Les ancres de la page : identifiants des éléments vers lesquels mène un lien interne (barre de résumé, encart « Que
// voulez-vous savoir ? », lien d'évitement) ou une adresse (« #bilan »). Écrite ici une seule fois, chaque ancre est
// reprise par l'`id` de l'élément et par le `href` des liens : une faute de frappe devient une erreur de compilation,
// et la table des vues (`vues.ts`) doit dire où se trouve chacune. Les valeurs sont celles des adresses déjà publiées :
// les changer casserait les liens enregistrés.

export const ANCRES = {
  /** Contenu principal, cible du lien d'évitement « Aller au contenu » ; il contient les trois vues. */
  contenu: "contenu",
  /** Bilan de l'année, en tête des résultats : net du foyer et prélèvements. */
  bilan: "bilan",
  /** Titre des résultats, suivi de leurs alertes. */
  titreDesResultats: "resultats-titre",
  /** Verdict du comparateur (affichage « Résumé »), ou invitation à saisir un chiffre d'affaires. */
  verdictDuComparateur: "comparateur-verdict",
  /** Titre du comparateur de statuts. */
  titreDuComparateur: "comparateur-titre",
  /** Réponse « Mariage ou Pacs ? » du comparateur. */
  comparaisonDuCouple: "comparaison-du-couple",
  /** Réponse « Rémunération ou dividendes ? » du comparateur. */
  titreDeLOptimisation: "optimisation-titre"
} as const

export type Ancre = (typeof ANCRES)[keyof typeof ANCRES]

/** Adresse d'un lien vers une ancre de la page : « #bilan ». */
export const lienVers = (ancre: Ancre): `#${Ancre}` => `#${ancre}`

/** L'identifiant donné est-il une ancre du registre ? */
export const estUneAncre = (id: string): id is Ancre => (Object.values(ANCRES) as string[]).includes(id)
