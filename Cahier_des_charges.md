## **Partie I : Cahier des Charges - Projet "Simulateur Indépendant" (v1.0)**

### **1. Introduction et Objectifs**

- **Nom du projet :** Simulateur Indépendant
- **Mission :** Fournir un outil de simulation gratuit, open-source, et fonctionnant hors-ligne pour aider les travailleurs indépendants en France à prendre des décisions éclairées sur leur statut juridique, anticiper leurs revenus, impôts et cotisations, et comprendre les implications de leurs choix.
- **Public Cible :** Freelances, consultants, créateurs d'entreprise, et salariés en transition vers l'indépendance.
- **Principes Clés :**
  - **Fiabilité :** Calculs basés sur la législation en vigueur, avec des approximations clairement identifiées.
  - **Confidentialité :** Aucune donnée utilisateur ne quitte la machine locale.
  - **Pédagogie :** L'interface et les résultats doivent être clairs, même pour un non-expert, avec des aides contextuelles.
  - **Maintenabilité :** Architecture modulaire et configuration centralisée pour faciliter les mises à jour annuelles.

### **2. Périmètre Fonctionnel (Features Implémentées)**

**F1 : Saisie des Données Utilisateur (Annuelle)**

- **F1.1 : Profil du Foyer :**
  - Nombre de parts fiscales.
  - Autres revenus du foyer (salaire net imposable, etc.).
- **F1.2 : Activité Annuelle :**
  - Chiffre d'Affaires (CA) - Prestations de services (BNC/BIC).
  - Chiffre d'Affaires (CA) - Vente de marchandises (BIC).
  - Charges professionnelles réelles.

**F2 : Moteur de Calcul Multi-Statuts**

