# ADR-021: Épargne retraite (PER)

- **Date :** 2026-11-26
- **Statut :** Accepté (2026-11-26). Réalisation en trois livraisons : la première (revenu global) est faite le 2026-11-26, la deuxième (bénéfice ou rémunération) le 2026-11-27, voir « Réalisation de la livraison 1 » et « … de la livraison 2 » ; la troisième (comparateur) reste à faire.

## Contexte

Le point 1 de la phase 17 de la feuille de route demande de simuler les versements sur un plan d'épargne retraite (PER) individuel. Aujourd'hui, le simulateur ne les connaît pas : un versement ne peut être saisi que comme une dépense, sans effet sur l'impôt.

Deux textes permettent de déduire un versement :

- **le revenu global** (article 163 quatervicies du CGI), ouvert à tous : le versement se déduit du revenu imposable du foyer, dans la limite d'un plafond calculé sur les revenus professionnels de l'année précédente, et dont la part inutilisée se reporte ;
- **le bénéfice ou la rémunération** (article 154 bis), pour l'entrepreneur individuel au réel et le gérant majoritaire d'EURL : le versement se déduit du revenu professionnel, dans une limite calculée sur l'année même, sans report.

Le contribuable choisit le cadre, et peut partager un versement entre les deux (article 163 quatervicies, I-1-d).

La recherche est dans `documentation/recherche/per.md` : les règles et leurs sources (relues le 2026-11-26), les points incertains, les cas calculés à la main, et le plan de réalisation.

## Décisions du propriétaire (2026-11-25, révisées le 2026-11-26)

1. **Plafond du revenu global :** un seul montant saisi par personne, pour la première année de la session. C'est la ligne « Plafond pour les cotisations versées en N » de l'avis d'impôt. Le détail par année d'origine viendra plus tard.
2. **Ordre de déduction :** le revenu global d'abord, pour tout le monde. Pour l'EI au réel et le gérant d'EURL, ce qui dépasse le plafond se déduit ensuite du bénéfice ou de la rémunération.
3. **Couple marié ou pacsé :** les plafonds sont mis en commun d'office, sans réglage.
4. **Comparateur :** trois réglages (« comme dans la simulation », « aucun versement », « maximum déductible, statut par statut »).
5. **Tranche marginale :** affichée comme indicative ; l'économie d'impôt se calcule par différence.
6. **Trois livraisons :** le revenu global, puis l'excédent sur le bénéfice ou la rémunération, puis le comparateur et l'optimiseur.
7. **Versement sans effet :** un avertissement, qui rappelle l'option pour la non-déduction.
8. **Maquettes** validées le 2026-11-26.

## Décision

### La saisie

- **Le versement** est un flux de la personne, de type « Versement PER », sortant comme une dépense. Le versement de l'année est la somme de ces flux, quel que soit le mois.
- **Le plafond** est un champ facultatif de la fiche de la personne. Il vaut pour la première année de la session ; depuis la livraison 2, cette année est enregistrée avec lui à la saisie.

### Le plafond du revenu global

Le plafond d'une personne pour l'année N est retenu dans cet ordre :

1. le montant saisi, si N est l'année enregistrée avec lui (pour un fichier d'avant cet enregistrement, la première année de la session) ;
2. sinon le plafond calculé sur l'année N-1, si elle est dans la session, plus les reliquats nés dans la session et non expirés ;
3. sinon le minimum légal (10 % du plafond de la sécurité sociale de N-1), et le simulateur le dit.

Le plafond calculé sur une année est le plus grand de deux montants : 10 % des revenus d'activité professionnelle de l'année, retenus dans la limite de 8 plafonds de la sécurité sociale, et 10 % d'un plafond de la sécurité sociale. Il est diminué de ce qui a été déduit du bénéfice ou de la rémunération la même année (livraison 2).

Un reliquat né en 2024 ou 2025 se reporte 3 ans ; un reliquat né à partir de 2026 se reporte 5 ans. La durée est dans les règles de chaque année.

### La déduction

