// src/lib/montages/adresse.ts
// L'adresse d'une situation type dans la démo web : `#situation=couple-union-libre` ouvre la situation dont
// l'identifiant (`MontageType.id`) suit le signe égal. Un article extérieur peut ainsi mener à l'exemple qui illustre
// son propos (« Ouvrir cet exemple dans le simulateur »). Les identifiants sont publiés dans ces liens : ils ne
// changent plus (liste figée par adresse.test.ts, reprise dans le README).

import { MONTAGES_TYPES, type MontageType } from "./montages"

const PREFIXE = "situation="

/**
 * L'identifiant d'une adresse de situation type (`#situation=…`), décodé ; `null` pour toute autre adresse (une vue,
 * une ancre, `#mentions-legales`…). Un identifiant vide reste une adresse de situation : il sera signalé introuvable.
 */
export function identifiantDeLAdresse(adresse: string): string | null {
  const fragment = adresse.replace(/^#/, "")
  if (!fragment.startsWith(PREFIXE)) return null
  const identifiant = fragment.slice(PREFIXE.length)
  try {
    return decodeURIComponent(identifiant)
  } catch {
    // Adresse mal encodée : lue telle quelle, elle ne correspondra à aucune situation.
    return identifiant
  }
}

/** La situation type de cet identifiant ; `null` s'il n'en désigne aucune. */
export function situationDeLIdentifiant(identifiant: string): MontageType | null {
  return MONTAGES_TYPES.find(montage => montage.id === identifiant) ?? null
}

/** Le fragment d'adresse d'une situation type : « #situation=couple-union-libre ». */
export const fragmentDeLaSituation = (identifiant: string) => `#${PREFIXE}${encodeURIComponent(identifiant)}`

/** Le lien à partager : l'adresse de la page (sans son fragment), suivie du fragment de la situation. */
export function lienVersLaSituation(adresseDeLaPage: string, identifiant: string): string {
  const adresse = new URL(adresseDeLaPage)
  adresse.hash = fragmentDeLaSituation(identifiant)
  return adresse.href
}
