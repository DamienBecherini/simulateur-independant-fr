# Fiche du Microsoft Store

Textes et réponses à recopier dans Partner Center pour la soumission de l'application (langue de la fiche : **français (France)**). La marche à suivre est dans [publier-sur-le-store.md](./publier-sur-le-store.md). Les limites de longueur indiquées sont celles affichées par Partner Center en octobre 2026 ; Partner Center les rappelle sous chaque champ.

## Identité de la fiche

| Champ | Valeur |
|---|---|
| Nom réservé (titre de la fiche) | Simulateur Indépendant FR |
| Titre court | Simulateur Indépendant |
| Titre de tri | Simulateur Indépendant FR |
| Développé par | Damien Becherini |
| ID Store et adresse publique | `9PJBJWX5WS72`, <https://apps.microsoft.com/detail/9PJBJWX5WS72> (publiée le 13 octobre 2026) |
| Copyright | © Damien Becherini — licence MIT |
| Conditions de licence supplémentaires | Logiciel libre sous licence MIT : https://github.com/DamienBecherini/simulateur-independant-fr/blob/main/LICENSE |
| Site web | https://damienbecherini.github.io/simulateur-independant-fr/ |
| Contact du support | simulateur-independant@damien.becherini.fr |
| URL de la politique de confidentialité | https://github.com/DamienBecherini/simulateur-independant-fr/blob/main/documentation/mentions-legales.md |

**Politique de confidentialité.** Obligatoire pour une application de bureau empaquetée (politique 10.5.1 du Store). L'URL retenue est celle des mentions légales du dépôt, sur la branche `main` : publique, lisible sans JavaScript, et tenue à jour avec le texte de l'application (`npm run mentions-legales`). La page des mentions légales de la démo web (`…/simulateur-independant-fr/#mentions-legales`) dit la même chose, mais dépend de l'adresse interne de la démo. Partner Center la demande même quand la réponse à la question sur les informations personnelles est « No » (application de bureau avec la capacité `runFullTrust`, relevé le 2026-10-12). Si le fichier change de nom un jour, mettre à jour l'URL dans Partner Center (cela ne demande pas de nouveau paquet).

## Description courte

> Simulez cotisations, impôt du foyer et net dans la poche selon votre statut d'indépendant (micro-entreprise, EI, EURL, SASU), et comparez les statuts. Hors ligne, gratuit et open source.

## Description

> Simulateur Indépendant FR aide les indépendants français à y voir clair : combien il reste vraiment dans la poche du foyer selon le statut juridique, la rémunération et les dividendes.
>
> Décrivez votre situation : les personnes du foyer, vos activités (micro-entreprise, entreprise individuelle au réel, EURL, SASU) et leurs liens (mariage, PACS, enfants, présidence, gérance). Saisissez vos revenus et charges mois par mois dans une grille annuelle. Le simulateur calcule les cotisations de chaque activité, puis l'impôt sur le revenu du foyer (quotient familial, décote, dividendes au prélèvement forfaitaire ou au barème), et affiche le net dans la poche et le taux global de prélèvement. Tout se recalcule à chaque modification.
>
> Comparez les statuts : pour une activité, le net, les prélèvements, les frais de fonctionnement et les trimestres de retraite validés en SASU, EURL, EI au réel, micro-entreprise (avec ou sans versement libératoire) et portage salarial. En société, trouvez le partage entre rémunération et dividendes qui donne le meilleur net, avec ou sans l'exigence de valider quatre trimestres de retraite.
>
> Plusieurs années, chacune avec ses règles fiscales (2024 à 2026), des situations types à adapter, des sauvegardes nommées, et des exports CSV, PDF et Markdown.
>
> Vos données restent sur votre ordinateur : pas de compte, pas de serveur, pas de publicité ni de mesure d'audience. L'application fonctionne entièrement hors ligne.
>
> Pour les utilisateurs d'un assistant d'IA de bureau (Claude Desktop, LM Studio…), un serveur MCP local permet à l'IA de lire votre simulation, de la faire calculer et de proposer des ajouts, que vous acceptez ou refusez dans l'application.
>
> Important : les résultats sont des estimations simplifiées, à titre indicatif. Ils ne remplacent pas l'avis d'un expert-comptable.
>
> Logiciel libre (licence MIT) : le code est sur GitHub.

## Nouveautés de cette version

Pour la première soumission (version 0.11.0) : **laisser le champ vide**, comme le demande Partner Center.

