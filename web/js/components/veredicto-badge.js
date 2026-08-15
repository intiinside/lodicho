export const VEREDICTO_LABELS = {
  viable_y_en_plan: "Viable y en el plan",
  fuera_de_competencia: "Fuera de competencia",
  no_consta_en_plan: "No consta en el plan",
  informacion_enganosa: "Información engañosa",
  informacion_falsa: "Información falsa",
  incomprobable: "Incomprobable",
};

export function veredictoBadgeHtml(veredicto) {
  const etiqueta = VEREDICTO_LABELS[veredicto];
  if (!etiqueta) {
    return `<span class="veredicto-badge veredicto-badge--pendiente">En revisión</span>`;
  }
  return `<span class="veredicto-badge veredicto-badge--${veredicto}">${etiqueta}</span>`;
}