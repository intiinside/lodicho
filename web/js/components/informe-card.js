// Tarjeta de feed: evidencia + (si ya esta publicado) veredicto. Nunca
// muestra un veredicto categorico salvo que estado === "publicado" — un
// borrador sin firma de revisor no es un veredicto (CLAUDE.md, Regla
// critica 4).
import { veredictoBadgeHtml } from "./veredicto-badge.js";
import { abrirEvidencias } from "./evidencia-sheet.js";
import { escapeHtml } from "../util.js";

export function crearInformeCard(informe) {
  const el = document.createElement("article");
  el.className = "informe-card";

  const iniciales = obtenerIniciales(informe.candidatura?.nombre);
  const cuerpoHtml = window.marked
    ? window.marked.parse(informe.resumenMarkdown || "")
    : `<p>${escapeHtml(informe.resumenMarkdown || "")}</p>`;

  el.innerHTML = `
    <div class="informe-card__header">
      <div class="informe-card__avatar">${iniciales}</div>
      <div class="informe-card__identity">
        <p class="informe-card__nombre">${escapeHtml(informe.candidatura?.nombre || "Candidatura por confirmar")}</p>
        <p class="informe-card__meta">${metaCandidatura(informe.candidatura)}</p>
      </div>
    </div>
    <div class="informe-card__body">${cuerpoHtml}</div>
    <div class="informe-card__footer">
      ${estadoBadgeHtml(informe)}
      <button type="button" class="informe-card__link" data-accion="ver-evidencia">
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

function obtenerIniciales(nombre) {
  if (!nombre) return "?";
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
}