- **F2.1 : Statuts juridiques comparés :**
  - **Micro-Entreprise** (régime fiscal de l'EI).
  - **Entreprise Individuelle (EI) au Régime Réel**.
  - **SASU** à l'Impôt sur les Sociétés (IS).
  - **EURL** à l'Impôt sur les Sociétés (IS).
- **F2.2 : Logiques de calcul implémentées :**
  - **Pour la Micro-Entreprise :**
    - Calcul des cotisations sociales sur le CA.
    - Calcul du revenu imposable après abattement forfaitaire.
    - Calcul du surcoût d'impôt sur le revenu (IR) généré par l'activité.
    - Calcul du "Net dans la poche" final (CA - Cotisations - Charges réelles - Surcoût IR).
    - **Détection du dépassement des plafonds de CA**, invalidation des résultats et affichage d'un avertissement pédagogique.
  - **Pour l'EI au Régime Réel :**
    - Calcul du bénéfice réel (CA - Charges réelles).
    - Calcul des cotisations sociales (TNS) sur la base du bénéfice.
    - Calcul du surcoût d'IR sur la base du bénéfice.
    - Calcul du "Net dans la poche" (Bénéfice - Cotisations - Surcoût IR).
  - **Pour la SASU et l'EURL (IS) :**
    - Calcul des cotisations sociales sur la rémunération (Assimilé-Salarié pour SASU, TNS pour EURL).
    - Calcul du bénéfice de la société et de l'Impôt sur les Sociétés (IS).
    - **Double simulation de l'imposition des dividendes** : PFU ("Flat Tax") vs. option au Barème Progressif de l'IR.
    - Calcul du "Net dans la poche" en choisissant automatiquement la meilleure option pour les dividendes.
- **F2.3 : Calcul de la TVA :**
  - Pour chaque statut, détermination dynamique du régime de TVA (Franchise, Tolérance, Assujetti) en fonction des seuils de CA.

**F3 : Restitution des Résultats et Pédagogie**

- **F3.1 : Tableau Comparatif Synthétique :** Affiche les résultats clés (Base Imposable, Statut TVA, Net dans la poche) pour une comparaison visuelle rapide.
- **F3.2 : Accordéon "Détails du Calcul" :**
  - Affiche une vue détaillée du cheminement des calculs pour chaque statut.
  - Inclut les étapes intermédiaires (cotisations, IS, détail de la rémunération, etc.).
  - Met en évidence la comparaison entre les options d'imposition des dividendes (PFU vs. Barème).
- **F3.3 : Modale d'Information Dynamique :**
  - Au clic sur l'icône d'avertissement ⚠️ (en cas de dépassement de plafond), une fenêtre modale s'ouvre.
  - Le contenu est généré dynamiquement et explique en détail les conséquences du dépassement, les démarches à effectuer (y compris en cas de prise de conscience tardive), et utilise les seuils exacts provenant du fichier de configuration.

**F4 : Interface et Expérience Utilisateur (UI/UX)**

- **F4.1 : Technologie :** Application de bureau multiplateforme (Electron) avec une interface web (HTML, SASS, JS).
- **F4.2 : Thème Sombre/Clair :**
  - Interrupteur de thème avec des icônes (soleil/lune).
  - Le choix de l'utilisateur est **persisté** dans le `localStorage` et rechargé au lancement.
  - Détection du thème préféré du système d'exploitation au premier lancement.
- **F4.3 : Gestion des Erreurs :**
  - Les erreurs critiques de calcul ne font pas planter l'application mais s'affichent dans une zone dédiée de l'interface.
  - Un bouton permet de copier le message d'erreur pour faciliter le débogage.

---

## **Partie II : Propositions d'Améliorations**

Voici une liste d'évolutions possibles, classées par ordre de pertinence à mon avis. C'est sur cette base que nous allons construire la future roadmap.

**Axe 1 : Affiner la Précision et les Cas d'Usage**

1.  **Gestion de l'ACRE :** Ajouter une simple case à cocher "Bénéficiaire de l'ACRE" qui divise les taux de cotisations la première année. C'est une fonctionnalité à très haute valeur pour les créateurs.
2.  **Règle Spécifique des Dividendes en EURL :** Actuellement, nous simplifions. La vraie règle est que les dividendes supérieurs à 10% du capital social sont soumis aux cotisations sociales TNS (~45%). L'implémenter ajouterait un champ "Capital Social" et rendrait la comparaison EURL/SASU beaucoup plus fidèle.
3.  **Calcul (Simplifié) des Trimestres de Retraite :** Afficher pour chaque statut si le revenu généré permet de valider les 4 trimestres de retraite pour l'année. C'est un indicateur non-financier très important.

**Axe 2 : Améliorer l'Ergonomie et l'Interaction**

4.  **Slider Rémunération / Dividendes :** Remplacer notre règle arbitraire (50% du CA) par un slider interactif pour la SASU/EURL. L'utilisateur pourrait ainsi faire varier la répartition et voir en temps réel l'impact sur le "Net dans la poche", ce qui est le cœur de l'optimisation.
5.  **Info-bulles Pédagogiques :** Ajouter des petites icônes `?` à côté des termes techniques (ACRE, Flat Tax, TNS, BNC...) qui affichent une courte définition au survol.
6.  **Saisie Mensuelle Détaillée :** Implémenter le second mode de saisie prévu dans la roadmap initiale, permettant de simuler des revenus fluctuants au cours de l'année.

**Axe 3 : Ajouter des Fonctionnalités de Confort**

7.  **Sauvegarde de Simulation :** Permettre à l'utilisateur de sauvegarder une ou plusieurs simulations (via le `localStorage`) pour les retrouver au prochain lancement.
8.  **Export des Résultats :** Ajouter un bouton pour exporter le tableau de résultats en format simple (CSV ou PDF) pour pouvoir le partager avec un comptable ou l'archiver.

---

## **Partie III : Discussion : Que Fait-on Maintenant ?**

Le projet est déjà très puissant. Pour la suite, je suggère de nous concentrer sur ce qui apporte le plus de valeur à l'utilisateur final pour un effort de développement raisonnable.

**Ce qui me semble prioritaire (finalisation de la Phase 2 de votre roadmap) :**

- **Le Slider Rémunération / Dividendes (n°4) :** C'est la fonctionnalité interactive la plus importante qui manque.
- **La Gestion de l'ACRE (n°1) :** C'est un cas d'usage extrêmement courant pour la cible.
- **Les Info-bulles (n°5) :** C'est un effort faible pour un gain pédagogique énorme.
- **La Règle Spécifique EURL (n°2) :** Important pour la fiabilité de la comparaison.

**Pour aller plus loin (Phase 3 et au-delà) :**

- La Saisie Mensuelle (n°6), la Sauvegarde (n°7) et l'Export (n°8).

**Ma proposition :** concentrons-nous sur le premier bloc (Slider, ACRE, Info-bulles, Règle EURL). Cela nous donnera une version de l'application extrêmement complète et fidèle à votre vision initiale.

Quelles sont les améliorations qui vous semblent les plus pertinentes pour la prochaine étape ? Une fois que vous aurez fait votre choix, je pourrai rédiger la roadmap mise à jour.

4. Proposition de Roadmap Mise à Jour

Maintenant que nous sommes d'accord sur la vision, voici une roadmap concrète pour y parvenir.

#### Phase 2 (Finalisation) : Devenir un Outil Pédagogique

    Objectif : Implémenter le système d'onglets et le contenu pédagogique.

    Tâches :

        (Urgent) Débogage de la Modale : Appliquer le correctif ci-dessus.

        Création du Contenu Pédagogique :

            Créer un nouveau fichier (ex: src/guides.js) qui contiendra tout le texte explicatif (avantages, inconvénients, règles clés, formules) pour chaque statut. Le centraliser ici le rendra facile à mettre à jour.

        Refactorisation de l'Interface (HTML/SASS) :

            Modifier index.html pour créer la structure des onglets : un onglet "Comparatif", un "Micro-Entreprise", "EI", "SASU", "EURL".

            Créer un nouveau composant SASS (_tabs.scss) pour styliser la navigation.

        Refactorisation du renderer.js :

            Ajouter la logique pour gérer le changement d'onglet (afficher/cacher le bon contenu).

            Le formulaire de saisie restera visible en permanence en haut de la page.

        Création de la Vue Détaillée dans display.js :

            Créer une nouvelle fonction renderStatutDetailView(resultat, guideContent) qui prendra les résultats d'UNE seule simulation et le contenu pédagogique correspondant.

            Cette fonction générera le HTML pour un onglet de statut, affichant :

                Le tableau de résultats détaillé que nous avons déjà.

                Les sections "Avantages", "Inconvénients", "Règles Clés" tirées de guides.js.

        Intégration des Info-bulles : En parallèle, nous ajouterons les icônes ? avec des définitions simples à côté des termes techniques.

#### Phase 3 : Améliorer l'Interaction et la Fiabilité

    Objectif : Rendre l'application plus interactive et les calculs encore plus précis.

    Tâches :

        Slider Rémunération / Dividendes : Remplacer notre calcul fixe par un slider interactif. C'est la plus grosse plus-value de cette phase.

        Gestion de l'ACRE : Ajouter la case à cocher "Bénéficiaire de l'ACRE".

        Règle Spécifique des Dividendes en EURL : Ajouter un champ "Capital Social" et implémenter la règle des 10% pour une simulation parfaitement fidèle.

####Phase 4 : Finalisation et Distribution (inchangée)

    Polissage, packaging, mise en Open Source, etc.

## 2. Roadmap Mise à Jour (Post-Refactorisation)

Nous venons de terminer une phase intensive de stabilisation et d'amélioration de l'interface qui n'était pas initialement planifiée avec ce niveau de détail. Il est temps d'officialiser ces accomplissements et de tracer une nouvelle voie claire pour la suite.
Phase 2 (Terminée) : Stabilisation & Modernisation de l'Interface

    Objectif atteint : Transformer le prototype fonctionnel en une application robuste, intuitive et agréable à utiliser.

    Réalisations clés :

        Refactorisation complète du renderer.js en une architecture modulaire et maintenable.

        Correction de tous les bugs critiques de sauvegarde, chargement et réinitialisation.

        Implémentation d'un design adaptatif complet (formulaire, onglets, tableaux).

        Amélioration significative de l'expérience utilisateur (boutons sticky, indicateurs de scroll, contraste des thèmes, gestion de la modale).

        Mise en place d'un système de réorganisation des sauvegardes par glisser-déposer.

Phase 3 (À venir) : Fiabilisation et Interactivité du Moteur de Calcul

    Objectif : Rendre les simulations encore plus précises et donner à l'utilisateur le contrôle sur les variables clés de l'optimisation. C'est le cœur de la valeur ajoutée de l'outil.

    Tâches :

        (Priorité #1) Slider Rémunération / Dividendes : Remplacer le calcul fixe actuel par un slider interactif pour la SASU et l'EURL. L'utilisateur pourra ajuster la répartition et voir en temps réel l'impact sur son "net dans la poche".

        Gestion de l'ACRE : Ajouter une simple case à cocher "Bénéficiaire de l'ACRE" qui appliquera les taux de cotisations réduits de la première année.

        Règle Spécifique des Dividendes en EURL : Implémenter la règle des 10% du capital social. Cela nécessitera d'ajouter un champ "Capital Social" (uniquement visible pour l'EURL) et de rendre la comparaison SASU/EURL parfaitement fidèle à la réalité.

Phase 4 (Future) : Fonctions de Confort et d'Analyse

    Objectif : Ajouter des fonctionnalités qui aident l'utilisateur à analyser les résultats et à les conserver.

    Tâches :

        Calcul des Trimestres de Retraite : Afficher un indicateur simple (ex: "4/4 trimestres validés") pour chaque statut, basé sur le revenu généré.

        Export des Résultats : Ajouter un bouton pour exporter le tableau comparatif au format CSV ou PDF simple, pour un archivage ou un partage facile avec un comptable.

Phase 5 (Finale) : Packaging et Distribution

    Objectif : Préparer l'application pour une distribution publique.

    Tâches :

        Polissage Final : Derniers ajustements de l'interface, vérification des textes et des infobulles.

        Tests Multi-plateformes : S'assurer que l'application se comporte bien sur Windows, macOS et Linux.

        Packaging de l'Application : Utiliser Electron Builder pour créer les installateurs (.exe, .dmg, etc.).

        Mise en Open Source : Nettoyer le dépôt Git, rédiger un README.md complet, ajouter une licence et des instructions de contribution (CONTRIBUTING.md).
