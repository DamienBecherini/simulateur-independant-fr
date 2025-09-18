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

# **Cahier des Charges & Roadmap Stratégique v5.0**

- **Document de Référence : L'Assistant Complet de la Transition Professionnelle**
- Date de dernière mise à jour : 17/09/2025

---

## **Partie I : État Actuel (v1.0 - Socle Existant)**

_Cette section décrit le périmètre fonctionnel de l'application qui sert de base à toutes les évolutions futures._

### **1. Introduction et Objectifs**

- **Nom du projet :** Simulateur Indépendant
- **Mission :** Fournir un outil de simulation gratuit, open-source, et fonctionnant hors-ligne pour aider les travailleurs indépendants en France à prendre des décisions éclairées.
- **Principes Clés :** Fiabilité, Confidentialité, Pédagogie, Maintenabilité.

### **2. Périmètre Fonctionnel Implémenté**

- **F1 : Saisie des Données (Annuelle) :** Profil fiscal du foyer, CA (Services/Vente), Charges professionnelles.
- **F2 : Moteur de Calcul (Base Annuelle) :**
  - **Statuts :** Micro-Entreprise, EI au Réel, SASU (IS), EURL (IS).
  - **Logiques Clés :** Cotisations, abattement, IS, double simulation (PFU/Barème) pour dividendes, détection des dépassements de plafonds annuels.
  - **TVA :** Détermination du régime basé sur les seuils annuels.
- **F3 : Restitution des Résultats :** Tableau comparatif, vues détaillées par statut, contenu pédagogique, modale d'avertissement.
- **F4 : Interface et Expérience Utilisateur :** Application Electron, thème Sombre/Clair, système de sauvegarde/import/export.

---

## **Partie II : Roadmap Stratégique (La Vision Future)**

_Cette roadmap transforme le simulateur d'un comparateur stratégique en un **assistant prévisionnel complet**. Chaque phase s'appuie sur la précédente pour livrer de la valeur de manière incrémentale._

### **Phase 3 : Fiabilisation et Confiance**

**Objectif :** Rendre chaque calcul fourni par le simulateur absolument irréprochable. La confiance de l'utilisateur est le socle de tout.

**Fonctionnalités Clés :**

1.  **Correction du Calcul des Dividendes en EURL :**

    - **Description :** Implémenter la règle spécifique où la part des dividendes supérieure à 10% du capital social est soumise aux cotisations sociales TNS (~45%) au lieu des prélèvements sociaux (17.2%).
    - **Impact :** Corrige l'incohérence la plus critique du simulateur. La comparaison SASU/EURL deviendra enfin juste et fiable.
    - **Dépendance Technique :** Ajout d'un champ "Capital Social" dans le formulaire de saisie.

2.  **Simulation du Versement Libératoire (VFL) :**

    - **Description :** Ajouter une case à cocher "Opter pour le VFL" pour la Micro-Entreprise. La case ne sera active que si les conditions de revenu (RFR N-2 par part) sont respectées.
    - **Impact :** Ajoute une simulation à très haute valeur pour les indépendants qui débutent et s'interrogent sur ce choix fiscal majeur.

3.  **Gestion de l'ACRE :**

    - **Description :** Ajouter une case à cocher "Bénéficiaire de l'ACRE" qui applique les taux de cotisations réduits de la première année d'activité.
    - **Impact :** Couvre un cas d'usage extrêmement fréquent et essentiel pour les créateurs d'entreprise.

4.  **Ajout d'un Avertissement Légal :**
    - **Description :** Intégrer un disclaimer clair et visible (ex: en pied de page) précisant que l'outil fournit des estimations à but pédagogique et ne remplace pas un conseil professionnel (expert-comptable, etc.).
    - **Impact :** Renforce le professionnalisme, la transparence et la crédibilité de l'application.

### **Phase 4 : L'Analyse Visuelle et Stratégique**

**Objectif :** Transformer les chiffres bruts en un outil d'aide à la décision visuel et interactif, permettant à l'utilisateur de comprendre les stratégies d'optimisation.

**Fonctionnalités Clés :**

