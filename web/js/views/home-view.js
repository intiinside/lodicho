// Pantalla principal: un composer unico (texto/voz/URL en una sola caja,
// el modo se infiere al enviar — ver components/composer.js) y los
// resultados aparecen como tarjetas de feed a medida que llegan por SSE:
// evidencia primero (paso 6, entrega inmediata), el veredicto despues si
// se pidio (paso 7, siempre "borrador" hasta que un revisor lo publique).
import { enviarConsulta, obtenerEstado } from "../api.js";
import { crearComposer } from "../components/composer.js";
import { crearInformeCard } from "../components/informe-card.js";
import { bannerSilencioHtml, bannerHtml } from "../components/banner-silencio.js";
import { guardarEnHistorial } from "../state.js";
import { escapeHtml } from "../util.js";

export async function render(container) {
  container.innerHTML = `
    <div class="home-intro">
      <h1 class="home-intro__titulo">Contrastación y Verificación Electoral</h1>
      <p class="home-intro__subtitulo">Cotejo factual con planes de trabajo inscritos en el CNE y competencias legales.</p>
    </div>
    <div id="home-banner"></div>
    <div id="composer-slot"></div>
    <div id="home-estado"></div>
    <div id="home-resultados"></div>
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

  estadoEl.innerHTML = `<div class="state-block"><div class="spinner"></div><p>Consultando…</p></div>`;

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
    <div class="state-block">
      <p>Hay varias candidaturas que coinciden. ¿Cuál es?</p>
      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        ${opciones
          .map(
            (op) => `
              <button type="button" class="btn btn--ghost btn--block" data-candidatura-id="${escapeHtml(op.id)}">
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
  // El backend entrega JSON estructurado; el frontend arma el Markdown a
  // partir de el (CLAUDE.md, "Salida del modelo"). Los campos de texto se
  // escapan antes de interpolarse: el contenido puede venir de una URL, y
  // ese es "dato no confiable" (Regla crítica 7) — no debe poder inyectar
  // HTML ni Markdown propio dentro del informe.
  const partes = [];
  if (data.declaracion?.texto) {
    partes.push(`> ${escapeHtml(data.declaracion.texto)}`);
  }
  for (const ev of data.evidencias || []) {
    partes.push(escapeHtml(ev.texto));
  }
  return partes.join("\n\n") || "_Sin evidencia recuperada._";
}