1. Le versement d'une personne s'impute sur son plafond de l'année, puis sur ses reliquats, du plus ancien au plus récent.
2. Dans un couple marié ou pacsé, ce qui dépasse se prend sur ce qui reste au conjoint. Ce qui reste après cela demeure à celui dont le plafond n'est pas épuisé. La carte du foyer rappelle de cocher la case 6QR de la déclaration.
3. **Livraison 2.** Pour l'EI au réel et le gérant d'EURL, ce qui dépasse encore se déduit du bénéfice ou de la rémunération, dans la limite de l'article 154 bis : 10 % du bénéfice retenu dans la limite de 8 plafonds de la sécurité sociale, plus 15 % de sa part au-delà d'un plafond, avec un minimum de 10 % du plafond. Le plafond de la sécurité sociale est celui de l'année, réduit au prorata l'année de création (ADR 020).
4. Ce qui dépasse encore n'est pas déduit, et ne le sera pas les années suivantes.

La part déduite du revenu global :

- réduit la base du barème du foyer, sans la faire passer sous zéro ;
- est rajoutée au revenu fiscal de référence (article 1417).

La part déduite du bénéfice ou de la rémunération (livraison 2) :

- réduit le revenu professionnel imposable ; pour un gérant, elle se déduit avant la déduction de 10 % pour frais, et ne vaut donc que 90 % de son montant ;
- n'est pas rajoutée au revenu fiscal de référence ;
- réduit le plafond du revenu global de l'année suivante, sauf pour sa part couverte par les 15 %.

Les cotisations sociales ne changent dans aucun cas : un versement ne réduit pas leur assiette.

### Pourquoi le revenu global d'abord

| | Revenu global d'abord (retenu) | Bénéfice ou rémunération d'abord (écarté) |
|---|---|---|
| Impôt de l'année, EI | Identique | Identique |
| Impôt de l'année, gérant d'EURL | Déduction entière | Déduction de 90 % |
| Plafond de l'année suivante | Préservé | Réduit d'autant |
| Plafonds anciens près d'expirer | Utilisés dès que le versement dépasse le plafond de l'année | Laissés de côté |
| Règle à expliquer | Une seule, la même pour tous | Une par statut |
| Livraisons | La deuxième ajoute une possibilité sans changer les simulations déjà faites | L'EI et le gérant changent de cadre entre deux versions |

Les cas 1 et 2 de la recherche chiffrent l'écart.

### Ce que les résultats disent

- **Par personne :** le versé, le déduit et son cadre, le plafond et son origine (saisi, calculé ou minimum légal), la part prise sur le plafond du conjoint, le non déduit, le plafond calculé sur l'année pour l'année suivante.
- **Par foyer :** le déduit, le montant rajouté au revenu fiscal de référence, l'économie d'impôt, la tranche marginale.
- **L'économie d'impôt** est la différence entre l'impôt du foyer recalculé sans le versement et l'impôt calculé avec. La tranche marginale est affichée comme indicative : la décote, le quotient familial et un changement de tranche font que l'économie n'est pas toujours le versement multiplié par ce taux.
- **Le net après impôts** garde le versement : la somme reste au foyer, sous forme d'épargne. Une ligne « dont épargne retraite » la montre, bloquée jusqu'à la retraite.
- **Avertissements :**
  - un versement dépasse le plafond (montant non déduit, sans report) ;
  - un versement ne réduit pas l'impôt (versement libératoire sans autre revenu au barème, foyer non imposable), avec le rappel de l'option pour la non-déduction, à demander lors du versement ;
  - le plafond n'est pas saisi et le minimum légal est retenu.

### Le comparateur et l'optimiseur (livraison 3)

Un réglage à trois valeurs s'applique à toutes les colonnes :

- **comme dans la simulation** (par défaut) : le versement saisi, placé sur la personne dirigeante ;
- **aucun versement** ;
- **maximum déductible, statut par statut** : chaque colonne verse ce que son statut permet de déduire. C'est le plafond du revenu global, plus la limite de l'article 154 bis pour l'EI et l'EURL, et zéro sans revenu au barème.

L'épargne versée s'affiche à part sous le net. Le classement reste fait sur le net, épargne comprise. L'optimiseur applique le réglage à chaque point, sans nouvelle dimension de recherche.

## Hypothèses

