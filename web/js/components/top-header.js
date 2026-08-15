import { ICONS } from "../icons.js";
import { leerTema, toggleTema } from "../state.js";

export function montarTopHeader(container) {
  const isDark = leerTema() === "dark";
  container.innerHTML = `
    <div class="top-header__left">
      <button type="button" class="top-header__action" id="mobile-menu-toggle" aria-label="Menú">
        ${ICONS.menu}
      </button>
      <div class="top-header__brand">
        <img src="icons/icon-192.png" alt="Logo" class="top-header__logo" />
        <span>Lo Dicho</span>
      </div>
    </div>
    <button type="button" class="top-header__action" id="theme-toggle" aria-label="Cambiar tema">
      ${isDark ? ICONS.sun : ICONS.moon}
    </button>
  `;

  const botonTema = container.querySelector("#theme-toggle");
  botonTema.addEventListener("click", () => {
    const nuevo = toggleTema();
    botonTema.innerHTML = nuevo === "dark" ? ICONS.sun : ICONS.moon;
  });

  const botonMenu = container.querySelector("#mobile-menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");

  botonMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = mobileMenu.dataset.open === "true";
    mobileMenu.dataset.open = isOpen ? "false" : "true";
  });

  document.addEventListener("click", (e) => {
    if (mobileMenu && mobileMenu.dataset.open === "true" && !mobileMenu.contains(e.target) && !botonMenu.contains(e.target)) {
      mobileMenu.dataset.open = "false";
    }
  });
}