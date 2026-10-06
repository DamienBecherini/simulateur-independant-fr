# Roadmap de Développement Détaillée v3.0

- **Dernière mise à jour :** 04/10/2026

## **État Actuel du Projet**

Le socle (graphe d'entités, grille visuelle, persistance validée par Zod), les tests automatisés avec intégration continue, le moteur de simulation par foyer fiscal, le comparateur de statuts et l'arbitrage rémunération / dividendes sont en place, avec une démo web publiée sur GitHub Pages. L'accessibilité (WCAG 2.2 AA) est vérifiée automatiquement. Les chiffres s'exportent en CSV, en PDF et en rapport Markdown. Les cotisations du président de SASU et des salariés sont calculées ligne à ligne. Une session couvre désormais plusieurs années, chacune avec ses règles, et le revenu fiscal de référence est reporté sur le versement libératoire. La suite de la phase 13 : bénéfice mis en réserve, flux récurrents, sortie du régime micro.

> **Changement d'ordre par rapport à la v2.2 :** le comparateur de statuts passe avant l'arbitrage rémunération / dividendes, et la gestion des foyers fiscaux est intégrée à la refonte du moteur.

### **Phase 1 & 2.5 : Socle Technique & UX de Base [Terminé ✅]**

- Logique de calcul, IPC, gestion des entités (CRUD, D&D), et système de sauvegarde/import/export sont en place.

---

### **Phase 3 : Les Fondations du Graphe [Terminé ✅]**

- Le modèle de données et l'interface utilisateur permettent de gérer un graphe d'entités et de relations (création, édition, suppression).

---

### **Phase 4 : Robustesse, Pérennité & Feedback Utilisateur [Terminé ✅]**

**Objectif :** Rendre l'application "pare-balles" en matière de gestion de données et améliorer la communication avec l'utilisateur.

1.  **Action 4.1 à 4.4 : Intégration de la validation Zod et des notifications :** [✅]
    - Intégration de **Zod** comme "source de vérité" pour tous les types de données, garantissant une cohérence parfaite entre le code et la structure des sauvegardes.
    - Mise en place d'un **"data sanitizer"** qui valide et répare automatiquement les fichiers importés ou chargés, assurant la pérennité des données de l'utilisateur sur le long terme.
    - Implémentation d'un système de **notifications** (toasts via "Sonner") pour informer l'utilisateur des actions en arrière-plan (sauvegarde réussie, import avec corrections, etc.).

---

### **Phase 5 : La Grille Visuelle Interactive [Terminé ✅]**

**Objectif :** Transformer la grille de saisie numérique en un tableau de bord visuel qui offre un aperçu instantané de la composition et de la comparaison des flux financiers pour chaque entité.

1.  **Action 5.1 à 5.4 : Implémentation de la Grille Visuelle :** [✅]
    - Le composant `CellChartDisplay` affiche des barres verticales pour les gains et dépenses.
    - L'échelle est unifiée par ligne d'entité pour permettre une comparaison visuelle juste.
    - La légende des flux (`FlowLegend`) est dynamique et assigne un numéro unique à chaque type de flux.
    - Les numéros de la légende sont reportés au-dessus des barres dans la grille pour une identification claire et accessible.

---

### **Phase 5.5 : Corrections & Améliorations de l'UX [Terminé ✅]**

- **Types de dépenses clarifiés :** `expense` (« Dépense (non déductible) ») pour les personnes et les micro-entreprises, `deductible_expense` réservé aux sociétés à l'IS.
- **Barres agrégées par type de flux** dans la grille : deux flux du même type dans un mois donnent une seule barre.
- **Sauvegarde « Écraser vs. Créer » :** renommer une session chargée crée une nouvelle sauvegarde au lieu d'écraser l'ancienne (`loadedSlotId`).

---

### **Phase 6 : Le Moteur de Méta-Simulation v1 [Terminé ✅]**

- `runMetaSimulation` (`src/backend/logic/simulation-engine.ts`) : agrégation annuelle des flux par entité, regroupement des foyers fiscaux (Union-Find sur les relations Marié(e) / PACSé(e), demi-parts des enfants), routage de la rémunération du dirigeant vers la personne liée, appel des modules SASU / EURL / micro-entreprise, impôt sur le revenu par foyer.
- `ResultsPanel` : résultats par entité et synthèse par foyer, avec avertissements explicites.
- **Limites de cette v1** (corrigées en Phase 7) : l'impôt sur le revenu est estimé à la fois dans chaque module d'activité et au niveau du foyer ; les dividendes saisis dans la grille sont ignorés (100 % du bénéfice est supposé distribué) ; le capital social des EURL n'est pas saisi.

---

### **Phase 6.5 : Qualité & Intégration Continue [Terminé ✅]**

**Objectif :** pouvoir modifier le moteur sans régression.

1.  **Tests unitaires (Vitest)** sur les modules de calcul, le moteur, le sanitizer et la logique de graphe.
2.  **Garde-fous :** seuil de couverture bloquant, plafond de complexité par fonction (ESLint), tests de mutation (Stryker) sur le moteur.
3.  **GitHub Actions :** lint, vérification des types, tests et build à chaque push.

---

### **Phase 6.6 : Saisie Rapide des Flux [Terminé ✅]**

**Objectif :** réduire le nombre de clics pour saisir et corriger des flux.

1.  **Édition en ligne :** chaque flux se modifie directement dans la liste du mois (type, libellé, montant) ; une ligne vide en bas permet d'ajouter ; saisie enchaînée au clavier. La seconde fenêtre d'édition disparaît.
2.  **Libellés de flux centralisés** dans `src/lib/flow-constants.ts`.
3.  **Part du net dans le CA** affichée pour chaque activité dans les résultats.

---

### **Phase 7 : Refonte du Moteur — Un Calcul Unique par Foyer [Terminé ✅]**

**Objectif :** des résultats cohérents entre eux, avec un vrai « net du foyer après impôts ». Intègre l'ancienne Phase 8 (couples et foyers fiscaux).

- **Chaîne de calcul en un seul sens :** les activités produisent des revenus (rémunération, dividendes, bénéfices) → ces revenus sont versés aux personnes → l'impôt sur le revenu est calculé **une seule fois** par foyer. Les modules SASU / EURL / micro / EI ne calculent plus d'impôt sur le revenu.
- **Dividendes :** seuls les dividendes saisis dans la grille sont distribués (plafonnés au bénéfice disponible), le reste est conservé dans la société ; imposition au forfait ou au barème, selon le plus favorable ; pour l'EURL, cotisations sociales au-delà de 10 % du capital social (nouveau champ).
- **Impôt sur le revenu :** barème entièrement lu depuis `config.json`, abattement de 10 % sur les salaires, plafonnement du quotient familial, décote, parts des enfants selon leur rang.
- **Foyers :** les enfants sont rattachés au foyer de leurs parents (la relation « Enfant » va du parent vers l'enfant).
- **Entreprise individuelle au réel :** nouveau statut d'activité, branché sur le moteur.
- **Règles 2026 :** barèmes et taux mis à jour et sourcés (service-public, impots.gouv).
- **Résultats :** net après impôts par foyer, détail par activité, recalcul automatique à chaque modification.
- **Robustesse :** le chargement écarte les éléments invalides un par un au lieu de réinitialiser la session ; identifiants uniques (UUID).

**Ajouté ensuite :** le versionnage des sauvegardes prévu au cahier des charges (voir « Travaux transverses »).

---

### **Phase 8 : Le Comparateur Stratégique [Terminé ✅]**

- **Comparateur de statuts :** l'activité choisie est simulée en SASU, EURL, EI au réel et micro-entreprise (avec et sans versement libératoire), le reste de la simulation restant identique. Tableau : net dans la poche, taux global de prélèvement, détail des prélèvements, bénéfice conservé, écart avec le statut actuel, meilleur net mis en évidence.
- **Conversion des flux :** chiffre d'affaires par nature, charges déductibles en société et en EI mais pas en micro, part BNC des prestations réglable quand une société devient une micro ; une micro mêlant vente, BIC et BNC garde sa répartition.
- **Réglages des colonnes SASU et EURL :** rémunération nette, et versement de tout le bénéfice disponible en dividendes (par défaut si aucun dividende n'est saisi).
- **Versement libératoire :** seuil de revenu fiscal de référence N-2 proportionnel aux parts du foyer ; au-delà, l'option est refusée et l'impôt calculé au barème.
- **Couples :** relation « En couple (union libre) », et comparaison de l'impôt avec une imposition commune (mariage ou PACS).
- **Frais de fonctionnement :** expert-comptable, banque, logiciel, assurance RC Pro et CFE par statut, détaillés et modifiables.
- **Cotisations minimales des indépendants** (1 255 € en 2026, dues même sans revenu) appliquées au gérant d'EURL et à l'EI au réel, dans tout le moteur.
- **Protection sociale :** note sur 5 étoiles par statut, avec les trimestres de retraite validés (seuils officiels 2026).

---

### **Phase 9 : L'Optimisation Visuelle (Rémunération / Dividendes) [Terminé ✅]**

- **Objectif :** arbitrage interactif entre rémunération et dividendes pour les sociétés à l'IS, intégré au comparateur.
- **Moteur :** pour l'activité comparée, en SASU ou en EURL, chaque rémunération nette de zéro à ce que la société peut verser (trouvée par dichotomie), le reste du bénéfice étant versé en dividendes, puis toute la simulation relancée. Grille d'une soixantaine de points, affinée à 100 € près autour des optimums ; une quinzaine de millisecondes.
- **Deux optimums :** le meilleur net du foyer, et le meilleur net parmi les rémunérations qui valident 4 trimestres de retraite, avec ce qu'il coûte par an. En SASU, le meilleur net est souvent sans salaire, donc sans retraite : le second optimum rend l'arbitrage visible.
- **Interface :** courbe du net selon la rémunération (zone sans 4 trimestres, rémunération du comparateur, optimums annotés), survol au pointeur et au clavier, tableau des valeurs, report d'une rémunération dans le comparateur en un clic.

---

### **Phase 10 : Accessibilité (RGAA / WCAG 2.2 AA) [Terminé ✅]**

- **Objectif :** une application utilisable par tous, sur ordinateur comme sur téléphone, vérifiée automatiquement. Le RGAA reprend les WCAG 2.1 AA ; on vise les WCAG 2.2 AA, qui les incluent.

1.  **Audit automatique en CI :** axe-core (`@axe-core/playwright`) sur la démo web et l'application, dans les tests de bout en bout ; la CI échoue en cas de violation. Couvre les contrastes (4,5:1 pour le texte, 3:1 pour les grands textes et les éléments d'interface), les libellés, les rôles ARIA et la structure des titres.
2.  **Zones cliquables :** au moins 24 × 24 px (WCAG 2.2, critère 2.5.8), 44 × 44 px visés sur téléphone pour éviter les erreurs de clic ; espacement entre les boutons voisins (croix de suppression des relations, icônes de la barre du haut, cellules de la grille).
3.  **Taille du texte :** pas de texte sous 12 px, 14 px pour le texte courant ; vérification par un test. Tout reste utilisable avec le texte agrandi à 200 % (critère 1.4.4).
4.  **Clavier et focus :** tout le parcours au clavier (grille, fenêtres, glisser-déposer avec une alternative), focus toujours visible, ordre de tabulation logique.
5.  **Préférences du système :** animations réduites (`prefers-reduced-motion`), contrastes renforcés (`forced-colors`).
6.  **Curseur :** main sur tout élément cliquable, « interdit » sur les éléments désactivés.

- **Réalisé :** audit axe-core (WCAG 2.2 AA) de la démo web dans plusieurs états (chargement, comparateur déplié, mode sombre, téléphone, les six fenêtres) et de l'application de bureau, bloquant en CI ; contrastes corrigés (gris, rouge, montants de la grille, initiales des avatars choisies en blanc ou en foncé selon la couleur) ; zones cliquables d'au moins 24 px, 44 px sur écran tactile ; textes d'au moins 12 px, 14 px pour les phrases ; lien d'évitement, focus visible partout, réorganisation des listes au clavier (Espace, flèches, Espace) avec annonces en français ; animations réduites et mode contraste élevé de Windows. Tests dédiés : `e2e-web/accessibilite`, `cibles`, `textes`, `clavier` et `curseurs`.

---

### **Phase 11 : Exports [Terminé ✅]**

- **Objectif :** présenter les chiffres, les transmettre à un expert-comptable ou les faire analyser par une IA.

1.  **CSV :** grille mensuelle, résultats par activité et par foyer, tableau du comparateur et courbe rémunération / dividendes ; séparateur et décimales à la française, lisibles directement par Excel ou LibreOffice.
2.  **PDF :** feuille de style d'impression (sans barre d'outils ni boutons, tableaux sur des pages entières), puis `printToPDF` dans Electron et « Imprimer en PDF » dans le navigateur.
3.  **Rapport pour une IA :** Markdown structuré (hypothèses, règles de l'année, acteurs et relations, montants par activité et par foyer, comparaison des statuts, avertissements), plus lisible pour un modèle de langage qu'un export XML ; le JSON complet reste disponible.
4.  **Toutes les sauvegardes :** export et import de l'ensemble des sauvegardes nommées en un seul fichier (aujourd'hui, seule la simulation en cours s'exporte).
5.  **XLSX (optionnel) :** seulement avec une bibliothèque sans failles connues ; le CSV couvre l'essentiel. Non fait.

- **Réalisé :** fenêtre « Exporter » regroupant les formats ; CSV de la grille, des résultats, du comparateur et de la courbe rémunération / dividendes (séparateur « ; », virgule décimale, BOM pour Excel, protection contre l'injection de formules) ; rapport Markdown complet ; PDF A4 en thème clair (barre d'outils et boutons masqués, sections dépliées, en-tête et numéros de page) ; export et import de toutes les sauvegardes dans un fichier versionné, sans jamais écraser (doublons ignorés, conflits importés en copie « (importée) »), avec bilan. Les sauvegardes sont validées avant écriture, dans l'application comme dans la démo.

---

### **Phase 12 : Cotisations du président de SASU et statut de salarié [Terminé ✅]**

- **Objectif :** des rémunérations en société calculées comme sur un bulletin de paie, et le cas du conjoint salarié de la société.

1.  **Président de SASU ligne à ligne :** remplacer le ratio moyen (coût total = 1,8 fois le net) par les cotisations salariales et patronales d'un assimilé salarié : taux et assiettes (plafonnée au PASS ou non), tranches 1 et 2 de la retraite complémentaire, taux réduits maladie et allocations familiales pour les rémunérations modestes (à confirmer pour un mandataire social), sans assurance chômage ni réduction générale des cotisations patronales. Brut retrouvé par dichotomie à partir du net, comme pour l'EURL ; cas de référence dérivés des barèmes Urssaf. Rend plus juste l'arbitrage rémunération / dividendes, surtout pour les petites rémunérations.
2.  **Relation « Salarié de » :** une personne salariée d'une société de la simulation (par exemple le conjoint du président), avec le coût employeur complet : cotisations patronales, assurance chômage, et réduction générale dégressive des cotisations patronales (paramètres 2026 à vérifier sur l'Urssaf). Avertissement sur les conditions (lien de subordination réel, pas de gérance de fait). L'allocation chômage elle-même n'est pas modélisée.

- **Réalisé :** taux 2026 du régime général sourcés (Urssaf, Agirc-Arrco, Légifrance) et calculés ligne à ligne ; les taux réduits maladie et allocations familiales ont été supprimés au 1er janvier 2026 (LFSS 2025), la question de leur application au président ne se pose donc plus. Président : sans chômage, AGS, APEC ni réduction générale, affilié cadre ; brut retrouvé par dichotomie à partir du net ; trimestres comptés sur le vrai brut (seuil de 4 trimestres : 7 212 € bruts, soit 5 709 € nets, 5 800 € à la centaine dans l'optimiseur). Relation « Salarié » : le salaire reste saisi en net sur la personne, l'activité supporte le coût employeur (brut, cotisations patronales, réduction générale dégressive unique 2026 déduite) ; non proposée pour une micro-entreprise. Cas de référence dérivés à la main (président à 5 700, 30 000 et 60 000 € nets ; salarié au SMIC, à 1,6 et 2,5 SMIC). **À confirmer :** le gel du SMIC à 12,02 € pour toute l'année 2026, trouvé dans une seule source secondaire.

---

### **Phase 13 : Plusieurs années [En cours 🚧]**

- **Objectif :** simuler et comparer plusieurs années qui s'enchaînent.

1.  **Modèle de données [✅] :** une session contient plusieurs années consécutives (`annees`, ADR 008) ; acteurs et relations communs à toutes les années pour l'instant ; format de fichier 3, avec migration des formats 1 et 2 (la grille existante est placée en 2026, l'original est copié à côté) ; sélecteur d'année, ajout d'une année (copie de la voisine ou vide) et suppression d'une année d'extrémité.
2.  **Règles par année [✅] :** règles 2024 et 2025 collectées et sourcées (`src/backend/regles/`), 2026 dans `config.json`, convention d'année acceptée (ADR 007) ; chaque année est simulée avec ses propres règles. Après 2026, les dernières règles connues sont reprises avec un avertissement (revalorisations manquantes) ; avant 2024, l'année est refusée, faute de règles fiables. **Reste :** étendre le format pour ce que les règles d'avant 2026 approchent (cotisations des indépendants de 2024, taux réduits maladie 7 % et allocations familiales 3,45 % des salariés, réduction Fillon bâtie sur ces taux, changements en cours d'année), et déplacer `config.json` dans `regles/2026.json`.
3.  **Revenu fiscal de référence [✅] :** calculé pour chaque foyer et chaque année (article 1417 IV du CGI : revenu imposable au barème, dividendes au prélèvement forfaitaire ou abattement de 40 % réintégré, chiffre d'affaires micro après abattement sous versement libératoire) ; le versement libératoire de l'année N vérifie celui de N-2 quand cette année est dans la session, sinon celui saisi. Non calculables, faute de saisie : revenus exonérés, épargne salariale, plus-values, intérêts, déductions PER.
4.  **Bénéfice mis en réserve [À faire] :** le résultat conservé d'une société est reporté sur l'année suivante et peut être distribué plus tard ; arbitrage des dividendes entre les années.
5.  **Flux récurrents :** un flux défini une fois pour plusieurs mois ou années (« 800 € par mois de janvier à décembre »), modifiable en une fois, avec une règle claire quand on change un seul mois d'une série. Aujourd'hui, la grille recopie le flux sur les mois choisis : les copies sont indépendantes.
6.  **Dispositifs limités dans le temps [✅] :** date de création (mois et année) d'une micro-entreprise ou d'une société ; ACRE d'une micro-entreprise du mois de création à la fin du 3e trimestre civil suivant, mois par mois d'après la grille, à 50 % ou à 25 % pour une création depuis le 1er juillet 2026 (décret n° 2026-69) ; CFE du comparateur exonérée l'année de création et réduite de moitié l'année suivante (article 1478 II du CGI). Sans date de création, rien ne change. **Reste :** ACRE des indépendants hors micro et des dirigeants de société, exonération de CFE sous 5 000 € de chiffre d'affaires, franchise de TVA au prorata l'année de création, cotisations provisionnelles des premières années.
7.  **Sortie du régime micro [✅] :** deux années de suite au-delà des plafonds en vigueur l'année suivante (au prorata des jours d'activité l'année de création) font passer l'activité au réel au 1er janvier suivant (F32353) : elle y est simulée en EI au réel, annoncée sur sa carte, dans la synthèse des années, le comparateur (colonnes micro « plus accessibles ») et les exports ; retour au régime micro après une année sous les plafonds ; case « au-delà des plafonds l'année d'avant la simulation ».
8.  **Partage du bénéfice des sociétés [✅] :** dans le comparateur, quatre modes (rémunération saisie et dividendes, tout en rémunération, répartition personnalisée, dividendes de la grille) ; barre empilée exacte du bénéfice avant rémunération (rémunération nette, cotisations, IS, dividendes, cotisations sur dividendes, réserves) avec poignées glissables à la souris, au doigt et au clavier, répartitions toutes faites, exports.
9.  **Comparateur au meilleur net [✅] :** mode par défaut, chaque statut de société (SASU, EURL) avec sa propre rémunération optimale et tout le reste en dividendes, option « avec 4 trimestres de retraite » ; un seul calcul partagé avec « Rémunération ou dividendes ? ».
10. **Saisie sur plusieurs années depuis la grille [✅] :** cases « Aussi en » dans la fenêtre des flux ; ajout, modification et suppression d'une série appliqués aux mêmes mois des années cochées (même portée, mêmes mois du calendrier), sans doublon, en une seule étape d'annulation, avec une notification détaillée par année. La recopie jusqu'en décembre reste limitée à l'année affichée.
11. **Dix années au plus [✅] :** dix années consécutives au plus par session (au-delà, les chiffres ne sont plus qu'une projection) ; les fichiers aux années trop nombreuses ou non consécutives sont refusés en nommant les années manquantes, une année en double écartée est signalée (addendum à l'ADR 008) ; raccourcis « Toutes, Aucune, Années précédentes, Années suivantes » dans la fenêtre des flux, synthèse des années à colonne fixe.
12. **Réglages du comparateur enregistrés [✅] :** activité comparée, partage du bénéfice, rémunération saisie par année, part BNC, frais de fonctionnement et statut étudié, enregistrés avec la session : rechargement, sauvegardes, exports, imports et rapport Markdown ; hors de l'historique d'annulation (ADR 009). Le nom de la simulation suit désormais l'export et l'import. Un test vérifie que rien ne se perd d'une session qui remplit chaque champ du schéma, par tous les chemins d'enregistrement.
13. **Préférences retenues [✅] :** d'une ouverture à l'autre, la sauvegarde chargée (« Sauvegarder » la met à jour), le zoom et les sections repliées ; préférences validées champ par champ dans l'application de bureau ; version de l'application écrite dans chaque fichier et indiquée à l'import.
14. **Exports complets [✅] :** frais réels par personne (déduction retenue, trajets, montant au barème par voiture, autres frais), déplacements professionnels, revenu fiscal de référence par foyer et contrôle du versement libératoire dans les résultats CSV et le rapport Markdown ; synthèse des années dans le rapport et en CSV.
15. **Plus tard :** acteurs et relations propres à chaque année, optimisation sur plusieurs années.

---

### **Phase 13 bis : Frais professionnels et frais réels [En cours 🚧, points 1 à 3 ✅]**

- **Objectif :** que le comparateur tienne compte des vrais frais, et dise quand le réel l'emporte sur les forfaits (abattement de la micro, déduction de 10 % sur les salaires).

1.  **Barème kilométrique par année [✅] :** barème des voitures pour les revenus 2024, 2025 et 2026 (inchangé depuis l'arrêté du 27 mars 2023 ; celui des revenus 2026, publié au printemps 2027, est en attendant celui de 2025), selon la puissance fiscale et les tranches de kilométrage, majoré de 20 % pour un véhicule électrique, avec sa source. Non modélisés : deux-roues, péages et stationnement (déductibles en plus du barème).
2.  **Frais réels sur salaire [✅] :** sur une personne, trajets domicile-travail (un aller-retour par jour, 40 km au plus par trajet sauf distance justifiée) et autres frais réels ; le moteur retient le plus favorable entre la déduction de 10 % et les frais réels, sur les salaires, l'allocation chômage et les rémunérations de dirigeant, et l'indique dans les résultats. Jamais au-delà de ces revenus (pas de déficit). Réglages communs à toutes les années.
3.  **Déplacements professionnels d'une activité [✅] :** kilomètres de l'année et véhicule, au barème de l'année : dépense non déductible en micro, charge déductible en EI et en société (indemnités kilométriques remboursées au dirigeant, sans impôt ni cotisations pour lui) ; le comparateur applique la conversion à chaque statut. **Reste :** frais réels et kilométrage dans les exports CSV et Markdown, réglages par année, second aller-retour quotidien pour les repas.
4.  **Plusieurs trajets par personne [✅] :** un trajet domicile-travail par lieu de travail (plusieurs employeurs, salaire et rémunération de dirigeant), limite de 40 km par trajet, kilomètres additionnés par voiture (même puissance, même motorisation) avant le barème, un seul choix entre déduction de 10 % et frais réels par personne. Les anciennes sauvegardes sont converties.
5.  **Voiture de société [À faire] :** pas de barème kilométrique ; ses frais sont des charges de la société et l'usage privé un avantage en nature imposable chez le salarié ou le dirigeant.
6.  **Catégories de charges (plus tard) :** loyer, énergie, bureau à domicile au prorata, repas (part au-delà du repas à domicile, dans la limite d'un plafond), matériel amorti sur plusieurs années, abonnements, tenues spécifiques, avec leurs règles.

---

### **Phase 13 ter : Moins d'informations à l'écran [En cours 🚧]**

- **Objectif :** n'afficher par défaut que ce qui répond à la question de l'utilisateur, et atteindre le reste en un ou deux clics. L'écran est aujourd'hui une longue page : acteurs, grille, légende, résultats du foyer, synthèse des années, puis le comparateur (réglages, partage du bénéfice, tableau, notes, rémunération ou dividendes). Chaque phase y a ajouté un panneau.
- **À faire avant la phase 14 :** les montages types ajouteront encore du contenu.

1.  **Inventaire :** lister chaque information affichée et la classer : essentielle, fréquente, occasionnelle, experte. Repérer les doublons (une même donnée à plusieurs endroits) et ce qui pourrait n'apparaître qu'au survol ou à la sélection.
2.  **Parcours types et nombre de clics :** trois ou quatre questions réelles (« je suis en micro, ai-je intérêt à passer en société ? », « quelle rémunération me verser en SASU ? », « que donnent les trois prochaines années ? », « je prépare mon rendez-vous avec l'expert-comptable »), avec le nombre de clics et de défilements avant et après la refonte.
3.  **Pistes à évaluer :**
    - **Résumé toujours visible :** une barre de quelques chiffres clés (net du foyer, taux de prélèvement, meilleur statut, alertes), recalculée en direct ; chaque chiffre mène à son détail.
    - **Divulgation progressive :** dans chaque panneau, le chiffre qui compte d'abord, le détail replié ; dans le comparateur, la ligne « Net dans la poche » et le meilleur statut, les autres lignes et notes sur demande ; la barre de partage réduite à une ligne hors répartition personnalisée.
    - **Vues ou étapes :** « Ma situation » (acteurs, grille), « Mes résultats » (foyer, années), « Comparer et optimiser », sans perdre le lien direct entre une saisie et son effet (le résumé reste visible).
    - **Détails contextuels :** les réglages et résultats d'un acteur dans un panneau latéral à sa sélection plutôt qu'en permanence ; la légende de la grille au survol ou repliée.
    - **Mémoire de l'affichage :** sections ouvertes ou fermées retenues, liens d'ancrage, raccourcis clavier.
4.  **Maquettes et essais :** deux ou trois maquettes basse fidélité, essayées par quelques personnes sur les parcours types avant de coder.
5.  **Étude [✅] :** inventaire, parcours mesurés et trois propositions dans `docs/conception/allegement-ecran.md` (page actuelle : 6,5 écrans sur ordinateur, 11 sur téléphone).
6.  **Quatre affichages au choix pendant la bêta :** l'affichage d'origine et les trois propositions (A : résumé collant et divulgation progressive ; C : A plus un panneau latéral par acteur ; B : trois vues), à choisir dans la barre du haut et retenus pour chaque utilisateur, pour les faire essayer et recueillir des avis avant d'en garder un. Ordre de réalisation : A, puis C, puis B. **Fait :** sélecteur « Affichage » dans la barre d'outils, retenu dans les préférences ; affichage « Résumé » (A) : barre de résumé collante, détail replié, verdict du comparateur et cartes par statut sur téléphone (page de 5 888 à 3 614 px sur ordinateur, de 9 349 à 5 717 px sur téléphone) ; l'écart entre le net du bilan et celui du comparateur (frais de fonctionnement supposés) est expliqué dans les deux affichages. Affichage « Panneaux » (C) : acteurs en liste courte, panneau latéral par acteur (réglages appliqués à mesure, carte de résultats, « Comparer ses statuts »), en bas de l'écran sur téléphone (page de 3 380 px sur ordinateur, 4 991 px sur téléphone). Affichage « Trois vues » (B) : résumé et détail replié de A, page partagée en trois vues à onglets (Ma situation, Mes résultats, Comparer et optimiser), chacune avec son adresse (#situation, #resultats, #comparer : retour arrière, liens du résumé et rechargement retrouvent la vue), les trois vues imprimées à la suite (vue la plus longue : 1 967 px sur ordinateur, 2 944 px sur téléphone). **Après essai :** l'affichage « Panneaux » (C) est retiré par le product owner et « Résumé » (A) devient l'affichage par défaut ; « Classique » et « Trois vues » restent proposés (voir docs/conception/allegement-ecran.md). **Reste :** recueillir les avis (phase 13 quater) et choisir l'affichage à garder.
7.  **Détail et réglages [✅] :** un clic sur « Afficher le détail » ouvre ou ferme le détail de tous les foyers, ou de toutes les activités, sans perdre sa place dans la page ; réglages essentiels du comparateur toujours visibles et serrés ; au meilleur net, 4 trimestres de retraite exigés par défaut, avec leur coût en net affiché par statut et dans les exports ; sections repliées retenues d'une ouverture à l'autre.
8.  **Réglages du comparateur sur une ligne [✅] :** les cinq modes de partage (Meilleur net, Ma rémunération, Tout en rémunération, Sur mesure, Selon la grille) sur la ligne de l'activité avec la phrase du mode choisi, un curseur de rémunération borné au maximum sans déficit du statut étudié (une valeur plus haute reste possible au clavier), frais de fonctionnement et part BNC à un seul clic.
9.  **Garde-fous :** accessibilité inchangée (tests axe, clavier, tailles des cibles), impression et PDF qui déplient tout, tests de bout en bout adaptés aux nouveaux chemins.

---

### **Phase 13 quater : Retours des utilisateurs [En cours 🚧, étape 1 ✅]**

- **Objectif :** pendant la bêta, recueillir notes, avis et rapports de bug depuis l'application, et les retrouver sur GitHub sans ressaisie.

1.  **Formulaire dans l'application :** noter l'application (1 à 5), dire quel affichage on préfère (classique, A, B ou C), écrire un commentaire, signaler un bug ou proposer une idée. **Tout est facultatif**, mais il faut au moins une information pour pouvoir envoyer ; joindre si on le souhaite un diagnostic (version, système, affichage choisi, dernières erreurs), jamais les données de la simulation sans accord explicite. Rien n'est envoyé sans clic sur « Envoyer », avec un aperçu du contenu.
2.  **Sans serveur, d'abord :** le bouton ouvre un ticket GitHub prérempli (formulaires de tickets du dépôt : bug, idée, avis avec note), sur le compte GitHub de la personne. Aucun secret dans l'application ni dans la démo. **Fait :** bouton « Donner mon avis » (note, affichage préféré, avis, bug ou idée, message, diagnostic facultatif sans aucune donnée de la simulation, aperçu du texte envoyé, version toujours jointe) ; envoi par ticket GitHub prérempli (formulaire `retour.yml`, message public) ou par e-mail prérempli à simulateur-independant@damien.becherini.fr, ou copie du message ; étiquettes posées par un workflow ; note moyenne (une voix par compte, tickets `invalide` et `spam` écartés) publiée avec la démo dans `retours.json` et affichée par un badge du README.
3.  **Sans compte GitHub, ensuite :** un petit relais (fonction serverless) qui garde seul le jeton d'une application GitHub et crée le ticket ou la discussion avec ses étiquettes ; protection contre le spam (défi anti-robot, limite de débit), aucune donnée personnelle conservée, mention RGPD.
4.  **Note moyenne dans le README :** une GitHub Action agrège les notes des tickets qui en ont une (les retours sans note sont ignorés dans la moyenne, et le nombre de notes est affiché avec elle), ainsi que les préférences d'affichage exprimées, et publie un badge (fichier JSON servi par GitHub Pages, lu par shields.io) : le README affiche la note sans commit automatique sur main.
5.  **Tri :** étiquettes automatiques (bug, idée, avis, affichage A, B, C ou d'origine), modèle de réponse, lien entre un ticket et sa correction.

---

### **Phase 14 : Montages types [Terminé ✅, sauf la recherche automatique]**

- **Objectif :** partir d'une situation courante plutôt que d'une page vide. Peut s'intercaler entre deux autres phases.

1.  **Bibliothèque de montages [✅] :** huit montages types (micro-entreprise seule, SASU sans salaire, SASU avec un salaire qui valide 4 trimestres, EURL à l'IS, salarié avec une micro-entreprise, micro-entreprise et SASU du conjoint, conjoint salarié de la SASU, couple en union libre), chargés depuis les paramètres ou une simulation vide, avec confirmation avant de remplacer une simulation non enregistrée ; leurs chiffres 2026 sont figés par un test de référence. L'EURL à l'IR est approchée par l'EI au réel du comparateur.
2.  **Explication [✅] :** pour chaque montage, ce qu'il illustre, ses conditions, ses risques et ses sources officielles.
3.  **Plus tard :** recherche automatique d'une meilleure structure, en s'appuyant sur le comparateur et l'optimiseur.

---

### **Phase 15 : Scénarios Avancés & Finalisation [Planifié 🗓️]**

- **Objectif :** compléter le modèle pour les situations moins courantes, puis distribuer l'application.

1.  **Prorata temporis :** activité démarrée en cours d'année.
2.  **ACRE :** distinguer la réduction de 50 % et celle de 25 % (micro-entreprises créées à partir du 01/07/2026).
3.  **Répartition du capital :** part de chaque associé dans une société à plusieurs associés. Aujourd'hui, les dividendes, l'impôt sur les sociétés et le bénéfice conservé sont partagés à parts égales.
4.  **Compte courant d'associé :** solde par société, flux d'apport et de remboursement (non imposés), intérêts versés (déductibles pour la société dans une limite, imposés chez l'associé), et prise en compte du solde dans le seuil des 10 % du capital des EURL.
5.  **Enfants et foyers :**
    - **Date de naissance :** sur la personne, pour connaître son âge chaque année de la session. Mineur, majeur de moins de 21 ans (25 ans s'il est étudiant), naissance dans l'année (comptée pour l'année entière), garde des moins de 6 ans (crédit d'impôt).
    - **Parents non mariés :** choisir le parent de rattachement, ou la résidence alternée (la moitié des parts de l'enfant à chaque parent). Aujourd'hui, l'enfant est rattaché au premier parent trouvé, avec un avertissement.
    - **Parent isolé (case T) :** case « vit seul(e) avec ses enfants » sur la personne, demi-part supplémentaire avec son plafond propre. Elle ne se déduit pas des relations : sans relation de couple, rien ne dit que la personne vit seule.
    - **Enfant qui a des revenus :** majeur, rattaché (ses revenus s'ajoutent au foyer, avec sa part) ou déclarant seul (les parents peuvent déduire une pension alimentaire, plafonnée) ; mineur, imposé avec ses parents, sauf revenus de son propre travail (imposition distincte possible) ; exonération des salaires des étudiants de moins de 26 ans dans une limite.
    - **Comparateur :** pour chaque enfant concerné, rattachement le plus avantageux (à quel parent, ou déclaration séparée avec pension) et gain total des foyers.
6.  **Distribution [✅ en grande partie] :** exécutables Windows (installateur et zip), macOS (Apple Silicon et Intel) et Linux (AppImage et deb), construits par le workflow « Publication des exécutables » à chaque étiquette `vX.Y.Z` et déposés dans un brouillon de version GitHub ; guide d'installation et CHANGELOG. **Reste :** première publication, signature du code (avertissements SmartScreen et Gatekeeper), test de bout en bout de l'application packagée.

---

### **Phase 16 : Travailler avec une IA [Planifié 🗓️]**

- **Objectif :** qu'une IA puisse remplir la simulation à partir d'un cahier de comptes ou de factures, l'interroger et en analyser les résultats, en se servant du simulateur comme d'un outil plutôt qu'en calculant elle-même.

1.  **Couche d'outils commune :** une quinzaine de fonctions documentées et validées par Zod (décrire la simulation, proposer des flux, appliquer une proposition, simuler, comparer les statuts, optimiser la rémunération, expliquer un résultat), dont les schémas JSON sont générés depuis Zod. Seule source de vérité pour le serveur MCP et l'assistant intégré.
2.  **Serveur MCP local, pour l'application de bureau :** utilisable depuis un client d'IA de bureau (Claude Desktop, Claude Code, ou un client d'IA locale comme LM Studio) qui lit lui-même les factures et les relevés ; il travaille sur les fichiers de la simulation, que l'application recharge. Aucun serveur à héberger.
3.  **Assistant intégré, pour la démo web (donc aussi sur téléphone) et l'application :** fenêtre de discussion, dépôt de fichiers (PDF, images, CSV), mêmes outils exécutés dans la page ; fournisseur au choix : Anthropic, ou toute adresse compatible OpenAI, IA locale comprise (Ollama sur `localhost`), pour un assistant entièrement local. Clé chiffrée par le système dans l'application de bureau, gardée en mémoire seulement dans la démo. Aucune donnée ne passe par un serveur du projet.
4.  **Serveur MCP distant, seulement si le besoin apparaît :** les mêmes outils sur un service web, la simulation passée en paramètre (aucun stockage), avec authentification et limite de débit, pour les clients d'IA sur téléphone ou sur le web.
5.  **Règles :**
    - **Les chiffres viennent du moteur, jamais de l'IA.**
    - **L'IA propose, l'utilisateur valide :** chaque modification est présentée à relire (« Appliquer ces 24 flux ? ») et s'annule en une étape.
    - **Méfiance envers les documents :** une facture peut contenir des instructions piégées ; les outils sont limités (pas de suppression en masse, rien hors de la simulation) et toujours soumis à validation.
    - **Confidentialité :** l'utilisateur est prévenu que ses données partent chez le fournisseur d'IA choisi, et une IA locale lui est recommandée pour les données sensibles (avec ses limites : les petits modèles enchaînent moins bien les outils et lisent moins bien les factures scannées) ; option d'anonymisation des noms.
    - **Avertissement :** ce n'est pas l'avis d'un expert-comptable.
6.  **Mentions légales et confidentialité [✅] :** page dans l'application et la démo (pied de page, paramètres, adresse `#mentions-legales`) et en Markdown, tirées d'une même source : éditeur (particulier, art. 1-1 II de la LCEN), hébergeur, données gardées dans le navigateur ou sur la machine, aucun cookie ni traceur, ce qui sort et quand (retours), avertissement, licence.
7.  **Sans IA, en complément :** import CSV de relevés bancaires ou du livre de recettes, avec des règles de classement ; l'IA ne sert qu'aux lignes ambiguës.

---

### **Travaux transverses [À faire 🧰]**

Tâches sans phase attitrée, à traiter entre deux fonctionnalités.

1.  **Dépendances [✅ en grande partie] :** 46 vulnérabilités signalées, 8 restantes. Correctifs compatibles appliqués, `os-utils` (inutilisé) retiré, passage à Electron 44 et electron-builder 26. **Reste :** 8 vulnérabilités dans des outils de développement seulement, jamais embarqués dans l'application (`tsc-alias`, `globby` du script `concat`, `qs` via Stryker) ; aucun correctif disponible hors retour à des versions plus anciennes. À revoir à la prochaine mise à jour de ces outils.
2.  **Versionnage des sauvegardes [✅] :** chaque fichier (session, sauvegardes, exports) porte un numéro de format ; à la lecture, les migrations sont appliquées d'une version à la suivante, l'original est copié à côté, et l'utilisateur est prévenu des points à vérifier.
3.  **Tests de l'interface [✅] :** tests de composants (Testing Library, jsdom) sur la saisie des flux et des salaires, les cartes des acteurs, le panneau de résultats et l'historique d'annulation de l'application entière. **Non couvert :** glisser-déposer, fenêtres d'édition et de sauvegarde, test de bout en bout de l'application packagée.
4.  **Import [✅] :** la fenêtre de confirmation s'ouvre aussi quand seuls des flux sont écartés, ou quand le fichier a été converti.
5.  **Cotisations des travailleurs non salariés [✅] :** calcul ligne à ligne selon les règles officielles 2026 (assiette unique après l'abattement de 26 %, maladie et allocations familiales progressives, retraites de base et complémentaire par tranches, CSG-CRDS en partie non déductible, assiettes minimales par risque), au lieu d'un taux moyen de 45 % ; rémunération brute du gérant d'EURL retrouvée par dichotomie à partir du net saisi ; trimestres de retraite comptés sur l'assiette de la retraite de base.
