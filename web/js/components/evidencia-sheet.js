import { ICONS, mostrarToast } from "../icons.js";
import { escapeHtml } from "../util.js";

const ETIQUETA_PASO = {
  planes_trabajo: "Plan de Trabajo Inscrito",
  marco_legal: "Competencia Legal (COOTAD)",
  indicadores: "Indicador Oficial (INEC / BCE)",
  analisis_publicados: "Análisis Previo Publicado",
};

let sheetEl = null;
let backdropEl = null;

function elementos() {
  if (!sheetEl) sheetEl = document.getElementById("sheet");
  if (!backdropEl) backdropEl = document.getElementById("sheet-backdrop");
  return { sheetEl, backdropEl };
}

export function abrirEvidencias(evidencias, titulo = "Trazabilidad de Evidencias") {
  const { sheetEl, backdropEl } = elementos();
  if (!sheetEl || !backdropEl) return;

  sheetEl.innerHTML = `
    <div class="sheet__handle-area" id="sheet-handle"><div class="sheet__handle"></div></div>
    <div class="sheet__header">
      <h2 class="sheet__title" id="sheet-title">${escapeHtml(titulo)}</h2>
      <button type="button" class="sheet__close" id="sheet-close" aria-label="Cerrar modal">${ICONS.close}</button>
    </div>
    <div class="sheet__body">
      ${evidencias && evidencias.length ? evidencias.map(itemHtml).join("") : vacioHtml()}
    </div>
  `;

  sheetEl.querySelector("#sheet-close").addEventListener("click", cerrarEvidencias);
  backdropEl.addEventListener("click", cerrarEvidencias, { once: true });

  sheetEl.querySelectorAll("[data-copy-sha]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(btn.dataset.copySha);
      mostrarToast("SHA copiado al portapapeles");
    });
  });

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
    <div class="evidence-chunk">
      <div class="evidence-chunk__step">${escapeHtml(ETIQUETA_PASO[ev.paso] || ev.paso || "Fuente")}</div>
      <p class="evidence-chunk__text">${escapeHtml(ev.texto)}</p>
      <div class="evidence-chunk__meta">
        ${score ? `<span>Score RRF: ${escapeHtml(score)}</span>` : ""}
        <span>Doc: ${escapeHtml(ev.doc_id || "N/A")}</span>
        ${ev.git_sha ? `<button type="button" class="btn-secondary" style="padding:2px 8px; font-size:11px;" data-copy-sha="${escapeHtml(ev.git_sha)}">Git: ${escapeHtml(ev.git_sha.slice(0, 8))}</button>` : ""}
      </div>
    </div>
  `;
}

function vacioHtml() {
  return `
    <div class="loading-state">
      ${ICONS.empty}
      <p>No se recuperaron fragmentos para esta consulta.</p>
    </div>
  `;
}