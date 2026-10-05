// src/lib/adresses-des-retours.ts
// Les seules adresses externes que l'application ouvre : le formulaire de ticket du dépôt GitHub et l'adresse
// e-mail des retours. Le process principal d'Electron et le pont de la démo web refusent toute autre adresse.
// Aucune dépendance : ce module est aussi compilé avec le process principal.

/** Dépôt GitHub du projet. */
export const DEPOT_GITHUB = "https://github.com/DamienBecherini/simulateur-independant-fr"

/** Ouverture d'un ticket sur le dépôt ; le formulaire « retour.yml » s'y choisit par l'adresse. */
export const ADRESSE_NOUVEAU_TICKET = `${DEPOT_GITHUB}/issues/new`

/** Adresse e-mail qui reçoit les retours envoyés par e-mail. */
export const ADRESSE_E_MAIL_DES_RETOURS = "simulateur-independant@damien.becherini.fr"

/** Au-delà, une adresse est refusée sans être analysée. */
const LONGUEUR_MAXIMALE = 16_000

/** Paramètres admis dans un lien `mailto:` : ni copie, ni destinataire de plus. */
const PARAMETRES_MAILTO = new Set(["subject", "body"])

function lire(adresse: unknown): URL | null {
  if (typeof adresse !== "string" || adresse.length > LONGUEUR_MAXIMALE) return null
  try {
    return new URL(adresse)
  } catch {
    return null
  }
}

/** Le formulaire de ticket du dépôt, en https, sans identifiants ni port, et rien d'autre sur github.com. */
function estLeFormulaireDeTicket(url: URL): boolean {
  const attendu = new URL(ADRESSE_NOUVEAU_TICKET)
  return url.protocol === "https:" && url.username === "" && url.password === "" && url.host === attendu.host && url.pathname === attendu.pathname
}

/** Un e-mail à la seule adresse des retours, avec au plus un sujet et un corps. */
function estLEMailDesRetours(url: URL): boolean {
  if (url.protocol !== "mailto:") return false
  let destinataire: string
  try {
    destinataire = decodeURIComponent(url.pathname)
  } catch {
    return false
  }
  if (destinataire.toLowerCase() !== ADRESSE_E_MAIL_DES_RETOURS) return false
  return [...url.searchParams.keys()].every(cle => PARAMETRES_MAILTO.has(cle.toLowerCase()))
}

/** Vrai si l'adresse est l'une des deux que l'application peut ouvrir hors de sa fenêtre. */
export function adresseExterneAutorisee(adresse: unknown): adresse is string {
  const url = lire(adresse)
  return url !== null && (estLeFormulaireDeTicket(url) || estLEMailDesRetours(url))
}
