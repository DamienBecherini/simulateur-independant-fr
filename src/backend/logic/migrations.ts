// src/backend/logic/migrations.ts

/*
 * Versionnage du format des fichiers (session en cours, sauvegardes, exports).
 *
 * Chaque fichier écrit porte un numéro `formatVersion`. À la lecture, les migrations sont appliquées
 * une à une, de la version du fichier jusqu'à la version actuelle, AVANT la validation Zod : elles
 * travaillent donc sur des données brutes et doivent rester défensives.
 *
 * Une migration transforme ce qui peut l'être sans risque et signale le reste à l'utilisateur
 * (notes affichées au chargement). Pour ajouter une version : incrémenter FORMAT_VERSION_ACTUEL et
 * ajouter la migration correspondante dans `migrations`.
 */

export const FORMAT_VERSION_ACTUEL = 3

/**
 * Année des sessions écrites avant les années multiples (formats 1 et 2) : celle des seules règles alors connues.
 * Valeur historique, à ne jamais modifier : ce n'est pas l'année en cours. Une session du format 2 a été remplie avec
 * les règles de 2026 ; la placer dans une autre année changerait ses résultats.
 */
export const ANNEE_DES_SESSIONS_D_UNE_ANNEE = 2026

/** Un fichier sans numéro de format date d'avant le versionnage : c'est la version 1. */
const VERSION_SANS_NUMERO = 1

type DonneesBrutes = Record<string, unknown>

export interface ResultatMigration {
  donnees: unknown
  versionOrigine: number
  /** Points à vérifier par l'utilisateur après conversion. */
  notes: string[]
}

function estObjet(valeur: unknown): valeur is DonneesBrutes {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
}

function tableau(valeur: unknown): DonneesBrutes[] {
  return Array.isArray(valeur) ? valeur.filter(estObjet) : []
}

/** Version du format d'un fichier brut. */
export function versionDuFormat(donnees: unknown): number {
  if (!estObjet(donnees)) return VERSION_SANS_NUMERO
  const version = donnees.formatVersion
  return typeof version === "number" && Number.isInteger(version) && version > 0 ? version : VERSION_SANS_NUMERO
}

/**
 * Version 1 → 2 (octobre 2026, refonte du moteur). Les données gardent leur forme, mais deux
 * éléments changent de sens, sans conversion automatique possible :
 * - la relation « Enfant » se lit désormais du parent vers l'enfant ;
 * - les dividendes ne sont plus déduits d'office du bénéfice : seuls ceux saisis dans la grille sont versés.
 * Le capital social des EURL, nouveau, reçoit sa valeur par défaut à la validation.
 */
function migrerV1VersV2(donnees: DonneesBrutes): { donnees: DonneesBrutes; notes: string[] } {
  const notes: string[] = []
  const entites = tableau(donnees.entities)
  const relations = tableau(donnees.relationships)
  const flux = tableau(donnees.monthlyData).flatMap(mois => tableau(mois.flows))

  const liensDeFiliation = relations.filter(rel => rel.type === "Enfant").length
  if (liensDeFiliation > 0) {
    notes.push(`${liensDeFiliation} relation${liensDeFiliation > 1 ? "s" : ""} « Enfant » : elle se lit désormais du parent vers l'enfant. Vérifiez que « Enfant à charge » apparaît bien sur la carte du parent, sinon supprimez la relation et recréez-la depuis le parent.`)
  }

  const societesSansDividendes = entites.filter(e => e.type === "company" && (e.legalStatus === "SASU" || e.legalStatus === "EURL") && !flux.some(f => f.entityId === e.id && f.type === "dividends_payment"))
  if (societesSansDividendes.length > 0) {
    notes.push("Les dividendes ne sont plus déduits d'office du bénéfice : seuls ceux saisis dans la grille sont versés, le reste est conservé dans la société. Saisissez-les pour retrouver une distribution.")
  }

  if (entites.some(e => e.type === "company" && e.legalStatus === "EURL")) {
    notes.push("Le capital social des EURL est désormais pris en compte (1 000 € par défaut) : renseignez le vôtre dans la fiche de la société.")
  }

  return { donnees, notes }
}

/**
 * Version 2 → 3 (octobre 2026, plusieurs années). La grille unique devient la grille d'une année : 2026, la seule
 * dont le simulateur connaissait les règles. Les acteurs et les relations, communs à toutes les années, ne changent pas.
 * Un fichier sans grille n'en reçoit pas : l'année par défaut s'applique à la validation.
 */
function migrerV2VersV3(donnees: DonneesBrutes): { donnees: DonneesBrutes; notes: string[] } {
  if (!("monthlyData" in donnees)) return { donnees, notes: [] }
  const { monthlyData, ...reste } = donnees
  return {
    donnees: { ...reste, annees: [{ annee: ANNEE_DES_SESSIONS_D_UNE_ANNEE, monthlyData }] },
    notes: [`La simulation porte désormais sur une ou plusieurs années : votre grille a été placée en ${ANNEE_DES_SESSIONS_D_UNE_ANNEE}, l'année des règles qu'elle utilisait. Vous pouvez ajouter des années à côté de la grille.`]
  }
}

/** `migrations[n]` convertit un fichier de la version n à la version n + 1. */
const migrations: Record<number, (donnees: DonneesBrutes) => { donnees: DonneesBrutes; notes: string[] }> = {
  1: migrerV1VersV2,
  2: migrerV2VersV3
}

/**
 * Convertit des données brutes au format actuel et les marque de ce numéro.
 * Un fichier d'un format plus récent est laissé tel quel, avec un avertissement.
 */
export function migrerVersFormatActuel(brutes: unknown): ResultatMigration {
  const versionOrigine = versionDuFormat(brutes)
  if (!estObjet(brutes)) return { donnees: brutes, versionOrigine, notes: [] }

  if (versionOrigine > FORMAT_VERSION_ACTUEL) {
    return {
      donnees: brutes,
      versionOrigine,
      notes: [`Ce fichier a été créé par une version plus récente du simulateur (format ${versionOrigine}) : les informations que cette version ne connaît pas seront ignorées.`]
    }
  }

  let donnees = brutes
  const notes: string[] = []
  for (let version = versionOrigine; version < FORMAT_VERSION_ACTUEL; version++) {
    const resultat = migrations[version](donnees)
    donnees = resultat.donnees
    notes.push(...resultat.notes)
  }

  return { donnees: { ...donnees, formatVersion: FORMAT_VERSION_ACTUEL }, versionOrigine, notes }
}
