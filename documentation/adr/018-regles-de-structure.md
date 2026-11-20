# ADR-018: Règles de structure : qui peut tenir quel rôle dans une activité

- **Date :** 2026-11-20
- **Statut :** Accepté (2026-11-20)

## Contexte

Pendant la recette de la version suivante, le propriétaire a relié deux personnes comme « Titulaire » de la même micro-entreprise. La saisie l'acceptait ; le calcul attribuait tout le revenu à la première, sans rien dire de la seconde.

Le défaut ne tenait pas à un oubli isolé. Les règles qui disent qui peut tenir quel rôle dans une activité étaient réécrites à quatre endroits, sans lien entre eux :

- la fenêtre des relations (`src/lib/graph-logic.ts`) ;
- la validation des propositions des IA (`outils/commun.ts`) ;
- le calcul, qui choisissait « le premier » et avertissait dans certains cas seulement (`routage-des-flux.ts`) ;
- la lecture d'une sauvegarde ou d'un fichier importé, qui ne vérifiait rien.

L'examen des sociétés a montré le même genre de défaut :

- deux présidents sur une SASU étaient acceptés à la saisie ;
- tout président ou gérant était compté d'office comme associé : un président non associé recevait des dividendes.

### Ce que disent les textes (consultés le 2026-11-20)

- **SAS et SASU : un président.** « La société est représentée à l'égard des tiers par un président désigné dans les conditions prévues par les statuts » (article L227-6 du Code de commerce). Les statuts peuvent prévoir un directeur général ou un directeur général délégué, pas un second président. Le président peut être associé ou non.
- **SARL et EURL : un ou plusieurs gérants**, personnes physiques, qui « peuvent être choisis en dehors des associés » (article L223-18 du Code de commerce).
- **Régime social du gérant d'EURL.** Le gérant associé unique est travailleur non salarié. Le gérant non associé, s'il est rémunéré, est assimilé salarié et relève du régime général (service-public.fr, F36239).
- **Une SASU ou une EURL n'a qu'un associé.** Avec plusieurs associés, la société est une SAS ou une SARL.

## Décisions du propriétaire (2026-11-20)

1. **Le président d'une SASU n'est plus compté d'office comme associé.** Il ne reçoit des dividendes que relié aussi par « Associé ». Les sauvegardes existantes sont converties pour que leurs chiffres ne changent pas.
2. **Une SASU ou une EURL à plusieurs associés reste acceptée**, avec l'avertissement existant : les dividendes sont partagés à parts égales, la répartition du capital n'est pas modélisée.
3. **Le gérant d'EURL non associé n'est pas proposé** : le simulateur ne le calcule pas, et ne donne pas un chiffre faux à la place.
4. **Un second gérant d'EURL reste accepté**, avec l'avertissement existant (décision du 2026-11-20, après la recette) : le droit l'admet (article L223-18), le calcul ne rémunère que le premier et le dit.
5. **Une personne titulaire de plusieurs micro-entreprises reste acceptée, avec un avertissement, et leurs plafonds se calculent sur le total** (décision du 2026-11-20, le soir). Plusieurs sociétés pour une même personne restent permises : le droit n'y met pas de limite.

## Décision

### Une seule table, lue par tous

`src/backend/logic/regles-de-structure.ts` porte `REGLES_DE_STRUCTURE` : pour chaque forme d'activité, les rôles qu'une personne peut y tenir, et pour chaque rôle :

- s'il fait **diriger** l'activité (rémunération de dirigeant, revenu du titulaire) ;
- s'il fait de la personne un **associé** (dividendes, part du résultat) ;
- son **maximum** de personnes, avec sa raison, écrite pour l'utilisateur ;
- les rôles qu'une même personne **ne cumule pas** avec lui ;
- s'il est **hors saisie** : connu du calcul, jamais proposé.

| Forme | Rôle | Dirige | Associé | Maximum | Ne se cumule pas avec |
|---|---|---|---|---|---|
| SASU | Président | oui | non | 1 (article L227-6) | Salarié |
| SASU | Associé | non | oui | aucun | |
| SASU | Salarié | non | non | aucun | Président |
| EURL | Gérant | oui | oui | aucun | Salarié |
| EURL | Associé | non | oui | aucun | |
| EURL | Salarié | non | non | aucun | Gérant |
| Entreprise individuelle | Titulaire | oui | | 1 | Salarié |
| Entreprise individuelle | Salarié | non | | aucun | Titulaire |
| Micro-entreprise, portage | Titulaire | oui | | 1 | Salarié |
| Micro-entreprise, portage | Salarié (hors saisie) | non | | aucun | Titulaire |

Deux sortes de limites y figurent, et leur raison le dit : ce que le droit interdit (un second président), et ce que le simulateur ne calcule pas (un gérant non associé).

