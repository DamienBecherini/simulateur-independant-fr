# Suivi : les règles de 2027

Liste de travail pour la procédure du guide (§ 3.1 de `documentation/GUIDE_DEVELOPPEUR.md`, « Ajouter l'année de règles 2027 »). Elle dit, bloc par bloc de `src/backend/regles/2026.json`, ce qui doit changer pour 2027, d'où viendra la valeur et quand elle paraît. **Aucune valeur de ce document n'entre dans les règles tant que sa source officielle n'est pas publiée** (§ 4.3 du guide : jamais de chiffre inventé, `NON SOURCÉ` à défaut).

- **Point fait le :** 23 novembre 2026.
- **Légende de l'état :** **publié** (texte officiel paru), **annoncé** (communiqué ou projet de loi, pas encore officiel), **attendu** (rien de paru).

## Calendrier

| Quand | Ce qui paraît | Blocs concernés |
|---|---|---|
| Décembre 2026 | Arrêté du plafond de la Sécurité sociale (JO, fin décembre) ; décret du SMIC au 1er janvier (mi-décembre) | `regimeGeneral`, `TNS`, `protectionSociale`, `liberauxReglementes`, tout ce qui est exprimé en part du PASS ou en heures de SMIC |
| Décembre 2026 à février 2027 | Loi de financement de la sécurité sociale pour 2027 ; loi de finances pour 2027 (barème de l'IR des revenus 2026) | `regimeGeneral`, `TNS`, `microEntreprise`, `dividendes`, `IR` **de 2026.json** (étape 8 du § 3.1) |
| Janvier 2027 | Barèmes de l'Urssaf et notices des caisses de libéraux (CIPAV, CARPIMKO) | `microEntreprise`, `TNS`, `liberauxReglementes` |
| Printemps 2027 | Barème kilométrique des revenus de 2026 | `baremeKilometrique` de 2026.json |
| Printemps 2028 | Barème kilométrique des revenus de 2027 | `baremeKilometrique` de 2027.json (d'ici là, le dernier connu, en le disant) |

## Bloc par bloc

| Bloc | Valeur 2026 | 2027 | État | Source attendue |
|---|---|---|---|---|
| `regimeGeneral.plafondSecuriteSociale`, `TNS.plafondSecuriteSociale` | 48 060 € | 48 900 € (4 075 € par mois, + 1,74 %) | **annoncé** (communiqué du BOSS du 16/10/2026) | Arrêté au JO, fin décembre |
| SMIC horaire (`protectionSociale.revenuParTrimestre` = 150 h ; `TNS.cotisationsMinimales.retraiteDeBase` = 450 h ; `regimeGeneral.reductionGenerale`) | 12,02 € | — | attendu | Décret de revalorisation, mi-décembre |
| Montants en part du PASS (`TNS.cotisationsMinimales.indemnitesJournalieres` 40 %, `invaliditeDeces` 11,5 %, tranches TNS, caisses de libéraux) | — | à recalculer avec le PASS 2027 | suit le PASS | Arrêté du PASS, barème Urssaf de janvier |
| Taux du régime général et des TNS (`regimeGeneral.cotisations`, `TNS.*`) | — | — | attendu ; le PLFSS 2027 a été rejeté par l'Assemblée en première lecture le 23/10/2026, le Sénat examine le texte initial | LFSS 2027, barèmes Urssaf de janvier |
| `microEntreprise.cotisations` | 12,3 %, 21,2 %, 25,6 % | — | attendu ; aucune réforme générale repérée dans le PLFSS 2027 (seulement un taux dérogatoire pour les communes touchées par les incendies de l'été 2026, hors du modèle) | Barème Urssaf de janvier |
| `microEntreprise.plafonds` | fixés pour 2026-2028 | inchangés | **publié** | — |
| `microEntreprise.versementLiberatoire.plafondRfrParPart` | 29 315 € (RFR 2024, option en 2026) | RFR 2025 pour l'option en 2027 | attendu | impots.gouv.fr, lié à la limite de la 2e tranche du barème |
| `TVA` (franchise en base) | 37 500 € / 85 000 € | — | attendu | Loi de finances pour 2027, service-public F21746 |
| `IR` de **2026.json** (revenus 2026, imposés en 2027) | barème de la loi de finances pour 2026 | barème relevé de 2,1 % (1re tranche à 11 844 €, puis 30 200 €, 86 353 €, 185 737 €), décote et plafonds du quotient familial relevés | **annoncé** (article 2 du PLF 2027) | Loi de finances pour 2027 (vote entre décembre et février) |
| `IR` de 2027.json (revenus 2027) | — | celui de la loi de finances pour 2027, en attendant celle de 2028 | suit la loi de finances | § 3.1, étape 1 |
| `IS`, `dividendes`, `EURL`, `reserveLegale`, `CFE`, `exonerationsDeZone` | — | inchangés sauf mesure de la loi de finances | à vérifier au vote | Loi de finances pour 2027 |
| `microEntreprise.ACRE`, `microEntreprise.reductionACRE` | 50 % ; 25 % depuis le 01/07/2026 | — | à vérifier | LFSS 2027, Urssaf |
| `portageSalarial` | — | minimum conventionnel et prévoyance de la branche | attendu | Avenants de la convention IDCC 3219 |
| `baremeKilometrique` | inchangé depuis l'arrêté du 27/03/2023 | le dernier connu | attendu (printemps 2028) | Arrêté annuel |

## Sources consultées

- Plafond de la Sécurité sociale 2027 annoncé par le BOSS : [Éditions Tissot](https://www.editions-tissot.fr/actualite/droit-du-travail/plafond-de-la-securite-sociale-le-boss-annonce-les-nouveaux-montants), [Crowe](https://www.crowe.com/fr/groupe-rsa/news/plafond-de-la-secu-2027) (sources secondaires : l'arrêté fait foi).
- Barème de l'IR dans le PLF 2027 : [Legifiscal](https://www.legifiscal.fr/actualites-fiscales/4659-plf-2027-texte-publie-bareme-ir-revalorise-21.html), [La finance pour tous](https://www.lafinancepourtous.com/2026/10/02/projet-de-loi-de-finances-pour-2027-les-mesures-pour-les-particuliers/).
- PLFSS 2027 : [Sénat, dossier législatif](https://www.senat.fr/tableau-historique/plfss2027.html), [Legifiscal, synthèse](https://www.legifiscal.fr/vie-affaires/plfss-2027-tableau-synthese-principales-mesures.html).

## Prochaines vérifications

1. **Fin décembre 2026 :** arrêté du PASS et décret du SMIC au JO.
2. **Au vote des lois de finances et de financement** (décembre à février) : barème de l'IR des revenus 2026 (mettre à jour `IR` de 2026.json et les cas de référence de 2026 qui changent, § 3.1 étape 8), mesures sur les cotisations, la TVA, l'IS et les dividendes.
3. **Janvier 2027 :** barèmes de l'Urssaf et des caisses ; créer alors `2027.json` (§ 3.1).