1. **Reste du plafond saisi.** On ne connaît qu'un total, pas l'année d'origine de chaque reliquat. Ce qui n'est pas utilisé la première année n'est pas reporté sur les années suivantes de la session.
2. **Assiette de la limite du gérant** (livraison 2) : la rémunération imposable après la déduction de 10 % ou les frais réels, avant le versement. Aucune source ne tranche ; c'est l'assiette la plus basse.
3. **Versement sans effet :** il consomme le plafond quand même. La déduction s'impute sur le plafond qu'elle réduise l'impôt ou non.
4. **Deux activités éligibles** pour une même personne (livraison 2) : l'excédent va sur celle qui a le plus grand bénéfice.
5. **Revenus d'activité professionnelle** retenus pour le plafond :
   - salaires, allocations de chômage et rémunérations de dirigeant, après la déduction de 10 % ou les frais réels ;
   - bénéfices imposables après déduction, bénéfices exonérés en zone rajoutés ;
   - chiffre d'affaires de la micro-entreprise après abattement, versement libératoire compris ;
   - en somme algébrique, déficits compris.

   Les « autres revenus » saisis, de nature inconnue, n'y entrent pas, ni les dividendes.
6. **Bénéfice en zone** (livraison 2) : la limite de l'article 154 bis se calcule sur le bénéfice avant l'exonération de zone (ZFU-TE, QPV) ; l'exonération porte ensuite sur le bénéfice diminué du versement. Lecture de l'article 41 DN bis de l'annexe III à travers le BOFiP (« compte non tenu » de certains abattements), à vérifier sur BOI-BIC-CHG-40-50-40-20 : le site refuse les lectures automatiques.
7. **Part de 15 % qui ne réduit pas le plafond suivant** (livraison 2) : elle se calcule avec le même plafond de la sécurité sociale que la limite, réduit au prorata l'année de création. La loi parle du « montant annuel » du plafond, comme l'article 154 bis lui-même, que le BOFiP réduit pourtant au prorata pour un exercice de moins de douze mois (§ 60) : c'est la même part.

## Ce qui est écarté

