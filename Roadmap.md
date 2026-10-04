# Roadmap de Développement Détaillée v3.0

- **Dernière mise à jour :** 04/10/2026

## **État Actuel du Projet**

Le socle (graphe d'entités, grille visuelle, persistance validée par Zod), les tests automatisés avec intégration continue, le moteur de simulation par foyer fiscal, le comparateur de statuts et l'arbitrage rémunération / dividendes sont en place, avec une démo web publiée sur GitHub Pages. L'accessibilité (WCAG 2.2 AA) est vérifiée automatiquement. Les chiffres s'exportent en CSV, en PDF et en rapport Markdown. Les cotisations du président de SASU et des salariés sont calculées ligne à ligne. La prochaine étape est **plusieurs années** (Phase 13), dont les règles 2024 et 2025 sont déjà collectées.

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

### **Phase 13 : Plusieurs années [Planifié 🗓️]**

- **Objectif :** simuler et comparer plusieurs années qui s'enchaînent.

1.  **Modèle de données :** une session contient plusieurs années (grille, acteurs et relations par année) ; nouveau format de fichier, avec migration des sessions existantes.
2.  **Règles par année [✅ en partie] :** règles 2024 et 2025 collectées et sourcées (`src/backend/regles/`), au format de `config.json`, avec des tests de forme et de cohérence d'une année sur l'autre ; convention d'année acceptée (ADR 007 : l'année des revenus et de l'activité). Le régime général (phase 12) y est aussi, pour les trois années. **Reste :** les brancher dans le moteur ; pour une année sans règles connues, reprendre les dernières avec un avertissement ; étendre le format pour représenter ce que les règles d'avant 2026 approchent aujourd'hui : cotisations des indépendants de 2024 (ancien mode de calcul), taux réduits maladie (7 %) et allocations familiales (3,45 %) des salariés sous un seuil en SMIC, coefficient de la réduction Fillon bâti sur ces taux, et changements en cours d'année (SMIC, chômage, AGS, accidents du travail, taux micro BNC de juillet 2024).
3.  **Revenu fiscal de référence :** calculé chaque année et reporté ; le versement libératoire de l'année N vérifie celui de N-2 automatiquement (il faut donc trois années chaînées).
4.  **Bénéfice mis en réserve :** le résultat conservé d'une société est reporté sur l'année suivante et peut être distribué plus tard ; arbitrage des dividendes entre les années.
5.  **Dispositifs limités dans le temps :** ACRE la première année, exonération de CFE l'année de création, cotisations des premières années.

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
