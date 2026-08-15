import { ICONS } from "../icons.js";
import { leerTema, guardarTema } from "../state.js";

export function montarTopHeader(container) {
  container.innerHTML = `
    <div class="top-header__left">
      <button type="button" class="top-header__action" id="mobile-menu-toggle" aria-label="Menú">
        ${ICONS.menu}
      </button>
      <div class="top-header__brand">
        <img src="icons/icon-192.png" alt="" class="top-header__logo" />
        <div class="top-header__titles">
          <span>Lo Dicho</span>
        </div>
      </div>
    </div>
    <button type="button" class="top-header__action" id="theme-toggle" aria-label="Cambiar tema">
      ${ICONS.moon}
    </button>
  `;

  const botonTema = container.querySelector("#theme-toggle");
  botonTema.addEventListener("click", () => {
    const actual = leerTema();
    const ORDEN_TEMA = ["system", "light", "dark"];
    const siguiente = ORDEN_TEMA[(ORDEN_TEMA.indexOf(actual) + 1) % ORDEN_TEMA.length];
    guardarTema(siguiente);
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