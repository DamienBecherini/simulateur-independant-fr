// src/lib/montages/montages.ts
// Bibliothèque des montages types : des simulations d'un an, préremplies, pour partir d'une situation courante plutôt
// que d'une page vide. Chiffres ronds et fictifs, prénoms génériques. Les explications restent prudentes : elles
// renvoient aux sources officielles, et les chiffres de chaque montage sont figés par montages.reference.test.ts.
// Les taux et seuils que citent les textes viennent des règles de l'année des montages, jamais recopiés à la main.

import { euros, pourcent } from "@/backend/logic/format"
import { reglesPubliees } from "@/backend/logic/regles"
import type { SessionState } from "@/types"
import { ANNEE_DES_MONTAGES, comparateurAuMeilleurNet, microEntreprise, personne, relation, sessionDuMontage, societe, type ContenuDuMontage } from "./construction"

/** Les règles de l'année des montages, d'où viennent les taux et seuils cités. */
const REGLES = reglesPubliees(ANNEE_DES_MONTAGES)
const MICRO = REGLES.microEntreprise
const { IS, dividendes: DIVIDENDES } = REGLES

/** Un lien vers une page officielle qui fonde une explication. */
export interface SourceOfficielle {
  libelle: string
  url: string
}

export interface MontageType {
  id: string
  titre: string
  /** Une phrase qui résume la situation. */
  resume: string
  /** Mots-clés affichés sur la carte : « Micro », « SASU », « Couple »… */
  etiquettes: string[]
  /** Questions auxquelles le montage aide à répondre. */
  questions: string[]
  /** Ce que le montage illustre, et où le voir dans le simulateur. */
  illustre: string[]
  /** Conditions à remplir pour que le montage soit possible. */
  conditions: string[]
  /** Points d'attention et risques. */
  pointsDAttention: string[]
  sources: SourceOfficielle[]
  /** Acteurs, relations et flux de l'année ; la session porte le titre du montage. */
  contenu: () => ContenuDuMontage
}

/** La session à charger pour un montage : une année, nommée d'après le montage. */
export function sessionDUnMontage(montage: MontageType): SessionState {
  return sessionDuMontage(montage.titre, montage.contenu())
}

// --- Sources officielles communes ---

