const STORAGE_KEY = "lodicho:historial";
const THEME_KEY = "lodicho:theme";
const CANDIDATURA_PRESELECCIONADA_KEY = "lodicho:candidatura_preseleccionada";
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
  const guardado = localStorage.getItem(THEME_KEY);
  if (guardado === "dark" || guardado === "light") return guardado;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function toggleTema() {
  const actual = leerTema();
  const nuevo = actual === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nuevo);
  aplicarTema(nuevo);
  return nuevo;
}

export function aplicarTema(tema) {
  const raiz = document.documentElement;
  raiz.setAttribute("data-theme", tema);
}

// Candidatura elegida en #/candidatos/{id} para arrancar la próxima consulta
// directo sobre ella, sin depender de que el clasificador adivine el nombre
// desde texto libre. Vive en sessionStorage: es contexto de la sesión de
// navegación actual, no algo que deba persistir entre visitas.
export function guardarCandidaturaPreseleccionada(candidatura) {
  sessionStorage.setItem(CANDIDATURA_PRESELECCIONADA_KEY, JSON.stringify(candidatura));
}

export function leerCandidaturaPreseleccionada() {
  try {
    return JSON.parse(sessionStorage.getItem(CANDIDATURA_PRESELECCIONADA_KEY));
  } catch {
    return null;
  }
}

export function limpiarCandidaturaPreseleccionada() {
  sessionStorage.removeItem(CANDIDATURA_PRESELECCIONADA_KEY);
}