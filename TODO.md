```python

Idéalement j'aimerai plus de clarté / détails pour chaque Synthèse.
Exemple pour la micro :

On affiche :
Salaires : xxxx€
ARE : xxxx€
(Dans le futur : Autres : xxxx€, ce qui pourrait comprendre les pensions alimentaires, loyers perçus, etc.)
Chiffre d'affaire  : xxxx€
(-) Cotisation Sociales {Bouton + de détails} : xxxx€ -> clic sur le bouton affiche x nouvelles lignes enfant en dessous de cette ligne, agrandissant le tableau, avec un effet déroulant comme un accordéon.
  Cotisation BIC (x%) : xxxx€
  Cotisation BNC (x%) : xxxx€
  Cotisations Vente (x%) : xxxx€
Revenu Net de cotisations {Bouton + de détails} : xxxx€
  Revenu BIC : xx€
  Revenu BNC : xx€
  Revenu Ventes : xx€
  Salaire : xx€
Revenu Imposable (après abattement) {Bouton + de détails} : xxxx€
  Revenu BIC (abattement x%) : xx€
  Revenu BNC (abattement x%) : xx€
  Revenu Ventes (abattement x%) : xx€
  Salaire : xx€
Impôt sur le Revenu {Bouton + de détails} : xxxx€
  Ici on affiche le calcul détaillé avec les sommes qu'on ajoute et leur source, et les différentes tranches d'imposition
  Exemple qui dépend du nombre de parts :
  Si Impôt libératoire, on affiche le calcul détaillé de la partie Micro sur 1 à 4 lignes (BIC, BNC, Ventes et total si plus d'un type de CA)
  Puis on affiche le calcul de l'impôt (voir ci dessous) pour le reste des revenus. Si pas impôt libératoire, on affiche juste le calcul de l'impôt ci dessous :
  Jusqu’à 11 294 € : 0%
  11 294 – 28 797 € : 11%, soit 1925,33€
  28 798€ – xxxx€ : 30%, soit xxxx€
  Si impot libératoire : on affiche le Total libératoire + résultat du calcul impot autres revenus ci dessus.
(-) Charges pro non déductibles
= Net dans la poche final
```

|
|
|
|
|
|
|
|
|
|
|
|
|

C'est une excellente suggestion. Vous visez exactement l'un des principes clés de votre cahier des charges : la **Pédagogie**. Rendre le calcul transparent et interactif est la meilleure façon pour un utilisateur de comprendre _pourquoi_ un statut est plus intéressant qu'un autre dans sa situation.

Transformer vos tableaux de synthèse statiques en "mini-calculatrices" interactives est une évolution majeure et très pertinente. Analysons comment intégrer cela dans votre architecture existante.

Voici une feuille de route technique complète pour implémenter cette fonctionnalité, en suivant votre exemple pour la Micro-Entreprise.

### Plan d'Action en 4 Étapes

1.  **Étape 1 : Enrichir le Moteur de Calcul (Back-end).** Les fonctions de calcul (`calculsAE.js`, etc.) doivent retourner non seulement les totaux, mais aussi toutes les valeurs intermédiaires nécessaires à l'affichage détaillé.
2.  **Étape 2 : Créer le Composant "Ligne Déroulante" (Front-end HTML/JS).** Mettre en place la logique HTML, CSS et JavaScript pour créer des lignes de tableau qui peuvent s'étendre et se réduire.
3.  **Étape 3 : Adapter les Vues de Synthèse (Front-end HTML/JS).** Mettre à jour la fonction `renderMicroTable` (et les autres) pour qu'elle génère ce nouveau HTML interactif.
4.  **Étape 4 : Styliser l'Accordéon de Tableau (Front-end CSS).** Assurer un rendu visuel clair et agréable pour les lignes parentes et enfants.

---

### Étape 1 : Enrichir le Moteur de Calcul

C'est le prérequis indispensable. Le front-end ne peut pas afficher des données qu'il ne reçoit pas.

#### a) Pour `src/calculsAE.js` (Micro-Entreprise)

La fonction `simulerMicroEntreprise` doit retourner une structure de données beaucoup plus riche.

