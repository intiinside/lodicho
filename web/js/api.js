// Cliente de la API. IMPORTANTE: /api/v1/consulta todavia no esta
// implementado en el backend (ver CLAUDE.md, "Estado actual" — seguimos en
// Fase 1). Este modulo ya respeta el contrato documentado en CLAUDE.md,
// seccion "Pipeline de consulta", para no tener que rehacer el frontend
// cuando el endpoint exista. Si el fetch falla, el error se reporta claro
// via handlers.onError — nunca se inventan datos para "que se vea bonito".
const BASE_URL = "/api/v1";

export class ErrorAPI extends Error {
  constructor(mensaje, causa) {
    super(mensaje);
    this.name = "ErrorAPI";
    this.causa = causa;
  }
}

/**
 * Bandera de silencio electoral (Regla critica 6). Si el endpoint no
 * existe o falla, se asume que NO hay silencio electoral activo: fallar
 * abierto hacia "mostrar todo" es lo seguro aqui, porque lo peligroso
 * seria lo contrario (silenciar la app por un error de red).
 */
export async function obtenerEstado() {
  try {
    const res = await fetch(`${BASE_URL}/estado`);
    if (!res.ok) return { modo_silencio_electoral: false };
    return await res.json();
  } catch {
    return { modo_silencio_electoral: false };
  }
}

/**
 * Envia una consulta (texto, voz o URL) y consume la respuesta como
 * Server-Sent Events sobre POST (no se puede usar EventSource nativo
 * porque solo soporta GET).
 *
 * Eventos SSE asumidos, uno por paso del pipeline (CLAUDE.md):
 *   "rechazo"      -> { motivo }                              intencion no permitida, fin
 *   "candidatura"  -> { candidatura } | { opciones: [...] }    resolucion de candidatura
 *   "evidencia"    -> { declaracion, evidencias: [...] }       entrega inmediata, sin revision
 *   "veredicto"    -> InformeContrastacion (estado="borrador")  solo si se pidio veredicto
 *   "error"        -> { detalle }
 *
 * @param {{tipoInput: "texto"|"voz"|"url", texto?: string, urlFuente?: string, audioBlob?: Blob}} payload
 * @param {{onEvento: (nombre: string, data: any) => void, onError: (err: ErrorAPI) => void, onFin?: () => void}} handlers
 */
export async function enviarConsulta(payload, handlers) {
  const formData = new FormData();
  formData.set("tipo_input", payload.tipoInput);
  if (payload.texto) formData.set("texto", payload.texto);
  if (payload.urlFuente) formData.set("url_fuente", payload.urlFuente);
  if (payload.audioBlob) formData.set("audio", payload.audioBlob, "consulta.webm");

  let response;
  try {
    response = await fetch(`${BASE_URL}/consulta`, { method: "POST", body: formData });
  } catch (causa) {
    handlers.onError(new ErrorAPI("No se pudo conectar con el servidor.", causa));
    return;
  }

  if (!response.ok || !response.body) {
    handlers.onError(new ErrorAPI(`El servidor respondió ${response.status}.`));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separador;
      while ((separador = buffer.indexOf("\n\n")) !== -1) {
        const bloque = buffer.slice(0, separador);
        buffer = buffer.slice(separador + 2);
        procesarBloqueSSE(bloque, handlers);
      }
    }
  } catch (causa) {
    handlers.onError(new ErrorAPI("Se perdió la conexión durante la consulta.", causa));
    return;
  }

  handlers.onFin?.();
}

function procesarBloqueSSE(bloque, handlers) {
  let evento = "message";
  const lineasData = [];
  for (const linea of bloque.split("\n")) {
    if (linea.startsWith("event:")) evento = linea.slice(6).trim();
    else if (linea.startsWith("data:")) lineasData.push(linea.slice(5).trim());
  }
  if (lineasData.length === 0) return;

  try {
    const data = JSON.parse(lineasData.join("\n"));
    handlers.onEvento(evento, data);
  } catch (causa) {
    handlers.onError(new ErrorAPI("Respuesta del servidor no válida.", causa));
  }
}