1.  **Graphique d'Optimisation Rémunération/Dividendes :**

    - **Description :** Pour SASU et EURL, créer un graphique interactif montrant l'évolution du "Net dans la poche" en fonction de la répartition Rémunération/Dividendes.
    - **Impact :** Fournit la fonctionnalité "wow" la plus recherchée en matière d'optimisation fiscale, en matérialisant le point optimal de répartition.

2.  **Graphique Comparatif des Points de Bascule :**

    - **Description :** Développer un graphique qui trace une courbe de "Net dans la poche" pour chaque statut en fonction du Chiffre d'Affaires.
    - **Impact :** Permet de visualiser immédiatement à partir de quel niveau de revenu un statut devient plus intéressant qu'un autre.

3.  **Simulation EURL : IS vs. IR :**
    - **Description :** Ajouter la possibilité de simuler l'EURL à l'Impôt sur le Revenu (IR), en plus de l'IS.
    - **Impact :** Couvre un choix stratégique fondamental lors de la création d'une EURL, rendant le comparateur exhaustif.

### **Phase 5 : La Simulation Dynamique et Mensualisée**

**Objectif :** Implémenter la saisie mensuelle pour passer d'une projection annuelle à une simulation fine, reflétant la réalité opérationnelle fluctuante d'un indépendant (saisonnalité, revenus multiples).

**Fonctionnalités Clés :**

1.  **Refonte de l'Interface de Saisie :**

    - **Description :** Créer une nouvelle interface de saisie mensuelle (ex: une grille sur 12 mois). L'utilisateur pourra y détailler pour chaque mois :
      - **Gains :** Lignes multiples pour "Salaire", "CA BIC (vente)", "CA BIC (artisanat)", "CA BNC (libéral)", etc.
      - **Dépenses Pro :** Lignes multiples pour "Déplacements", "Logiciels", "Repas", etc.
    - **Ergonomie :** Intégrer un bouton **"Dupliquer ce mois"** pour propager facilement une saisie sur les mois suivants.

2.  **Évolution Majeure du Moteur de Calcul :**

    - **Description :** Adapter toutes les fonctions de simulation pour qu'elles acceptent un tableau de 12 mois de données en entrée. Le moteur devra agréger les données pour les calculs annuels tout en analysant la chronologie.
    - **Impact :** Permet une précision inégalée, notamment pour la détection du **mois exact de dépassement des seuils** (TVA, Micro-Entreprise) et l'affichage d'alertes contextuelles.

3.  **Simulation de Scénarios Avancés :**
    - **Description :** Gérer nativement un **début d'activité en cours d'année** (ex: les premiers mois sont à zéro) et appliquer automatiquement les calculs de **prorata temporis** sur les plafonds et seuils.

### **Phase 6 : Simulation de la Transition avec Maintien des Droits (ARE)**

**Objectif :** Simuler le cumul des revenus d'indépendant avec l'Aide au Retour à l'Emploi (ARE), pour sécuriser financièrement la phase de lancement.

**Fonctionnalités Clés :**

1.  **Module de Calcul de l'ARE :**

    - **Description :** Créer une fonction qui estime le montant de l'ARE mensuelle à partir du salaire brut moyen des 24 derniers mois.
    - **Dépendance Technique :** Nécessite une nouvelle section dans l'interface de saisie (mensualisée) pour renseigner l'ancien salaire brut.

