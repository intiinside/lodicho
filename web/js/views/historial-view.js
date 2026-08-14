import { leerHistorial, limpiarHistorial } from "../state.js";
import { escapeHtml, formatearFecha } from "../util.js";
import { ICONS } from "../icons.js";

export async function render(container) {
  const historial = leerHistorial();

  container.innerHTML = `
    <h1 style="font-size:20px; margin-bottom:16px;">Historial</h1>
    <div id="historial-contenido"></div>
  `;

  const contenido = container.querySelector("#historial-contenido");

  if (!historial.length) {
    contenido.innerHTML = vacioHtml();
    return;
  }

  contenido.innerHTML = `
    <ul id="historial-lista">${historial.map(itemHtml).join("")}</ul>
    <button type="button" class="btn btn--ghost btn--block" id="btn-limpiar" style="margin-top:16px;">
      Borrar historial de este dispositivo
    </button>
  `;

  contenido.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () => {
      location.hash = `#/consulta/${el.dataset.id}`;
    });
  });

  contenido.querySelector("#btn-limpiar").addEventListener("click", () => {
    if (confirm("¿Borrar todo el historial guardado en este dispositivo?")) {
      limpiarHistorial();
      render(container);
    }
  });
}

function itemHtml(item) {
  const textoPlano = (item.resumenMarkdown || "").replace(/[>#*_`\n]/g, " ").trim();
  const snippet = textoPlano.length > 140 ? `${textoPlano.slice(0, 140)}…` : textoPlano;
  return `
    <li>
      <button type="button" class="historial-item" data-id="${escapeHtml(item.id)}">
        <span class="historial-item__icon">${ICONS.history}</span>
        <span>
          <p class="historial-item__texto">
            <strong>${escapeHtml(item.candidatura?.nombre || "Consulta")}</strong>
            ${snippet ? " — " + escapeHtml(snippet) : ""}
          </p>
          <p class="historial-item__fecha">${formatearFecha(item.guardado_en)}</p>
        </span>
      </button>
    </li>
  `;
}

function vacioHtml() {
  return `
    <div class="state-block">
      ${ICONS.empty}
      <h2>Todavía no hay consultas</h2>
      <p>Lo que consultes desde este teléfono va a aparecer aquí.</p>
    </div>
  `;
}
