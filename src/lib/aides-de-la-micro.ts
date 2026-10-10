// src/lib/aides-de-la-micro.ts
// Ce qu'il faut savoir de l'ACRE et du versement libératoire au moment de les activer sur une micro-entreprise : un
// texte court, tiré des règles de l'année affichée (réductions, durée, taux, plafond de revenu fiscal de référence), et
// la page officielle de la condition d'accès.

import { euros, pourcent } from "@/backend/logic/format"
import { libelleDuMois, lireMois } from "@/backend/logic/dispositifs"
import type { ReglesFiscales } from "@/backend/logic/regles"

/** L'explication d'une option : son titre, quelques phrases, et la page officielle de ses conditions. */
export interface ExplicationDUneOption {
  titre: string
  paragraphes: string[]
  source: { libelle: string; url: string }
}

/** « 50 % pour une création depuis janvier 2020, 25 % depuis juillet 2026 » ; « 50 % » quand il n'y a qu'un taux. */
function reductionsDeLACRE(reductions: ReglesFiscales["microEntreprise"]["ACRE"]["reductionsParDateDeCreation"]): string {
  if (reductions.length === 1) return pourcent(reductions[0].reduction)
  return reductions
    .map(({ aPartirDe, reduction }, i) => {
      const mois = lireMois(aPartirDe)
      const depuis = mois ? `depuis ${libelleDuMois(mois)}` : `depuis ${aPartirDe}`
      return `${pourcent(reduction)} ${i === 0 ? `pour une création ${depuis}` : depuis}`
    })
    .join(", ")
}

/** L'ACRE d'une micro-entreprise, avec les règles de l'année affichée. */
export function explicationDeLACRE(regles: ReglesFiscales): ExplicationDUneOption {
  const micro = regles.microEntreprise
  return {
    titre: "ACRE (aide à la création ou à la reprise d'entreprise)",
    paragraphes: [
      `Cotisations sociales réduites de ${reductionsDeLACRE(micro.ACRE.reductionsParDateDeCreation)}, du début d'activité jusqu'à la fin du ${micro.ACRE.trimestresCivilsApresLeDebut}e trimestre civil qui suit. Sans date de création dans la fiche de l'activité, la réduction de ${pourcent(micro.reductionACRE)} est appliquée à toute l'année.`,
      "Les droits baissent d'autant : moins de trimestres de retraite validés, des indemnités journalières plus faibles. La formation professionnelle n'est pas réduite.",
      "Réservée à certains créateurs et accordée sur demande : vérifiez les conditions avant de l'activer."
    ],
    source: { libelle: "Conditions de l'ACRE (service-public.fr)", url: "https://entreprendre.service-public.gouv.fr/vosdroits/F11677" }
  }
}

/** Le versement libératoire de l'impôt sur le revenu, avec les règles de l'année affichée. */
export function explicationDuVersementLiberatoire(regles: ReglesFiscales): ExplicationDUneOption {
  const { taux, plafondRfrParPart } = regles.microEntreprise.versementLiberatoire
  return {
    titre: "Versement libératoire de l'impôt sur le revenu",
    paragraphes: [
      `L'impôt sur le revenu de l'activité est payé avec les cotisations, en pourcentage du chiffre d'affaires : ${pourcent(taux.venteBic)} pour les ventes, ${pourcent(taux.servicesBic)} pour les prestations de services BIC, ${pourcent(taux.servicesBnc)} pour les BNC, au lieu de l'impôt au barème sur le revenu après l'abattement forfaitaire.`,
      `Condition pour ${regles.annee} : un revenu fiscal de référence ${regles.annee - 2} du foyer d'au plus ${euros(plafondRfrParPart)} par part. Le simulateur ne l'applique que si elle est remplie, et le dit dans le détail de l'activité.`
    ],
    source: { libelle: "Conditions du versement libératoire (impots.gouv.fr)", url: "https://www.impots.gouv.fr/professionnel/questions/en-tant-que-micro-entrepreneur-sous-quelles-conditions-puis-je-opter-pour-l" }
  }
}
