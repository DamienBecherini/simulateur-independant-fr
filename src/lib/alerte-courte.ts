// src/lib/alerte-courte.ts
// Une alerte des résultats en une ligne courte, le reste à lire dans une bulle (voir AlerteCourte).
//
// Les alertes du calcul sont des phrases écrites pour être lues en entier, dans les exports comme à l'écran. Leur
// début dit presque toujours l'essentiel, avant un deux-points (« La société est déficitaire de 5 000 € : … ») ou à
// la fin de la première phrase (« ACRE : cotisations réduites de 50 %. Elles financent… »). La ligne courte est ce
// début ; le reste va dans la bulle. Quelques alertes au début trop long ont leur ligne courte écrite ici.
//
// Hors des lignes écrites, la ligne courte est le début exact du texte : l'impression, qui n'a pas de bulle, affiche la
// suite à sa place, et le texte entier se relit d'un bloc.

/** Au-delà, une alerte est coupée. */
const LONGUEUR_D_UNE_LIGNE = 110
/** Le début avant un deux-points tient sur une ligne… */
const DEBUT_LE_PLUS_LONG = 100
/** … et en dit assez : « ACRE » ou un nom de profession seuls n'en disent pas assez, la première phrase les complète. */
const DEBUT_LE_PLUS_COURT = 25

export interface AlerteCoupee {
  /** Le début du texte, affiché. */
  court: string
  /** Ce qui suit, à lire dans la bulle ; absent pour une alerte courte, affichée entière. */
  detail?: string
  /** Le texte coupé au milieu d'une phrase : la ligne courte finit par des points de suspension. */
  coupeEnCours: boolean
}

/** Les alertes dont le début est trop long, avec leur ligne courte écrite à la main (qui n'est alors pas le début du texte). */
const LIGNES_ECRITES: { motif: RegExp; court: (m: RegExpMatchArray) => string }[] = [
  { motif: /^En (\d{4}), (?:le chiffre d'affaires|les prestations) .* dépassen?t le plafond de la micro-entreprise/, court: m => `Plafond de la micro-entreprise dépassé en ${m[1]}` },
  { motif: /^Salaire de base de (.+?) par mois en moyenne, sous le minimum conventionnel/, court: m => `Salaire de base sous le minimum conventionnel (${m[1]} par mois)` },
  { motif: /^(« [^»]+ ») est titulaire de plusieurs entreprises en nom propre/, court: m => `${m[1]} : une seule entreprise individuelle par personne` }
]

/** La première lettre en capitale : le reste d'une alerte coupée après un deux-points se lit comme une phrase. */
function enPhrase(texte: string): string {
  return texte.charAt(0).toLocaleUpperCase("fr-FR") + texte.slice(1)
}

/** Coupe une alerte en une ligne courte et un détail ; une alerte qui tient sur une ligne reste entière. */
export function couperLAlerte(texte: string): AlerteCoupee {
  if (texte.length <= LONGUEUR_D_UNE_LIGNE) return { court: texte, coupeEnCours: false }
  for (const { motif, court } of LIGNES_ECRITES) {
    const trouve = texte.match(motif)
    if (trouve) return { court: court(trouve), detail: texte, coupeEnCours: false }
  }
  const deuxPoints = texte.indexOf(" : ")
  const finDePhrase = texte.search(/\. (?=[A-ZÀ-ÖØ-Þ«])/)
  if (deuxPoints >= DEBUT_LE_PLUS_COURT && deuxPoints <= DEBUT_LE_PLUS_LONG) return { court: texte.slice(0, deuxPoints), detail: enPhrase(texte.slice(deuxPoints + 3)), coupeEnCours: false }
  if (finDePhrase > 0 && finDePhrase < LONGUEUR_D_UNE_LIGNE) return { court: texte.slice(0, finDePhrase + 1), detail: texte.slice(finDePhrase + 2), coupeEnCours: false }
  if (deuxPoints > 0 && deuxPoints <= DEBUT_LE_PLUS_LONG) return { court: texte.slice(0, deuxPoints), detail: enPhrase(texte.slice(deuxPoints + 3)), coupeEnCours: false }
  // Ni deux-points ni fin de phrase assez tôt : coupée au dernier espace de la ligne, le texte entier dans la bulle.
  const coupe = texte.lastIndexOf(" ", LONGUEUR_D_UNE_LIGNE - 10)
  return { court: texte.slice(0, coupe), detail: texte, coupeEnCours: true }
}
