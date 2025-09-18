// src/calculsEURL.js - VERSION PRO
const config = require("../config.json")
const { calculerIR } = require("./calculsIR.js")

function simulerEURL(inputs) {
  // AJOUT : capitalSocial est maintenant requis pour les calculs
  const { chiffreAffaires = 0, chargesDeductibles = 0, remunerationNetteVisee = 0, autresRevenusImposablesFoyer = 0, partsFiscales = 1, capitalSocial = 0 } = inputs

  // --- Calcul Rémunération et IS (inchangé) ---
  const cotisationsSocialesRemu = remunerationNetteVisee * config.EURL.cotisations_tns.taux_approx_sur_remuneration
  const coutTotalRemuneration = remunerationNetteVisee + cotisationsSocialesRemu
  const beneficeAvantIS = chiffreAffaires - chargesDeductibles - coutTotalRemuneration
  let impotSocietes = 0
  if (beneficeAvantIS > 0) {
    const beneficePartTauxReduit = Math.min(beneficeAvantIS, config.SASU.IS.plafond_reduit)
    const beneficePartTauxNormal = beneficeAvantIS - beneficePartTauxReduit
    impotSocietes = beneficePartTauxReduit * config.SASU.IS.taux_reduit + beneficePartTauxNormal * config.SASU.IS.taux_normal
  }
  const beneficeApresIS = beneficeAvantIS > 0 ? beneficeAvantIS - impotSocietes : 0
  const dividendesBruts = beneficeApresIS

  // --- DÉBUT DE LA NOUVELLE LOGIQUE POUR LES DIVIDENDES EURL ---
  const seuilDividendesSoumisPS = capitalSocial * 0.1

  // On sépare les dividendes en deux parts
  const partDividendesPourPS = Math.min(dividendesBruts, seuilDividendesSoumisPS)
  const partDividendesPourTNS = dividendesBruts - partDividendesPourPS

  // On calcule les cotisations sur la part excédentaire
  const cotisationsTNSsurDividendes = partDividendesPourTNS * config.EURL.cotisations_tns.taux_approx_sur_remuneration

  // La part TNS des dividendes est traitée comme un revenu, donc elle sera ajoutée au revenu imposable.
  const dividendesNetsPartTNS = partDividendesPourTNS - cotisationsTNSsurDividendes

  // L'autre part est soumise à la fiscalité classique des dividendes (PFU ou barème)
  const prelevementsSociaux = partDividendesPourPS * config.SASU.dividendes.pru_taux_ps

  // Option 1 : PFU (Flat Tax) sur la part non-TNS
  const impotDividendesPFU = partDividendesPourPS * config.SASU.dividendes.pru_taux_ir
  const dividendesNetsPartPS_PFU = partDividendesPourPS - prelevementsSociaux - impotDividendesPFU

  // Option 2 : Barème sur la part non-TNS
  const dividendesImposablesBareme = partDividendesPourPS * 0.6 // Abattement 40%

  // Le revenu imposable total inclut : la rémunération, les revenus du foyer, ET la part des dividendes soumise aux TNS
  const revenuImposableBase = remunerationNetteVisee + autresRevenusImposablesFoyer + dividendesNetsPartTNS

  const irTotalOptionBareme = calculerIR({ revenuNetGlobalImposable: revenuImposableBase + dividendesImposablesBareme, partsFiscales })
  const irSansDividendesPartPS = calculerIR({ revenuNetGlobalImposable: revenuImposableBase, partsFiscales })

  const surcoutIRDividendesBareme = irTotalOptionBareme - irSansDividendesPartPS
  const dividendesNetsPartPS_Bareme = partDividendesPourPS - prelevementsSociaux - surcoutIRDividendesBareme

  // On choisit la meilleure option pour la part soumise aux PS
  const meilleureOptionDividendesPartPS = Math.max(dividendesNetsPartPS_PFU, dividendesNetsPartPS_Bareme)

  // Le revenu total net des dividendes est la somme des deux parts nettes
  const dividendesNetsTotal = dividendesNetsPartTNS + meilleureOptionDividendesPartPS
  // --- FIN DE LA NOUVELLE LOGIQUE ---

  // --- Calcul de l'IR sur la rémunération (maintenant il doit aussi inclure la part TNS des dividendes) ---
  const revenuImposableTotalActivite = remunerationNetteVisee + dividendesNetsPartTNS

  const irTotalRemuEtDivTNS = calculerIR({ revenuNetGlobalImposable: revenuImposableTotalActivite + autresRevenusImposablesFoyer, partsFiscales })
  const irSansActivite = calculerIR({ revenuNetGlobalImposable: autresRevenusImposablesFoyer, partsFiscales })
  const surcoutIRRemu = irTotalRemuEtDivTNS - irSansActivite

  // Le net dans la poche est la rémunération nette + les dividendes nets totaux - le surcoût d'IR global
  const netDansLaPoche = remunerationNetteVisee + dividendesNetsTotal - surcoutIRRemu

  // --- TVA (inchangé) ---
  const { ca_services = 0 } = inputs
  let statutTVA = "En franchise"
  if (chiffreAffaires > config.TVA.vente.seuil_majore || ca_services > config.TVA.services.seuil_majore) {
    statutTVA = "Assujetti (dépassement seuil majoré)"
  } else if (chiffreAffaires > config.TVA.vente.franchise_base || ca_services > config.TVA.services.franchise_base) {
    statutTVA = "Seuil de base dépassé / Tolérance"
  }

  return {
    statut: "EURL (IS)",
    chiffreAffaires,
    chargesReelles: chargesDeductibles,
    remuneration: {
      net: remunerationNetteVisee,
      coutTotal: coutTotalRemuneration
    },
    impotSocietes: Math.round(impotSocietes),
    dividendes: {
      // Structure simplifiée car le détail PFU/Barème devient trop complexe à afficher simplement
      bruts: dividendesBruts,
      nets: Math.round(dividendesNetsTotal)
    },
    revenuImposable: Math.round(revenuImposableTotalActivite), // Revenu imposable = Rémunération + part TNS des dividendes
    surcoutIR: Math.round(surcoutIRRemu),
    netDansLaPoche: Math.round(netDansLaPoche),
    statutTVA: statutTVA
  }
}

module.exports = { simulerEURL }
