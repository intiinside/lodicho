import { ICONS } from "../icons.js";
import { escapeHtml, formatearFecha } from "../util.js";

const CAMPOS_POR_TIPO = {
  marco_legal: [
    { clave: "nivel_gobierno", etiqueta: "Nivel de gobierno", tipo: "text", placeholder: "parroquial_rural" },
    { clave: "jurisdiccion_dpa", etiqueta: "Jurisdicción DPA (opcional)", tipo: "text", placeholder: "0207" },
  ],
  plan_trabajo: [
    { clave: "dignidad", etiqueta: "Dignidad", tipo: "text", placeholder: "vocal_junta_parroquial" },
    { clave: "organizacion", etiqueta: "Organización política", tipo: "text", placeholder: "Partido Y" },
    { clave: "lista_numero", etiqueta: "Número de lista", tipo: "text", placeholder: "18" },
    { clave: "periodo", etiqueta: "Período", tipo: "text", placeholder: "2027-2031" },
    { clave: "jurisdiccion_dpa", etiqueta: "Jurisdicción DPA", tipo: "text", placeholder: "0207" },
  ],
  contexto: [{ clave: "jurisdiccion_dpa", etiqueta: "Jurisdicción DPA", tipo: "text", placeholder: "0207" }],
};

const SECCIONES = [
  { clave: "subir", etiqueta: "Subir PDF" },
  { clave: "documentos", etiqueta: "Documentos" },
  { clave: "candidaturas", etiqueta: "Candidaturas" },
];

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
    <div class="dash-hero">
      <h1 class="dash-hero__title">Gestión de Corpus</h1>
      <p class="dash-hero__subtitle">Acceso restringido al equipo editorial.</p>
    </div>
    <div class="console-card" style="max-width: 400px;">
      <div style="margin-bottom: 24px;">
        <input type="password" class="console-input" id="admin-password" placeholder="Contraseña de acceso" autocomplete="current-password" />
      </div>
      <button type="button" class="btn btn--primary" id="admin-login-btn">Ingresar al Dashboard</button>
      <p class="field-hint" id="admin-login-error" style="color: var(--veredicto-falso-text);"></p>
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
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") intentar(); });
  input.focus();
}

function renderPanel(container, api, seccion) {
  container.innerHTML = `
    <div class="dash-hero">
      <h1 class="dash-hero__title">Gestión de Documentos</h1>
      <p class="dash-hero__subtitle">Administra los planes de trabajo, leyes y contexto.</p>
    </div>
    
    <div class="console-tabs" role="tablist">
      ${SECCIONES.map(s => `
        <button type="button" class="console-tab" aria-selected="${s.clave === seccion ? "true" : "false"}" data-seccion="${s.clave}">
          ${escapeHtml(s.etiqueta)}
        </button>
      `).join("")}
      <button type="button" class="console-tab" id="admin-salir" style="color: var(--veredicto-falso-text);">Salir</button>
    </div>
    
    <div id="admin-contenido" style="margin-top: 24px;"></div>
  `;

  container.querySelectorAll(".console-tab[data-seccion]").forEach((boton) => {
    boton.addEventListener("click", () => renderPanel(container, api, boton.dataset.seccion));
  });

  container.querySelector("#admin-salir").addEventListener("click", () => {
    api.cerrarSesion();
    renderLogin(container, api);
  });

  const contenido = container.querySelector("#admin-contenido");
  if (seccion === "documentos") renderDocumentos(contenido, api);
  else if (seccion === "candidaturas") renderCandidaturas(contenido, api);
  else renderSubir(contenido, api);
}

async function renderDocumentos(container, api) {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando…</p></div>`;
  let documentos;
  try { ({ documentos } = await api.listarDocumentos()); } 
  catch (err) { container.innerHTML = `<div class="admin-lista-errores">${escapeHtml(err.message)}</div>`; return; }

  if (!documentos.length) {
    container.innerHTML = `
      <div class="loading-state">
        ${ICONS.empty}
        <h2>Todavía no hay documentos</h2>
        <p>Los que subas y confirmes van a aparecer acá.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="console-card" style="padding: 0; overflow-x: auto;">
      <table class="admin-tabla" style="margin: 0;">
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
          ${documentos.map(d => `
            <tr>
              <td>${escapeHtml(d.doc_id)}</td>
              <td>${escapeHtml(d.tipo)}</td>
              <td>${d.n_chunks}</td>
              <td>${d.indexado_en ? escapeHtml(formatearFecha(d.indexado_en)) : "—"}</td>
              <td>${escapeHtml(d.estado)}</td>
              <td><button type="button" class="admin-tabla__accion" data-reingestar="${escapeHtml(d.doc_id)}">Reingestar</button></td>
            </tr>
          `).join("")}
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
      } catch (err) { estadoEl.textContent = `${docId}: ${err.message}`; } 
      finally { boton.disabled = false; }
    });
  });
}

