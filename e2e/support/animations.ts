// e2e/support/animations.ts
// Attendre que l'écran ne bouge plus avant de le mesurer ou de l'auditer : une fenêtre qui s'ouvre en fondu, un fond
// qui change de couleur avec le thème. Partagé par les tests de l'application Electron et ceux de la démo web.

import type { Page } from "@playwright/test"

/**
 * Attend la fin des animations et des transitions de ce qui est affiché. Celles d'un contenu qui n'est pas rendu (une
 * section repliée) ne comptent pas : au changement de thème, Firefox leur crée une transition qu'il laisse « en cours »,
 * à l'arrêt, tant que la section reste fermée ; les attendre ne finirait jamais.
 */
export async function attendreLaFinDesAnimations(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every(animation => {
      if (animation.playState !== "running") return true
      const cible = animation.effect instanceof KeyframeEffect ? animation.effect.target : null
      return cible !== null && !cible.checkVisibility()
    })
  )
}
