import { ICONS } from "../icons.js";
import { leerTema, guardarTema } from "../state.js";

const ITEMS = [
  { ruta: "#/", etiqueta: "Preguntar", icono: ICONS.home },
  { ruta: "#/admin", etiqueta: "Gestionar Documentos", icono: ICONS.folder },
  { ruta: "#/historial", etiqueta: "Historial Local", icono: ICONS.history },
  { ruta: "#/acerca", etiqueta: "Acerca de Lo Dicho", icono: ICONS.info },
];

export function montarNavegacion(sidebarContainer, mobileMenuContainer, rutaActiva) {
  // Sidebar (Desktop)
  if (sidebarContainer) {
    sidebarContainer.innerHTML = `
      <div class="sidebar__brand">
        <a href="#/" class="sidebar__brand-link">
          <img src="icons/icon-192.png" alt="Lo Dicho" class="sidebar__logo" />
          <div class="sidebar__title-block">
            <span class="sidebar__title">Lo Dicho</span>
            <span class="sidebar__tag">Dashboard</span>
          </div>
        </a>
      </div>
      
      <nav class="sidebar__menu">
        <div class="sidebar__section-title">Principal</div>
        ${ITEMS.slice(0, 2).map(item => renderItem(item, rutaActiva, 'sidebar__item')).join("")}
        
        <div class="sidebar__section-title" style="margin-top: 24px;">General</div>
        ${ITEMS.slice(2).map(item => renderItem(item, rutaActiva, 'sidebar__item')).join("")}
      </nav>
      
      <div class="sidebar__footer">
        <button type="button" class="sidebar__theme-btn" id="sidebar-theme-toggle">
          ${ICONS.moon} <span>Cambiar tema</span>
        </button>
      </div>
    `;

    const btnTheme = sidebarContainer.querySelector("#sidebar-theme-toggle");
    if (btnTheme) btnTheme.addEventListener("click", () => toggleTheme());
  }

  // Mobile Menu
  if (mobileMenuContainer) {
    mobileMenuContainer.innerHTML = ITEMS.map(item => renderItem(item, rutaActiva, 'mobile-menu__item')).join("");
  }
}

function renderItem(item, rutaActiva, baseClass) {
  const activo = esActiva(item.ruta, rutaActiva);
  const claseActiva = activo ? `${baseClass}--active` : '';
  return `
    <a href="${item.ruta}" class="${baseClass} ${claseActiva}">
      ${item.icono}
      <span>${item.etiqueta}</span>
    </a>
  `;
}

function esActiva(ruta, rutaActiva) {
  if (ruta === "#/") return rutaActiva === "#/" || rutaActiva === "" || rutaActiva === "#";
  return rutaActiva.startsWith(ruta);
}

function toggleTheme() {
  const actual = leerTema();
  const ORDEN_TEMA = ["system", "light", "dark"];
  const siguiente = ORDEN_TEMA[(ORDEN_TEMA.indexOf(actual) + 1) % ORDEN_TEMA.length];
  guardarTema(siguiente);
}