async function renderCandidaturas(container, api) {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando…</p></div>`;
  let candidaturas;
  try { candidaturas = await api.listarCandidaturas(); } 
  catch (err) { container.innerHTML = `<div class="admin-lista-errores">${escapeHtml(err.message)}</div>`; return; }

  container.innerHTML = `
    ${candidaturas.length ? `
      <div class="console-card" style="padding: 0; overflow-x: auto;">
        <table class="admin-tabla" style="margin: 0;">
          <thead>
            <tr>
              <th>org</th>
              <th>lista</th>
              <th>dignidad</th>
              <th>jurisdicción</th>
              <th>período</th>
              <th>plan</th>
            </tr>
          </thead>
          <tbody>
            ${candidaturas.map(c => `
              <tr>
                <td>${escapeHtml(c.organizacion_politica)}</td>
                <td>${escapeHtml(c.lista_numero)}</td>
                <td>${escapeHtml(c.dignidad)}</td>
                <td>${escapeHtml(c.jurisdiccion_dpa)}</td>
                <td>${escapeHtml(c.periodo)}</td>
                <td>${escapeHtml(c.estado_plan)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    ` : `<div class="loading-state">${ICONS.empty}<p>Todavía no hay candidaturas registradas.</p></div>`}

    <div class="console-card" style="margin-top: 24px;">
      <h2 style="font-size:16px; margin-bottom:16px;">Nueva candidatura</h2>
      <div id="admin-candidatura-error"></div>
      
      <div class="admin-grid">
        <div class="admin-field">
          <label for="cand-organizacion">Organización política</label>
          <input type="text" class="console-input" id="cand-organizacion" placeholder="Partido Y" />
        </div>
        <div class="admin-field">
          <label for="cand-lista">Número de lista</label>
          <input type="text" class="console-input" id="cand-lista" placeholder="18" />
        </div>
        <div class="admin-field">
          <label for="cand-dignidad">Dignidad</label>
          <input type="text" class="console-input" id="cand-dignidad" placeholder="vocal_junta_parroquial" />
        </div>
        <div class="admin-field">
          <label for="cand-jurisdiccion">Jurisdicción DPA</label>
          <input type="text" class="console-input" id="cand-jurisdiccion" placeholder="0207" />
        </div>
        <div class="admin-field">
          <label for="cand-periodo">Período</label>
          <input type="text" class="console-input" id="cand-periodo" placeholder="2027-2031" />
        </div>
        <div class="admin-field">
          <label for="cand-estado-plan">Estado del plan</label>
          <select class="console-input" id="cand-estado-plan">
            <option value="registrado">Registrado ante el CNE</option>
            <option value="sin_plan_registrado">No registró plan</option>
          </select>
        </div>
      </div>
      <button type="button" class="btn btn--primary btn--block" id="cand-guardar-btn">Guardar candidatura</button>
    </div>
  `;

  const errorEl = container.querySelector("#admin-candidatura-error");
  container.querySelector("#cand-guardar-btn").addEventListener("click", async (evento) => {
    const datos = {
      organizacion_politica: container.querySelector("#cand-organizacion").value.trim(),
      lista_numero: container.querySelector("#cand-lista").value.trim(),
      dignidad: container.querySelector("#cand-dignidad").value.trim(),
      jurisdiccion_dpa: container.querySelector("#cand-jurisdiccion").value.trim(),
      periodo: container.querySelector("#cand-periodo").value.trim(),
      estado_plan: container.querySelector("#cand-estado-plan").value,
    };

    if (Object.values(datos).some((v) => !v)) {
      errorEl.innerHTML = `<div class="admin-lista-errores">Completá todos los campos.</div>`;
      return;
    }

    errorEl.innerHTML = "";
    evento.target.disabled = true;
    try {
      await api.crearCandidatura(datos);
      renderCandidaturas(container, api);
    } catch (err) {
      errorEl.innerHTML = `<div class="admin-lista-errores">${escapeHtml(err.message)}</div>`;
      evento.target.disabled = false;
    }
  });
}

function renderSubir(container, api) {
  container.innerHTML = `
    <div class="console-card">
      <p class="admin-paso">Paso 1 de 3 — Subir</p>
      
      <div class="form-group-card" style="margin-bottom: 24px;">
        <div class="form-row">
          <label for="admin-tipo">Tipo de documento</label>
          <select class="console-input" id="admin-tipo" style="padding: 0; height: auto;">
            <option value="marco_legal">Marco legal (COOTAD, etc.)</option>
            <option value="plan_trabajo">Plan de trabajo</option>
            <option value="contexto">Contexto</option>
          </select>
        </div>
      </div>

      <div class="dropzone" id="admin-dropzone" style="margin-bottom: 24px;">
        <div class="dropzone__icon">${ICONS.attach}</div>
        <div class="dropzone__title">Seleccionar PDF</div>
        <div class="dropzone__subtitle" id="admin-dropzone-subtitle">Ningún archivo seleccionado</div>
        <input type="file" id="admin-pdf" accept="application/pdf" hidden />
      </div>

      <button type="button" class="btn btn--primary btn--block" id="admin-convertir-btn">Extraer y Convertir a Markdown</button>
      <p class="field-hint" id="admin-subir-error"></p>
      <div id="admin-subir-estado"></div>
    </div>
  `;

  const selectTipo = container.querySelector("#admin-tipo");
  const inputPdf = container.querySelector("#admin-pdf");
  const dropzone = container.querySelector("#admin-dropzone");
  const dropzoneSubtitle = container.querySelector("#admin-dropzone-subtitle");
  const boton = container.querySelector("#admin-convertir-btn");
  const error = container.querySelector("#admin-subir-error");
  const estadoEl = container.querySelector("#admin-subir-estado");

  dropzone.addEventListener("click", () => inputPdf.click());
  inputPdf.addEventListener("change", () => {
    if(inputPdf.files[0]) dropzoneSubtitle.textContent = inputPdf.files[0].name;
  });

  boton.addEventListener("click", async () => {
    const archivo = inputPdf.files[0];
    if (!archivo) { error.textContent = "Elegí un PDF primero."; return; }
    error.textContent = ""; boton.disabled = true;
    estadoEl.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Convirtiendo con Docling…</p></div>`;

    try {
      const resultado = await api.convertir(selectTipo.value, archivo);
      await renderRevisar(container, api, resultado);
    } catch (err) {
      estadoEl.innerHTML = ""; error.textContent = err.message; boton.disabled = false;
    }
  });
}

async function renderRevisar(container, api, datosIniciales) {
  const estado = {
    borradorId: datosIniciales.borrador_id, tipo: datosIniciales.tipo,
    markdown: datosIniciales.markdown, meta: { tipo: datosIniciales.tipo, vigente: true },
  };

  const camposEspecificos = CAMPOS_POR_TIPO[estado.tipo] || [];
  let candidaturas = [];
  if (estado.tipo === "plan_trabajo") { try { candidaturas = await api.listarCandidaturas(); } catch {} }

  container.innerHTML = `
    <div class="console-card">
      <p class="admin-paso">Paso 2 de 3 — Revisar</p>
      <div id="admin-validacion"></div>

      <div class="admin-field">
        <label for="admin-doc-id">doc_id</label>
        <input type="text" class="console-input" id="admin-doc-id" placeholder="plan-bolivar..." />
      </div>

      ${estado.tipo === "plan_trabajo" ? `
        <div class="admin-field">
          <label for="admin-campo-candidatura_id">Candidatura</label>
          <select class="console-input" id="admin-campo-candidatura_id" data-campo="candidatura_id">
            <option value="">— elegir —</option>
            ${candidaturas.map(c => `<option value="${c.id}">${escapeHtml(`${c.organizacion_politica} · lista ${c.lista_numero} · ${c.dignidad}`)}</option>`).join("")}
          </select>
        </div>` : ""
      }

      <div class="admin-grid">
        ${camposEspecificos.map(c => `
          <div class="admin-field">
            <label for="admin-campo-${c.clave}">${escapeHtml(c.etiqueta)}</label>
            <input type="${c.tipo}" class="console-input" id="admin-campo-${c.clave}" data-campo="${c.clave}" placeholder="${escapeHtml(c.placeholder)}" />
          </div>`).join("")}
      </div>

      <div class="admin-field">
        <label for="admin-fuente-url">URL de la fuente</label>
        <input type="url" class="console-input" id="admin-fuente-url" placeholder="https://…" />
      </div>

      <div class="admin-field">
        <label for="admin-revisado-por">Revisado por</label>
        <input type="text" class="console-input" id="admin-revisado-por" placeholder="tu.nombre" />
      </div>

      <div class="admin-field admin-checkbox">
        <input type="checkbox" id="admin-vigente" checked />
        <label for="admin-vigente" style="margin:0;">Vigente</label>
      </div>

      <div class="admin-field">
        <label for="admin-markdown">Markdown (editable)</label>
        <textarea class="console-textarea admin-textarea--markdown" id="admin-markdown"></textarea>
      </div>

      <div style="display:flex; gap:8px;">
        <button type="button" class="btn btn--ghost" id="admin-validar-btn" style="flex:1;">Validar</button>
        <button type="button" class="btn btn--primary" id="admin-confirmar-btn" style="flex:1;">Confirmar y commitear</button>
      </div>
      <button type="button" class="btn btn--ghost btn--block" id="admin-cancelar-btn" style="margin-top:8px;">Cancelar</button>
    </div>
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
      const esNumerico = input.type === "number" || input.tagName === "SELECT";
      meta[input.dataset.campo] = esNumerico ? Number(valor) : valor;
    });

    return { markdown: container.querySelector("#admin-markdown").value, meta };
  }

  function mostrarValidacion(resultado) {
    const el = container.querySelector("#admin-validacion");
    const partes = [];
    if (resultado.errores?.length) {
      partes.push(`<div class="admin-lista-errores"><strong>Hay que corregir esto:</strong><ul>${resultado.errores.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>`);
    }
    if (resultado.warnings?.length) {
      partes.push(`<div class="admin-lista-warnings"><strong>Revisar (no bloquea):</strong><ul>${resultado.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>`);
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
    } catch (err) { mostrarValidacion({ errores: [err.message], warnings: [] }); } 
    finally { botonValidar.disabled = false; }
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
      if (err.detalle?.errores) mostrarValidacion(err.detalle);
      else mostrarValidacion({ errores: [err.message], warnings: [] });
      botonConfirmar.disabled = false;
    }
  });

  container.querySelector("#admin-cancelar-btn").addEventListener("click", async () => {
    try { await api.descartarBorrador(estado.borradorId); } catch {}
    renderSubir(container, api);
  });
}

