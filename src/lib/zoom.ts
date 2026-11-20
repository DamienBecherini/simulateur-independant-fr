// src/lib/zoom.ts
// Le zoom de l'interface (CSS `zoom` sur le body) réduit la largeur réellement disponible pour la mise en page :
// une fenêtre de 1 000 px zoomée à 200 % n'offre plus que 500 px. On borne donc le zoom pour que cette largeur
// effective ne descende jamais sous la largeur minimale que la mise en page sait afficher.
//
// Les points de rupture CSS (`sm:`, 640 px) suivent la largeur de la fenêtre, pas la largeur zoomée : dès 640 px
// de fenêtre, c'est la mise en page large qui s'affiche, même si le zoom ne lui laisse que 400 px. Elle demande
// plus de place que la mise en page compacte, d'où deux largeurs minimales. Valeurs mesurées dans Chromium.
// Font exception les parties qui, zoomées, devenaient illisibles : elles suivent leur propre largeur (requêtes de
// conteneur), donc la largeur zoomée. Ce sont la barre d'outils (BarreDOutils.tsx), les cartes des résultats
// (ResultsPanel.tsx), la bande des mois (BandeDesMois.tsx) et les lignes de flux de la saisie mensuelle
// (MonthlyFlowsModal.tsx). Une nouvelle mise en page à points de rupture doit faire de même, ou tenir dans 460 px ;
// e2e-web/zoom-lisibilite.web.ts vérifie que la page et toutes ses fenêtres restent lisibles à cinq couples de largeur
// et de zoom ; e2e-web/zoom-balayage.web.ts balaie les deux dimensions (chaque zoom, fenêtre de 1 920 à 320 px par pas de 24 px).
// La mise en page compacte tient dans 320 px (critère 1.4.10 des WCAG) : à cette largeur, le zoom reste à 100 %, et
// textes et zones cliquables gardent leur taille.

/** Largeur de fenêtre à partir de laquelle la mise en page large s'applique (point de rupture `sm` de Tailwind). */
const POINT_DE_RUPTURE = 640
/** Largeur effective minimale, en pixels CSS, de la mise en page compacte. */
export const LARGEUR_MINIMALE = 320
/** Largeur effective minimale, en pixels CSS, de la mise en page large. */
export const LARGEUR_MINIMALE_LARGE = 460
export const ZOOM_MINIMAL = 0.5
export const ZOOM_MAXIMAL = 2
export const PAS_DE_ZOOM = 0.1

const arrondi = (zoom: number) => Math.round(zoom * 100) / 100
// Le zoom maximal est arrondi vers le bas : la largeur effective ne passe jamais sous la largeur minimale.
const arrondiInferieur = (zoom: number) => Math.floor(zoom * 100) / 100

/** Zoom le plus fort que permet une fenêtre de cette largeur, entre le zoom minimal et le zoom maximal. */
export function zoomMaximalPour(largeurFenetre: number): number {
  const largeurMinimale = largeurFenetre >= POINT_DE_RUPTURE ? LARGEUR_MINIMALE_LARGE : LARGEUR_MINIMALE
  return Math.max(ZOOM_MINIMAL, Math.min(ZOOM_MAXIMAL, arrondiInferieur(largeurFenetre / largeurMinimale)))
}

/** Ramène un zoom dans les bornes permises par la largeur de la fenêtre. */
export function bornerZoom(zoom: number, largeurFenetre: number): number {
  return arrondi(Math.min(Math.max(zoom, ZOOM_MINIMAL), zoomMaximalPour(largeurFenetre)))
}
