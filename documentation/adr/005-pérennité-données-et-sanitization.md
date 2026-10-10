# ADR-005: Pérennité des Données via la "Sanitization" à la Volée

- **Date :** 2025-11-08
- **Statut :** Accepté ; complétée par l'ADR 008 et par la section « Versionnage du format » (2026-10-10) : les migrations de format existent désormais

## Contexte

Un principe fondamental du projet est la longévité des données de l'utilisateur. Le format des fichiers de sauvegarde est amené à évoluer au fil des versions de l'application (ajout de nouveaux champs, modification de structures). Il est crucial que l'application puisse ouvrir des fichiers créés par d'anciennes versions sans planter et sans corrompre les données. L'application doit être résiliente face à des données potentiellement obsolètes, incomplètes ou corrompues.

## Décision

Nous avons adopté une stratégie de **validation et de réparation automatique à la lecture** pour toutes les données externes (chargement de session, import de fichier). Cette stratégie repose sur deux piliers :

1.  **Zod comme Source de Vérité Unique :** La bibliothèque Zod est utilisée pour définir des schémas stricts pour toutes nos structures de données (`SessionState`, `Entity`, etc.). Ces schémas sont considérés comme la définition canonique de ce à quoi les données _doivent_ ressembler dans la version actuelle de l'application.
2.  **Un Module de "Sanitization" (`data-sanitizer.ts`) :** Toute donnée entrante est systématiquement passée à travers ce module. Il utilise `Schema.safeParse()` de Zod pour valider la structure.
    - Les champs manquants dans une ancienne sauvegarde sont automatiquement ajoutés grâce aux `.default()` définis dans les schémas Zod.
    - Les données qui ne correspondent pas au type attendu sont écartées par Zod.
    - Une passe de validation sémantique supplémentaire nettoie les incohérences logiques (ex: suppression des relations ou des flux qui pointent vers des entités qui n'existent plus).
3.  **Notification à l'Utilisateur :** Si des corrections importantes ont été effectuées, un rapport est généré et l'utilisateur en est informé via une notification ou une modale de confirmation, expliquant ce qui a été nettoyé.

## Conséquences

- **Positives :**

  - **Robustesse Exceptionnelle :** L'application ne plantera jamais à cause d'un fichier de sauvegarde mal formé ou d'une ancienne version. Elle se "guérit" elle-même.
  - **Évolutivité Sereine :** Les développeurs peuvent faire évoluer les schémas de données en toute confiance. Il suffit d'ajouter des valeurs par défaut aux nouveaux champs pour assurer la rétrocompatibilité.
  - **Maintenance Simplifiée :** Supprime le besoin de créer des scripts de migration complexes et fragiles pour chaque changement de version.
  - **Fiabilité des Données :** Garantit que l'état de l'application en mémoire est toujours sain et conforme aux schémas actuels.

- **Négatives ou Compromis :**
  - **Perte de Données Contrôlée :** Dans des cas extrêmes où des données sont totalement méconnaissables ou si une fonctionnalité est supprimée, les données correspondantes seront perdues (supprimées) lors du nettoyage. C'est un choix délibéré qui privilégie la stabilité de l'application à la conservation de données invalides.
  - **Couplage Fort à Zod :** L'architecture de la pérennité des données est intrinsèquement liée à la bibliothèque Zod. Un changement de bibliothèque de validation nécessiterait une réécriture significative de cette logique.

## Versionnage du format (2026-10-10)

La conséquence « supprime le besoin de scripts de migration » ne tient plus : les valeurs par défaut de Zod suffisent pour ajouter un champ, pas pour changer le sens d'une donnée ni la déplacer. Depuis la refonte du moteur (format 2) et l'ADR 008 (format 3), chaque fichier porte un numéro `formatVersion`, et `src/backend/logic/migrations.ts` convertit un fichier ancien, version par version, **avant** le nettoyage décrit plus haut, qui reste le second étage. La règle pour décider :

- **Pas de nouveau numéro** pour un champ facultatif dont l'absence a un sens, avec sa valeur par défaut (`.optional()`, `.default()`, `.catch()` pour écarter seule une valeur invalide) : un fichier ancien se lit tel quel, une version précédente ignore le champ (ADR 009, 014, 015). De même pour une nouvelle valeur d'une énumération (type de flux, statut) : une version précédente écarte l'élément inconnu et le signale dans son rapport.
- **Nouveau numéro et migration** quand une donnée existante change de sens ou de place (format 2 : sens de la relation « Enfant » et des dividendes ; format 3 : la grille devient celle d'une année). La migration travaille sur les données brutes, convertit ce qui peut l'être et rend des notes à l'utilisateur pour le reste ; l'original est copié à côté (`*.format-N.json`) avant la première réécriture. Un numéro plus récent que celui de l'application est lu avec un avertissement, en ignorant ce qu'elle ne connaît pas.
- Dans les deux cas, la session « maximale » (`src/lib/testing/session-maximale.ts`) doit remplir le nouveau champ ou la nouvelle valeur : le test « rien ne se perd » le vérifie.

La marche à suivre pas à pas est dans le [guide du développeur](../GUIDE_DEVELOPPEUR.md#35-faire-évoluer-le-format-de-fichier).

## Complément (octobre 2026) : robustesse de l'écriture

La relecture d'octobre 2026 (constats P1 à P6) a montré que le nettoyage ne suffisait pas : un `simulationSlots.json` tronqué échouait avant lui, était lu comme vide, puis écrasé à la sauvegarde suivante ; une écriture qui échouait affichait quand même « Sauvegarde réussie ! ». Règles adoptées, pour l'application de bureau (`src/backend/fichiers-surs.ts`, `src/backend/donnees-de-l-application.ts`) et la démo web (`src/web/stockage-navigateur.ts`, `src/web/api-navigateur.ts`) :

1. **Jamais remplacer ce qu'on n'a pas pu lire sans l'avoir copié.** Un fichier de session, de sauvegardes ou de préférences illisible (JSON invalide, pas un objet ou pas une liste ; pour la session, aussi un objet refusé en bloc par le schéma, voir plus bas) est copié octet pour octet à côté de lui sous un nom horodaté, `simulationSlots.illisible-AAAAMMJJ-HHMMSS.json`, puis retiré : il n'est pas relu au démarrage suivant. Un fichier lu mais dont une partie est écartée (sauvegarde illisible, années refusées, éléments retirés par le nettoyage) est copié en `*.refuse-AAAAMMJJ-HHMMSS.json`, puis réécrit sans eux. Une copie ne remplace jamais une copie existante (`-2`, `-3`…). La copie d'avant une conversion de format garde son nom fixe (`*.format-N.json`).
2. **Prévenir à l'ouverture.** Une boîte de dialogue dit ce qui s'est passé et nomme la copie et son dossier ; la session repart vierge, la liste des sauvegardes vide. Seules les préférences sont mises de côté sans message.
3. **Un fichier qu'on n'a pu ni lire ni copier est protégé.** Erreur de lecture autre qu'un fichier absent (droits, verrou, dossier à sa place) ou copie impossible (disque plein) : le fichier n'est plus écrit jusqu'à la fermeture, et toute écriture échoue avec un message.
4. **Écriture atomique.** Chaque écriture va dans un fichier temporaire du même dossier (`<fichier>.<pid>-<n>.tmp`), vidé sur le disque, puis renommé ; un renommage refusé un court instant sous Windows (`EPERM`, `EACCES`, `EBUSY`) est retenté. Une écriture plus ancienne qui finit après une plus récente (sauvegarde différée et enregistrement synchrone à la fermeture) ne la remplace pas.
5. **Échec signalé.** `saveSlots` renvoie `false` et le pont notifie « Échec de la sauvegarde : … Vos sauvegardes précédentes sont intactes. » ; le panneau des paramètres ne change alors ni la liste ni son état. L'échec de la sauvegarde automatique de la session ou des préférences est notifié une fois, jusqu'à la prochaine écriture réussie.
6. **Rien avant le chargement.** La sauvegarde automatique (`useDebouncedSave`) ne part qu'une fois la session chargée, et pas pour la session tout juste chargée : la session vierge provisoire ne peut pas remplacer celle du disque, même sous `StrictMode` ou si le chargement échoue.

Dans la démo web, les mêmes règles s'appliquent au stockage du navigateur : une valeur illisible est copiée sous une clé horodatée (`simulateur.sauvegardes.illisible-AAAAMMJJ-HHMMSS`) ; une clé qu'on n'a pas pu copier (stockage plein) n'est plus écrite pendant la visite ; un quota dépassé ou un stockage bloqué est notifié au lieu de « Sauvegarde réussie ! ». Une session illisible y est remplacée par la simulation d'exemple, comme à la première visite.

**Session refusée en bloc (complément du 2026-10-10).** Une session lisible mais dont le schéma refuse l'objet entier (un `name` qui n'est pas un texte, une liste d'années ou la grille d'un mois inutilisables : rien ne peut être gardé élément par élément) était remplacée en silence par une session vierge. Le nettoyage distingue désormais ce cas : `nettoyerLaSession` (`data-sanitizer.ts`) lève `SessionIrrecuperableError`, et la lecture du fichier de la session (`lireLaSession`, `fichiers-de-donnees.ts`) le traite comme un fichier illisible : copie `sessionState.illisible-AAAAMMJJ-HHMMSS.json`, message au démarrage, session vierge. La démo web fait de même (clé `simulateur.session.illisible-…`, retour à la simulation d'exemple), et le serveur MCP répond que le fichier est invalide. Le nettoyage partiel ne change pas : un élément invalide (entité, relation, flux, réglage) est écarté seul, et la session est gardée. L'import d'une simulation suit la même règle : un fichier dont rien ne peut être repris est refusé (« Erreur d'importation », la simulation en cours n'est pas remplacée) au lieu d'être importé comme une simulation vierge annoncée « importée avec succès ». `sanitizeStateAndFillDefaults` garde l'ancien comportement (session par défaut, rapport vide) pour les appelants qui n'ont rien à mettre de côté (validation d'une proposition des outils pour les IA, tests).
