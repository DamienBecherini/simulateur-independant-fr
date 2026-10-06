# ADR-012: Le bénéfice mis en réserve, d'une année à l'autre

- **Date :** 2026-10-06
- **Statut :** Accepté

## Contexte

Depuis l'ADR 008, une session enchaîne plusieurs années, mais chaque société à l'IS repartait de zéro le 1er janvier : le bénéfice qu'une SASU ou une EURL gardait (« conservé dans la société ») était calculé, puis perdu l'année suivante. On ne pouvait donc pas simuler la stratégie la plus courante des dirigeants de société : garder une part du bénéfice une année, pour la distribuer une autre, quand l'impôt progressif du foyer est plus doux.

Deux décisions du responsable du produit :

1. **Reporter les réserves** d'une année à l'autre, et permettre aux dividendes d'une année d'y puiser ;
2. **Comparer des stratégies de distribution** sur toutes les années de la session, dans le comparateur.

Les règles en jeu, vérifiées sur les sources officielles :

- **Impôt sur les sociétés** (entreprendre.service-public.gouv.fr F23575) : il porte sur tout le bénéfice de l'exercice, distribué ou non. Un dividende pris plus tard sur les réserves ne le supporte pas une seconde fois.
- **Bénéfice distribuable** (article L232-11 du code de commerce) : bénéfice de l'exercice, diminué des pertes antérieures et des sommes portées en réserve en application de la loi, augmenté du report bénéficiaire ; les réserves disponibles peuvent aussi être distribuées.
- **Réserve légale** (article L232-10 du code de commerce, en vigueur depuis le 1er octobre 2025 ; entreprendre.service-public.gouv.fr F24024) : dans les SARL, dont l'EURL, et les sociétés par actions, dont la SASU, un vingtième au moins du bénéfice de l'exercice, diminué des pertes antérieures, va à la réserve légale jusqu'à ce qu'elle atteigne le dixième du capital. Elle n'est pas distribuable.
- **Report en avant des déficits** (article 209 I du CGI, BOI-IS-DEF-10-30-20130410) : un déficit s'impute sur les bénéfices des exercices suivants, sans limite de durée, dans la limite de 1 000 000 € majorés de 50 % du bénéfice au-delà.
- **EURL** (article L131-6 du code de la sécurité sociale, entreprendre.service-public.gouv.fr F38152) : la part des dividendes du gérant majoritaire qui dépasse 10 % du capital social (et des primes d'émission et des sommes en compte courant) supporte les cotisations sociales, l'année où ils sont perçus, quel que soit l'exercice dont ils viennent.
- **Imposition des dividendes** : prélèvement forfaitaire ou option pour le barème, choisis pour toute l'année de la perception et pour tout le foyer, comme avant ; le revenu fiscal de référence est celui de l'année de la perception (il décide du versement libératoire deux ans plus tard, ADR 008).

## Décision

**Chaque société à l'IS porte d'une année à l'autre un état : ses réserves distribuables, sa réserve légale et son déficit reportable.**

```ts
EtatDeLaSociete = { reserves: number; reserveLegale: number; deficitReportable: number }
```

- **Moteur** (`calculsSociete.ts`) : sur l'année, le déficit reportable s'impute avant l'IS ; une part du bénéfice après IS va à la réserve légale tant qu'elle n'est pas constituée ; le bénéfice distribuable de l'année s'ajoute aux réserves du 1er janvier (une perte les diminue). Les dividendes saisis sont plafonnés à ce total, avec un avertissement quand la grille en demande plus. Le résultat de l'activité donne les réserves du 1er janvier et du 31 décembre (`ActivityResult.reserves`). `resultatConserve` garde son sens d'un flux de l'année : ce que les réserves gagnent (négatif quand la société distribue plus que son bénéfice de l'année, ou perd de l'argent).
- **Années** (`simulation-pluriannuelle.ts`) : l'état au 31 décembre d'une année est celui du 1er janvier de la suivante ; une année non simulée transmet celui qu'elle a reçu. Le comparateur et l'optimiseur d'une année partent de l'état de la session à cette date.
- **Première année** : les réserves saisies dans la fiche de la société (`Company.reservesInitiales`, facultatif : aucune) ; aucun déficit reportable ; une réserve légale réputée constituée, sauf pour une société dont la date de création tombe dans la première année de la session ou après, qui part de zéro.
- **Règles** : la réserve légale (`reserveLegale`) et le report des déficits (`IS.reportEnAvantDesDeficits`) sont dans le fichier de chaque année, avec leur source.
- **Comparateur d'une année** : inchangé. Ses modes « tout en dividendes » et « répartition personnalisée » portent sur le bénéfice distribuable de l'année ; les réserves restent dans la société. Seul le mode « grille » peut y puiser, comme la simulation.
- **« Sur toutes les années »** (`strategies-de-distribution.ts`), pour une session d'au moins deux années : l'activité comparée devient SASU, puis EURL, sur toutes les années, et trois stratégies fixent les dividendes de chaque année : tout distribuer chaque année (le comportement d'avant), garder une part X du bénéfice distribuable chaque année puis distribuer toutes les réserves la dernière (X réglable, enregistré dans `ReglagesComparateur.partMiseEnReserve`, 50 % par défaut), lisser (le même montant chaque année, tout étant distribué à la fin). Le moteur simule ensuite toutes les années : aucune règle n'est refaite. Chaque stratégie donne le net et les prélèvements cumulés de tous les foyers, et les réserves restantes ; la meilleure est celle au net cumulé le plus haut.

Le format de fichier ne change pas : les deux nouveaux champs sont facultatifs, une session d'avant se lit telle quelle.

### Options écartées

- **Ne reporter que le bénéfice gardé, sans réserve légale ni déficit** : plus simple, mais une société créée dans la session distribuerait de l'argent qu'elle ne peut pas distribuer, et une perte suivie d'un bénéfice paierait trop d'IS. Les deux règles tiennent en quelques lignes.
- **Saisir la réserve légale déjà constituée** : un champ de plus pour un écart de 10 % du capital au plus (100 € pour 1 000 € de capital) ; la date de création suffit à distinguer une société nouvelle d'une société installée.
- **Une rémunération optimisée chaque année dans les stratégies** : chaque stratégie garde la rémunération saisie pour chaque année dans le comparateur (sinon celle de la grille). Optimiser la rémunération et les dividendes ensemble, sur plusieurs années, est un autre problème, bien plus coûteux à calculer et à expliquer.

## Conséquences

- **Positives :**
  - Le bénéfice gardé une année se retrouve l'année suivante, dans la carte de l'activité (ajouté aux réserves, pris sur les réserves, réserves au 31 décembre), la synthèse des années, la barre de partage du comparateur, les exports CSV et Markdown et les outils des clients d'IA.
  - Une perte n'est plus oubliée : elle diminue l'IS des années suivantes et ce qu'elles peuvent distribuer.
  - Le comparateur répond à la question « distribuer maintenant ou plus tard ? » sur les années de la session, en réutilisant le moteur.
- **Négatives ou Compromis :**
  - Les dividendes de l'année N peuvent venir du bénéfice de N lui-même, comme avant : en réalité, ils sont votés après la clôture des comptes de N (ou versés en acompte au vu d'un bilan intermédiaire, article L232-12 du code de commerce). Le décalage d'une année n'est pas modélisé.
  - Le seuil de 10 % des dividendes d'EURL ne tient compte que du capital social, ni des primes d'émission ni des comptes courants d'associés.
  - Un déficit d'avant la simulation, ou des pertes antérieures, ne se saisissent pas : les réserves de départ sont positives ou nulles.
  - Les réserves d'une société à plusieurs associés sont partagées à parts égales, comme les dividendes.
  - « Sur toutes les années » suppose que l'avenir est celui que décrivent les années de la session ; une année au-delà des dernières règles connues reprend celles-ci, sans revalorisation. Les réserves restantes ne comptent pas dans le net cumulé : elles seront imposées au nom du foyer le jour où elles seront distribuées.
  - Le bénéfice de chaque année est calculé une fois sans dividendes, puis chaque stratégie fixe ses dividendes d'après lui : si une perte suivait une distribution, la réserve légale de l'année suivante pourrait différer légèrement ; le moteur verserait alors un peu moins que prévu, et la stratégie l'indiquerait.