```javascript
// EXEMPLE DE NOUVEL OBJET DE RETOUR pour simulerMicroEntreprise

return {
  // ...valeurs existantes...
  statut: "Micro-Entreprise",
  chiffreAffaires: totalCA,
  cotisationsSociales: Math.round(cotisationsSociales),
  revenuImposable: Math.round(revenuImposable),
  surcoutIR: Math.round(surcoutIR),
  netDansLaPoche: Math.round(netDansLaPoche),

  // --- AJOUTS POUR L'AFFICHAGE DÉTAILLÉ ---
  details: {
    cotisations: {
      total: Math.round(cotisationsSociales),
      details: [
        { label: `Vente BIC (${tauxCotisations.vente_bic * 100}%)`, montant: ca_vente * tauxCotisations.vente_bic },
        { label: `Services BIC (${tauxCotisations.services_bic * 100}%)`, montant: ca_services_bic * tauxCotisations.services_bic },
        { label: `Services BNC (${tauxCotisations.services_bnc_regime_general * 100}%)`, montant: ca_services_bnc * tauxCotisations.services_bnc_regime_general }
      ]
    },
    revenuApresCotisations: {
      total: Math.round(revenuNetApresCotisations),
      details: [
        // ... structure similaire
      ]
    },
    revenuImposable: {
      total: Math.round(revenuImposable),
      details: [
        { label: "Salaire", montant: autresRevenusImposablesFoyer },
        { label: `Vente (abattement ${config.microEntreprise.abattement.vente_bic * 100}%)`, montant: ca_imposable_vente },
        { label: `Services BIC (abattement ${config.microEntreprise.abattement.services_bic * 100}%)`, montant: ca_imposable_services_bic },
        { label: `Services BNC (abattement ${config.microEntreprise.abattement.services_bnc * 100}%)`, montant: ca_imposable_services_bnc }
      ]
    },
    // Le détail de l'IR est le plus complexe, voir point b)
    impot: detailsIR
  }
}
```

#### b) Pour `src/calculsIR.js` (le plus important)

Pour afficher le détail du calcul par tranche, la fonction `calculerIR` ne peut plus se contenter de retourner un simple nombre. Elle doit retourner un objet complet.

```javascript
// Dans src/calculsIR.js

function calculerIR({ revenuNetGlobalImposable, partsFiscales }) {
  if (revenuNetGlobalImposable <= 0 || !partsFiscales || partsFiscales <= 0) {
    return { total: 0, details: [] } // Retourner un objet vide
  }

  const revenuParPart = revenuNetGlobalImposable / partsFiscales
  const bareme = config.IR.bareme
  let impotsTotal = 0
  let revenuRestant = revenuParPart
  const detailsCalcul = []

  let plancherTranche = 0
  for (const tranche of bareme) {
    if (revenuRestant <= 0) break

    const plafondTranche = tranche.trancheJusqua === "Infinity" ? revenuParPart : tranche.trancheJusqua
    const baseCalculTranche = Math.min(revenuRestant, plafondTranche - plancherTranche)

    if (baseCalculTranche > 0) {
      const montantImpotTranche = baseCalculTranche * tranche.taux
      impotsTotal += montantImpotTranche
      detailsCalcul.push({
        tranche: `de ${plancherTranche.toLocaleString("fr-FR")}€ à ${plafondTranche.toLocaleString("fr-FR")}€`,
        taux: `${tranche.taux * 100}%`,
        base: baseCalculTranche,
        montant: montantImpotTranche
      })
    }

    revenuRestant -= baseCalculTranche
    plancherTranche = plafondTranche
  }

  const impotsFinal = impotsTotal * partsFiscales

  return {
    total: Math.round(Math.max(0, impotsFinal)),
    details: detailsCalcul,
    revenuParPart: revenuParPart
  }
}
```

Il faudra ensuite adapter l'appel à cette fonction dans tous les autres fichiers pour utiliser `calculerIR(...).total`.

---

### Étape 2 : Créer le Composant "Ligne Déroulante"

Cela se passera principalement dans le JavaScript qui génère le HTML et un peu de CSS.

**HTML Structure (à générer dynamiquement)**

La meilleure approche est d'utiliser des `<tbody>` pour regrouper chaque section déroulante. Cela maintient une structure de tableau sémantique.

```html
<!-- Exemple pour la ligne des Cotisations -->
<tbody class="expandable-section">
  <tr class="parent-row">
    <td>
      (-) Cotisations Sociales
      <button class="toggle-details-btn" data-target="details-cotis-ae">[+]</button>
    </td>
    <td>${formatCurrency(-res.details.cotisations.total)}</td>
  </tr>
  <tr class="child-row is-hidden" id="details-cotis-ae">
    <td colspan="2" class="details-cell">
      <ul>
        <!-- Les lignes de détail seront injectées ici par le JS -->
      </ul>
    </td>
  </tr>
</tbody>
```

**JavaScript (dans `ui/eventListeners.js` ou un nouveau module UI)**

Utilisez la délégation d'événement sur le conteneur du tableau pour gérer les clics.

```javascript
// À ajouter dans setupEventListeners()
document.querySelector(".tabs-content").addEventListener("click", event => {
  const button = event.target.closest(".toggle-details-btn")
  if (!button) return

  const targetId = button.dataset.target
  const childRow = document.getElementById(targetId)

  if (childRow) {
    childRow.classList.toggle("is-hidden")
    button.textContent = childRow.classList.contains("is-hidden") ? "[+]" : "[-]"
  }
})
```

