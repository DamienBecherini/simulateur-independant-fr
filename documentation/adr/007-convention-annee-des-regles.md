# ADR-007: Convention d'année des règles fiscales et sociales

- **Date :** 2026-10-04
- **Statut :** Accepté ; intégration appliquée le 2026-10-09 (voir « Intégration »)

## Contexte

Le simulateur ne connaît aujourd'hui qu'une année de règles : `src/backend/config.json`, typé par `ReglesFiscales` (`src/backend/logic/regles.ts`) et exposé sous le nom `reglesEnVigueur`. Son champ `annee` vaut 2026, mais ses valeurs mélangent deux lectures de « 2026 » :

- les cotisations sociales, le plafond de la sécurité sociale (PASS), le SMIC, les plafonds et taux de la micro-entreprise, l'impôt sur les sociétés et les prélèvements sociaux sur les dividendes sont ceux **en vigueur pendant 2026**, qui frappent l'activité et les revenus de 2026 ;
- le barème de l'impôt sur le revenu est décrit comme le « barème 2026 de l'impôt sur le revenu (revenus 2025) » : celui de la loi de finances pour 2026, qui impose les revenus **de 2025**.

Ce décalage tient au calendrier fiscal : la loi de finances de l'année N+1 fixe le barème qui imposera les revenus de l'année N (elle est votée en fin d'année N ou au début de N+1, l'impôt est liquidé à l'été N+1). Les revenus de 2026 seront donc imposés selon la loi de finances pour 2027, qui n'est pas votée en octobre 2026.

La phase 13 (« Plusieurs années ») va enchaîner plusieurs années : revenu fiscal de référence de N-2 pour le versement libératoire, bénéfice mis en réserve, ACRE la première année. Avec plusieurs fichiers de règles (`src/backend/regles/2024.json`, `2025.json`, puis 2026), il faut une seule lecture de l'année, sans quoi une simulation « 2025 » mélangerait des règles de 2024, 2025 et 2026.

D'autres règles changent en cours d'année : taux de cotisation des micro-entrepreneurs libéraux au 1er juillet 2024, ACRE ramenée à 25 % pour les micro-entreprises créées à partir du 1er juillet 2026. Le schéma actuel ne porte qu'une valeur par paramètre et par année.

## Décision

**L'année N d'un fichier de règles est l'année de l'activité et des revenus simulés.** Chaque paramètre prend la valeur qui s'applique à l'activité ou aux revenus de N :

1. **Impôt sur le revenu** (barème, plafonnement du quotient familial, décote, déduction de 10 %) : valeurs de la **loi de finances pour N+1**, qui impose les revenus de N. Tant qu'elle n'est pas votée, on reprend celles de la dernière loi de finances connue (loi de finances pour N, revenus N-1), et la `description` le dit explicitement.
2. **Versement libératoire** : le plafond de revenu fiscal de référence est celui qui ouvre droit à l'option **pour l'année N**, apprécié sur le revenu fiscal de référence de N-2 (limite de la deuxième tranche du barème qui a imposé les revenus de N-2). C'est cette valeur que la phase 13 comparera au revenu fiscal de référence calculé pour N-2.
3. **Cotisations et contributions sociales, PASS, SMIC, plafonds et taux de la micro-entreprise, ACRE, impôt sur les sociétés, prélèvements sociaux sur les dividendes, seuils de franchise de TVA** : valeurs **en vigueur pendant l'année N**, qui s'appliquent à l'activité, aux revenus, aux dividendes versés et au chiffre d'affaires de N.
4. **Changement en cours d'année** : le fichier garde la valeur **en vigueur au 1er janvier de N** ; la `description` donne la nouvelle valeur et sa date. C'est déjà le cas de l'ACRE dans le fichier 2026 (50 %, 25 % après le 1er juillet 2026, non distingué). Le prorata temporis (phase 15) pourra plus tard affiner ces cas.
5. **Structure absente une année** (par exemple l'assiette unique des cotisations des travailleurs non salariés, avec son abattement de 26 %, qui n'existe qu'à partir des revenus de 2025) : on représente l'année aussi fidèlement que le schéma le permet, sans inventer de valeur officielle, et la `description` du bloc dit précisément ce qui est approché.

**Forme des fichiers.** Un fichier par année, `src/backend/regles/<N>.json`, exactement de la même forme que les autres années : mêmes clés, mêmes `description` et `source` (adresses directes des pages officielles consultées), champ `annee` égal à N et `derniereMiseAJour`. Le champ `annee` existe déjà dans `ReglesFiscales` ; aucune modification du schéma n'est nécessaire. Des tests (`src/backend/regles/*.test.ts`) vérifient que chaque fichier respecte `ReglesFiscales` et la forme des autres années, et la cohérence d'une année à l'autre.

**Intégration.** Le moteur charge le fichier de l'année simulée (`reglesDeLAnnee`, `src/backend/logic/regles.ts`) et reprend le dernier connu pour une année plus récente, avec un avertissement (phase 13). Depuis la relecture d'octobre 2026, toutes les années ont le même statut :

- **Un fichier par année, y compris l'année en cours** : `src/backend/regles/2024.json`, `2025.json`, `2026.json`. L'ancien `src/backend/config.json` (« l'année en cours ») est devenu `regles/2026.json`.
- **Une seule liste des fichiers** : `src/backend/regles/index.ts` (`FICHIERS_DE_REGLES`), écrite à la main parce que le même moteur tourne sous Node (Electron, serveur MCP empaqueté) et dans la page (Vite) ; un test vérifie que chaque fichier du dossier y figure et que les années se suivent.
- **L'année en cours est dérivée, jamais écrite** : `ANNEE_COURANTE` est la plus récente des années de la liste. Elle donne l'année d'une nouvelle session (`ANNEE_PAR_DEFAUT` de `src/types.ts`) et l'année annoncée par la démo ; les calculs, eux, prennent toujours les règles de l'année simulée. Ajouter le fichier de 2027 suffit à la faire avancer.
- **Ce qui ne suit pas l'année en cours** : les cas de référence (`testing/cas-de-reference.ts`) et les montages types (`ANNEE_DES_MONTAGES`) sont figés sur 2026, dont ils portent les chiffres dérivés à la main ; 2027 aura les siens. `ANNEE_DES_SESSIONS_D_UNE_ANNEE` (`migrations.ts`) est une valeur historique qui ne change jamais.

**Ajouter une année N.** Écrire `regles/<N>.json` (règles 1 à 5 ci-dessus), l'ajouter à `FICHIERS_DE_REGLES`, compléter les tests nommés par année de `regles/regles.test.ts` ; au vote de la loi de finances pour N, mettre à jour l'impôt sur le revenu du fichier N-1 (règle 1).

## Conséquences

- **Positives :**
  - Une simulation de l'année N n'utilise que des règles qui frappent N : cotisations, impôt sur les sociétés et impôt sur le revenu décrivent la même année d'activité.
  - Le versement libératoire de N se vérifie avec une seule valeur du fichier N et le revenu fiscal de référence calculé pour N-2.
  - Les règles d'une année passée deviennent définitives (sauf loi rétroactive) : le fichier 2024 et le fichier 2025 ne bougent plus une fois la loi de finances pour 2026 votée.
  - Pas de changement du schéma ni du moteur.
  - Ajouter une année ne touche ni le code du moteur ni les cas de référence des années précédentes.
- **Négatives ou Compromis :**
  - Le fichier de l'année en cours est provisoire pour l'impôt sur le revenu : jusqu'au vote de la loi de finances pour N+1, il reprend le barème de l'année précédente (en pratique, une indexation de 1 à 2 % manque). Il faudra le mettre à jour chaque hiver.
  - Le fichier 2025 a donc le même barème d'impôt sur le revenu que le fichier 2026 actuel (loi de finances pour 2026) ; les tests de cohérence acceptent l'égalité d'une année à l'autre.
  - Une seule valeur par année : les changements en cours d'année (taux micro libéral de 2024, ACRE de 2026) sont approchés par la valeur du 1er janvier.
  - Les années antérieures à une réforme de structure (assiette des travailleurs non salariés avant 2025) ne sont qu'approchées par le schéma actuel ; il faudrait l'enrichir pour les reproduire exactement.
  - Le fichier de 2026 suit la règle 1 : barème de la loi de finances pour 2026, repris pour les revenus de 2026 en attendant la loi de finances pour 2027, et sa description le dit.
