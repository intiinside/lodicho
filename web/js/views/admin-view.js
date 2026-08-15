// Panel de admin: subir PDF -> convertir a Markdown (Docling, del lado
// del servidor) -> revisar/editar -> commitear a lodicho-corpus -> ingestar
// a Qdrant. Todo desde el navegador, sin que el revisor toque una
// terminal ni git (ver api/app/services/corpus_git.py).
//
// No enlazado desde la nav publica a proposito: es una herramienta
// interna, no una funcion de cara al ciudadano. Se entra escribiendo
// #/admin directamente.
import { ICONS } from "../icons.js";
import { escapeHtml, formatearFecha } from "../util.js";

const CAMPOS_POR_TIPO = {
  marco_legal: [
    { clave: "nivel_gobierno", etiqueta: "Nivel de gobierno", tipo: "text", placeholder: "parroquial_rural" },
    { clave: "jurisdiccion_dpa", etiqueta: "Jurisdicción DPA (opcional)", tipo: "text", placeholder: "0207" },
  ],
  plan_trabajo: [
    { clave: "candidatura_id", etiqueta: "ID de candidatura", tipo: "number", placeholder: "42" },
    { clave: "dignidad", etiqueta: "Dignidad", tipo: "text", placeholder: "vocal_junta_parroquial" },
    { clave: "organizacion", etiqueta: "Organización política", tipo: "text", placeholder: "Partido Y" },
    { clave: "lista_numero", etiqueta: "Número de lista", tipo: "text", placeholder: "18" },
    { clave: "periodo", etiqueta: "Período", tipo: "text", placeholder: "2027-2031" },
    { clave: "jurisdiccion_dpa", etiqueta: "Jurisdicción DPA", tipo: "text", placeholder: "0207" },
  ],
  contexto: [{ clave: "jurisdiccion_dpa", etiqueta: "Jurisdicción DPA", tipo: "text", placeholder: "0207" }],
};

export async function render(container) {
  const api = await import("../admin-api.js");

  if (!api.obtenerToken()) {
    renderLogin(container, api);
    return;
  }

  renderPanel(container, api, "subir");
}

function renderLogin(container, api) {
  container.innerHTML = `
    <div class="admin-login">
      <h1>Panel de admin</h1>
      <div class="admin-field">
        <input type="password" class="admin-input" id="admin-password" placeholder="Contraseña" autocomplete="current-password" />
      </div>
      <button type="button" class="btn btn--primary btn--block" id="admin-login-btn">Entrar</button>
      <p class="field-hint" id="admin-login-error"></p>
    </div>
  `;

  const input = container.querySelector("#admin-password");
  const boton = container.querySelector("#admin-login-btn");
  const error = container.querySelector("#admin-login-error");

  async function intentar() {
    if (!input.value) return;
    boton.disabled = true;
    error.textContent = "";
    try {
      await api.login(input.value);
      renderPanel(container, api, "subir");
    } catch (err) {
      error.textContent = err.message;
    } finally {
      boton.disabled = false;
    }
  }

  boton.addEventListener("click", intentar);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") intentar();
  });
  input.focus();
}

const SECCIONES = [
  { clave: "subir", etiqueta: "Subir" },
  { clave: "documentos", etiqueta: "Documentos" },
];

function renderPanel(container, api, seccion) {
  container.innerHTML = `
    <div class="admin-nav">
      ${SECCIONES.map(
        (s) => `
          <button type="button" class="admin-nav__item${s.clave === seccion ? " admin-nav__item--activo" : ""}" data-seccion="${s.clave}">
            ${escapeHtml(s.etiqueta)}
          </button>
        `
      ).join("")}
      <button type="button" class="admin-nav__item admin-nav__item--salir" id="admin-salir">Salir</button>
    </div>
    <div id="admin-contenido"></div>
  `;

  container.querySelectorAll(".admin-nav__item[data-seccion]").forEach((boton) => {
    boton.addEventListener("click", () => renderPanel(container, api, boton.dataset.seccion));
  });

  container.querySelector("#admin-salir").addEventListener("click", () => {
    api.cerrarSesion();
    renderLogin(container, api);
  });

  const contenido = container.querySelector("#admin-contenido");
  if (seccion === "documentos") {
    renderDocumentos(contenido, api);
  } else {
    renderSubir(contenido, api);
  }
}

