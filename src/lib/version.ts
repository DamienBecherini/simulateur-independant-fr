// src/lib/version.ts
// Version de l'application, lue dans package.json à la construction (constante `__APP_VERSION__` de vite.config.ts).
// L'interface et la démo web l'écrivent dans les fichiers qu'elles produisent ; le process principal d'Electron, qui
// n'est pas construit par Vite, prend la même valeur avec `app.getVersion()`.

export const VERSION_DE_L_APPLICATION: string = __APP_VERSION__