Pour les suivantes, reprendre la section de la version dans [CHANGELOG.md](../../CHANGELOG.md), en quelques lignes, du point de vue de l'utilisateur (1 500 caractères au plus).

### Version 0.14.0

```text
Version 0.14.0

- Zone franche urbaine (ZFU-TE) ou quartier prioritaire (QPV) : une case exonère d'impôt le bénéfice de l'activité, selon sa date de création ; une nouvelle situation type le montre.
- « Comparer et optimiser » en trois étapes : ce qui est comparé, le résultat avec le meilleur net mis en évidence, puis les réglages de la société (rémunération ou dividendes, 4 trimestres de retraite colonne par colonne).
- Le comparateur tient compte de la perte ou du bénéfice gardé dans la société, et une société ne verse plus une rémunération qu'elle ne gagne pas ; la saisie rappelle la limite.
- Protection sociale comparée garantie par garantie, notes et précisions dans des bulles.
- Grille : la rémunération et les dividendes aussi sur la ligne de qui les reçoit ; ajouts et retraits animés.
- Saisie d'un mois : « Appliquer à » se choisit après la modification ; l'aide à la saisie devient une liste.
- Situations types : une recherche et des filtres.
- Zoom : niveau affiché, retour à 100 % (Ctrl+0), interface lisible de 50 % à 200 %.
- Corrections : structures impossibles (deux titulaires, deux présidents), plafonds de deux micro-entreprises d'une même personne, fenêtres et barre d'outils sous un zoom.
```

### Version 0.13.0

```text
Version 0.13.0

- Portage salarial : une nouvelle colonne du comparateur, avec les conditions de la société de portage réglables (frais de gestion, contrat, effectif…).
- « Combien facturer pour un net visé ? » : pour chaque statut, le chiffre d'affaires qui donne le net du foyer que vous visez.
- « Ajouter un conjoint » sur la carte d'une personne seule, et une nouvelle situation type « SASU avec un conjoint salarié ailleurs ».
- Avec une IA : elle peut proposer de supprimer plusieurs éléments ou de repartir de zéro, toujours après votre accord ; si vous le choisissez, elle peut aussi modifier directement la simulation, chaque modification s'annulant d'un clic.
- Affichage « Trois vues » par défaut, lignes alternées dans les tableaux, grille plus facile à toucher, croix pour fermer les notifications.
- Corrections : fenêtres qui débordaient de l'écran avec l'interface agrandie, contrastes des notifications et du thème sombre, paramètres accessibles sur un petit écran, mises à jour de sécurité.
```

## Fonctionnalités du produit

Une par ligne dans Partner Center (vingt au plus) :

1. Net dans la poche du foyer et taux global de prélèvement, recalculés à chaque modification
2. Micro-entreprise, entreprise individuelle au réel, EURL et SASU
3. Impôt sur le revenu calculé par foyer fiscal : quotient familial, décote, dividendes
4. Comparateur de statuts, portage salarial compris : net, prélèvements, frais et protection sociale, garantie par garantie
5. Rémunération ou dividendes : la répartition qui donne le meilleur net
6. Combien facturer pour un net visé, statut par statut
7. Grille annuelle des revenus et charges, mois par mois
8. Plusieurs années de simulation, chacune avec ses règles fiscales
9. Situations types préremplies et expliquées, avec leurs sources
10. Frais réels et barème kilométrique
11. Exonération d'impôt en zone franche urbaine ou en quartier prioritaire
12. Sauvegardes nommées, import et export JSON
13. Exports CSV pour Excel, PDF mis en page et rapport Markdown
14. Annuler et rétablir, sauvegarde automatique, zoom de 50 % à 200 %
15. 100 % hors ligne : aucune donnée ne quitte l'ordinateur
16. Serveur MCP local pour les assistants d'IA de bureau, avec validation de chaque proposition
17. Gratuit, sans publicité, open source (licence MIT)

## Mots-clés

Sept au plus, 40 caractères chacun et 21 mots en tout. Les mots du titre (« simulateur », « indépendant ») comptent déjà pour la recherche : les mots-clés servent aux termes que les gens tapent et qui n'y sont pas. Taper chacun puis Entrée, sans reprendre les suggestions de l'IA de Partner Center (« simulateur EURL »…), qui répètent le titre.

1. auto-entrepreneur
2. micro-entreprise
3. SASU
4. EURL
5. cotisations sociales
6. impôt sur le revenu
7. statut juridique

## Catégorie

