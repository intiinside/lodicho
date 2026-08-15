import { ICONS } from "../icons.js";
import { leerTema, toggleTema } from "../state.js";

const ITEMS = [
  { ruta: "#/", etiqueta: "Consultar", icono: ICONS.home },
  { ruta: "#/candidatos", etiqueta: "Candidatos", icono: ICONS.users },
  { ruta: "#/admin", etiqueta: "Ingresar Documentos", icono: ICONS.folder },
  { ruta: "#/historial", etiqueta: "Historial", icono: ICONS.history },
  { ruta: "#/acerca", etiqueta: "Metodología", icono: ICONS.info },
];

export function montarNavegacion(sidebarContainer, mobileMenuContainer, rutaActiva) {
  if (sidebarContainer) {
    const isDark = leerTema() === "dark";
    sidebarContainer.innerHTML = `
      <div class="sidebar__brand">
        <a href="#/" class="sidebar__brand-link">
          <img src="icons/icon.svg" alt="Lo Dicho" class="sidebar__logo" />
          <div class="sidebar__title-block">
            <span class="sidebar__title">Lo Dicho</span>
            <span class="sidebar__tag">Ecuador</span>
          </div>
        </a>
      </div>
      
      <nav class="sidebar__menu">
        <div class="sidebar__section-title">Navegación</div>
        ${ITEMS.map((item) => renderItem(item, rutaActiva, "sidebar__item")).join("")}
      </nav>
      
      <div class="sidebar__footer">
        <button type="button" class="sidebar__theme-btn" id="sidebar-theme-toggle">
          ${isDark ? ICONS.sun : ICONS.moon}
          <span id="sidebar-theme-label">${isDark ? "Modo Claro" : "Modo Oscuro"}</span>
        </button>
      </div>
    `;

    const btnTheme = sidebarContainer.querySelector("#sidebar-theme-toggle");
    if (btnTheme) {
      btnTheme.addEventListener("click", () => {
        const nuevo = toggleTema();
        const icon = nuevo === "dark" ? ICONS.sun : ICONS.moon;
        const label = nuevo === "dark" ? "Modo Claro" : "Modo Oscuro";
        btnTheme.innerHTML = `${icon} <span id="sidebar-theme-label">${label}</span>`;
      });
    }
  }

  if (mobileMenuContainer) {
    mobileMenuContainer.innerHTML = ITEMS.map((item) =>
      renderItem(item, rutaActiva, "mobile-menu__item")
    ).join("");
  }

  const bottomBar = document.getElementById("mobile-bottom-bar");
  if (bottomBar) {
    const mainItems = ITEMS.filter(i => i.ruta !== "#/admin");
    bottomBar.innerHTML = mainItems.map((item) => `
      <a href="${item.ruta}" class="bottom-nav__item" ${esActiva(item.ruta, rutaActiva) ? 'aria-current="page"' : ""}>
        ${item.icono}
        <span>${item.etiqueta}</span>
      </a>
    `).join("");
  }
}

function renderItem(item, rutaActiva, baseClass) {
  const activo = esActiva(item.ruta, rutaActiva);
  const claseActiva = activo ? `${baseClass}--active` : "";
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