2.  **Simulation du Maintien Partiel des Droits :**

    - **Description :** Le moteur de calcul appliquera, pour chaque mois de la simulation, les règles de cumul ARE + revenus d'indépendant, en distinguant :
      - Le calcul pour la **Micro-Entreprise** (basé sur le CA après abattement).
      - Le calcul pour les **Sociétés** (basé uniquement sur la rémunération versée, ignorant les dividendes).
    - **Impact :** Révèle des stratégies d'optimisation majeures pour les créateurs d'entreprise en transition (ex: 0€ de rémunération en SASU pour maintenir 100% de l'ARE).

3.  **Restitution Consolidée :**
    - **Description :** Le résultat final "Net dans la poche" affichera la somme du revenu net de l'activité ET de l'ARE recalculée, offrant une vision complète et réaliste de la trésorerie personnelle.

### **Phase 7 : Confort et Partage**

**Objectif :** Peaufiner l'expérience utilisateur, faciliter la prise en main pour les débutants et permettre l'utilisation concrète des résultats.

**Fonctionnalités Clés :**

1.  **Ajout de Profils-Types :**

    - **Description :** Créer des boutons "Pré-remplir pour..." (ex: Développeur Web, Consultant) qui remplissent la simulation (annuelle ou mensuelle) avec des données moyennes.
    - **Impact :** Réduit drastiquement la friction pour les nouveaux utilisateurs.

2.  **Calcul des Trimestres de Retraite :**

    - **Description :** Afficher un indicateur simple (ex: "4/4 trimestres validés") pour chaque statut, basé sur le revenu généré.
    - **Impact :** Ajoute une dimension non-financière importante à la décision.

3.  **Export des Résultats et Graphiques :**
    - **Description :** Permettre l'export des tableaux (CSV/PDF) et des graphiques (PNG).
    - **Impact :** Permet à l'utilisateur de conserver, partager ou discuter des résultats avec son comptable.

### **Phase 8 : Lancement et Distribution Open Source**

**Objectif :** Préparer une distribution publique de haute qualité et faire de la nature open-source du projet un argument de confiance et de collaboration.

**Fonctionnalités Clés :**

1.  **Polissage Final & Tests Multi-plateformes.**
2.  **Packaging de l'Application** (via Electron Builder pour .exe, .dmg, etc.).
3.  **Mise en Open Source Stratégique :**
    - **Description :** Rédiger un `README.md` très complet, expliquer la mission du projet, ajouter une licence et un guide de contribution (`CONTRIBUTING.md`).
    - **Impact :** Utiliser la transparence comme un argument marketing majeur pour bâtir une communauté et renforcer la confiance.

### **Phase 9 : Vision Long Terme - Simulation de Cumul d'Activités**

**Objectif :** Devenir le seul outil capable de simuler des montages juridiques hybrides, répondant aux cas d'usage les plus avancés des entrepreneurs multi-activités (ex: une Micro-Entreprise pour une activité B2C + une SASU pour une activité B2B).

**Fonctionnalités Clés :**

1.  **Mode de Simulation "Cumul d'Activités" :**
    - **Description :** Ajouter un choix à l'utilisateur : "Simuler une activité unique" (comportement par défaut) ou "Simuler un cumul d'activités".
2.  **Interface de Saisie Multi-Activités :**
    - **Description :** Développer une interface dédiée permettant d'isoler les revenus et charges de chaque activité et d'assigner un statut à chacune.
3.  **Moteur de Calcul par Consolidation :**
    - **Description :** Créer un "méta-simulateur" capable d'exécuter les simulations en parallèle et d'agréger les revenus pour un calcul fiscal et social consolidé.
4.  **Restitution des Résultats Comparatifs de Combinaisons :**
    - **Description :** Le tableau final comparera des combinaisons (ex: "Micro + SASU", "Micro + EI", etc.).

Absolument ! C'est une excellente idée d'évolution qui transforme votre simulateur d'un outil individuel en un puissant assistant de stratégie fiscale pour les couples, ce qui est un cas d'usage extrêmement courant et à très forte valeur ajoutée.

Après avoir analysé en profondeur votre `Cahier_des_charges.md` et la structure de votre code, je vous propose une feuille de route détaillée pour intégrer cette fonctionnalité. Votre projet est déjà très bien structuré (calculs modulaires, configuration centralisée), ce qui facilitera grandement cette évolution.

Je suggère de positionner cette fonctionnalité comme une **Phase 10**, car elle s'appuie logiquement sur les fondations des phases précédentes, notamment la simulation de cumul d'activités de la Phase 9.

Voici une proposition de rédaction pour cette nouvelle phase, conçue pour s'intégrer parfaitement à votre roadmap existante.

### **Phase 10 : L'Assistant Familial - Simulation pour les Couples**

**Objectif :** Répondre à une question fondamentale pour des millions de foyers : "Est-il plus avantageux de nous marier/pacser, ou de rester en déclarations séparées ?". Cette phase fait évoluer le simulateur en un outil de planification financière pour le foyer.

**Fonctionnalités Clés :**

#### **1. Refonte Majeure de l'Interface de Saisie**

- **Description :** L'interface doit permettre de simuler deux personnes simultanément.

  - Un sélecteur initial permettra de choisir entre "Simulation Individuelle" (comportement actuel) et "Simulation pour un Couple".
  - En mode "Couple", le formulaire affichera deux colonnes ou deux sections distinctes : "Partenaire A" et "Partenaire B".
  - Pour chaque partenaire, un menu déroulant permettra de définir sa situation :
    - Salarié(e) (avec un simple champ "Salaire net imposable")
    - Micro-Entreprise
    - EI au Réel
    - SASU (IS)
    - EURL (IS)
  - Les champs de saisie (CA, charges, etc.) apparaîtront dynamiquement sous chaque partenaire en fonction du statut choisi.
  - Un champ global "Nombre d'enfants à charge" permettra de calculer le nombre de parts total pour la déclaration commune.

- **Impact Technique :**
  - **`index.html`** : Nécessite une restructuration importante du `<form id="simulation-form">`.
  - **`ui/eventListeners.js`** : La fonction `collectInputs()` devra être entièrement repensée pour agréger les données des deux partenaires.
  - **`src/stateManager.js`** : La structure de `ui.formInputs` dans l'état de l'application devra être modifiée pour accueillir un objet `partnerA` et `partnerB`.

#### **2. Évolution du Moteur : Le "Méta-Simulateur"**

- **Description :** Le cœur de cette phase est un nouveau "méta-simulateur" qui orchestrera les calculs existants.

  - Une nouvelle fonction, par exemple `simulerCouple(inputs)`, sera créée dans `main.js`.
  - Cette fonction exécutera deux simulations en parallèle :
    1.  **Scénario 1 : Déclaration Commune (Mariés/Pacsés)**
        - Lancer la simulation individuelle pour le Partenaire A (en utilisant les `calculsAE.js`, `calculsSASU.js`, etc.) pour déterminer son revenu imposable.
        - Faire de même pour le Partenaire B.
        - Agréger tous les revenus imposables du foyer (Revenu imposable A + Revenu imposable B + Autres revenus du foyer).
        - Appeler `calculerIR()` **une seule fois** avec le revenu total et le nombre de parts du couple (ex: 2 parts + enfants).
        - Calculer le "Net dans la poche" total du foyer.
    2.  **Scénario 2 : Déclarations Séparées (Célibataires)**
        - Lancer la simulation individuelle pour le Partenaire A.
        - Appeler `calculerIR()` une première fois, uniquement avec les revenus du Partenaire A et ses parts (généralement 1).
        - Lancer la simulation individuelle pour le Partenaire B.
        - Appeler `calculerIR()` une seconde fois, uniquement avec les revenus du Partenaire B et ses parts.
        - Additionner les deux impôts pour obtenir l'impôt total payé par le couple.
        - Additionner les deux "Net dans la poche" pour obtenir le revenu net total du foyer.

- **Impact Technique :**
  - **`main.js`** : Création d'un nouveau `ipcMain.handle("run-couple-simulation", ...)` qui appellera ce méta-simulateur.
  - Les modules `calculsAE.js`, `calculsEI.js`, etc., n'auront **presque pas besoin d'être modifiés**. C'est la force de votre architecture actuelle. Ils seront simplement utilisés comme des briques de base.
  - **`calculsIR.js`** : Aucune modification nécessaire, il sera simplement appelé avec des paramètres différents.

#### **3. Restitution des Résultats : Le Comparatif Décisionnel**

- **Description :** Le résultat ne sera plus un simple tableau comparatif des statuts, mais une comparaison des deux scénarios fiscaux.

  - Le tableau de résultats principal affichera :
    - **Ligne 1 : Impôt sur le Revenu Total** (colonne "Déclaration Commune" vs colonne "Déclarations Séparées").
    - **Ligne 2 : Net dans la poche (Partenaire A)**.
    - **Ligne 3 : Net dans la poche (Partenaire B)**.
    - **Ligne 4 : Net dans la poche (Total Foyer)**.
    - **Ligne 5 (mise en évidence) : Économie d'impôt annuelle** (différence entre les deux scénarios).

- **Impact Technique :**
  - **`ui/views/comparatorView.js`** : Création d'une nouvelle fonction `displayCoupleComparatorView()` pour générer ce tableau spécifique.
  - Les vues détaillées par statut pourraient être adaptées pour montrer le détail du calcul pour chaque partenaire.