- **Catégorie recommandée : Entreprise (Business), sous-catégorie Comptabilité et finances (Accounting & finance).** Le public est celui des indépendants et dirigeants de petites sociétés, qui choisissent un statut et une rémunération : c'est là qu'ils cherchent.
- Alternative : Finances personnelles (Personal finance), si l'on veut viser plutôt le budget du foyer. Productivité est trop large.

## Captures d'écran

Dans [captures/](./captures/) : 1366 × 768 pixels (la taille minimale demandée pour une application de bureau), sur la simulation fictive de la démo web (famille Martin), régénérées par `npm run captures` (fichier `captures/store.captures.ts`).

| Fichier | Écran | Légende proposée |
|---|---|---|
| `1-simulation.png` | Personnes et activités du foyer, avec le résumé du net (66 710 €) | Décrivez votre foyer et vos activités, et leurs liens |
| `2-grille.png` | Grille de saisie annuelle, avec revenus et charges mois par mois | Saisissez vos revenus et charges mois par mois |
| `3-resultats.png` | Résultats de simulation | Le net dans la poche et le taux global de prélèvement, par foyer et par activité |
| `4-comparateur.png` | Comparateur de statuts, étape 2 : le tableau, meilleur net mis en évidence | Comparez SASU, EURL, EI, micro-entreprise et portage salarial sur votre situation |
| `5-remuneration-ou-dividendes.png` | Rémunération ou dividendes | Trouvez la rémunération qui donne le meilleur net |

