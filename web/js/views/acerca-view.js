export async function render(container) {
  container.innerHTML = `
    <div class="dash-hero">
      <h1 class="dash-hero__title">Acerca de Lo Dicho</h1>
      <p class="dash-hero__subtitle">Piloto en la provincia de Bolívar.</p>
    </div>
    
    <div class="console-card">
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Lo que no hacemos</h2>
      <ul class="acerca-bullets">
        <li>No recomendamos voto ni comparamos la calidad de los candidatos.</li>
        <li>No inventamos cifras: sin un indicador oficial disponible, el veredicto es <em>incomprobable</em>.</li>
        <li>Ningún veredicto categórico se publica sin revisión humana.</li>
      </ul>
    </div>

    <div class="console-card">
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Veredictos Posibles</h2>
      <div class="verdict-explain-grid">
        ${Object.entries(VEREDICTOS_DESC).map(([clave, desc]) => `
          <div class="verdict-explain-card">
            <span class="veredicto-badge veredicto-badge--${clave}" style="align-self: flex-start;">${LABELS[clave]}</span>
            <p class="verdict-explain-desc">${desc}</p>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="console-card">
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Rúbrica de factibilidad</h2>
      <p class="field-hint" style="text-align: left; margin-bottom: 16px;">El modelo llena factores discretos y un cálculo con pesos fijos produce el número.</p>
      <div>
        ${FACTORES.map(f => `
          <div class="factibilidad__factor">
            <span class="factibilidad__factor-nombre">${f.nombre}</span>
            <span class="factibilidad__factor-valor">${f.peso}</span>
          </div>
        `).join("")}
      </div>
    </div>
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
  viable_y_en_plan: "Consta en el plan de trabajo y es competencia de ese nivel de gobierno.",
  fuera_de_competencia: "El nivel de gobierno no tiene la competencia.",
  no_consta_en_plan: "El plan se recuperó correctamente pero no aparece.",
  informacion_enganosa: "Cifra real descontextualizada.",
  informacion_falsa: "Contradice el dato oficial disponible.",
  incomprobable: "Sin indicador oficial para verificar la cifra.",
};

const FACTORES = [
  { nombre: "Competencia legal", peso: "35%" },
  { nombre: "Consta en el plan", peso: "20%" },
  { nombre: "Financiamiento identificado", peso: "20%" },
  { nombre: "Plazo vs. período de gestión", peso: "15%" },
  { nombre: "Precedente presupuestario", peso: "10%" },
];