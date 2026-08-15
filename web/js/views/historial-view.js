import { leerHistorial, limpiarHistorial } from "../state.js";
import { escapeHtml, formatearFecha } from "../util.js";
import { ICONS, mostrarToast } from "../icons.js";
import { VEREDICTO_LABELS } from "../components/veredicto-badge.js";

export async function render(container) {
  const historial = leerHistorial();

  container.innerHTML = `
    <div class="dash-hero">
      <h1 class="dash-hero__title">Historial de Consultas</h1>
      <p class="dash-hero__subtitle">Registro de afirmaciones y contrastaciones almacenadas en este dispositivo.</p>
    </div>
    <div id="historial-contenido"></div>
  `;

  const contenido = container.querySelector("#historial-contenido");

  if (!historial.length) {
    contenido.innerHTML = `
      <div class="console-card" style="text-align:center; padding: 48px 24px;">
        <p style="color:var(--color-text-muted); font-size: 15px;">No tienes consultas guardadas en el historial local.</p>
      </div>
    `;
    return;
  }

  contenido.innerHTML = `
    <div class="recent-grid" style="grid-template-columns: 1fr;">
      ${historial.map(itemHtml).join("")}
    </div>
    <div style="margin-top:28px; text-align:center;">
      <button type="button" class="btn-secondary" id="btn-limpiar" style="color: var(--veredicto-falso-text);">
        ${ICONS.close} <span>Eliminar historial local</span>
      </button>
    </div>
  `;

  contenido.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () => {
      location.hash = `#/consulta/${el.dataset.id}`;
    });
  });

  contenido.querySelector("#btn-limpiar").addEventListener("click", () => {
    if (confirm("¿Deseas eliminar todo el historial local?")) {
      limpiarHistorial();
      mostrarToast("Historial borrado");
      render(container);
    }
  });
}

function itemHtml(item) {
  const textoPlano = (item.resumenMarkdown || "").replace(/[>#*_`\n]/g, " ").trim();
  const snippet = textoPlano.length > 140 ? `${textoPlano.slice(0, 140)}...` : textoPlano;
  const veredicto = item.veredicto || "pendiente";
  const label = VEREDICTO_LABELS[veredicto] || "Pendiente";

  return `
    <div class="recent-card" data-id="${escapeHtml(item.id)}">
      <div class="recent-card__top">
        <span class="recent-card__cand">${escapeHtml(item.candidatura?.nombre || "Consulta Electoral")}</span>
        <span class="veredicto-badge veredicto-badge--${veredicto}">${escapeHtml(label)}</span>
      </div>
      <p class="recent-card__text">${escapeHtml(snippet)}</p>
      <div class="recent-card__bottom">
        <span>${formatearFecha(item.guardado_en)}</span>
        <span class="recent-card__cta">Ver detalle →</span>
      </div>
    </div>
  `;
}