async function renderDocumentos(container, api) {
  container.innerHTML = `<div class="state-block"><div class="spinner"></div><p>Cargando…</p></div>`;

  let documentos;
  try {
    ({ documentos } = await api.listarDocumentos());
  } catch (err) {
    container.innerHTML = `<div class="admin-lista-errores">${escapeHtml(err.message)}</div>`;
    return;
  }

  if (!documentos.length) {
    container.innerHTML = `
      <div class="state-block">
        ${ICONS.empty}
        <h2>Todavía no hay documentos</h2>
        <p>Los que subas y confirmes van a aparecer acá.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="admin-tabla">
        <thead>
          <tr>
            <th>doc_id</th>
            <th>tipo</th>
            <th>chunks</th>
            <th>indexado</th>
            <th>estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${documentos
            .map(
              (d) => `
                <tr>
                  <td>${escapeHtml(d.doc_id)}</td>
                  <td>${escapeHtml(d.tipo)}</td>
                  <td>${d.n_chunks}</td>
                  <td>${d.indexado_en ? escapeHtml(formatearFecha(d.indexado_en)) : "—"}</td>
                  <td>${escapeHtml(d.estado)}</td>
                  <td><button type="button" class="admin-tabla__accion" data-reingestar="${escapeHtml(d.doc_id)}">Reingestar</button></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="field-hint" id="admin-documentos-estado"></p>
  `;

  const estadoEl = container.querySelector("#admin-documentos-estado");
  container.querySelectorAll("[data-reingestar]").forEach((boton) => {
    boton.addEventListener("click", async () => {
      const docId = boton.dataset.reingestar;
      boton.disabled = true;
      estadoEl.textContent = `Reingestando ${docId}…`;
      try {
        const r = await api.ingestarDocumento(docId);
        estadoEl.textContent = `${docId}: ${r.n_chunks} chunk(s) actualizados.`;
      } catch (err) {
        estadoEl.textContent = `${docId}: ${err.message}`;
      } finally {
        boton.disabled = false;
      }
    });
  });
}

function renderSubir(container, api) {
  container.innerHTML = `
    <p class="admin-paso">Paso 1 de 3 — Subir</p>
    <h1 style="font-size:18px; margin-bottom:16px;">Nuevo documento</h1>

    <div class="admin-field">
      <label for="admin-tipo">Tipo de documento</label>
      <select class="admin-select" id="admin-tipo">
        <option value="marco_legal">Marco legal (COOTAD, etc.)</option>
        <option value="plan_trabajo">Plan de trabajo</option>
        <option value="contexto">Contexto</option>
      </select>
    </div>

    <div class="admin-field">
      <label for="admin-pdf">Archivo PDF</label>
      <input type="file" class="admin-input" id="admin-pdf" accept="application/pdf" />
    </div>

    <button type="button" class="btn btn--primary btn--block" id="admin-convertir-btn">Convertir a Markdown</button>
    <p class="field-hint" id="admin-subir-error"></p>
    <div id="admin-subir-estado"></div>
  `;

  const selectTipo = container.querySelector("#admin-tipo");
  const inputPdf = container.querySelector("#admin-pdf");
  const boton = container.querySelector("#admin-convertir-btn");
  const error = container.querySelector("#admin-subir-error");
  const estadoEl = container.querySelector("#admin-subir-estado");

  boton.addEventListener("click", async () => {
    const archivo = inputPdf.files[0];
    if (!archivo) {
      error.textContent = "Elegí un PDF primero.";
      return;
    }
    error.textContent = "";
    boton.disabled = true;
    estadoEl.innerHTML = `<div class="state-block"><div class="spinner"></div><p>Convirtiendo con Docling — puede tardar según el tamaño del PDF…</p></div>`;

    try {
      const resultado = await api.convertir(selectTipo.value, archivo);
      renderRevisar(container, api, resultado);
    } catch (err) {
      estadoEl.innerHTML = "";
      error.textContent = err.message;
      boton.disabled = false;
    }
  });
}

function renderRevisar(container, api, datosIniciales) {
  const estado = {
    borradorId: datosIniciales.borrador_id,
    tipo: datosIniciales.tipo,
    markdown: datosIniciales.markdown,
    meta: { tipo: datosIniciales.tipo, vigente: true },
  };

  const camposEspecificos = CAMPOS_POR_TIPO[estado.tipo] || [];

  container.innerHTML = `
    <p class="admin-paso">Paso 2 de 3 — Revisar</p>
    <h1 style="font-size:18px; margin-bottom:16px;">Revisá el Markdown y completá los datos</h1>

    <div id="admin-validacion"></div>

    <div class="admin-field">
      <label for="admin-doc-id">doc_id</label>
      <input type="text" class="admin-input" id="admin-doc-id" placeholder="plan-bolivar-simiatug-junta-18-2027" />
    </div>

    <div class="admin-grid">
      ${camposEspecificos
        .map(
          (c) => `
            <div class="admin-field">
              <label for="admin-campo-${c.clave}">${escapeHtml(c.etiqueta)}</label>
              <input type="${c.tipo}" class="admin-input" id="admin-campo-${c.clave}" data-campo="${c.clave}" placeholder="${escapeHtml(c.placeholder)}" />
            </div>
          `
        )
        .join("")}
    </div>

    <div class="admin-field">
      <label for="admin-fuente-url">URL de la fuente</label>
      <input type="url" class="admin-input" id="admin-fuente-url" placeholder="https://…" />
    </div>

    <div class="admin-field">
      <label for="admin-revisado-por">Revisado por</label>
      <input type="text" class="admin-input" id="admin-revisado-por" placeholder="tu.nombre" />
    </div>

    <div class="admin-field admin-checkbox">
      <input type="checkbox" id="admin-vigente" checked />
      <label for="admin-vigente" style="margin:0;">Vigente</label>
    </div>

    <div class="admin-field">
      <label for="admin-markdown">Markdown (editable)</label>
      <textarea class="admin-textarea admin-textarea--markdown" id="admin-markdown"></textarea>
    </div>

    <div style="display:flex; gap:8px;">
      <button type="button" class="btn btn--ghost" id="admin-validar-btn" style="flex:1;">Validar</button>
      <button type="button" class="btn btn--primary" id="admin-confirmar-btn" style="flex:1;">Confirmar y commitear</button>
    </div>
    <button type="button" class="btn btn--ghost btn--block" id="admin-cancelar-btn" style="margin-top:8px;">Cancelar</button>
  `;

  container.querySelector("#admin-markdown").value = estado.markdown;

  function leerFormulario() {
    const meta = { tipo: estado.tipo, vigente: container.querySelector("#admin-vigente").checked };
    const docId = container.querySelector("#admin-doc-id").value.trim();
    if (docId) meta.doc_id = docId;
    const fuenteUrl = container.querySelector("#admin-fuente-url").value.trim();
    if (fuenteUrl) meta.fuente_url = fuenteUrl;
    const revisadoPor = container.querySelector("#admin-revisado-por").value.trim();
    if (revisadoPor) meta.revisado_por = revisadoPor;

    container.querySelectorAll("[data-campo]").forEach((input) => {
      const valor = input.value.trim();
      if (!valor) return;
      meta[input.dataset.campo] = input.type === "number" ? Number(valor) : valor;
    });

    return { markdown: container.querySelector("#admin-markdown").value, meta };
  }

  function mostrarValidacion(resultado) {
    const el = container.querySelector("#admin-validacion");
    const partes = [];
    if (resultado.errores?.length) {
      partes.push(
        `<div class="admin-lista-errores"><strong>Hay que corregir esto:</strong><ul>${resultado.errores
          .map((e) => `<li>${escapeHtml(e)}</li>`)
          .join("")}</ul></div>`
      );
    }
    if (resultado.warnings?.length) {
      partes.push(
        `<div class="admin-lista-warnings"><strong>Revisar (no bloquea):</strong><ul>${resultado.warnings
          .map((w) => `<li>${escapeHtml(w)}</li>`)
          .join("")}</ul></div>`
      );
    }
    el.innerHTML = partes.join("");
  }

  container.querySelector("#admin-validar-btn").addEventListener("click", async () => {
    const { markdown, meta } = leerFormulario();
    const botonValidar = container.querySelector("#admin-validar-btn");
    botonValidar.disabled = true;
    try {
      await api.actualizarBorrador(estado.borradorId, markdown, meta);
      const resultado = await api.validarBorrador(estado.borradorId);
      mostrarValidacion(resultado);
    } catch (err) {
      mostrarValidacion({ errores: [err.message], warnings: [] });
    } finally {
      botonValidar.disabled = false;
    }
  });

  container.querySelector("#admin-confirmar-btn").addEventListener("click", async () => {
    const { markdown, meta } = leerFormulario();
    const botonConfirmar = container.querySelector("#admin-confirmar-btn");
    botonConfirmar.disabled = true;
    try {
      await api.actualizarBorrador(estado.borradorId, markdown, meta);
      const resultado = await api.confirmarBorrador(estado.borradorId);
      renderListo(container, api, resultado);
    } catch (err) {
      if (err.detalle?.errores) {
        mostrarValidacion(err.detalle);
      } else {
        mostrarValidacion({ errores: [err.message], warnings: [] });
      }
      botonConfirmar.disabled = false;
    }
  });

  container.querySelector("#admin-cancelar-btn").addEventListener("click", async () => {
    try {
      await api.descartarBorrador(estado.borradorId);
    } catch {
      /* si ya no existe del lado del servidor, no importa */
    }
    renderSubir(container, api);
  });
}

function renderListo(container, api, resultado) {
  container.innerHTML = `
    <p class="admin-paso">Paso 3 de 3 — Ingestar</p>
    <h1 style="font-size:18px; margin-bottom:16px;">Commiteado a lodicho-corpus</h1>

    <div class="admin-resultado">
      doc_id: ${escapeHtml(resultado.doc_id)}<br />
      git_sha: ${escapeHtml(resultado.git_sha)}<br />
      ruta: ${escapeHtml(resultado.ruta_md)}
    </div>

    <button type="button" class="btn btn--primary btn--block" id="admin-ingestar-btn">Ingestar a Qdrant</button>
    <div id="admin-ingesta-estado"></div>

    <button type="button" class="btn btn--ghost btn--block" id="admin-otro-btn" style="margin-top:16px;">Cargar otro documento</button>
  `;

  const estadoEl = container.querySelector("#admin-ingesta-estado");

  container.querySelector("#admin-ingestar-btn").addEventListener("click", async (evento) => {
    evento.target.disabled = true;
    estadoEl.innerHTML = `<div class="state-block"><div class="spinner"></div><p>Generando embeddings y subiendo a Qdrant…</p></div>`;
    try {
      const r = await api.ingestarDocumento(resultado.doc_id);
      estadoEl.innerHTML = `<div class="admin-resultado">Listo: ${r.n_chunks} chunk(s) indexados en "${escapeHtml(r.tipo)}".</div>`;
    } catch (err) {
      estadoEl.innerHTML = `<div class="admin-lista-errores">${escapeHtml(err.message)}</div>`;
      evento.target.disabled = false;
    }
  });

  container.querySelector("#admin-otro-btn").addEventListener("click", () => renderSubir(container, api));
}
