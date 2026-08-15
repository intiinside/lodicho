import { enviarConsulta, obtenerEstado } from "../api.js";
import { crearComposer } from "../components/composer.js";
import { crearInformeCard } from "../components/informe-card.js";
import { bannerSilencioHtml, bannerHtml } from "../components/banner-silencio.js";
import {
  guardarEnHistorial,
  leerHistorial,
  leerCandidaturaPreseleccionada,
  limpiarCandidaturaPreseleccionada,
} from "../state.js";
import { escapeHtml, formatearFecha } from "../util.js";
import { VEREDICTO_LABELS } from "../components/veredicto-badge.js";
import { ICONS } from "../icons.js";

export async function render(container) {
  const historialReciente = leerHistorial().slice(0, 4);
  let candidaturaPreseleccionada = leerCandidaturaPreseleccionada();

  container.innerHTML = `
    <div id="home-banner"></div>

    <div class="dash-hero">
      <h1 class="dash-hero__title">Contrastación Electoral</h1>
      <p class="dash-hero__subtitle">Cotejo factual e inmediato contra planes de trabajo del CNE y competencias legales del COOTAD.</p>
    </div>

    <div id="candidatura-preseleccionada-slot" style="margin-bottom: 16px;"></div>

    <div id="composer-slot" style="margin-bottom: 32px;"></div>

    <div id="home-estado" style="margin-bottom: 24px;"></div>
    <div id="home-resultados-stream"></div>

    <section class="dash-section" id="seccion-recientes">
      <div class="dash-section__header">
        <h2 class="dash-section__title">Consultas Recientes</h2>
        <a href="#/historial" class="recent-card__cta">Ver todas</a>
      </div>
      <div class="recent-grid">
        ${historialReciente.length ? historialReciente.map(recienteCardHtml).join("") : vacioRecientesHtml()}
      </div>
    </section>
  `;

  obtenerEstado().then((estado) => {
    container.querySelector("#home-banner").innerHTML = bannerSilencioHtml(estado.modo_silencio_electoral);
  });

  const preseleccionSlot = container.querySelector("#candidatura-preseleccionada-slot");
  function pintarPreseleccion() {
    preseleccionSlot.innerHTML = candidaturaPreseleccionada
      ? `
        <div class="console-card" style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; margin-bottom:0; border-color:var(--color-brand);">
          <span style="font-size:13px;">Vas a contrastar una declaración de <strong>${escapeHtml(candidaturaPreseleccionada.nombre)}</strong>.</span>
          <button type="button" class="btn-secondary" id="btn-quitar-preseleccion" style="flex-shrink:0;">
            ${ICONS.close} <span>Quitar</span>
          </button>
        </div>
      `
      : "";

    const btnQuitar = preseleccionSlot.querySelector("#btn-quitar-preseleccion");
    if (btnQuitar) {
      btnQuitar.addEventListener("click", () => {
        candidaturaPreseleccionada = null;
        limpiarCandidaturaPreseleccionada();
        pintarPreseleccion();
      });
    }
  }
  pintarPreseleccion();

  const estadoEl = container.querySelector("#home-estado");
  const composer = crearComposer({
    onEnviar: (payload) => {
      const payloadConCandidatura = candidaturaPreseleccionada
        ? { ...payload, candidaturaId: candidaturaPreseleccionada.id }
        : payload;
      ejecutarConsulta(container, payloadConCandidatura, estadoEl);
    },
  });
  container.querySelector("#composer-slot").appendChild(composer);
}

