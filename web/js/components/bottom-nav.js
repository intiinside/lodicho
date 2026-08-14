import { ICONS } from "../icons.js";

const ITEMS = [
  { ruta: "#/", etiqueta: "Inicio", icono: ICONS.home },
  { ruta: "#/historial", etiqueta: "Historial", icono: ICONS.history },
  { ruta: "#/acerca", etiqueta: "Acerca de", icono: ICONS.info },
];

export function montarBottomNav(container, rutaActiva) {
  container.innerHTML = ITEMS.map(
    (item) => `
      <a
        class="bottom-nav__item"
        href="${item.ruta}"
        data-ruta="${item.ruta}"
        ${esActiva(item.ruta, rutaActiva) ? 'aria-current="page"' : ""}
      >
        ${item.icono}
        <span class="bottom-nav__label">${item.etiqueta}</span>
      </a>
    `
  ).join("");
}

function esActiva(ruta, rutaActiva) {
  if (ruta === "#/") return rutaActiva === "#/" || rutaActiva === "" || rutaActiva === "#";
  return rutaActiva.startsWith(ruta);
}