- **La sortie** du plan, en capital ou en rente, et son imposition.
- **L'option pour la non-déduction** : le simulateur la rappelle dans un avertissement, sans la simuler.
- **La règle des 70 ans** (plus de déduction pour un versement fait à 70 ans ou plus, depuis le 1er janvier 2026) : le simulateur ne connaît pas l'âge des personnes.
- **Les primo-arrivants** (personnes qui s'installent en France), et les règles qui leur sont propres.
- **L'épargne salariale** (PERECO, PERO) et l'abondement de l'employeur, qui réduisent le plafond de l'année suivante.
- **Le détail du plafond par année d'origine**, tel qu'il figure sur l'avis d'impôt.
- **Les anciens contrats** (PERP, Préfon, Madelin) : ils n'ont pas de saisie propre.

## Réalisation de la livraison 1 (2026-11-26)

Ce que le code a précisé, au-delà de la décision :

- **Format de fichier : pas de nouveau numéro.** Le plan prévoyait le format suivant avec une migration vide. L'ADR 005 dit l'inverse pour ce cas : un nouveau type de flux et un champ facultatif ne changent pas le numéro ; une version précédente écarte les flux « Versement PER » et le signale, et ignore le plafond saisi.
- **Montants à l'euro.** Les versements de l'année et les plafonds sont arrondis à l'euro, comme sur la déclaration et l'avis d'impôt.
- **Dividendes.** Au prélèvement forfaitaire, les dividendes ne sont pas dans le revenu global : la déduction ne porte que sur les autres revenus. Avec l'option pour le barème, elle porte aussi sur eux. Le simulateur retient, comme avant, l'imposition des dividendes la plus favorable, déduction comprise.
- **Revenu imposable plus faible que la déduction.** La déduction s'arrête au revenu imposable au barème. La part en trop n'est ni déduite ni reportée, le plafond est consommé (hypothèse 3), et le foyer est averti. Seule la part réellement déduite est rajoutée au revenu fiscal de référence.
- **Enfant rattaché.** Il a son propre plafond, sans mise en commun ; ses versements se déduisent du revenu du foyer.
- **Première année.** Le plafond saisi vaut pour la première année que le simulateur sait simuler : une année d'avant les premières règles connues, qui n'est pas simulée, ne compte pas. Si l'on ajoute ensuite une année avant elle, le plafond saisi vaut pour cette nouvelle première année, et le libellé du champ le dit ; il en va déjà ainsi du revenu fiscal de référence saisi d'une micro-entreprise. Enregistrer l'année avec le montant éviterait ce glissement : c'est une évolution possible, non retenue ici. Faite à la livraison 2, décision du propriétaire du 2026-11-26 (voir plus bas).
- **Année manquante.** Quand l'année précédente n'est pas dans la session, une année autre que la première retient le minimum légal ; ce qui restait des années plus anciennes n'est pas repris, faute de savoir ce qui s'est passé entre-temps.
- **Année au-delà des dernières règles.** Elle est simulée avec les dernières règles connues ; son minimum légal se calcule alors sur le plafond de la sécurité sociale de ces règles, le dernier connu, et non sur celui de l'année qui les précède.
- **Revenus d'activité professionnelle (hypothèse 5).** Vérifiés à la réalisation sur le document 2041 GX de l'administration : pour les salariés, toute la rubrique « traitements et salaires » de la déclaration, allocations de chômage comprises, nette de frais professionnels.
- **Reste après dépenses.** La ligne « Reste après dépenses saisies » de la carte retire aussi l'épargne retraite, que le net contient mais qui n'est pas disponible.
- **Reste du plafond saisi (hypothèse 1).** Il est affiché la première année, et rappelé dans l'avertissement d'un dépassement des années suivantes tant qu'il pourrait encore servir.
- **Plafond par défaut.** Le minimum légal retenu faute de saisie n'est signalé que s'il sert : la personne a versé, ou son conjoint a pris sur son plafond.
- **Comparateur, en attendant la livraison 3.** Chaque colonne garde les versements saisis sur la personne : c'est le réglage « comme dans la simulation ».
- **Résultat du moteur.** Trois montants du foyer, présents quand il a versé (`versementsEpargneRetraite`, `deductionEpargneRetraite`, `impotEconomiseEpargneRetraite`), que les exports et l'outil `simuler` montrent par la table des champs du foyer ; et `epargneRetraite`, toujours présent, qui porte pour chaque membre son plafond, l'imputation de ses versements, ce qui reste et le plafond calculé sur l'année : c'est ce que l'année suivante en reçoit.

## Réalisation de la livraison 2 (2026-11-27)

Ce que le code a précisé, au-delà de la décision :

- **Deux calculs des activités.** Ce qui dépasse les plafonds du revenu global est connu avant tout calcul de revenu : l'imputation ne dépend ni des revenus de l'année ni de l'impôt (hypothèse 3). La limite, elle, se calcule sur le bénéfice ou la rémunération. Le moteur calcule donc les activités une première fois pour les mesurer, décide de chaque déduction, puis les calcule une seconde fois avec elle (`simulation-engine.ts`). La déduction ne change ni les cotisations ni ce qui est versé, seulement le revenu imposable : le second calcul ne déplace pas la limite. Sans versement au-delà des plafonds, un seul calcul.
- **Limite.** Elle se calcule avec le plafond de la sécurité sociale de la période d'activité (ADR 020) : réduit l'année de création, il donne une limite plus haute au-delà d'un plafond, puisque la part de 15 % commence plus tôt. Une activité pas encore créée dans l'année ne porte aucune déduction.
- **Gérant.** La limite se calcule sur sa rémunération moins sa part de la déduction pour frais, au prorata de ses revenus imposés comme des salaires (hypothèse 2) ; le versement se déduit avant cette déduction, qui baisse d'autant. Sa rémunération imposable ne devient jamais négative. Le bénéfice d'une entreprise individuelle, si : la limite a un minimum même sans bénéfice, et la déduction peut creuser un déficit.
- **Activité retenue** (hypothèse 4) : celle dont le revenu de la limite est le plus grand, donc la limite la plus haute. Une gérance sans rémunération n'en est pas une.
- **Plafond de l'année suivante.** Calculé sur les revenus après la déduction, puis diminué de la déduction moins sa part de 15 %, calculée sur le revenu après déduction : pour un gérant, sa rémunération après le versement et la déduction pour frais. Il ne devient jamais négatif.
- **Impôt économisé.** Il compte les deux déductions : l'impôt est recalculé sans aucun versement, sur les revenus du premier calcul des activités.
- **Case 6QR.** Quand celui qui prend sur le plafond de son conjoint pourrait encore déduire de son bénéfice ou de sa rémunération (sa limite n'est pas atteinte), ces versements ne seraient pas tous perdus sans la case : la consigne le dit, sans chiffrer un impôt en plus qui supposerait le contraire. Limite atteinte, elle le chiffre comme à la livraison 1.
- **Relecture indépendante** (`/code-review high`, 9 remarques) : corrigés la consigne de la case 6QR quand la limite est pleine, l'année d'un plafond retirée de la session, le champ vidé puis retapé qui changeait d'année, et quatre textes. Écartée : le plafond suivant ne serait pas à réduire deux fois (revenus après déduction, puis déduction moins sa part de 15 %). C'est pourtant la règle : BOI-IR-BASE-20-50-20, § 150 (revenus « sous déduction » des cotisations de l'article 154 bis) et § 330 à 350 ; l'exemple de la brochure (1 545 €) suit ce calcul, et le cas de référence le retrouve.
- **Ce que les résultats montrent.** La carte de l'activité porte une ligne « Versement PER déduit du bénéfice » (ou « de la rémunération »), sans signe moins, comme le bénéfice exonéré en zone : elle ne change pas ce que l'activité verse. Le bloc du foyer distingue « Déduit du revenu global » et « Déduit du bénéfice » ; la précision du revenu fiscal de référence dit que seule la première part y est rajoutée. Le champ du foyer des exports s'appelle « PER déduit du revenu global » ; le CSV de l'épargne retraite gagne la part déduite du bénéfice ou de la rémunération, son activité, sa limite et la réduction du plafond calculé ; l'outil `simuler` des clients d'IA rend `versementPerDeduit` pour l'activité.
- **Année du plafond saisi** (décision du 2026-11-26). Le champ `anneeDuPlafondEpargneRetraite` de la personne s'enregistre avec le plafond : à la saisie dans la fiche, la première année simulée de la session à ce moment-là, ou celle déjà enregistrée quand le montant est corrigé, tant qu'elle est dans la session (sinon la première année, pour qu'un plafond corrigé serve de nouveau). Vider le champ laisse l'année : retapé, même en deux temps, le montant vaut pour elle, comme le libellé l'a dit pendant la saisie ; le moteur ignore une année sans plafond. Une proposition d'un client d'IA enregistre toujours la première année, comme la description du réglage le dit (une précision de plus coûtait 54 caractères au catalogue). Le plafond saisi l'emporte sur le plafond calculé et les restes des années d'avant, puisqu'il les contient. Une année ajoutée avant la sienne retient le minimum légal, et le simulateur dit pourquoi ; une année enregistrée absente de la session ne sert à aucune, et l'aide du champ le dit. Un fichier sans année se lit comme avant. Pas de nouveau numéro de format (ADR 005, champ facultatif). Le revenu fiscal de référence saisi d'une micro-entreprise glisse de la même façon ; il n'est pas touché ici.

## Conséquences

- **Positives :**
  - Un versement PER réduit l'impôt selon les textes, pour tous les statuts, avec une seule règle à expliquer.
  - Le choix retenu est le plus favorable dans les cas calculés : il préserve le plafond de l'année suivante et donne au gérant une déduction entière.
  - La deuxième livraison ajoute une déduction sans changer le résultat des simulations faites avec la première.
  - Sur plusieurs années, le plafond et les reliquats se calculent seuls.
- **Négatives ou compromis :**
  - Le résultat dépend du plafond saisi. Sans saisie, le minimum légal peut être trop haut pour qui a déduit, l'année d'avant, des cotisations de retraite de ses revenus professionnels.
  - Quand une déduction du bénéfice ou de la rémunération existe, les activités de l'année sont calculées deux fois. Le chantier 6 de l'audit de qualité (mémoriser les dichotomies) doit l'alléger avant la livraison 3, où le réglage « maximum déductible » la demandera dans chaque colonne du comparateur.
  - Le revenu fiscal de référence baisse moins qu'avec une déduction du bénéfice.
  - Les reliquats d'avant la session ne servent que la première année (hypothèse 1).
  - Le net après impôts contient une épargne bloquée, dont la sortie sera imposée : deux colonnes du comparateur au même net ne se valent pas si l'une contient plus d'épargne. L'affichage à part le montre.
  - Le contribuable qui préfère déduire d'abord de son bénéfice (pour réduire son revenu fiscal de référence) ne peut pas le simuler.
