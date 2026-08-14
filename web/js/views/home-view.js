// Pantalla principal: elegir metodo de entrada (texto/voz/url), enviar la
// consulta, y ver los resultados aparecer como tarjetas de feed a medida
// que llegan por SSE — evidencia primero (paso 6, entrega inmediata), el
// veredicto despues si se pidio (paso 7, siempre "borrador" hasta que un
// revisor lo publique).
import { enviarConsulta, obtenerEstado } from "../api.js";
import { crearVoiceRecorder } from "../components/voice-recorder.js";
import { crearInformeCard } from "../components/informe-card.js";
import { bannerSilencioHtml, bannerHtml } from "../components/banner-silencio.js";
import { guardarEnHistorial } from "../state.js";
import { escapeHtml } from "../util.js";

export async function render(container) {
  container.innerHTML = `
    <div id="home-banner"></div>

    <div class="input-tabs" role="tablist">
      <button type="button" class="input-tabs__btn" role="tab" data-tab="texto" aria-selected="true">Texto</button>
      <button type="button" class="input-tabs__btn" role="tab" data-tab="voz" aria-selected="false">Voz</button>
      <button type="button" class="input-tabs__btn" role="tab" data-tab="url" aria-selected="false">URL</button>
    </div>

    <div class="input-panel" data-panel="texto" data-active="true">
      <textarea class="textarea-field" id="campo-texto" placeholder="Pega o escribe lo que dijo el candidato…"></textarea>
      <p class="field-hint">Cita textual, o dictado tuyo describiendo la propuesta.</p>
    </div>

    <div class="input-panel" data-panel="voz" data-active="false">
      <div id="voice-recorder-slot"></div>
      <textarea class="textarea-field" id="campo-voz-texto" placeholder="El texto reconocido aparece aquí — revísalo antes de enviar."></textarea>
      <p class="field-hint">Guardamos el audio original como evidencia ante cualquier impugnación.</p>
    </div>

    <div class="input-panel" data-panel="url" data-active="false">
      <input class="text-field" id="campo-url" type="url" placeholder="https://…" inputmode="url" autocapitalize="off" autocorrect="off" />
      <p class="field-hint">Nota de prensa o publicación. Su contenido se trata como no confiable hasta separarlo en citas.</p>
    </div>

    <button type="button" class="btn btn--primary" id="btn-enviar" style="margin-top: var(--space-4);">Consultar</button>

    <div id="home-estado"></div>
    <div id="home-resultados"></div>
  `;

  obtenerEstado().then((estado) => {
    container.querySelector("#home-banner").innerHTML = bannerSilencioHtml(estado.modo_silencio_electoral);
  });

  const estadoVoz = { audioBlob: null };

  configurarTabs(container);
  configurarVoz(container, estadoVoz);
  container.querySelector("#btn-enviar").addEventListener("click", () => manejarEnvio(container, estadoVoz));
}

function configurarTabs(container) {
  const botones = [...container.querySelectorAll('[role="tab"]')];
  botones.forEach((boton) => {
    boton.addEventListener("click", () => {
      botones.forEach((b) => b.setAttribute("aria-selected", String(b === boton)));
      container.querySelectorAll(".input-panel").forEach((panel) => {
        panel.dataset.active = String(panel.dataset.panel === boton.dataset.tab);
      });
    });
  });
}

function configurarVoz(container, estadoVoz) {
  const slot = container.querySelector("#voice-recorder-slot");
  const campoVozTexto = container.querySelector("#campo-voz-texto");
  const grabador = crearVoiceRecorder({
    onTranscripcion: (texto, blob) => {
      if (texto) campoVozTexto.value = texto;
      estadoVoz.audioBlob = blob;
    },
  });
  slot.appendChild(grabador);
}

function tabActiva(container) {
  return container.querySelector('[role="tab"][aria-selected="true"]').dataset.tab;
}

function construirPayload(container, estadoVoz) {
  const tab = tabActiva(container);
  if (tab === "texto") {
    const texto = container.querySelector("#campo-texto").value.trim();
    if (!texto) return { error: "Escribe o pega una declaración primero." };
    return { payload: { tipoInput: "texto", texto } };
  }
  if (tab === "voz") {
    const texto = container.querySelector("#campo-voz-texto").value.trim();
    if (!texto && !estadoVoz.audioBlob) return { error: "Graba o escribe algo primero." };
    return { payload: { tipoInput: "voz", texto, audioBlob: estadoVoz.audioBlob } };
  }
  const url = container.querySelector("#campo-url").value.trim();
  if (!url) return { error: "Pega la URL de la nota de prensa." };
  return { payload: { tipoInput: "url", urlFuente: url } };
}

async function manejarEnvio(container, estadoVoz) {
  const estadoEl = container.querySelector("#home-estado");
  const boton = container.querySelector("#btn-enviar");

  const { payload, error } = construirPayload(container, estadoVoz);
  if (error) {
    estadoEl.innerHTML = bannerHtml("warning", escapeHtml(error));
    return;
  }

  await ejecutarConsulta(container, payload, { estadoEl, boton });
}

async function ejecutarConsulta(container, payload, { estadoEl, boton }) {
  const contenedorResultados = container.querySelector("#home-resultados");

  boton.disabled = true;
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
          ejecutarConsulta(container, { ...payload, candidaturaId }, { estadoEl, boton });
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

  boton.disabled = false;
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