---

### Étape 3 : Adapter les Vues de Synthèse

C'est ici que vous assemblez les données enrichies de l'Étape 1 avec le composant de l'Étape 2.

**Dans `ui/views/statusDetailView.js`**

La fonction `renderMicroTable` deviendra beaucoup plus complexe.

```javascript
function renderMicroTable(res, config) {
  // ...
  // Helper pour générer les listes de détails
  const generateDetailList = detailsArray => {
    return (
      "<ul>" +
      detailsArray
        .filter(d => d.montant > 0) // N'affiche que les lignes pertinentes
        .map(d => `<li><span>${d.label}</span><span>${formatCurrency(d.montant)}</span></li>`)
        .join("") +
      "</ul>"
    )
  }

  // Helper pour le détail de l'impôt
  const generateIRDetails = irDetails => {
    // ... logique pour boucler sur irDetails.details et afficher les tranches
  }

  return `
    <div class="table-container">
      <table class="details-summary-table">
        <!-- ... Lignes pour Salaires, CA, etc. ... -->
        
        <tbody class="expandable-section">
          <tr class="parent-row">
            <td>(-) Cotisations Sociales <button class="toggle-details-btn" data-target="details-cotis-ae">[+]</button></td>
            <td>${formatCurrency(-res.details.cotisations.total)}</td>
          </tr>
          <tr class="child-row is-hidden" id="details-cotis-ae">
            <td colspan="2" class="details-cell">${generateDetailList(res.details.cotisations.details)}</td>
          </tr>
        </tbody>

        <!-- ... tbody pour Revenu Imposable ... -->

        <tbody class="expandable-section">
          <tr class="parent-row">
            <td>(-) Impôt sur le Revenu <button class="toggle-details-btn" data-target="details-ir-ae">[+]</button></td>
            <td>${formatCurrency(-res.surcoutIR)}</td>
          </tr>
          <tr class="child-row is-hidden" id="details-ir-ae">
            <td colspan="2" class="details-cell">${generateIRDetails(res.details.impot)}</td>
          </tr>
        </tbody>

        <!-- ... Lignes finales ... -->
      </table>
    </div>`
}
```

---

### Étape 4 : Styliser l'Accordéon de Tableau

Ajoutez ces styles à votre fichier SCSS, par exemple dans `_results-table.scss`.

```scss
// Dans ui/scss/components/_results-table.scss

.details-summary-table {
  // ... styles existants ...

  .toggle-details-btn {
    margin-left: 8px;
    background-color: var(--header-bg-color);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    font-size: 0.9em;
    padding: 2px 6px;
  }

  .child-row.is-hidden {
    display: none;
  }

  .details-cell {
    padding: 1em 1.5em 1em 3em !important; // Indentation pour la clarté
    background-color: var(--bg-color);

    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    li {
      display: flex;
      justify-content: space-between;
      padding: 0.4em 0;
      border-bottom: 1px dashed var(--border-color);

      &:last-child {
        border-bottom: none;
      }
    }
  }
}
```

En suivant ces étapes, vous transformerez radicalement l'utilité et la clarté de votre simulateur, en passant d'un simple comparateur de résultats à un véritable outil pédagogique interactif. C'est un travail conséquent, mais la valeur ajoutée pour l'utilisateur final sera immense.

---

|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|

Et est-ce que le calcul de l'impot est fiable? Les % et les tranches varient en fonction du nombre de part c'est ça? On le prend en compte?
Autre point, toutes ces formules peuvent changer avec le temps, et les seuils de tranches aussi.
On a un moyen de régler ça dans le fichier config?

|
|
|
|
|
|
|
|
|
|
|
|
|

Excellentes questions ! Vous touchez ici aux deux piliers de votre projet : la **fiabilité** des calculs et la **maintenabilité** de l'application.

Analysons ces deux points en détail.

### 1. Fiabilité du Calcul de l'Impôt et Prise en Compte des Parts

Votre intuition est correcte, mais la mécanique fiscale est un peu différente de ce que vous décrivez.

C'est une subtilité souvent mal comprise du système fiscal français. En réalité, **les tranches et les pourcentages d'imposition (0%, 11%, 30%...) sont les mêmes pour tout le monde**, peu importe le nombre de parts.

Ce qui change, c'est la manière dont on applique ces tranches à votre revenu. Le système français utilise une méthode appelée le **"quotient familial"**. C'est une astuce mathématique très avantageuse qui consiste à :

