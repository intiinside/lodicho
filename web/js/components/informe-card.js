import { veredictoBadgeHtml } from "./veredicto-badge.js";
import { abrirEvidencias } from "./evidencia-sheet.js";
import { escapeHtml } from "../util.js";

export function crearInformeCard(informe) {
  const el = document.createElement("article");
  el.className = "informe-card";

  const cuerpoHtml = window.marked
    ? window.marked.parse(informe.resumenMarkdown || "")
    : `<p>${escapeHtml(informe.resumenMarkdown || "")}</p>`;

  el.innerHTML = `
    <div class="informe-card__header">
      <div style="flex: 1;">
        <span class="informe-card__name">${escapeHtml(informe.candidatura?.nombre || "Candidatura por confirmar")}</span>
        <span class="informe-card__jurisdiction">${metaCandidatura(informe.candidatura)}</span>
      </div>
    </div>
    <div class="informe-card__body">${cuerpoHtml}</div>
    <div class="informe-card__footer">
      ${estadoBadgeHtml(informe)}
      <button type="button" class="informe-card__evidence-trigger" data-accion="ver-evidencia">
        Ver evidencia (${informe.evidencias?.length || 0})
      </button>
    </div>
  `;

  el.querySelector('[data-accion="ver-evidencia"]').addEventListener("click", () => {
    abrirEvidencias(informe.evidencias || []);
  });

  return el;
}

function estadoBadgeHtml(informe) {
  if (informe.estado === "publicado" && informe.veredicto) {
    return veredictoBadgeHtml(informe.veredicto);
  }
  const texto =
    informe.estado === "borrador"
      ? "Borrador — sin revisión editorial"
      : informe.estado === "en_revision"
        ? "En revisión editorial"
        : "Evidencia sin veredicto";
  return `<span class="veredicto-badge veredicto-badge--pendiente">${texto}</span>`;
}

function metaCandidatura(candidatura) {
  if (!candidatura) return "";
  const partes = [candidatura.dignidad, candidatura.organizacion_politica].filter(Boolean);
  return escapeHtml(partes.join(" · "));
}