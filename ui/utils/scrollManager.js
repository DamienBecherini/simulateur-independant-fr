// ui/utils/scrollManager.js

export function manageScrollShadowsWithObserver(container) {
  if (!container) return

  // Ajoute la classe de base pour le style des ombres
  container.classList.add("horizontal-scroll-shadow")

  // Vérifie si les sentinelles existent déjà pour éviter de les dupliquer
  let sentinelStart = container.querySelector(".scroll-sentinel-start")
  if (!sentinelStart) {
    sentinelStart = document.createElement("div")
    sentinelStart.classList.add("scroll-sentinel", "scroll-sentinel-start")
    container.prepend(sentinelStart) // On l'insère au tout début
  }

  let sentinelEnd = container.querySelector(".scroll-sentinel-end")
  if (!sentinelEnd) {
    sentinelEnd = document.createElement("div")
    sentinelEnd.classList.add("scroll-sentinel", "scroll-sentinel-end")
    container.append(sentinelEnd) // On l'insère à la toute fin
  }

  const observerCallback = entries => {
    entries.forEach(entry => {
      // Si la sentinelle de DÉBUT est visible (isIntersecting),
      // alors nous sommes au début du scroll. On cache donc l'ombre de gauche.
      if (entry.target.classList.contains("scroll-sentinel-start")) {
        container.classList.toggle("is-scrolled-start", !entry.isIntersecting)
      }

      // Si la sentinelle de FIN est visible (isIntersecting),
      // alors nous sommes à la fin du scroll. On cache donc l'ombre de droite.
      if (entry.target.classList.contains("scroll-sentinel-end")) {
        container.classList.toggle("is-scrolled-end", !entry.isIntersecting)
      }
    })
  }

  const observer = new IntersectionObserver(observerCallback, {
    root: container, // L'observation se fait à l'intérieur du conteneur lui-même
    threshold: 1.0 // On se déclenche quand la sentinelle est 100% visible
  })

  observer.observe(sentinelStart)
  observer.observe(sentinelEnd)
}
