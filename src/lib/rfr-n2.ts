// src/lib/rfr-n2.ts
// Libellé et aide du champ « revenu fiscal de référence » d'une micro-entreprise. L'accès au versement libératoire
// d'une année dépend du RFR de deux ans plus tôt : la simulation le calcule elle-même quand cette année-là est simulée,
// et le champ ne sert qu'aux années dont l'année N-2 est hors de la simulation (les deux premières, en général).

export interface TexteDuRfrN2 {
  libelle: string
  aide: string
}

const liste = (valeurs: number[]) => (valeurs.length === 1 ? String(valeurs[0]) : `${valeurs.slice(0, -1).join(", ")} et ${valeurs[valeurs.length - 1]}`)

/** Les années simulées dont le RFR N-2 n'est pas calculé par la simulation : le champ saisi sert pour elles. */
export function anneesDuRfrSaisi(annees: number[]): number[] {
  return [...annees].sort((a, b) => a - b).filter(annee => !annees.includes(annee - 2))
}

/** Le libellé (« Revenu fiscal de référence 2024 ») et l'aide du champ, d'après les années de la simulation. */
export function texteDuRfrN2(annees: number[]): TexteDuRfrN2 {
  const saisies = anneesDuRfrSaisi(annees)
  if (saisies.length === 0) return { libelle: "Revenu fiscal de référence d'il y a deux ans", aide: "Revenu fiscal de référence du foyer d'il y a deux ans (avis d'imposition) : il décide de l'accès au versement libératoire." }
  const rfr = saisies.map(annee => annee - 2)
  const avis = saisies.map(annee => annee - 1)
  const calculees = [...annees].sort((a, b) => a - b).filter(annee => annees.includes(annee - 2))
  const uneValeurPourPlusieurs = saisies.length > 1 ? ` La même valeur sert pour ${liste(saisies)}.` : ""
  const ensuite = calculees.length > 0 ? ` Pour ${liste(calculees)}, la simulation utilise le revenu fiscal de référence qu'elle calcule elle-même.` : ""
  return {
    libelle: `Revenu fiscal de référence ${liste(rfr)}`,
    aide: `Revenu fiscal de référence ${liste(rfr)} du foyer, sur ${saisies.length > 1 ? "les avis" : "l'avis"} d'imposition reçu${saisies.length > 1 ? "s" : ""} en ${liste(avis)} : il décide de l'accès au versement libératoire en ${liste(saisies)}.${uneValeurPourPlusieurs}${ensuite}`
  }
}
