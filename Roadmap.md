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
6.  **Dispositifs limités dans le temps [À faire] :** ACRE la première année, exonération de CFE l'année de création, cotisations des premières années.
7.  **Sortie du régime micro [À faire] :** repérer deux années consécutives au-delà des plafonds et annoncer le passage au réel au 1er janvier suivant (règle de service-public.fr, F32353). Aujourd'hui, une micro hors plafond est signalée « 2 ans au plus » et n'est jamais désignée meilleur net.
8.  **Partage du bénéfice des sociétés [✅] :** dans le comparateur, quatre modes (rémunération saisie et dividendes, tout en rémunération, répartition personnalisée, dividendes de la grille) ; barre empilée exacte du bénéfice avant rémunération (rémunération nette, cotisations, IS, dividendes, cotisations sur dividendes, réserves) avec poignées glissables à la souris, au doigt et au clavier, répartitions toutes faites, exports.
8 bis. **Comparateur au meilleur net [✅] :** mode par défaut, chaque statut de société (SASU, EURL) avec sa propre rémunération optimale et tout le reste en dividendes, option « avec 4 trimestres de retraite » ; un seul calcul partagé avec « Rémunération ou dividendes ? ».
9.  **Saisie sur plusieurs années depuis la grille [✅] :** cases « Aussi en » dans la fenêtre des flux ; ajout, modification et suppression d'une série appliqués aux mêmes mois des années cochées (même portée, mêmes mois du calendrier), sans doublon, en une seule étape d'annulation, avec une notification détaillée par année. La recopie jusqu'en décembre reste limitée à l'année affichée.
10. **Plus tard :** acteurs et relations propres à chaque année, exports et optimisation sur plusieurs années, revenu fiscal de référence dans les exports CSV et Markdown.

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

### **Phase 13 ter : Moins d'informations à l'écran [À étudier 🔍]**

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
5.  **Garde-fous :** accessibilité inchangée (tests axe, clavier, tailles des cibles), impression et PDF qui déplient tout, tests de bout en bout adaptés aux nouveaux chemins.

---

### **Phase 14 : Montages types [Planifié 🗓️]**

- **Objectif :** partir d'une situation courante plutôt que d'une page vide. Peut s'intercaler entre deux autres phases.

1.  **Bibliothèque de montages :** simulations préremplies à charger en un clic, comme la simulation d'exemple de la démo : micro-entreprise seule, SASU sans salaire, micro-entreprise et SASU du conjoint, conjoint salarié de la SASU, EURL à l'IR ou à l'IS, couple en union libre ou marié.
2.  **Explication :** pour chaque montage, ce qu'il illustre, ses conditions et ses risques, avec un lien vers le comparateur et l'arbitrage rémunération / dividendes.
3.  **Plus tard :** recherche automatique d'une meilleure structure, en s'appuyant sur le comparateur et l'optimiseur.

---

### **Phase 15 : Scénarios Avancés & Finalisation [Planifié 🗓️]**

- **Objectif :** compléter le modèle pour les situations moins courantes, puis distribuer l'application.

1.  **Prorata temporis :** activité démarrée en cours d'année.
2.  **ACRE :** distinguer la réduction de 50 % et celle de 25 % (micro-entreprises créées à partir du 01/07/2026).
3.  **Répartition du capital :** part de chaque associé dans une société à plusieurs associés. Aujourd'hui, les dividendes, l'impôt sur les sociétés et le bénéfice conservé sont partagés à parts égales.
4.  **Compte courant d'associé :** solde par société, flux d'apport et de remboursement (non imposés), intérêts versés (déductibles pour la société dans une limite, imposés chez l'associé), et prise en compte du solde dans le seuil des 10 % du capital des EURL.
5.  **Distribution :** exécutables Windows / macOS / Linux.

---

### **Travaux transverses [À faire 🧰]**

Tâches sans phase attitrée, à traiter entre deux fonctionnalités.

1.  **Dépendances [✅ en grande partie] :** 46 vulnérabilités signalées, 8 restantes. Correctifs compatibles appliqués, `os-utils` (inutilisé) retiré, passage à Electron 44 et electron-builder 26. **Reste :** 8 vulnérabilités dans des outils de développement seulement, jamais embarqués dans l'application (`tsc-alias`, `globby` du script `concat`, `qs` via Stryker) ; aucun correctif disponible hors retour à des versions plus anciennes. À revoir à la prochaine mise à jour de ces outils.
2.  **Versionnage des sauvegardes [✅] :** chaque fichier (session, sauvegardes, exports) porte un numéro de format ; à la lecture, les migrations sont appliquées d'une version à la suivante, l'original est copié à côté, et l'utilisateur est prévenu des points à vérifier.
3.  **Tests de l'interface [✅] :** tests de composants (Testing Library, jsdom) sur la saisie des flux et des salaires, les cartes des acteurs, le panneau de résultats et l'historique d'annulation de l'application entière. **Non couvert :** glisser-déposer, fenêtres d'édition et de sauvegarde, test de bout en bout de l'application packagée.
4.  **Import [✅] :** la fenêtre de confirmation s'ouvre aussi quand seuls des flux sont écartés, ou quand le fichier a été converti.
5.  **Cotisations des travailleurs non salariés [✅] :** calcul ligne à ligne selon les règles officielles 2026 (assiette unique après l'abattement de 26 %, maladie et allocations familiales progressives, retraites de base et complémentaire par tranches, CSG-CRDS en partie non déductible, assiettes minimales par risque), au lieu d'un taux moyen de 45 % ; rémunération brute du gérant d'EURL retrouvée par dichotomie à partir du net saisi ; trimestres de retraite comptés sur l'assiette de la retraite de base.