function recienteCardHtml(item) {
  const snippet = (item.resumenMarkdown || "").replace(/[>#*_`\n]/g, " ").trim().slice(0, 85);
  const veredicto = item.veredicto || "pendiente";
  const label = VEREDICTO_LABELS[veredicto] || "Pendiente";

  return `
    <div class="recent-card" onclick="location.hash='#/consulta/${escapeHtml(item.id)}'">
      <div class="recent-card__top">
        <span class="recent-card__cand">${escapeHtml(item.candidatura?.nombre || "Consulta Electoral")}</span>
        <span class="veredicto-badge veredicto-badge--${veredicto}">${escapeHtml(label)}</span>
      </div>
      <p class="recent-card__text">${escapeHtml(snippet)}...</p>
      <div class="recent-card__bottom">
        <span>${formatearFecha(item.guardado_en)}</span>
        <span class="recent-card__cta">Ver informe →</span>
      </div>
    </div>
  `;
}

function vacioRecientesHtml() {
  return `
    <div class="recent-card" style="grid-column: 1/-1; text-align: center; padding: 24px;">
      <p style="color: var(--color-text-subtle);">No tienes consultas guardadas en este dispositivo.</p>
    </div>
  `;
}

async function ejecutarConsulta(container, payload, estadoEl) {
  const streamEl = container.querySelector("#home-resultados-stream");
  const recientesEl = container.querySelector("#seccion-recientes");
  if (recientesEl) recientesEl.style.display = "none";

  estadoEl.innerHTML = `
    <div class="loading-state">
      <div class="apple-spinner"></div>
      <span>Contrastando con el corpus oficial de planes y leyes...</span>
    </div>
  `;

  await enviarConsulta(payload, {
    onEvento(nombre, data) {
      if (nombre === "rechazo") {
        estadoEl.innerHTML = bannerHtml("warning", escapeHtml(data.motivo || "Consulta no permitida"));
        return;
      }
      if (nombre === "candidatura") {
        if (data.opciones && data.opciones.length > 0) {
          mostrarOpcionesCandidatura(estadoEl, data.opciones, (candidaturaId) => {
            ejecutarConsulta(container, { ...payload, candidaturaId }, estadoEl);
          });
        } else if (!data.candidatura) {
          mostrarFallbackDPA(estadoEl, (candidaturaId) => {
            ejecutarConsulta(container, { ...payload, candidaturaId }, estadoEl);
          });
        }
        return;
      }
      if (nombre === "evidencia") {
        estadoEl.innerHTML = "";
        const informe = guardarEnHistorial({
          candidatura: data.candidatura || null,
          declaracionId: data.declaracion?.id ?? null,
          resumenMarkdown: construirResumenMarkdown(data, payload),
          veredicto: null,
          estado: "borrador",
          evidencias: data.evidencias || [],
        });
        streamEl.prepend(crearInformeCard(informe));
        return;
      }
      if (nombre === "error") {
        estadoEl.innerHTML = bannerHtml("warning", escapeHtml(data.detalle || "Ocurrió un error."));
      }
    },
    onError(err) {
      estadoEl.innerHTML = bannerHtml("danger", escapeHtml(err.message));
    },
  });
}

function mostrarOpcionesCandidatura(estadoEl, opciones, onElegir) {
  estadoEl.innerHTML = `
    <div class="console-card" style="border-color: var(--color-brand);">
      <p style="font-weight:700; margin-bottom:12px;">Se detectaron varias candidaturas posibles. Selecciona una:</p>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${opciones.map(op => `
          <button type="button" class="btn-secondary" data-candidatura-id="${escapeHtml(String(op.id))}" style="justify-content: flex-start; text-align: left;">
            <strong>${escapeHtml(op.nombre || "Candidato")}</strong> — ${escapeHtml(op.dignidad)} (${escapeHtml(op.organizacion)})
          </button>
        `).join("")}
      </div>
    </div>
  `;

  estadoEl.querySelectorAll("[data-candidatura-id]").forEach((boton) => {
    boton.addEventListener("click", () => onElegir(boton.dataset.candidaturaId));
  });
}

function mostrarFallbackDPA(estadoEl, onElegir) {
  estadoEl.innerHTML = `
    <div class="console-card" style="border-color: var(--color-brand);">
      <p style="font-weight:700; margin-bottom:12px;">No se identificó un candidato explícito. Selecciona el nivel de gobierno:</p>
      <div style="margin-bottom: 12px;">
        <select class="console-select" id="fallback-dignidad">
          <option value="">-- Seleccionar Dignidad --</option>
          <option value="prefecto">Prefectura (Provincial)</option>
          <option value="alcalde">Alcaldía (Cantonal)</option>
          <option value="vocal_junta_parroquial">Junta Parroquial</option>
        </select>
      </div>
      <button type="button" class="btn-primary" id="btn-confirmar-dpa" disabled>Continuar</button>
    </div>
  `;

  const select = estadoEl.querySelector("#fallback-dignidad");
  const btn = estadoEl.querySelector("#btn-confirmar-dpa");

  select.addEventListener("change", () => { btn.disabled = !select.value; });
  btn.addEventListener("click", () => onElegir("fallback_" + select.value));
}

function construirResumenMarkdown(data, payload) {
  const partes = [];
  if (data.declaracion?.texto || payload.texto) {
    partes.push(`> ${escapeHtml(data.declaracion?.texto || payload.texto)}`);
  }
  for (const ev of data.evidencias || []) {
    partes.push(escapeHtml(ev.texto));
  }
  return partes.join("\n\n") || "_Sin evidencia recuperada._";
}