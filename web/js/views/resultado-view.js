import { buscarEnHistorial } from "../state.js";
import { crearInformeCard } from "../components/informe-card.js";
import { ICONS } from "../icons.js";

export async function render(container, params) {
  const informe = params?.id ? buscarEnHistorial(params.id) : null;

  if (!informe) {
    container.innerHTML = `
      <div class="state-block">
        ${ICONS.empty}
        <h2>No encontrado</h2>
        <p>Esta consulta no está guardada en este dispositivo.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  container.appendChild(crearInformeCard(informe));
}
