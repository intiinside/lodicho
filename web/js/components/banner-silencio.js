import { ICONS } from "../icons.js";

const MENSAJE_SILENCIO =
  "Silencio electoral activo: solo se muestran informes ya publicados. La generación de nuevos análisis está desactivada.";

export function bannerSilencioHtml(activo) {
  if (!activo) return "";
  return `
    <div class="banner banner--warning" data-visible="true">
      ${ICONS.alert} ${MENSAJE_SILENCIO}
    </div>
  `;
}

export function bannerHtml(tipo, mensaje) {
  if (!mensaje) return "";
  return `<div class="banner banner--${tipo}" data-visible="true">${mensaje}</div>`;
}
