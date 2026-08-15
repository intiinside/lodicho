import { enviarConsulta, obtenerEstado } from "../api.js";
import { crearComposer } from "../components/composer.js";
import { crearInformeCard } from "../components/informe-card.js";
import { bannerSilencioHtml, bannerHtml } from "../components/banner-silencio.js";
import { guardarEnHistorial } from "../state.js";
import { escapeHtml } from "../util.js";

export async function render(container) {
  container.innerHTML = `
    <div class="dash-hero">
      <h1 class="dash-hero__title">Preguntar a Lo Dicho</h1>
      <p class="dash-hero__subtitle">Verifica declaraciones con los planes de trabajo oficiales y el COOTAD.</p>
    </div>
    <div id="home-banner"></div>
    <div id="composer-slot"></div>
    <div id="home-estado"></div>
    <div class="dash-section" style="margin-top: 32px;">
      <div class="dash-section__header">
        <div class="dash-section__title-group">
          <h2 class="dash-section__title">Resultados de la Verificación</h2>
        </div>
      </div>
      <div id="home-resultados" class="recent-grid"></div>
    </div>
  `;

  obtenerEstado().then((estado) => {
    container.querySelector("#home-banner").innerHTML = bannerSilencioHtml(estado.modo_silencio_electoral);
  });

  const estadoEl = container.querySelector("#home-estado");
  const composer = crearComposer({
    onEnviar: (payload) => ejecutarConsulta(container, payload, estadoEl),
  });
  container.querySelector("#composer-slot").appendChild(composer);
}

async function ejecutarConsulta(container, payload, estadoEl) {
  const contenedorResultados = container.querySelector("#home-resultados");

  estadoEl.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Consultando fuentes oficiales…</p></div>`;

  let informeActual = null;
  let cardActual = null;

  await enviarConsulta(payload, {
    onEvento(nombre, data) {
      if (nombre === "rechazo") {
        estadoEl.innerHTML = bannerHtml("warning", escapeHtml(data.motivo));
        return;
      }

      if (nombre === "candidatura" && data.opciones) {
        mostrarOpcionesCandidatura(estadoEl, data.opciones, (candidaturaId) => {
          ejecutarConsulta(container, { ...payload, candidaturaId }, estadoEl);
        });
        return;
      }

      if (nombre === "evidencia") {
        estadoEl.innerHTML = "";
        informeActual = {
          candidatura: data.candidatura || null,
          resumenMarkdown: construirResumenMarkdown(data),
          veredicto: null,
          estado: null,
          evidencias: data.evidencias || [],
        };
        cardActual = crearInformeCard(informeActual);
        contenedorResultados.prepend(cardActual);
        guardarEnHistorial(informeActual);
        return;
      }

      if (nombre === "veredicto" && informeActual && cardActual) {
        informeActual = {
          ...informeActual,
          veredicto: data.veredicto,
          estado: data.estado,
          evidencias: data.evidencias || informeActual.evidencias,
        };
        const nuevaCard = crearInformeCard(informeActual);
        cardActual.replaceWith(nuevaCard);
        cardActual = nuevaCard;
        guardarEnHistorial(informeActual);
        return;
      }

      if (nombre === "error") {
        estadoEl.innerHTML = bannerHtml("warning", escapeHtml(data.detalle || "Ocurrió un error."));
      }
    },
    onError(err) {
      estadoEl.innerHTML = bannerHtml("warning", escapeHtml(err.message));
    },
  });
}

function mostrarOpcionesCandidatura(estadoEl, opciones, onElegir) {
  estadoEl.innerHTML = `
    <div class="loading-state">
      <p>Hay varias candidaturas que coinciden. ¿Cuál es?</p>
      <div style="display:flex; flex-direction:column; gap:8px; width:100%; max-width: 320px;">
        ${opciones
          .map(
            (op) => `
              <button type="button" class="btn btn--ghost" data-candidatura-id="${escapeHtml(op.id)}">
                ${escapeHtml(op.nombre)}${op.dignidad ? " — " + escapeHtml(op.dignidad) : ""}
              </button>
            `
          )
          .join("")}
      </div>
    </div>
  `;
  estadoEl.querySelectorAll("[data-candidatura-id]").forEach((boton) => {
    boton.addEventListener("click", () => onElegir(boton.dataset.candidaturaId));
  });
}

function construirResumenMarkdown(data) {
  const partes = [];
  if (data.declaracion?.texto) {
    partes.push(`> ${escapeHtml(data.declaracion.texto)}`);
  }
  for (const ev of data.evidencias || []) {
    partes.push(escapeHtml(ev.texto));
  }
  return partes.join("\n\n") || "_Sin evidencia recuperada._";
}