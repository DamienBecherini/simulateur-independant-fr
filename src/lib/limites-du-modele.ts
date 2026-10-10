// src/lib/limites-du-modele.ts
// Hypothèses et limites du simulateur : la seule liste, affichée sous le titre des résultats, reprise dans le rapport
// Markdown et, mot pour mot, dans la section « Limites connues » du README (un test y veille). Aucun chiffre des règles
// ici : la liste vaut pour toutes les années.

/** Titre de la liste, dans l'application comme dans le rapport Markdown. */
export const TITRE_DES_LIMITES = "Hypothèses et limites"

/** Hypothèses et limites du simulateur, en bref. */
export const LIMITES = [
  "Résultats indicatifs, non validés par un expert-comptable : ce n'est pas un conseil fiscal.",
  "Montants annuels en euros, hors taxe ; la grille saisit des montants mensuels, additionnés sur l'année.",
  "Cotisations d'un travailleur non salarié au réel (entrepreneur individuel, gérant d'EURL) calculées sur le revenu de l'année, comme après la régularisation : les acomptes provisionnels que l'Urssaf appelle d'abord sur un revenu antérieur, et la régularisation de l'année suivante, ne sont pas simulés ; l'appel de l'Urssaf d'une année peut donc différer du montant affiché.",
  "Cotisations des travailleurs non salariés calculées ligne à ligne selon le barème de l'année des artisans, commerçants et professions libérales non réglementées (assiette unique après l'abattement forfaitaire, assiettes minimales) ; la formation professionnelle d'un artisan est comptée au taux des commerçants, et la CSG déductible sur les dividendes soumis à cotisations n'est pas modélisée.",
  "Professions libérales réglementées : seules la CIPAV et la CARPIMKO sont calculées (au réel et en micro-entreprise) ; les autres caisses (CARMF, CARCDSF, CNBF…) le sont comme une profession non réglementée, avec un avertissement. CARPIMKO : retraite complémentaire et ASV calculées sur le revenu de l'année précédente quand elle est dans la simulation, sinon sur celui de l'année. En SASU ou en EURL, la rémunération d'un associé de société d'exercice libéral (BNC, caisse de la profession) n'est pas modélisée : un avertissement le signale.",
  "Président de SASU et salariés : cotisations calculées ligne à ligne avec les taux du régime général de l'année (président sans assurance chômage ni réduction générale, salarié avec la réduction générale) ; ne sont pas modélisés l'APEC des cadres, le régime d'Alsace-Moselle, le temps partiel, ni plus d'un employeur par personne ; le taux d'accident du travail retenu est celui des fonctions support.",
  "Micro-entreprise : cotisations au taux de chaque nature d'activité, plus la contribution à la formation professionnelle, comptée au taux des artisans pour les prestations de services BIC (artisan et commerçant ne sont pas distingués).",
  "La note de protection sociale du comparateur est indicative (régime et trimestres de retraite validés) ; l'arbitrage rémunération / dividendes porte sur une seule année, sans les droits à la retraite complémentaire ni le lissage sur plusieurs années.",
  "Non modélisés : prévoyance et mutuelle, réductions et crédits d'impôt, résidence alternée, report sur les années suivantes du déficit d'une entreprise individuelle supérieur aux autres revenus du foyer (celui d'une société à l'IS est reporté), TVA (seul le dépassement des seuils de franchise est signalé), répartition du capital entre associés (dividendes partagés à parts égales)."
]