1.  **Diviser** le revenu total imposable du foyer par le nombre de parts.
2.  **Calculer** l'impôt sur ce montant "réduit" en appliquant le barème standard.
3.  **Multiplier** le résultat de cet impôt par le nombre de parts pour obtenir l'impôt final.

**Le code de votre fichier `src/calculsIR.js` implémente cette logique parfaitement.** Il fait exactement ces trois étapes, ce qui le rend fiable.

- `const revenuParPart = revenuNetGlobalImposable / partsFiscales` (Étape 1)
- Les `if/else if` calculent l'impôt sur ce `revenuParPart` (Étape 2)
- `const impotsTotal = impotsPourUnePart * partsFiscales` (Étape 3)

**En résumé : oui, le calcul actuel est fiable et prend correctement en compte les parts fiscales, non pas en changeant les tranches, mais en "réduisant" le revenu qui leur est soumis.**

---

### 2. Gestion des Changements de Taux et de Seuils (config.json)

Vous mettez le doigt sur un point absolument essentiel à la maintenabilité de votre projet. La réponse est **oui, votre `config.json` est déjà parfaitement structuré pour ça, mais votre fonction `calculerIR.js` pourrait être rendue encore plus robuste.**

**État actuel :**

- **Ce qui est bien :** Votre `config.json` contient déjà le barème de l'impôt dans un format de tableau très propre.
  ```json
  "IR": {
    "bareme": [
      { "trancheJusqua": 11294, "taux": 0 },
      { "trancheJusqua": 28797, "taux": 0.11 },
      // etc.
    ]
  }
  ```
- **Ce qui peut être amélioré :** Votre fichier `src/calculsIR.js` utilise ce `config`, mais la logique de calcul elle-même est écrite "en dur" avec une série de `if/else if`. Si le gouvernement décidait d'ajouter une sixième tranche d'imposition, le code actuel ne fonctionnerait plus correctement et il faudrait ajouter un nouveau `else if`.

#### Proposition : Rendre `calculerIR.js` 100% piloté par la configuration

Nous pouvons refactoriser cette fonction pour qu'elle s'adapte dynamiquement à ce qui se trouve dans `config.json`, quel que soit le nombre de tranches. Elle lira le tableau `bareme` et appliquera les calculs en boucle.

Voici la version améliorée et "à l'épreuve du futur" de votre fonction :

**Fichier à modifier : `src/calculsIR.js`**

```javascript
// src/calculsIR.js - VERSION "DATA-DRIVEN"
const config = require("../config.json")

function calculerIR({ revenuNetGlobalImposable, partsFiscales }) {
  if (revenuNetGlobalImposable <= 0 || !partsFiscales || partsFiscales <= 0) {
    return 0
  }

  // 1. Calculer le revenu par part (inchangé)
  const revenuParPart = revenuNetGlobalImposable / partsFiscales

  // 2. Appliquer le barème de manière dynamique
  let impotsPourUnePart = 0
  let plancherTranchePrecedente = 0 // On commence à 0

  // On boucle sur chaque tranche définie dans le fichier de config
  for (const tranche of config.IR.bareme) {
    const plafondTrancheActuelle = tranche.trancheJusqua === "Infinity" ? Infinity : tranche.trancheJusqua

    // Si le revenu par part est dans ou au-dessus de cette tranche
    if (revenuParPart > plancherTranchePrecedente) {
      // On calcule la base imposable DANS CETTE TRANCHE SEULEMENT
      const baseImposableDansLaTranche = Math.min(revenuParPart - plancherTranchePrecedente, plafondTrancheActuelle - plancherTranchePrecedente)

      // On ajoute l'impôt calculé pour cette tranche au total
      impotsPourUnePart += baseImposableDansLaTranche * tranche.taux
    }

    // La tranche actuelle devient le plancher pour la suivante
    plancherTranchePrecedente = plafondTrancheActuelle
  }

  // 3. Remultiplier par le nombre de parts (inchangé)
  const impotsTotal = impotsPourUnePart * partsFiscales

  return Math.round(Math.max(0, impotsTotal))
}

module.exports = { calculerIR }
```

### Avantages de cette nouvelle version :

- **Maintenabilité Maximale :** Pour mettre à jour votre simulateur pour l'année 2026, vous n'aurez qu'à modifier les valeurs des seuils et des taux dans `config.json`. Le code JavaScript, lui, n'aura pas besoin d'être touché.
- **Robustesse :** Le calcul s'adaptera automatiquement si le nombre de tranches d'imposition change.
- **Clarté :** La logique est plus mathématique et moins dépendante d'une série de conditions statiques.

Je vous recommande vivement d'adopter cette nouvelle version de la fonction `calculerIR.js`. C'est un investissement minime en temps qui pérennise la fiabilité de votre simulateur pour les années à venir.