Le gérant d'une EURL est associé par sa seule relation « Gérant ». C'est ainsi que la décision 3 s'applique : il n'existe aucun moyen de saisir un gérant non associé, et l'aide affichée au choix de la relation le dit.

Les salariés d'une micro-entreprise ou d'une activité en portage sont « hors saisie » : leur coût n'y réduit ni cotisations ni impôt, la saisie ne les propose donc pas, mais une activité qui change de statut garde les siens.

### Qui lit la table

- **La saisie** : `getAvailableRelationships` ne propose que les rôles de `rolesDisponibles`.
- **Les propositions des IA** : `verifierNouvelleRelation` refuse ce que `obstacleAuRole` refuse, avec la même raison, en une phrase (`phraseDeLObstacle`).
- **Le calcul** : `dirigeantsDe` et `associesDe` (`routage-des-flux.ts`) remplacent les listes de relations écrites en dur.
- **Les avertissements du calcul** : `anomaliesDeStructure` signale, sur la carte de l'activité, ce qu'une sauvegarde ancienne ou un fichier importé contredit : un rôle que la forme n'a pas (ignoré par le calcul), un rôle tenu par trop de personnes (le calcul retient la première), la direction et le salariat cumulés.
- **La création et la conversion** : `rolesDeQuiExerce` donne les rôles de la personne qui exerce seule une activité. En SASU : « Président » et « Associé ».

### Format de fichier : version 4

Le sens d'une donnée existante change (la relation « Président » ne vaut plus associé) : nouveau numéro et migration, selon l'ADR 005.

`migrerV3VersV4` ajoute la relation « Associé » à chaque président d'une SASU qui ne l'a pas. Jusqu'au format 3, tout président était associé : les chiffres ne changent pas, aucune note n'est affichée. Un fichier au format 4 où un président n'a pas cette relation décrit un président non associé.

Un fichier au format 4 ouvert par une version précédente y est signalé « créé par une version plus récente », puis lu avec ce qu'elle connaît : elle compte le président comme associé, comme avant.

### Changement de statut et comparateur

- La personne qui exerçait l'activité **en la possédant** en reste l'associée : devenue présidente d'une SASU, elle reçoit aussi « Associé », et la confirmation le dit. Un président qui n'était pas associé ne le devient pas.
- En EURL, la relation « Associé » du gérant ferait double emploi : elle est retirée sans rien annoncer.
- Quand le nouveau statut n'admet qu'un dirigeant, le premier le reste. Un cogérant d'EURL reste associé d'une société, et quitte une activité qui n'a pas d'associé.
- L'associé salarié qui reprend à son nom une société sans dirigeant n'en reste pas le salarié.

Les trois derniers points ont été trouvés par le test exhaustif ci-dessous, pas par relecture.

### Tests exhaustifs

`src/lib/regles-de-structure.exhaustif.test.ts` construit toutes les combinaisons : une activité de chaque forme, deux personnes, chacun des cinq rôles présent ou absent (1 024 structures par forme), puis trois personnes sur les rôles permis. Il vérifie, en une seconde et demie :

1. la saisie et les IA proposent exactement les mêmes relations, dans toutes les situations, et dans les deux sens de la saisie ;
2. ce qu'elles laissent construire est exactement ce que le calcul tient pour régulier ; tout le reste est signalé ;
3. le calcul ne perd ni ne crée d'argent (ce que l'activité verse arrive aux personnes, ou reste « non rattaché »), et seul qui dirige ou est associé en reçoit ;
4. un changement de statut, ou une colonne du comparateur, ne fabrique jamais une structure irrégulière.

`regles-de-structure.test.ts` fige le contenu de la table : la changer est un acte délibéré.

### Une personne, une entreprise individuelle

Une personne physique n'a qu'une entreprise individuelle, micro-entreprise ou au réel, qui réunit toutes ses activités en nom propre. Ses seuils s'apprécient sur le chiffre d'affaires de l'ensemble : « un seuil global » pour « l'ensemble des activités exercées par l'entreprise », pour le régime micro comme pour la franchise en base de TVA (service-public.fr, F33339).

La saisie laisse pourtant créer plusieurs micro-entreprises pour une même personne : c'est la façon naturelle d'y décrire deux activités (deux professions, deux fiches). Elle n'est pas refusée ; le calcul fait ce que le droit ferait d'une seule entreprise, et le dit.

