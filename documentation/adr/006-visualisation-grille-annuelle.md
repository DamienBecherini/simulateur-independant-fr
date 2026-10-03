# **ADR-001: Représentation Visuelle des Flux dans la Grille Annuelle**

- **Date :** 2025-11-08
- **Statut :** Accepté

## **Contexte**

La grille de saisie annuelle (`MonthlyGrid`) affiche actuellement un total numérique pour chaque mois et chaque entité. Cette représentation est fonctionnelle mais manque de profondeur analytique. L'utilisateur ne peut pas comprendre d'un coup d'œil la composition de ce total (ex: est-ce du CA ou un salaire ?), ni comparer facilement le volume des gains à celui des dépenses.

Plusieurs approches ont été envisagées :

1.  Un seul graphique en bâtons empilés par cellule : Rejeté car il mélange des flux de nature différente (CA brut vs. Salaire net) et ne permet pas de visualiser les dépenses.
2.  Deux graphiques (gains/dépenses) avec des échelles indépendantes : Rejeté car cela empêche la comparaison directe de la magnitude entre les gains et les dépenses, qui est un besoin clé.

De plus, des clarifications sur la nature des flux (Brut/Net, HT/TTC) sont nécessaires pour guider la saisie de l'utilisateur et assurer la cohérence des calculs.

## **Décision**

Nous allons transformer chaque cellule de la grille en un mini tableau de bord visuel en adoptant la structure suivante :

1.  **Double Graphique par Cellule :** Chaque cellule affichera deux graphiques en bâtons empilés : un pour les **Gains** à gauche, et un pour les **Dépenses** à droite.
2.  **Échelle Unifiée par Entité :** Pour chaque ligne d'entité, une échelle de hauteur unique sera calculée basée sur la plus grande valeur absolue (total des gains ou des dépenses) de l'année. Cette échelle s'appliquera aux deux graphiques (gains et dépenses) sur toute la ligne, permettant une comparaison visuelle directe de leur importance relative.
3.  **Barres de Résumé :** Sous chaque graphique, une barre de résumé colorée (verte pour les gains, rouge pour les dépenses) affichera le total numérique du mois (ex: `+ 10 000 €` / `- 500 €`) et une icône directionnelle (▲/▼).
4.  **Conventions de Saisie Fortes :**
    - Pour les **Personnes Physiques**, tous les revenus saisis sont considérés comme **"Net avant prélèvement à la source"**.
    - Pour les **Sociétés**, tous les flux (CA, charges) sont considérés comme **"Hors Taxes (HT)"** pour simplifier la logique et se concentrer sur l'impact sur le résultat.
5.  **Personnalisation des Couleurs :** L'utilisateur pourra personnaliser la couleur associée à chaque type de flux via un menu de paramètres, avec une palette par défaut fournie.

## **Conséquences**

- **Positives :**

  - **Clarté Immédiate :** L'utilisateur peut instantanément comparer les gains et les dépenses pour chaque mois.
  - **Analyse de Composition :** Les barres empilées et colorées révèlent la nature des flux financiers.
  - **Intuitivité :** Le code couleur Vert/Rouge et les icônes sont universellement compris.
  - **Cohérence des Données :** Les conventions de saisie (Net avant IR / HT) clarifient ce que l'utilisateur doit entrer et ce que le simulateur calculera.
  - **Engagement :** L'interface devient plus riche, plus interactive et plus "pédagogique", conformément à la vision du projet.

- **Négatives ou Compromis :**
  - **Complexité du Composant :** Le composant `MonthlyGrid` et son nouveau sous-composant `CellChartDisplay` seront significativement plus complexes que l'affichage d'un simple nombre.
  - **Pas de Liaison Automatique :** Pour l'instant, la saisie d'une "Rémunération de dirigeant" dans une société ne crée pas automatiquement le flux de revenu correspondant pour la personne. Ce lien est logique (pour le moteur de calcul) mais pas encore transactionnel (dans l'UI).
  - **Simplification de la TVA :** La décision de tout traiter en HT pour les sociétés est une simplification forte. Elle est acceptable car le but est la simulation fiscale et non la comptabilité exacte, mais c'est un compromis à garder en tête.
