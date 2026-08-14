import { ICONS } from "../icons.js";
import { leerTema, guardarTema } from "../state.js";

const ORDEN_TEMA = ["system", "light", "dark"];
const ETIQUETA_TEMA = { system: "Automático", light: "Claro", dark: "Oscuro" };

export function montarTopHeader(container) {
  container.innerHTML = `
    <div class="top-header__brand">
      <img src="icons/icon-192.png" alt="" />
      <span>Lo Dicho</span>
    </div>
    <button type="button" class="top-header__action" id="theme-toggle" aria-label="Cambiar tema"></button>
  `;

  const boton = container.querySelector("#theme-toggle");
  boton.innerHTML = ICONS.moon;

  boton.addEventListener("click", () => {
    const actual = leerTema();
    const siguiente = ORDEN_TEMA[(ORDEN_TEMA.indexOf(actual) + 1) % ORDEN_TEMA.length];
    guardarTema(siguiente);
    boton.setAttribute("aria-label", `Tema: ${ETIQUETA_TEMA[siguiente]}`);
  });
}
