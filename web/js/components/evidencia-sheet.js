// Hoja inferior con el detalle de evidencia: chunk recuperado, score,
// doc_id y git_sha. "Esa trazabilidad es el producto" (CLAUDE.md, Frontend).
import { ICONS } from "../icons.js";
import { escapeHtml } from "../util.js";

const ETIQUETA_PASO = {
  planes_trabajo: "Plan de trabajo",
  marco_legal: "Marco legal (COOTAD)",
  indicadores: "Indicador oficial",
  analisis_publicados: "Análisis publicado",
};

let sheetEl = null;
let backdropEl = null;

function elementos() {
  if (!sheetEl) sheetEl = document.getElementById("sheet");
  if (!backdropEl) backdropEl = document.getElementById("sheet-backdrop");
  return { sheetEl, backdropEl };
}

export function abrirEvidencias(evidencias, titulo = "Evidencia recuperada") {
  const { sheetEl, backdropEl } = elementos();
  if (!sheetEl || !backdropEl) return;

  sheetEl.innerHTML = `
    <div class="sheet__handle"></div>
    <div class="sheet__header">
      <h2 class="sheet__title" id="sheet-title">${escapeHtml(titulo)}</h2>
      <button type="button" class="sheet__close" id="sheet-close" aria-label="Cerrar">${ICONS.close}</button>
    </div>
    <div class="sheet__body">
      ${evidencias && evidencias.length ? evidencias.map(itemHtml).join("") : vacioHtml()}
    </div>
  `;

  sheetEl.querySelector("#sheet-close").addEventListener("click", cerrarEvidencias);
  backdropEl.addEventListener("click", cerrarEvidencias, { once: true });

  requestAnimationFrame(() => {
    sheetEl.dataset.open = "true";
    backdropEl.dataset.open = "true";
  });
}

export function cerrarEvidencias() {
  const { sheetEl, backdropEl } = elementos();
  if (sheetEl) sheetEl.dataset.open = "false";
  if (backdropEl) backdropEl.dataset.open = "false";
}

function itemHtml(ev) {
  const score = typeof ev.score === "number" ? ev.score.toFixed(3) : ev.score;
  return `
    <article class="evidencia-item">
      <p class="evidencia-item__paso">${escapeHtml(ETIQUETA_PASO[ev.paso] || ev.paso || "")}</p>
      <p class="evidencia-item__texto">${escapeHtml(ev.texto)}</p>
      <div class="evidencia-item__meta">
        <span>score ${escapeHtml(score)}</span>
        <span>${escapeHtml(ev.doc_id)}</span>
        <span>${escapeHtml((ev.git_sha || "").slice(0, 10))}</span>
      </div>
    </article>
  `;
}

function vacioHtml() {
  return `
    <div class="state-block">
      ${ICONS.empty}
      <p>No se recuperó evidencia para este paso.</p>
    </div>
  `;
}
