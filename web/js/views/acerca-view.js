import { VEREDICTO_LABELS } from "../components/veredicto-badge.js";

const VEREDICTOS_DESC = {
  viable_y_en_plan: "Consta explícitamente en el plan registrado ante el CNE y corresponde a las competencias legales del nivel de gobierno.",
  fuera_de_competencia: "El nivel de gobierno no tiene competencia legal (COOTAD) para ejecutar la obra o política prometida.",
  no_consta_en_plan: "El plan de trabajo fue recuperado pero la propuesta no se encuentra en el documento oficial.",
  informacion_enganosa: "Utiliza cifras reales descontextualizadas para inducir a una conclusión errónea.",
  informacion_falsa: "La afirmación contradice de forma directa los indicadores oficiales disponibles (INEC, BCE).",
  incomprobable: "No existe un indicador oficial verificado disponible para contrastar la afirmación.",
};

const FACTORES = [
  { nombre: "Competencia legal (COOTAD)", peso: "35" },
  { nombre: "Consta en plan de trabajo", peso: "20" },
  { nombre: "Financiamiento identificado", peso: "20" },
  { nombre: "Plazo vs. período de gestión", peso: "15" },
  { nombre: "Precedente presupuestario", peso: "10" },
];

export async function render(container) {
  container.innerHTML = `
    <div class="dash-hero">
      <h1 class="dash-hero__title">Metodología y Reglas</h1>
      <p class="dash-hero__subtitle">Criterios editoriales, trazabilidad de datos y pesos de factibilidad.</p>
    </div>

    <div class="console-card">
      <h2 style="font-size:17px; font-weight:700; margin-bottom:10px;">Principios de Contrastación</h2>
      <p style="font-size:14.5px; color:var(--color-text-muted); line-height:1.55; margin-bottom:12px;">
        <strong>Lo Dicho</strong> no emite recomendaciones de voto ni juicios de valor personal. Su único propósito es contrastar afirmaciones de candidatos contra los planes de trabajo inscritos ante el CNE y las competencias legales del COOTAD.
      </p>
      <p style="font-size:14.5px; color:var(--color-text-muted); line-height:1.55;">
        Sin un indicador estadístico oficial verificado, la afirmación se clasifica como <em>incomprobable</em>. Ningún veredicto definitivo se publica sin revisión humana.
      </p>
    </div>

    <div class="console-card">
      <h2 style="font-size:17px; font-weight:700; margin-bottom:16px;">Veredictos Categóricos</h2>
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${Object.entries(VEREDICTOS_DESC).map(([clave, desc]) => `
          <div style="padding:14px; background:var(--color-surface-muted); border-radius:var(--radius-md);">
            <div style="margin-bottom:6px;">
              <span class="veredicto-badge veredicto-badge--${clave}">${VEREDICTO_LABELS[clave]}</span>
            </div>
            <p style="font-size:13.5px; color:var(--color-text-muted); line-height:1.45;">${desc}</p>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="console-card">
      <h2 style="font-size:17px; font-weight:700; margin-bottom:16px;">Rúbrica de Factibilidad</h2>
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${FACTORES.map(f => `
          <div>
            <div style="display:flex; justify-content:space-between; font-size:13.5px; margin-bottom:5px;">
              <span style="font-weight:600;">${f.nombre}</span>
              <span style="color:var(--color-brand); font-weight:700;">${f.peso}%</span>
            </div>
            <div class="factor-track">
              <div class="factor-fill" style="width: ${f.peso}%; background: var(--color-brand);"></div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}