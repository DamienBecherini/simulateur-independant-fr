# Crochets git du dépôt

Règle : **on ne commite jamais directement sur `main`**. Chaque changement passe par une branche dédiée, se teste
(`npm run test:all`, `npm run lint`), est fusionné dans `integration` pour la recette, puis dans `main`.

- `pre-commit` refuse un commit sur `main`, sauf pour conclure une fusion dont on a résolu les conflits.

Activation, une fois par clone :

```sh
git config core.hooksPath .githooks
```
