# Liens vers les situations types

Dans la [démo web](https://damienbecherini.github.io/simulateur-independant-fr/), une adresse de la forme `…/simulateur-independant-fr/#situation=<identifiant>` ouvre la situation type correspondante. Une page extérieure (article, fiche pratique) peut ainsi proposer « Ouvrir cet exemple dans le simulateur » :

```html
<a href="https://damienbecherini.github.io/simulateur-independant-fr/#situation=couple-union-libre">Ouvrir cet exemple dans le simulateur</a>
```

Dans la fenêtre « Partir d'une situation type » de la démo, le bouton « Copier le lien » de chaque carte donne ce lien.

## Ce qui se passe à l'ouverture du lien

- Sur une première visite (simulation d'exemple non modifiée) ou sur une simulation vide, la situation se charge directement.
- Sur une simulation non enregistrée dans une sauvegarde, la même confirmation que la fenêtre des situations types demande d'abord : « Remplacer la simulation en cours ? ». « Annuler » ne change rien.
- Le chargement s'annule en une étape (bouton « Annuler » de la barre d'outils, Ctrl+Z).
- Une fois lu, le fragment `#situation=…` quitte l'adresse : un rechargement de la page ne remet pas la situation par-dessus le travail fait depuis.
- Un identifiant inconnu ne change rien ; un message discret le signale, avec un lien vers la fenêtre des situations types.
- L'application de bureau n'a pas d'adresse : ces liens ne valent que pour la démo web.

## Identifiants publics

Ces identifiants sont publiés dans des liens : **ils ne doivent plus changer**. Le test `src/lib/montages/adresse.test.ts` fige la liste ; un renommage le fait échouer. Une nouvelle situation type ajoute son identifiant à la fin de cette table et du test ; une situation retirée garde sa ligne, avec la mention de son retrait (son lien affichera « Situation introuvable »).

| Identifiant | Situation type |
|---|---|
| `micro-bnc-seule` | Micro-entreprise seule (BNC) |
| `osteopathe-micro` | Ostéopathe en micro-entreprise |
| `kinesitherapeute-ei` | Kinésithérapeute conventionné en entreprise individuelle |
| `sasu-sans-salaire` | SASU sans salaire, tout en dividendes |
| `sasu-salaire-4-trimestres` | SASU avec un salaire qui valide 4 trimestres |
| `eurl-is-remuneration-gerant` | EURL à l'IS avec rémunération du gérant |
| `salarie-et-micro` | Salarié avec une micro-entreprise à côté |
| `micro-et-sasu-du-conjoint` | Micro-entreprise et SASU du conjoint |
| `conjoint-salarie-sasu` | Conjoint salarié de la SASU |
| `couple-union-libre` | Couple en union libre, puis marié ou pacsé |

Le code : la lecture de l'adresse et la composition des liens dans `src/lib/montages/adresse.ts`, le comportement dans la page dans `src/ui/components/SituationParLAdresse.tsx`, le lien de la démo dans `src/web/plateforme-web.ts` (`lienVersUneSituation`).
