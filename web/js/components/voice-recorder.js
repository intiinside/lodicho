// Dictado, no streaming (CLAUDE.md, Frontend):
//  - Web Speech API: vista previa en vivo mientras habla, gratis, en dispositivo.
//  - MediaRecorder graba en paralelo; al soltar, el blob se guarda para
//    subir junto al texto (evidencia ante impugnación, y Gemini hace la
//    transcripción autoritativa del lado del servidor).
//  - El texto cae en el mismo campo de texto — un solo pipeline; por eso
//    este componente no envía nada por su cuenta, solo entrega
//    (texto, blob) al llamador via onTranscripcion.
import { ICONS } from "../icons.js";

const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

export function crearVoiceRecorder({ onTranscripcion }) {
  const el = document.createElement("div");
  el.className = "voice-recorder";
  el.innerHTML = `
    <button type="button" class="voice-recorder__button" id="rec-btn" aria-label="Mantén presionado para grabar">
      ${ICONS.mic}
    </button>
    <p class="voice-recorder__status" id="rec-status">Mantén presionado para grabar</p>
  `;

  const boton = el.querySelector("#rec-btn");
  const status = el.querySelector("#rec-status");

  let mediaRecorder = null;
  let chunks = [];
  let reconocimiento = null;
  let transcriptoParcial = "";
  let grabando = false;

  async function iniciar(evento) {
    evento.preventDefault();
    if (grabando) return;

    if (!window.isSecureContext) {
      status.textContent = "El micrófono requiere HTTPS (o localhost en desarrollo).";
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = "Este navegador no permite grabar audio.";
      return;
    }

    grabando = true;
    chunks = [];
    transcriptoParcial = "";
    boton.dataset.recording = "true";
    boton.innerHTML = ICONS.stop;
    status.textContent = "Escuchando…";

    iniciarReconocimientoVivo();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.start();
    } catch {
      status.textContent = "No se pudo acceder al micrófono.";
      detener();
    }
  }

  function iniciarReconocimientoVivo() {
    if (!RecognitionCtor) {
      status.textContent = "Grabando… (vista previa en vivo no disponible en este navegador)";
      return;
    }
    reconocimiento = new RecognitionCtor();
    reconocimiento.lang = "es-EC";
    reconocimiento.continuous = true;
    reconocimiento.interimResults = true;
    reconocimiento.onresult = (evento) => {
      let texto = "";
      for (let i = 0; i < evento.results.length; i++) {
        texto += evento.results[i][0].transcript;
      }
      transcriptoParcial = texto;
      status.textContent = texto || "Escuchando…";
    };
    reconocimiento.onerror = () => {
      // Best-effort: si la vista previa falla, el audio se sigue grabando
      // igual y Gemini transcribe del lado del servidor.
    };
    try {
      reconocimiento.start();
    } catch {
      /* ya iniciado, o no soportado en este momento */
    }
  }

  function detener() {
    if (!grabando) return;
    grabando = false;
    boton.dataset.recording = "false";
    boton.innerHTML = ICONS.mic;
    status.textContent = "Procesando…";

    try {
      reconocimiento?.stop();
    } catch {
      /* noop */
    }

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.addEventListener(
        "stop",
        () => {
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
          mediaRecorder.stream.getTracks().forEach((track) => track.stop());
          finalizar(blob);
        },
        { once: true }
      );
      mediaRecorder.stop();
    } else {
      finalizar(null);
    }
  }

  function finalizar(blob) {
    status.textContent = blob
      ? "Listo. Revisa el texto antes de enviar."
      : "No se pudo grabar audio; revisa el texto antes de enviar.";
    onTranscripcion(transcriptoParcial.trim(), blob);
  }

  boton.addEventListener("pointerdown", iniciar);
  ["pointerup", "pointerleave", "pointercancel"].forEach((tipo) =>
    boton.addEventListener(tipo, detener)
  );

  if (!RecognitionCtor) {
    status.textContent = "Mantén presionado para grabar (sin vista previa en vivo en este navegador)";
  }

  return el;
}
