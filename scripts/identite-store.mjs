// scripts/identite-store.mjs
// Identité du paquet du Microsoft Store (Identity.Name, Publisher, PublisherDisplayName), lue dans
// build/store/identite.json, que l'on remplit après avoir réservé le nom de l'application dans Partner Center.
// Des variables d'environnement peuvent la remplacer (STORE_IDENTITY_NAME, STORE_PUBLISHER, STORE_PUBLISHER_DISPLAY_NAME).
// Tant qu'elle n'est pas remplie, seul un paquet d'essai, non publiable, peut être construit (--essai).

/** Valeur des champs encore à remplir dans build/store/identite.json. */
export const A_REMPLIR = "A_REMPLIR"

/** Identité d'un paquet d'essai : assez pour vérifier la construction et le manifeste, refusée par le Store. */
export const IDENTITE_D_ESSAI = Object.freeze({
  identityName: "Essai.SimulateurIndependantFR",
  publisher: "CN=Essai",
  publisherDisplayName: "Essai local, non publiable"
})

const VARIABLES = { identityName: "STORE_IDENTITY_NAME", publisher: "STORE_PUBLISHER", publisherDisplayName: "STORE_PUBLISHER_DISPLAY_NAME" }

const estRemplie = valeur => typeof valeur === "string" && valeur.trim() !== "" && !valeur.includes(A_REMPLIR)

/** L'identité du fichier, complétée par l'environnement ; `complete` si aucun champ n'est à remplir. */
export function lireLIdentite(fichier, env = {}) {
  const identite = {}
  for (const [champ, variable] of Object.entries(VARIABLES)) {
    const valeur = env[variable] || fichier?.[champ]
    identite[champ] = typeof valeur === "string" ? valeur.trim() : ""
  }
  return { identite, complete: Object.values(identite).every(estRemplie) }
}

/** Les erreurs d'une identité remplie : les formats qu'impose le manifeste du paquet. */
export function erreursDeLIdentite({ identityName, publisher }) {
  const erreurs = []
  if (!/^[A-Za-z0-9.-]{3,50}$/.test(identityName)) erreurs.push(`identityName « ${identityName} » : 3 à 50 caractères, lettres, chiffres, points et tirets.`)
  if (!/^CN=\S/.test(publisher)) erreurs.push(`publisher « ${publisher} » : doit commencer par « CN= », recopié tel quel depuis Partner Center.`)
  return erreurs
}

/**
 * L'identité à donner à electron-builder. Sans identité remplie, `--essai` donne l'identité d'essai ; sinon, erreur.
 * Renvoie `{ identite, essai }`.
 */
export function identiteDuPaquet(fichier, env, { essai }) {
  const { identite, complete } = lireLIdentite(fichier, env)
  if (!complete) {
    if (essai) return { identite: { ...IDENTITE_D_ESSAI }, essai: true }
    throw new Error(
      "Identité du paquet du Microsoft Store à remplir dans build/store/identite.json (voir documentation/microsoft-store/publier-sur-le-store.md), ou paquet d'essai non publiable : npm run dist:store -- --essai"
    )
  }
  const erreurs = erreursDeLIdentite(identite)
  if (erreurs.length > 0) throw new Error(`Identité du paquet du Microsoft Store invalide :\n- ${erreurs.join("\n- ")}`)
  return { identite, essai: false }
}
