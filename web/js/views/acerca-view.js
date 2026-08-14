// Contenido estatico. La rubrica y las definiciones de veredicto se
// publican en el sitio a proposito (CLAUDE.md, Rubrica de factibilidad):
// el desglose es lo auditable, no un numero suelto.
export async function render(container) {
  container.innerHTML = `
    <section class="acerca">
      <h1 style="font-size:20px; margin-bottom:8px;">Acerca de Lo Dicho</h1>
      <p class="field-hint" style="margin-bottom:20px;">
        Piloto en la provincia de Bolívar (Guaranda, Simiátug). Contrasta
        declaraciones de candidatos contra su plan de trabajo registrado y
        el COOTAD.
      </p>

      <h2 style="font-size:15px; margin-bottom:8px;">Lo que no hacemos</h2>
      <div class="informe-card" style="padding:16px; margin-bottom:20px;">
        <p style="margin-bottom:8px;">No recomendamos voto ni comparamos la calidad de los candidatos.</p>
        <p style="margin-bottom:8px;">No inventamos cifras: sin un indicador oficial disponible, el veredicto es
          <em>incomprobable</em>, nunca un número inferido.</p>
        <p>Ningún veredicto categórico se publica sin que un periodista lo revise y firme.</p>
      </div>

      <h2 style="font-size:15px; margin-bottom:8px;">Los seis veredictos posibles</h2>
      <dl class="acerca-lista" style="margin-bottom:20px;">
        ${Object.entries(VEREDICTOS_DESC)
          .map(
            ([clave, desc]) => `
              <div class="informe-card" style="padding:12px 16px; margin-bottom:8px;">
                <p><span class="veredicto-badge veredicto-badge--${clave}" style="margin-bottom:6px; display:inline-flex;">${LABELS[clave]}</span></p>
                <p class="field-hint" style="margin-top:6px;">${desc}</p>
              </div>
            `
          )
          .join("")}
      </dl>

      <h2 style="font-size:15px; margin-bottom:8px;">Rúbrica de factibilidad</h2>
      <p class="field-hint" style="margin-bottom:8px;">
        El puntaje nunca lo genera el modelo de lenguaje: el modelo llena
        factores discretos y un cálculo con pesos fijos produce el número.
        No existe "veracidad en porcentaje" — la veracidad es categórica.
      </p>
      <div class="informe-card" style="padding:4px 16px; margin-bottom:20px;">
        ${FACTORES.map(
          (f) => `
            <div class="factibilidad__factor">
              <span class="factibilidad__factor-nombre">${f.nombre}</span>
              <span class="factibilidad__factor-valor">${f.peso}</span>
            </div>
          `
        ).join("")}
      </div>

      <h2 style="font-size:15px; margin-bottom:8px;">Trazabilidad</h2>
      <p class="field-hint" style="margin-bottom:20px;">
        Cada afirmación del informe enlaza a un fragmento concreto —
        colección, <code>doc_id</code> y el <code>git_sha</code> exacto de
        la versión del documento fuente— disponible desde "Ver evidencia".
      </p>

      <h2 style="font-size:15px; margin-bottom:8px;">Derecho a réplica y silencio electoral</h2>
      <p class="field-hint" style="margin-bottom:8px;">
        Cada candidatura tiene derecho de respuesta sobre cualquier informe
        publicado. Durante el silencio electoral solo se muestran informes
        ya publicados; no se genera contenido nuevo.
      </p>
    </section>
  `;
}

const LABELS = {
  viable_y_en_plan: "Viable y en el plan",
  fuera_de_competencia: "Fuera de competencia",
  no_consta_en_plan: "No consta en el plan",
  informacion_enganosa: "Información engañosa",
  informacion_falsa: "Información falsa",
  incomprobable: "Incomprobable",
};

const VEREDICTOS_DESC = {
  viable_y_en_plan: "La propuesta consta en el plan de trabajo registrado y es competencia de ese nivel de gobierno.",
  fuera_de_competencia:
    "El nivel de gobierno del candidato no tiene esa competencia. Excepción importante: gestionar una obra ante otro nivel sí es legítimo, no se marca como extralimitación.",
  no_consta_en_plan: "El plan de trabajo se recuperó correctamente, pero la propuesta no aparece en él.",
  informacion_enganosa: "Usa una cifra real pero descontextualizada, de forma que induce a una conclusión distinta de la que soportan los datos.",
  informacion_falsa: "La afirmación contradice el dato oficial disponible.",
  incomprobable: "No hay un indicador oficial disponible para verificar la cifra. Nunca se reemplaza por una cifra inferida.",
};

const FACTORES = [
  { nombre: "Competencia legal", peso: "35%" },
  { nombre: "Consta en el plan", peso: "20%" },
  { nombre: "Financiamiento identificado", peso: "20%" },
  { nombre: "Plazo vs. período de gestión", peso: "15%" },
  { nombre: "Precedente presupuestario", peso: "10%" },
];
