import { buscarEnHistorial } from "../state.js";
import { crearInformeCard } from "../components/informe-card.js";
import { ICONS } from "../icons.js";

export async function render(container, params) {
  const informe = params?.id ? buscarEnHistorial(params.id) : null;

  if (!informe) {
    container.innerHTML = `
      <div class="loading-state">
        ${ICONS.empty}
        <h2 style="font-size:16px;">Informe no encontrado</h2>
        <p>Esta consulta no existe en el almacenamiento local.</p>
        <a href="#/" class="btn btn--primary" style="margin-top:12px; max-width:200px;">Volver al inicio</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="dash-hero">
      <h1 class="dash-hero__title">Detalle del Análisis</h1>
      <p class="dash-hero__subtitle">Registro de verificación auditado.</p>
    </div>
    <div id="resultado-slot"></div>
  `;

  container.querySelector("#resultado-slot").appendChild(crearInformeCard(informe));
}