- **Qui est réuni** : `entreprisesDuTitulaire` (`regles-de-structure.ts`) donne les entreprises en nom propre (micro-entreprise, entreprise individuelle au réel) dont la même personne est titulaire. Le portage n'en est pas (un salarié porté), ni les sociétés.
- **L'avertissement**, sur la carte de chacune (`anomaliesDeStructure`) : « « Alice » est titulaire de plusieurs entreprises en nom propre (« Conseil », « Formation ») : une personne n'a qu'une entreprise individuelle… »
- **Les plafonds sur le total**, pour les micro-entreprises réunies (`microsReunies`, `chiffreAffairesReuni`, `dispositifs.ts`) :
  - plafonds du régime micro et franchise de TVA de l'année (`verifierLesSeuils`, `calculsAE.ts`), les soins exonérés de TVA de chacune mis à part ; l'avertissement dit que le chiffre d'affaires est réuni, et de quelles activités ;
  - sortie du régime après deux années de dépassement, et retour : elles sortent et reviennent ensemble (`auDelaDesPlafonds`) ;
  - colonnes micro du comparateur (`horsPlafond`), y compris quand une société comparée devient la seconde micro-entreprise de son dirigeant ;
  - avertissement du changement de statut vers la micro-entreprise (`src/lib/changement-de-statut.ts`).
- **Ce qui reste par activité** : cotisations (proportionnelles au chiffre d'affaires, donc identiques), abattement, ACRE, versement libératoire, profession. L'année de création, les plafonds sont ceux de la plus ancienne des micro-entreprises réunies : une activité ajoutée à une entreprise qui existait déjà ne les réduit pas.

Une micro-entreprise et une entreprise individuelle au réel du même titulaire sont signalées, sans être réunies : chacune est calculée dans son régime.

## Conséquences

- **Positives**
  - Une règle ajoutée à la table vaut pour la saisie, les IA et le calcul.
  - Un président non associé se saisit, et ne reçoit plus de dividendes.
  - Les structures irrégulières des anciennes sauvegardes sont dites, avec ce que le calcul en fait.
- **Négatives ou à surveiller**
  - Qui relie à la main un président à une SASU doit ajouter « Associé » pour qu'il reçoive des dividendes. L'aide affichée au choix de la relation le dit, et l'avertissement « Dividendes versés sans associé » le rappelle. L'ajout d'une activité et les situations types créent les deux relations.
  - Deux relations vers la même société s'affichent sur la ligne du président. Le bouton qui en retire une nomme donc la relation (« Supprimer la relation « Associé » avec… »).
  - Les outils pour les IA exigent désormais un associé pour proposer des dividendes (« Associé », ou « Gérant » en EURL).

## Non modélisé

- La répartition du capital entre associés : dividendes à parts égales, avec un avertissement.
- Le gérant d'EURL non associé (assimilé salarié), et les gérants minoritaires ou égalitaires d'une SARL.
- La rémunération de plusieurs gérants : elle va au premier, avec l'avertissement existant.
- Un président personne morale ; un directeur général de SAS.
- L'entreprise individuelle unique d'une personne titulaire d'une micro-entreprise et d'une entreprise au réel : les deux sont calculées côte à côte, avec un avertissement.
- Le plafond de la sécurité sociale partagé entre plusieurs employeurs : le président de deux SASU cotise société par société, ce qui majore un peu ses cotisations plafonnées (environ 1 000 € pour deux rémunérations de 40 000 €, mesuré le 2026-11-20).

## À vérifier

- Le numéro exact de l'alinéa de l'article L311-3 du code de la sécurité sociale qui vise le gérant non associé d'une EURL : la fiche de service-public.fr est citée à sa place.
- La règle du plafond de la sécurité sociale pour un dirigeant rémunéré par plusieurs sociétés (article L242-3 du code de la sécurité sociale, non relu).
- Le texte qui pose qu'une personne physique n'a qu'une entreprise individuelle : Bpifrance Création le dit (un seul numéro SIREN) ; la page d'economie.gouv.fr sur les activités multiples n'a pas pu être relue (accès refusé).

## Sources consultées le 2026-11-20

- Article L227-6 du Code de commerce (legifrance.gouv.fr).
- Article L223-18 du Code de commerce (legifrance.gouv.fr).
- [Cotisations sociales d'une EURL](https://entreprendre.service-public.gouv.fr/vosdroits/F36239) (service-public.fr).
- [Micro-entrepreneur : peut-on cumuler plusieurs activités indépendantes ?](https://entreprendre.service-public.gouv.fr/vosdroits/F33339) (service-public.fr, vérifié le 21 février 2026) : seuil global de chiffre d'affaires pour l'ensemble des activités, seuils de TVA sur le montant global.
- [Le cumul d'activités avec une micro-entreprise](https://bpifrance-creation.fr/encyclopedie/micro-entreprise-regime-auto-entrepreneur/lessentiel-ce-regime/cumul-dactivites-micro) (Bpifrance Création) : une personne ne peut pas avoir deux micro-entreprises.
