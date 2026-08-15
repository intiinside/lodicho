import { veredictoBadgeHtml } from "./veredicto-badge.js";
import { abrirEvidencias } from "./evidencia-sheet.js";
import { escapeHtml } from "../util.js";
import { ICONS, mostrarToast } from "../icons.js";
import { pedirVeredicto } from "../api.js";
import { guardarEnHistorial } from "../state.js";

export function crearInformeCard(informe) {
  const el = document.createElement("article");
  el.className = "informe-card";

  const cuerpoHtml = window.marked
    ? window.marked.parse(informe.resumenMarkdown || "")
    : `<p>${escapeHtml(informe.resumenMarkdown || "")}</p>`;

  el.innerHTML = `
    <div class="informe-card__header">
      <div class="informe-card__title-group">
        <h3 class="informe-card__name">${escapeHtml(informe.candidatura?.nombre || "Consulta Electoral")}</h3>
        <span class="informe-card__jurisdiction">${metaCandidatura(informe.candidatura)}</span>
      </div>
      <div>${estadoBadgeHtml(informe)}</div>
    </div>

    ${bannerEditorialHtml(informe)}

    <div class="informe-card__body">
      ${cuerpoHtml}
      ${factibilidadHtml(informe.factibilidad_factores, informe.factibilidad_score)}
      ${replicaHtml(informe.respuesta_candidato)}
    </div>

    <div class="informe-card__footer">
      <button type="button" class="btn-secondary" data-accion="ver-evidencia">
        ${ICONS.folder} <span>Ver Evidencia (${informe.evidencias?.length || 0})</span>
      </button>
      <button type="button" class="btn-secondary" data-accion="copiar-despacho">
        ${ICONS.copy} <span>Copiar Despacho</span>
      </button>
      ${mostrarBotonVeredicto(informe) ? `
        <button type="button" class="btn-secondary" data-accion="pedir-veredicto">
          ${ICONS.sparkles} <span>Pedir Veredicto</span>
        </button>
      ` : ""}
    </div>
  `;

  el.querySelector('[data-accion="ver-evidencia"]').addEventListener("click", () => {
    abrirEvidencias(informe.evidencias || []);
  });

  el.querySelector('[data-accion="copiar-despacho"]').addEventListener("click", () => {
    copiarDespacho(informe);
  });

  el.querySelector('[data-accion="pedir-veredicto"]')?.addEventListener("click", (ev) => {
    solicitarVeredicto(el, informe, ev.currentTarget);
  });

  return el;
}

function mostrarBotonVeredicto(informe) {
  return (
    informe.estado !== "publicado" &&
    !informe.veredicto &&
    Boolean(informe.candidatura) &&
    Boolean(informe.declaracionId)
  );
}

async function solicitarVeredicto(el, informe, boton) {
  boton.disabled = true;
  boton.querySelector("span").textContent = "Generando...";

  await pedirVeredicto(informe.declaracionId, informe.candidatura.id, {
    onEvento(nombre, data) {
      if (nombre === "veredicto") {
        const actualizado = guardarEnHistorial({ ...informe, ...data });
        el.replaceWith(crearInformeCard(actualizado));
        return;
      }
      if (nombre === "rechazo" || nombre === "error") {
        mostrarToast(data.motivo || data.detalle || "No se pudo generar el veredicto");
        boton.disabled = false;
        boton.querySelector("span").textContent = "Pedir Veredicto";
      }
    },
    onError(err) {
      mostrarToast(err.message);
      boton.disabled = false;
      boton.querySelector("span").textContent = "Pedir Veredicto";
    },
  });
}

function bannerEditorialHtml(informe) {
  if (informe.estado === "borrador" || informe.estado === "en_revision") {
    return `
      <div class="banner banner--warning" style="margin: 0; border-radius: 0; border-bottom: 0.5px solid var(--color-border-subtle);">
        ${ICONS.alert} <span>Verificación preliminar automática — pendiente de firma y revisión editorial.</span>
      </div>
    `;
  }
  return "";
}

function estadoBadgeHtml(informe) {
  if (informe.estado === "publicado" && informe.veredicto) {
    return veredictoBadgeHtml(informe.veredicto);
  }
  const texto = informe.estado === "borrador" ? "Borrador" : informe.estado === "en_revision" ? "En revisión" : "Evidencia";
  return `<span class="veredicto-badge veredicto-badge--pendiente">${texto}</span>`;
}

function metaCandidatura(candidatura) {
  if (!candidatura) return "Bolívar • CNE";
  const partes = [candidatura.dignidad, candidatura.organizacion_politica].filter(Boolean);
  return escapeHtml(partes.join(" • "));
}

function factibilidadHtml(factores, score) {
  if (!factores || Object.keys(factores).length === 0) return "";
  const items = Object.entries(factores).map(([k, v]) => {
    const displayKey = k.replace(/_/g, " ");
    const pctFill = (v === "exclusiva" || v === "explicito" || v === "con_monto" || v === "holgado" || v === "existe") ? 100 :
                    (v === "concurrente" || v === "implicito" || v === "mencionado" || v === "ajustado" || v === "parcial") ? 50 : 15;
    const color = pctFill === 100 ? 'var(--veredicto-viable-dot)' : pctFill === 50 ? 'var(--veredicto-no-consta-dot)' : 'var(--veredicto-falso-dot)';

    return `
      <div class="factor-item">
        <div class="factor-labels">
          <span class="factor-name">${escapeHtml(displayKey)}</span>
          <span class="factor-value">${escapeHtml(String(v).replace(/_/g, " "))}</span>
        </div>
        <div class="factor-track">
          <div class="factor-fill" style="width: ${pctFill}%; background-color: ${color};"></div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="factibility-box">
      <div class="factibility-header">
        <span class="factibility-title">Rúbrica de Factibilidad</span>
        ${score != null ? `<span class="factibility-score">${score}/100</span>` : ""}
      </div>
      <div>${items}</div>
    </div>
  `;
}

function replicaHtml(respuesta) {
  if (!respuesta) return "";
  return `
    <div class="candidate-reply">
      <div class="candidate-reply__tag">Derecho a Réplica Oficial</div>
      <p class="candidate-reply__text">"${escapeHtml(respuesta)}"</p>
    </div>
  `;
}

async function copiarDespacho(informe) {
  const evtText = informe.evidencias?.[0]?.texto || "Sin evidencia directa";
  const docId = informe.evidencias?.[0]?.doc_id || "N/A";
  const sha = informe.evidencias?.[0]?.git_sha ? informe.evidencias[0].git_sha.substring(0, 8) : "N/A";
  const veredicto = informe.veredicto ? informe.veredicto.toUpperCase().replace(/_/g, " ") : "EN REVISIÓN";
  const revisor = informe.revisor_id || "Mesa de Verificación";

  const despacho = `VEREDICTO: ${veredicto}
Declaración:
${informe.resumenMarkdown?.split("\n")[0] || ""}

Evidencia Oficial (${docId}):
"${evtText}"

Trazabilidad: Git SHA ${sha}
Validado por: ${revisor}
Lo Dicho — Contrastación Electoral Bolívar`;

  try {
    await navigator.clipboard.writeText(despacho);
    mostrarToast("Despacho copiado al portapapeles");
  } catch (e) {
    mostrarToast("Error al copiar despacho");
  }
}