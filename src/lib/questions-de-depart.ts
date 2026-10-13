// src/lib/questions-de-depart.ts
// Encart « Que voulez-vous savoir ? » : les questions avec lesquelles on arrive, chacune menée à la situation type qui
// y répond (chargée comme depuis la fenêtre des situations types) ou, faute de situation adaptée, à la section de la
// page qui y répond. L'encart y ajoute « Partir de zéro ».

import { MONTAGES_TYPES, type MontageType } from "./montages/montages"

/** Une question de départ : sa situation type, ou l'identifiant de la section de la page qui y répond. */
export type QuestionDeDepart = { question: string; precision: string } & ({ montage: MontageType } | { ancre: string })

/** Le montage type d'identifiant donné ; une question qui en désignerait un disparu échoue dès le chargement. */
function situation(id: string): MontageType {
  const montage = MONTAGES_TYPES.find(m => m.id === id)
  if (!montage) throw new Error(`Situation type inconnue : ${id}`)
  return montage
}

export const QUESTIONS_DE_DEPART: readonly QuestionDeDepart[] = [
  { question: "Combien me restera-t-il ?", montage: situation("micro-bnc-seule"), precision: "Une micro-entreprise seule : le net après cotisations et impôt." },
  { question: "Société ou micro-entreprise ?", montage: situation("micro-bnc-seule"), precision: "La même micro-entreprise, comparée à l'EI, l'EURL et la SASU." },
  { question: "Mariage ou Pacs ?", montage: situation("couple-union-libre"), precision: "Un couple en union libre : son impôt s'il était marié ou pacsé." },
  { question: "Rémunération ou dividendes ?", montage: situation("sasu-salaire-4-trimestres"), precision: "Une SASU : le meilleur partage, et le coût de 4 trimestres de retraite." },
  { question: "Mes cotisations sont-elles justes ?", montage: situation("kinesitherapeute-ei"), precision: "Un kinésithérapeute au réel : chaque cotisation, avec son assiette et son taux." }
]

/** Identifiant du bouton « + Ajouter une personne » : « Partir de zéro » y porte le focus. */
export const ID_DE_L_AJOUT_D_UNE_PERSONNE = "ajouter-une-personne"