const SOURCES = {
  cotisationsMicro: { libelle: "Cotisations sociales du micro-entrepreneur (service-public.fr)", url: "https://entreprendre.service-public.gouv.fr/vosdroits/F36232" },
  abattementMicro: { libelle: "Régime micro-fiscal et abattement forfaitaire (service-public.fr)", url: "https://entreprendre.service-public.gouv.fr/vosdroits/F23267" },
  plafondsMicro: { libelle: "Seuils de chiffre d'affaires de la micro-entreprise (service-public.fr)", url: "https://entreprendre.service-public.gouv.fr/vosdroits/F32353" },
  versementLiberatoire: { libelle: "Conditions du versement libératoire (impots.gouv.fr)", url: "https://www.impots.gouv.fr/professionnel/questions/en-tant-que-micro-entrepreneur-sous-quelles-conditions-puis-je-opter-pour-l" },
  franchiseTva: { libelle: "Franchise en base de TVA (service-public.fr)", url: "https://entreprendre.service-public.gouv.fr/vosdroits/F21746" },
  impotSocietes: { libelle: `Impôt sur les sociétés, taux réduit de ${pourcent(IS.tauxReduit)} (service-public.fr)`, url: "https://entreprendre.service-public.gouv.fr/vosdroits/F23575" },
  dividendes: { libelle: "Imposition des dividendes (service-public.fr)", url: "https://entreprendre.service-public.gouv.fr/vosdroits/F32963" },
  cotisationsSas: { libelle: "Cotisations sociales d'une SAS (service-public.fr)", url: "https://entreprendre.service-public.gouv.fr/vosdroits/F36007" },
  protectionDirigeant: { libelle: "Protection sociale du dirigeant (service-public.fr)", url: "https://entreprendre.service-public.gouv.fr/vosdroits/F38152" },
  trimestres: { libelle: "Valider des trimestres de retraite (lassuranceretraite.fr)", url: "https://www.lassuranceretraite.fr/portail-info/home/actif/ma-carriere/cotisation-carriere.html" },
  conjoint: { libelle: "Statuts du conjoint du chef d'entreprise (service-public.fr)", url: "https://entreprendre.service-public.gouv.fr/vosdroits/F32266" },
  concubins: { libelle: "Déclaration de revenus d'un couple en union libre (service-public.fr)", url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F362" },
  anneeDuMariage: { libelle: "Déclarer ses revenus l'année du mariage ou du Pacs (impots.gouv.fr)", url: "https://www.impots.gouv.fr/particulier/questions/comment-declarer-nos-revenus-lannee-du-mariage-ou-pacs" },
  cumulSalarie: { libelle: "Cumuler un emploi salarié et une micro-entreprise (service-public.fr)", url: "https://entreprendre.service-public.gouv.fr/vosdroits/F23264" }
} satisfies Record<string, SourceOfficielle>

// Phrases reprises d'un montage à l'autre.
const RESERVE_LEGALE = "La réserve légale, les frais de fonctionnement et la prévoyance ne sont pas déduits : les montants sont des ordres de grandeur."
const PLAFOND_MICRO = `Chiffre d'affaires sous le plafond des prestations de services (${euros(MICRO.plafonds.services)} pour ${ANNEE_DES_MONTAGES}) ; dépassé deux années de suite, il fait sortir du régime.`
// Les conditions d'accès au taux réduit (10 millions d'euros, 75 % du capital) ne sont pas dans les règles : le simulateur ne les vérifie pas.
const TAUX_REDUIT_IS = `Taux réduit d'impôt sur les sociétés (${pourcent(IS.tauxReduit)} jusqu'à ${euros(IS.plafondTauxReduit)} de bénéfice) : chiffre d'affaires d'au plus 10 millions d'euros, capital entièrement libéré et détenu à 75 % au moins par des personnes physiques.`
/** Condition de revenu du versement libératoire, suivie d'une précision propre au montage (« ici 24 000 € saisis »). */
const plafondDuVersementLiberatoire = (precision = "") => `Versement libératoire : revenu fiscal de référence ${ANNEE_DES_MONTAGES - 2} du foyer d'au plus ${euros(MICRO.versementLiberatoire.plafondRfrParPart)} par part pour ${ANNEE_DES_MONTAGES}${precision}.`
/** Premier taux non nul du barème de l'impôt sur le revenu. */
const PREMIER_TAUX_DU_BAREME = REGLES.IR.bareme.find(tranche => tranche.taux > 0)?.taux ?? 0
/** Capital social de l'EURL du montage : il fixe la part des dividendes qui échappe aux cotisations. */
const CAPITAL_DE_L_EURL = 5000
const COMPARATEUR_MICRO = "Le comparateur place la micro-entreprise avec et sans versement libératoire côte à côte, face à l'entreprise individuelle au réel, l'EURL et la SASU."

// --- Les montages ---

const microSeule: MontageType = {
  id: "micro-bnc-seule",
  titre: "Micro-entreprise seule (BNC)",
  resume: "Sophie, célibataire, facture 3 000 € de prestations intellectuelles par mois en micro-entreprise, au versement libératoire.",
  etiquettes: ["Micro", "BNC", "Versement libératoire"],
  questions: ["Combien me reste-t-il après cotisations et impôt ?", "Le versement libératoire est-il avantageux pour moi ?", "À partir de quel chiffre d'affaires une société devient-elle intéressante ?"],
  illustre: [
    `Les cotisations calculées en pourcentage du chiffre d'affaires (${pourcent(MICRO.cotisations.servicesBnc)} pour une activité libérale non réglementée en ${ANNEE_DES_MONTAGES}, plus ${pourcent(MICRO.formationProfessionnelle.servicesBnc)} de contribution à la formation professionnelle), sans charges déductibles.`,
    `L'impôt payé avec les cotisations au versement libératoire (${pourcent(MICRO.versementLiberatoire.taux.servicesBnc)} du chiffre d'affaires en BNC), au lieu du barème après l'abattement forfaitaire de ${pourcent(MICRO.abattement.servicesBnc)}.`,
    COMPARATEUR_MICRO
  ],
  conditions: [
    plafondDuVersementLiberatoire(` (ici ${euros(24000)} saisis, pour une part)`),
    "Option à demander avant le 30 septembre pour l'année suivante, ou jusqu'au dernier jour du 3e mois après la création.",
    PLAFOND_MICRO
  ],
  pointsDAttention: [
    "À 36 000 € de chiffre d'affaires, l'activité reste sous le seuil de franchise en base de TVA des services : au-delà, la TVA peut devenir due (le simulateur ne la calcule pas, les montants sont hors taxe).",
    "Les dépenses professionnelles ne se déduisent pas : avec beaucoup de frais, le régime réel peut devenir plus intéressant.",
    `Le versement libératoire n'est pas toujours gagnant : il l'est surtout quand le foyer serait imposé à ${pourcent(PREMIER_TAUX_DU_BAREME)} ou plus au barème.`
  ],
  sources: [SOURCES.cotisationsMicro, SOURCES.abattementMicro, SOURCES.versementLiberatoire, SOURCES.plafondsMicro, SOURCES.franchiseTva],
  contenu: () => ({
    entities: [personne("p-sophie", "Sophie"), microEntreprise("m-sophie", "Conseil de Sophie", { opteVFL: true, rfrN2: 24000 })],
    relationships: [relation("p-sophie", "m-sophie", "Titulaire")],
    flux: [{ entityId: "m-sophie", type: "ca_micro_services_bnc", amount: 3000, label: "Prestations" }]
  })
}

/** Une SASU de conseil : 7 000 € facturés et 500 € de frais par mois, présidée par une personne seule. */
function sasuDeConseil(prenom: string, idPersonne: string, idSociete: string, remunerationMensuelle: number, dividendes: number, avecRetraite: boolean): ContenuDuMontage {
  return {
    entities: [personne(idPersonne, prenom), societe(idSociete, `SASU de ${prenom}`, "SASU", 1000)],
    relationships: [relation(idPersonne, idSociete, "Président")],
    flux: [
      { entityId: idSociete, type: "ca_services", amount: 7000, label: "Facturation" },
      { entityId: idSociete, type: "deductible_expense", amount: 500, label: "Frais" },
      ...(remunerationMensuelle > 0 ? [{ entityId: idSociete, type: "director_remuneration" as const, amount: remunerationMensuelle, label: "Rémunération" }] : []),
      { entityId: idSociete, type: "dividends_payment", amount: dividendes, label: "Dividendes", mois: 11 }
    ],
    comparateur: comparateurAuMeilleurNet(idSociete, avecRetraite)
  }
}

const sasuSansSalaire: MontageType = {
  id: "sasu-sans-salaire",
  titre: "SASU sans salaire, tout en dividendes",
  resume: "Thomas préside seul une SASU qui facture 84 000 € par an ; il ne se verse aucune rémunération et distribue tout le bénéfice en dividendes.",
  etiquettes: ["SASU", "Dividendes", "Retraite"],
  questions: ["Que reste-t-il si je ne me paie qu'en dividendes ?", "Combien coûte la validation de 4 trimestres de retraite ?", "Les dividendes sont-ils mieux imposés au prélèvement forfaitaire ou au barème ?"],
  illustre: [
    `Sans rémunération, le président ne paie pas de cotisations sociales : le bénéfice supporte l'impôt sur les sociétés, puis les dividendes le prélèvement forfaitaire de ${pourcent(DIVIDENDES.tauxIrForfaitaire + DIVIDENDES.prelevementsSociaux)} (${pourcent(DIVIDENDES.tauxIrForfaitaire)} d'impôt et ${pourcent(DIVIDENDES.prelevementsSociaux)} de prélèvements sociaux) ou, sur option, le barème après un abattement de ${pourcent(DIVIDENDES.abattementBareme)}.`,
    "Le comparateur est réglé au meilleur net parmi les rémunérations qui valident 4 trimestres de retraite : il montre ce que coûte cette exigence, à comparer avec le montage « SASU avec un salaire qui valide 4 trimestres ».",
    "« Rémunération ou dividendes ? » trace le net du foyer pour chaque rémunération possible.",
    `${euros(84000)} de chiffre d'affaires dépassent de peu le plafond de la micro-entreprise (${euros(MICRO.plafonds.services)}) : le comparateur la signale hors plafond et ne la désigne pas comme meilleur choix.`
  ],
  conditions: [TAUX_REDUIT_IS, "Les dividendes ne se versent qu'après l'approbation des comptes, sur un bénéfice distribuable."],
  pointsDAttention: [
    "Sans rémunération, aucun trimestre de retraite n'est validé, et le président n'a pas d'indemnités journalières en cas d'arrêt.",
    "Le président de SASU, assimilé salarié, ne cotise pas à l'assurance chômage, même avec une rémunération.",
    RESERVE_LEGALE
  ],
  sources: [SOURCES.impotSocietes, SOURCES.dividendes, SOURCES.cotisationsSas, SOURCES.trimestres],
  contenu: () => sasuDeConseil("Thomas", "p-thomas", "s-thomas", 0, 62750, true)
}

const sasuAvecSalaire: MontageType = {
  id: "sasu-salaire-4-trimestres",
  titre: "SASU avec un salaire qui valide 4 trimestres",
  resume: "Antoine préside une SASU qui facture 84 000 € par an ; il se verse 1 000 € nets par mois, puis le reste du bénéfice en dividendes.",
  etiquettes: ["SASU", "Rémunération", "Dividendes", "Retraite"],
  questions: ["Combien faut-il se verser pour valider 4 trimestres de retraite ?", "Que coûte ce salaire par rapport aux dividendes seuls ?", "Où se situe le meilleur partage entre rémunération et dividendes ?"],
  illustre: [
    `Une rémunération modeste, assez haute pour valider 4 trimestres (150 heures au SMIC par trimestre, soit ${euros(REGLES.protectionSociale.revenuParTrimestre)} soumis à cotisations en ${ANNEE_DES_MONTAGES}, 4 au plus par an), et le reste du bénéfice en dividendes.`,
    "Les cotisations du président, assimilé salarié : parts salariale et patronale, sans assurance chômage.",
    "La rémunération est une charge de la société : elle réduit l'impôt sur les sociétés. Le comparateur, au meilleur net sans condition, montre si un autre partage rapporterait plus."
  ],
  conditions: [TAUX_REDUIT_IS, "La rémunération du président est fixée par les associés ou selon les statuts."],
  pointsDAttention: [
    "Valider des trimestres ne dit rien du montant de la future pension : il dépend aussi des salaires cotisés et de la retraite complémentaire.",
    "Les cotisations sur la rémunération d'un président sont élevées : elles financent aussi une protection maladie, invalidité et décès.",
    RESERVE_LEGALE
  ],
  sources: [SOURCES.trimestres, SOURCES.cotisationsSas, SOURCES.impotSocietes, SOURCES.dividendes],
  contenu: () => sasuDeConseil("Antoine", "p-antoine", "s-antoine", 1000, 47000, false)
}

const eurlIS: MontageType = {
  id: "eurl-is-remuneration-gerant",
  titre: "EURL à l'IS avec rémunération du gérant",
  resume: "Nicolas, gérant associé unique d'une EURL à l'impôt sur les sociétés, se verse 2 500 € nets par mois et laisse le reste du bénéfice dans la société.",
  etiquettes: ["EURL", "Rémunération", "TNS"],
  questions: ["Combien coûtent les cotisations d'un gérant non salarié ?", "Pourquoi les dividendes d'EURL sont-ils peu distribués ?", "EURL ou SASU pour la même activité ?"],
  illustre: [
    "Les cotisations du travailleur non salarié, calculées sur sa rémunération : en général moins lourdes que celles d'un président de SASU pour le même net.",
    `Les dividendes du gérant majoritaire supportent les cotisations sociales pour leur part au-delà de ${pourcent(REGLES.EURL.seuilDividendesPartDuCapital)} du capital social : avec ${euros(CAPITAL_DE_L_EURL)} de capital, seuls ${euros(CAPITAL_DE_L_EURL * REGLES.EURL.seuilDividendesPartDuCapital)} de dividendes y échappent.`,
    "Le bénéfice non distribué reste dans la société, après l'impôt sur les sociétés. Le comparateur, réglé au meilleur net avec 4 trimestres de retraite, distribue tout le bénéfice dans chaque statut : il ne compare donc pas exactement la situation saisie."
  ],
  conditions: [TAUX_REDUIT_IS, "Gérant associé unique : il relève du régime des travailleurs non salariés."],
  pointsDAttention: [
    "Le gérant cotise sur des assiettes minimales même sans rémunération.",
    "Le bénéfice laissé dans la société n'est pas un revenu du foyer tant qu'il n'est pas distribué.",
    RESERVE_LEGALE
  ],
  sources: [SOURCES.protectionDirigeant, SOURCES.impotSocietes, SOURCES.dividendes],
  contenu: () => ({
    entities: [personne("p-nicolas", "Nicolas"), societe("e-nicolas", "EURL de Nicolas", "EURL", CAPITAL_DE_L_EURL)],
    relationships: [relation("p-nicolas", "e-nicolas", "Gérant")],
    flux: [
      { entityId: "e-nicolas", type: "ca_services", amount: 7000, label: "Facturation" },
      { entityId: "e-nicolas", type: "deductible_expense", amount: 500, label: "Frais" },
      { entityId: "e-nicolas", type: "director_remuneration", amount: 2500, label: "Rémunération" },
      { entityId: "e-nicolas", type: "dividends_payment", amount: 500, label: "Dividendes", mois: 11 }
    ],
    comparateur: comparateurAuMeilleurNet("e-nicolas", true)
  })
}

const microEtSasuDuConjoint: MontageType = {
  id: "micro-et-sasu-du-conjoint",
  titre: "Micro-entreprise et SASU du conjoint",
  resume: "Claire, en micro-entreprise BNC (2 500 € par mois), est mariée à Marc, président d'une SASU qui lui verse 2 000 € nets par mois et des dividendes.",
  etiquettes: ["Micro", "SASU", "Couple", "Marié"],
  questions: ["Combien reste-t-il au foyer, une fois tout payé ?", "Le versement libératoire vaut-il le coup avec les revenus du conjoint ?", "Quelle activité gagnerait à changer de statut ?"],
  illustre: [
    "Un foyer fiscal unique pour deux activités : les revenus du couple marié sont imposés ensemble, sur deux parts.",
    "Le versement libératoire de Claire dépend du revenu fiscal de référence du foyer, et non du sien seul : le comparateur dit s'il serait avantageux.",
    "Chaque activité se compare séparément : choisissez l'activité dans le comparateur."
  ],
  conditions: [
    "Mariés ou pacsés : une déclaration commune pour le foyer.",
    plafondDuVersementLiberatoire(),
    PLAFOND_MICRO
  ],
  pointsDAttention: [
    "Si Claire travaille aussi pour la SASU de Marc, elle doit choisir un statut (associée ou salariée) : le statut de conjoint collaborateur n'existe pas en SAS.",
    RESERVE_LEGALE
  ],
  sources: [SOURCES.anneeDuMariage, SOURCES.versementLiberatoire, SOURCES.cotisationsMicro, SOURCES.dividendes, SOURCES.conjoint],
  contenu: () => ({
    entities: [personne("p-claire", "Claire"), personne("p-marc", "Marc", true), microEntreprise("m-claire", "Micro-entreprise de Claire", { opteVFL: false, rfrN2: 52000 }), societe("s-marc", "SASU de Marc", "SASU", 1000)],
    relationships: [relation("p-claire", "p-marc", "Marié(e)"), relation("p-claire", "m-claire", "Titulaire"), relation("p-marc", "s-marc", "Président")],
    flux: [
      { entityId: "m-claire", type: "ca_micro_services_bnc", amount: 2500, label: "Prestations" },
      { entityId: "s-marc", type: "ca_services", amount: 6000, label: "Facturation" },
      { entityId: "s-marc", type: "director_remuneration", amount: 2000, label: "Rémunération" },
      { entityId: "s-marc", type: "dividends_payment", amount: 25000, label: "Dividendes", mois: 11 }
    ],
    comparateur: { activiteComparee: "m-claire", reglagesParActivite: {} }
  })
}

const conjointSalarie: MontageType = {
  id: "conjoint-salarie-sasu",
  titre: "Conjoint salarié de la SASU",
  resume: "Paul préside une SASU qui facture 9 000 € par mois ; Julie, son épouse, y est salariée à 1 500 € nets par mois.",
  etiquettes: ["SASU", "Salarié", "Couple", "Marié"],
  questions: ["Que coûte à la société le salaire du conjoint ?", "Que gagne le foyer à salarier le conjoint plutôt qu'à verser des dividendes ?", "Quels droits ouvre ce salaire ?"],
  illustre: [
    "La relation « Salarié » fait supporter à la SASU le coût employeur du salaire de Julie, réduction générale des cotisations patronales comprise.",
    "Le salaire réduit le bénéfice, donc l'impôt sur les sociétés et les dividendes de Paul ; le foyer, marié, est imposé sur l'ensemble.",
    "Contrairement au président, la salariée cotise à l'assurance chômage."
  ],
  conditions: [
    "Le conjoint salarié travaille réellement et régulièrement dans l'entreprise, avec un contrat de travail, sous l'autorité du dirigeant.",
    "Son salaire respecte le SMIC ou la convention collective, et correspond au travail fourni.",
    "Le statut de conjoint collaborateur n'est pas ouvert en SAS : restent les statuts de salarié ou d'associé."
  ],
  pointsDAttention: [
    "Un emploi fictif ou un salaire sans rapport avec le travail fourni peut être remis en cause.",
    "Le simulateur traite la salariée comme non cadre, sans prévoyance ni complémentaire santé d'entreprise.",
    RESERVE_LEGALE
  ],
  sources: [SOURCES.conjoint, SOURCES.cotisationsSas, SOURCES.impotSocietes, SOURCES.dividendes],
  contenu: () => ({
    entities: [personne("p-paul", "Paul"), personne("p-julie", "Julie", true), societe("s-paul", "SASU de Paul", "SASU", 1000)],
    relationships: [relation("p-paul", "p-julie", "Marié(e)"), relation("p-paul", "s-paul", "Président"), relation("p-julie", "s-paul", "Salarié")],
    flux: [
      { entityId: "s-paul", type: "ca_services", amount: 9000, label: "Facturation" },
      { entityId: "s-paul", type: "deductible_expense", amount: 500, label: "Frais" },
      { entityId: "s-paul", type: "director_remuneration", amount: 2000, label: "Rémunération" },
      { entityId: "p-julie", type: "salary", amount: 1500, label: "Salaire" },
      { entityId: "s-paul", type: "dividends_payment", amount: 30000, label: "Dividendes", mois: 11 }
    ]
  })
}

const unionLibre: MontageType = {
  id: "couple-union-libre",
  titre: "Couple en union libre, puis marié ou pacsé",
  resume: "Hugo, salarié à 3 500 € nets par mois, vit en union libre avec Emma, en micro-entreprise BNC à 1 000 € par mois : que changerait un mariage ou un Pacs ?",
  etiquettes: ["Micro", "Salarié", "Couple", "Union libre"],
  questions: ["Le mariage ou le Pacs réduirait-il notre impôt ?", "Combien chacun paie-t-il aujourd'hui ?", "Le versement libératoire reste-t-il possible après un mariage ?"],
  illustre: [
    "En union libre, chacun déclare ses revenus seul : deux foyers fiscaux.",
    "Le comparateur calcule l'impôt du couple s'il était marié ou pacsé : avec des revenus très inégaux, l'imposition commune réduit souvent l'impôt total.",
    "Pour voir le foyer commun, remplacez la relation « En couple » par « Marié(e) » ou « PACSé(e) »."
  ],
  conditions: [
    "Mariés ou pacsés : une déclaration commune, sauf option pour l'imposition distincte l'année du mariage ou du Pacs seulement.",
    "Versement libératoire : le revenu fiscal de référence est celui du foyer ; après un mariage, il inclut les revenus du conjoint."
  ],
  pointsDAttention: [
    "Se marier ou se pacser a d'autres effets que fiscaux (patrimoine, succession, protection du conjoint) : l'impôt n'est qu'un critère.",
    "Le gain fiscal dépend de l'écart de revenus : il peut être nul quand les deux revenus sont proches."
  ],
  sources: [SOURCES.concubins, SOURCES.anneeDuMariage, SOURCES.versementLiberatoire, SOURCES.abattementMicro],
  contenu: () => ({
    entities: [personne("p-hugo", "Hugo"), personne("p-emma", "Emma", true), microEntreprise("m-emma", "Micro-entreprise d'Emma", { opteVFL: false, rfrN2: 8000 })],
    relationships: [relation("p-hugo", "p-emma", "En couple"), relation("p-emma", "m-emma", "Titulaire")],
    flux: [
      { entityId: "p-hugo", type: "salary", amount: 3500, grossAmount: 4500, label: "Salaire" },
      { entityId: "m-emma", type: "ca_micro_services_bnc", amount: 1000, label: "Prestations" }
    ]
  })
}

const salariePlusMicro: MontageType = {
  id: "salarie-et-micro",
  titre: "Salarié avec une micro-entreprise à côté",
  resume: "Lucas, salarié à 2 200 € nets par mois, réalise aussi 800 € de missions par mois en micro-entreprise BNC.",
  etiquettes: ["Micro", "Salarié", "Cumul"],
  questions: ["Combien me rapporte vraiment mon activité à côté ?", "Le versement libératoire est-il intéressant avec mon salaire ?", "Quelles cotisations paie la micro-entreprise ?"],
  illustre: [
    "Le salaire et le bénéfice de la micro-entreprise s'additionnent dans le même foyer fiscal : l'activité à côté est imposée au taux marginal du foyer.",
    "Les cotisations de la micro-entreprise restent dues en pourcentage du chiffre d'affaires, même avec un salaire qui couvre déjà la protection sociale.",
    COMPARATEUR_MICRO
  ],
  conditions: [
    "Le contrat de travail ne comporte pas de clause d'exclusivité, l'activité ne concurrence pas l'employeur et s'exerce hors du temps de travail.",
    plafondDuVersementLiberatoire(` (ici ${euros(25000)} saisis)`)
  ],
  pointsDAttention: [
    "Même sans clause, le salarié reste tenu à une obligation de loyauté envers son employeur.",
    "Le versement libératoire ne s'applique qu'à l'activité de la micro-entreprise ; le salaire reste imposé au barème."
  ],
  sources: [SOURCES.cumulSalarie, SOURCES.cotisationsMicro, SOURCES.versementLiberatoire, SOURCES.abattementMicro],
  contenu: () => ({
    entities: [personne("p-lucas", "Lucas"), microEntreprise("m-lucas", "Missions de Lucas", { opteVFL: false, rfrN2: 25000 })],
    relationships: [relation("p-lucas", "m-lucas", "Titulaire")],
    flux: [
      { entityId: "p-lucas", type: "salary", amount: 2200, grossAmount: 2820, label: "Salaire" },
      { entityId: "m-lucas", type: "ca_micro_services_bnc", amount: 800, label: "Missions" }
    ]
  })
}

/** Les montages types, dans l'ordre de la bibliothèque : du plus simple au plus composé. */
export const MONTAGES_TYPES: MontageType[] = [microSeule, sasuSansSalaire, sasuAvecSalaire, eurlIS, salariePlusMicro, microEtSasuDuConjoint, conjointSalarie, unionLibre]
