// Estado local: historial de consultas y preferencia de tema. Vive en
// localStorage — no hay endpoint de "listar consultas" en el backend
// todavia, y el historial del propio telefono es util aunque no lo haya.
const STORAGE_KEY = "lodicho:historial";
const THEME_KEY = "lodicho:theme";
const MAX_HISTORIAL = 50;

export function leerHistorial() {
  try {
    const datos = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

export function guardarEnHistorial(entrada) {
  const historial = leerHistorial();
  const conId = {
    ...entrada,
    id: entrada.id ?? (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    guardado_en: new Date().toISOString(),
  };
  historial.unshift(conId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(historial.slice(0, MAX_HISTORIAL)));
  return conId;
}

export function buscarEnHistorial(id) {
  return leerHistorial().find((item) => item.id === id) ?? null;
}

export function limpiarHistorial() {
  localStorage.removeItem(STORAGE_KEY);
}

export function leerTema() {
  return localStorage.getItem(THEME_KEY) || "system";
}

export function guardarTema(tema) {
  if (tema === "system") {
    localStorage.removeItem(THEME_KEY);
  } else {
    localStorage.setItem(THEME_KEY, tema);
  }
  aplicarTema(tema);
}

export function aplicarTema(tema) {
  const raiz = document.documentElement;
  if (tema === "dark" || tema === "light") {
    raiz.setAttribute("data-theme", tema);
  } else {
    raiz.removeAttribute("data-theme");
  }
}