function renderListo(container, api, resultado) {
  container.innerHTML = `
    <div class="console-card">
      <p class="admin-paso">Paso 3 de 3 — Ingestar</p>
      <h1 style="font-size:18px; margin-bottom:16px;">Commiteado al repositorio</h1>

      <div class="admin-resultado">
        doc_id: ${escapeHtml(resultado.doc_id)}<br />
        git_sha: ${escapeHtml(resultado.git_sha)}<br />
        ruta: ${escapeHtml(resultado.ruta_md)}
      </div>

      <button type="button" class="btn btn--primary btn--block" id="admin-ingestar-btn">Ingestar a Qdrant</button>
      <div id="admin-ingesta-estado"></div>

      <button type="button" class="btn btn--ghost btn--block" id="admin-otro-btn" style="margin-top:16px;">Cargar otro documento</button>
    </div>
  `;

  const estadoEl = container.querySelector("#admin-ingesta-estado");

  container.querySelector("#admin-ingestar-btn").addEventListener("click", async (evento) => {
    evento.target.disabled = true;
    estadoEl.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Generando embeddings e indexando…</p></div>`;
    try {
      const r = await api.ingestarDocumento(resultado.doc_id);
      estadoEl.innerHTML = `<div class="admin-resultado" style="margin-top: 16px;">Listo: ${r.n_chunks} chunk(s) indexados.</div>`;
    } catch (err) {
      estadoEl.innerHTML = `<div class="admin-lista-errores" style="margin-top: 16px;">${escapeHtml(err.message)}</div>`;
      evento.target.disabled = false;
    }
  });

  container.querySelector("#admin-otro-btn").addEventListener("click", () => renderSubir(container, api));
}