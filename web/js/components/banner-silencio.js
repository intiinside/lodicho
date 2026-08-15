import { ICONS } from "../icons.js";

const MENSAJE_SILENCIO =
  "Silencio electoral activo: solo se permite consultar informes verificados previamente publicados.";

export function bannerSilencioHtml(activo) {
  if (!activo) return "";
  return `
    <div class="banner banner--warning" data-visible="true">
      ${ICONS.alert} <span>${MENSAJE_SILENCIO}</span>
    </div>
  `;
}

export function bannerHtml(tipo, mensaje) {
  if (!mensaje) return "";
  return `<div class="banner banner--${tipo}" data-visible="true">${ICONS.alert} <span>${mensaje}</span></div>`;
}