Pistes pour compléter (jusqu'à dix captures) : la grille annuelle avec la fenêtre d'un flux ouverte, les situations types, le mode sombre, l'export PDF. Éviter la fenêtre « Utiliser avec une IA » : elle affiche les chemins réels du poste, donc le nom de l'utilisateur.

## Logos de la fiche

Dans [logos/](./logos/), générés depuis l'icône de l'application par `scripts/generer-images-store.ps1` : `icone-300x300.png` (logo carré 1:1, 300 × 300), `boite-1080x1080.png` (illustration 1:1), `affiche-720x1080.png` (affiche 2:3). Seul le logo carré est utile pour une application ; les deux autres sont facultatifs. Les images du paquet lui-même (tuiles, icône de la barre des tâches) sont dans `build/appx/`.

## Classification par âge (questionnaire IARC)

Page **Age ratings** de Partner Center : *I'm ready to complete the International Age Rating Coalition (IARC) questionnaire*, puis *App Type* : **All Other App Types** (ni un jeu, ni une application de communication). Questions telles qu'elles s'affichent (relevées le 2026-10-11) :

| Section | Question | Réponse | Pourquoi |
|---|---|---|---|
| Downloaded App | Does the app contain any ratings-relevant content (e.g., sex, violence, language) downloaded as part of the app package? | No | Aucun contenu de ce type |
| User Content Sharing | Does the app natively allow users to interact or exchange content with other users…? | No | Aucune messagerie ni contenu partagé dans l'application. « Donner mon avis » ouvre le navigateur ou la messagerie de l'utilisateur, hors de l'application |
| Online Content | Does the app feature or promote content that isn't part of the initial app download, but can be accessed from the app? | No | L'application fonctionne hors ligne et ne charge aucun contenu ; les liens vers les sources officielles s'ouvrent dans le navigateur. Les propositions d'un assistant d'IA (serveur MCP) viennent d'un logiciel installé et choisi par l'utilisateur, et ne sont que des montants qu'il accepte ou refuse |
| Promotion or Sale of Age-Restricted Products or Activities | Does the app focus on promoting or selling items or activities that are typically age-restricted…? | No | Simulation fiscale, ni jeu d'argent ni produit réservé aux adultes |
| Miscellaneous | Does the app share the user's current and precise physical location with other users? | No | |
| Miscellaneous | Does the app allow users to purchase digital goods? | No | Gratuite, sans achat intégré |
| Miscellaneous | Does the app include cash rewards, gift cards, play-to-earn features, convertible cryptocurrency rewards…? | No | |
| Miscellaneous | Is the app a web browser or search engine? | No | L'application ne charge aucune page web |
| Miscellaneous | Is the app primarily a news or educational product? | No | Un outil de simulation, pas un média ni un produit éducatif |
| — | Will this product use ratings obtained directly from a ratings board, and/or will it be distributed on physical media in any region? | No | |

La question des informations personnelles est posée dans **Properties** (*Privacy policy*) : **No**, tout reste sur l'ordinateur (voir la politique de confidentialité).

Classification attendue : **3+ (PEGI 3, ESRB Everyone)**.

## Justification de la capacité `runFullTrust`

Après le dépôt du paquet, la page **Packages** avertit que la capacité restreinte `runFullTrust` doit être approuvée. La justification se donne dans **Submission Options** (Options de soumission), rubrique « Restricted capabilities », champ « Why do you need the runFullTrust capability, and how will it be used in your product? ». Ce champ est limité à **500 caractères** (relevé le 2026-10-12) : la version longue précédente était coupée. **À coller : la version anglaise courte ci-dessous** (395 caractères) :

> Win32 desktop app (Electron) packaged as MSIX (Desktop Bridge): runFullTrust is required for this kind of app. It only reads and writes its own data folder and files the user picks (import, exports). An execution alias lets a desktop AI assistant installed by the user start its local MCP server over standard input/output, with no network access. No service, no driver, no administrator rights.

Version française, pour mémoire (ne pas la coller : elle dépasse 500 caractères) :

> Simulateur Indépendant FR est une application de bureau Win32 (Electron) empaquetée en MSIX (Desktop Bridge) : runFullTrust est la capacité requise pour toute application de ce type. L'application lit et écrit ses données dans son dossier de données utilisateur et dans les fichiers que l'utilisateur choisit (import, export CSV, PDF, Markdown). Elle déclare un alias d'exécution (simulateur-independant-fr.exe) pour qu'un assistant d'IA de bureau installé par l'utilisateur puisse lancer son serveur MCP local, sur l'entrée et la sortie standard, sans réseau. Elle n'installe aucun service ni pilote et ne demande pas de droits d'administrateur.

## Notes pour la certification

**Où :** page **Informations supplémentaires sur les tests** (*Additional Testing Information*), dernière entrée du menu de gauche de Partner Center, sous *Infos supplémentaires*. Elle n'a qu'un champ de texte libre, lu par les testeurs de Microsoft qui certifient l'application : y coller **tout le bloc ci-dessous**, d'un seul tenant (l'anglais d'abord, pour les testeurs, puis le français), et enregistrer. La page **Options de soumission** y renvoie.

**Pourquoi :** les testeurs ouvrent l'application sans rien savoir d'elle. Les notes leur disent qu'elle n'a besoin ni de compte ni de connexion, comment voir un exemple complet (la version de bureau démarre sur une simulation vide), et que les fonctions qui ouvrent le navigateur, la messagerie ou un client d'IA sont normales et facultatives : sans ces notes, une simulation vide ou un lien externe peut passer pour un défaut.

```text
The app works fully offline: no account and no connection are needed. On first launch the simulation is empty, under a "Que voulez-vous savoir ?" panel of common questions. To see a complete example, click one of these questions, or "Situations types" in the toolbar at the top of the window (or open Settings, the gear icon at the top left, then "Partir d'une situation type..."), and load one of the examples. Results are recalculated on every change.

Results are simplified estimates for information only, not professional accounting advice; the app says so in its results and in its legal notice (Settings, or the footer link "Mentions légales et confidentialité").

The "Donner mon avis" (feedback) button opens the browser (GitHub) or the user's mail client; nothing is sent without the user's action. The "Utiliser avec une IA (MCP)" feature requires a desktop AI client installed separately (Claude Desktop, LM Studio); it is not needed to test the app.

---

L'application fonctionne entièrement hors ligne : aucune connexion ni aucun compte n'est nécessaire. Au premier lancement, la simulation est vide, sous un encart « Que voulez-vous savoir ? » qui propose des questions courantes. Pour voir un exemple complet, cliquer sur l'une de ces questions, ou sur « Situations types » dans la barre d'outils en haut de la fenêtre (ou ouvrir les Paramètres, icône en haut à gauche, puis « Partir d'une situation type... »), et charger l'un des exemples. Les résultats se recalculent à chaque modification.

Les résultats sont des estimations simplifiées, à titre indicatif, pas un conseil d'expert-comptable ; l'application le dit dans ses résultats et dans ses mentions légales (Paramètres, ou pied de page : « Mentions légales et confidentialité »).

Le bouton « Donner mon avis » ouvre le navigateur (GitHub) ou la messagerie de l'utilisateur ; rien n'est envoyé sans son action. La fonction « Utiliser avec une IA (MCP) » demande un client d'IA de bureau installé séparément (Claude Desktop, LM Studio) ; elle n'est pas nécessaire pour tester l'application.
```

Avant de coller : vérifier dans l'application les libellés cités (« Que voulez-vous savoir ? », « Situations types », « Partir d'une situation type... », « Mentions légales et confidentialité »), et les adapter si l'interface a changé.
