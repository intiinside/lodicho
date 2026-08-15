import { leerHistorial, limpiarHistorial } from "../state.js";
import { escapeHtml, formatearFecha } from "../util.js";
import { ICONS } from "../icons.js";

export async function render(container) {
  const historial = leerHistorial();

  container.innerHTML = `
    <div class="dash-hero">
      <h1 class="dash-hero__title">Historial de Consultas</h1>
      <p class="dash-hero__subtitle">Tu registro local de verificaciones.</p>
    </div>
    <div id="historial-contenido"></div>
  `;

  const contenido = container.querySelector("#historial-contenido");

  if (!historial.length) {
    contenido.innerHTML = `
      <div class="loading-state">
        ${ICONS.empty}
        <h2>Todavía no hay consultas</h2>
        <p>Lo que consultes desde este dispositivo aparecerá aquí.</p>
      </div>
    `;
    return;
  }

  contenido.innerHTML = `
    <div class="historial-lista">
      ${historial.map(itemHtml).join("")}
    </div>
    <button type="button" class="btn-clear-history" id="btn-limpiar" style="margin-top: 24px; width: 100%; justify-content: center;">
      ${ICONS.close} Borrar historial de este dispositivo
    </button>
  `;

  contenido.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () => { location.hash = `#/consulta/${el.dataset.id}`; });
  });

  contenido.querySelector("#btn-limpiar").addEventListener("click", () => {
    if (confirm("¿Borrar todo el historial guardado en este dispositivo?")) {
      limpiarHistorial();
      render(container);
    }
  });
}

function itemHtml(item) {
  const textoPlano = (item.resumenMarkdown || "").replace(/[>#*_`\n]/g, " ").trim();
  const snippet = textoPlano.length > 140 ? `${textoPlano.slice(0, 140)}…` : textoPlano;
  return `
    <div class="historial-card" data-id="${escapeHtml(item.id)}">
      <div class="historial-card__main">
        <div class="historial-card__top">
          <span class="historial-card__candidato">${escapeHtml(item.candidatura?.nombre || "Consulta General")}</span>
          <span class="historial-card__fecha">${formatearFecha(item.guardado_en)}</span>
        </div>
        <p class="historial-card__texto">${snippet ? escapeHtml(snippet) : ""}</p>
        <div class="historial-card__footer">
          <span class="historial-card__link">Ver detalles &rarr;</span>
        </div>
      </div>
    </div>
  `;
}