// Composer unico, estilo Gemini/ChatGPT: una sola caja que crece, en vez
// de tabs separados para texto/voz/URL. El modo (texto/voz/url) se
// infiere al enviar, no lo elige el usuario de antemano:
//   - hay audio adjunto (dictado o subido)  -> voz
//   - el texto completo es una URL           -> url
//   - cualquier otra cosa                    -> texto
import { ICONS } from "../icons.js";

const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const URL_RE = /^https?:\/\/\S+$/i;
const LIMITE_AUDIO_BYTES = 10 * 1024 * 1024; // CLAUDE.md: limite de 10 MB en subida de audio

export function crearComposer({ onEnviar }) {
  const el = document.createElement("div");
  el.className = "composer";
  el.innerHTML = `
    <textarea
      class="composer__textarea"
      id="composer-texto"
      placeholder="Escribí, pegá una URL, o dictá lo que dijo el candidato…"
      rows="1"
    ></textarea>
    <div class="composer__chip" id="composer-chip" hidden></div>
    <div class="composer__toolbar">
      <div class="composer__tools">
        <button type="button" class="composer__tool" id="composer-mic" aria-label="Dictar" title="Dictar">${ICONS.mic}</button>
        <button type="button" class="composer__tool" id="composer-attach" aria-label="Subir audio" title="Subir audio">${ICONS.attach}</button>
        <button type="button" class="composer__tool" id="composer-link" aria-label="Pegar URL" title="Pegar URL">${ICONS.link}</button>
        <input type="file" id="composer-file" accept="audio/*" hidden />
      </div>
      <button type="button" class="composer__enviar" id="composer-enviar" disabled aria-label="Consultar">${ICONS.send}</button>
    </div>
    <p class="composer__status" id="composer-status"></p>
  `;

  const textarea = el.querySelector("#composer-texto");
  const chip = el.querySelector("#composer-chip");
  const botonMic = el.querySelector("#composer-mic");
  const botonAttach = el.querySelector("#composer-attach");
  const inputFile = el.querySelector("#composer-file");
  const botonLink = el.querySelector("#composer-link");
  const botonEnviar = el.querySelector("#composer-enviar");
  const status = el.querySelector("#composer-status");

  let audioBlob = null;
  let grabando = false;
  let mediaRecorder = null;
  let chunks = [];
  let reconocimiento = null;

  function autoresize() {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }

  function actualizarEnviar() {
    botonEnviar.disabled = grabando || !(textarea.value.trim() || audioBlob);
  }

  function mostrarChip(etiqueta) {
    chip.hidden = false;
    chip.innerHTML = `${ICONS.mic}<span>${etiqueta}</span><button type="button" aria-label="Quitar audio">${ICONS.close}</button>`;
    chip.querySelector("button").addEventListener("click", quitarAudio);
  }

  function quitarAudio() {
    audioBlob = null;
    chip.hidden = true;
    chip.innerHTML = "";
    actualizarEnviar();
  }

  textarea.addEventListener("input", () => {
    autoresize();
    actualizarEnviar();
  });

  // --- subir un audio ya grabado ---
  botonAttach.addEventListener("click", () => inputFile.click());
  inputFile.addEventListener("change", () => {
    const archivo = inputFile.files[0];
    inputFile.value = "";
    if (!archivo) return;
    if (archivo.size > LIMITE_AUDIO_BYTES) {
      status.textContent = "Ese audio supera los 10 MB — es el límite del servidor.";
      return;
    }
    audioBlob = archivo;
    status.textContent = "";
    mostrarChip(archivo.name);
    actualizarEnviar();
  });

  // --- pegar URL desde el portapapeles ---
  botonLink.addEventListener("click", async () => {
    try {
      const texto = await navigator.clipboard.readText();
      if (texto) {
        textarea.value = texto.trim();
        autoresize();
        actualizarEnviar();
      }
      textarea.focus();
    } catch {
      status.textContent = "No se pudo leer el portapapeles — pegala a mano (Ctrl/Cmd+V).";
      textarea.focus();
    }
  });

  // --- dictado: un toque para empezar, otro para parar ---
  botonMic.addEventListener("click", () => (grabando ? detenerDictado() : iniciarDictado()));

  async function iniciarDictado() {
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
    botonMic.dataset.recording = "true";
    botonMic.innerHTML = ICONS.stop;
    status.textContent = "Escuchando…";
    actualizarEnviar();

    if (RecognitionCtor) {
      reconocimiento = new RecognitionCtor();
      reconocimiento.lang = "es-EC";
      reconocimiento.continuous = true;
      reconocimiento.interimResults = true;
      reconocimiento.onresult = (evento) => {
        let texto = "";
        for (let i = 0; i < evento.results.length; i++) texto += evento.results[i][0].transcript;
        textarea.value = texto;
        autoresize();
      };
      reconocimiento.onerror = () => {
        // Best-effort: si la vista previa falla, el audio se sigue
        // grabando igual y Gemini transcribe del lado del servidor.
      };
      try {
        reconocimiento.start();
      } catch {
        /* ya iniciado, o no soportado en este momento */
      }
    } else {
      status.textContent = "Grabando… (vista previa en vivo no disponible en este navegador)";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.start();
    } catch {
      status.textContent = "No se pudo acceder al micrófono.";
      detenerDictado();
    }
  }

  function detenerDictado() {
    if (!grabando) return;
    grabando = false;
    botonMic.dataset.recording = "false";
    botonMic.innerHTML = ICONS.mic;

    try {
      reconocimiento?.stop();
    } catch {
      /* noop */
    }

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.addEventListener(
        "stop",
        () => {
          audioBlob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
          mediaRecorder.stream.getTracks().forEach((track) => track.stop());
          mostrarChip("Audio dictado");
          status.textContent = "Listo. Revisá el texto antes de enviar.";
          actualizarEnviar();
        },
        { once: true }
      );
      mediaRecorder.stop();
    } else {
      actualizarEnviar();
    }
  }

  botonEnviar.addEventListener("click", () => {
    const texto = textarea.value.trim();
    let payload;
    if (audioBlob) {
      payload = { tipoInput: "voz", texto, audioBlob };
    } else if (URL_RE.test(texto)) {
      payload = { tipoInput: "url", urlFuente: texto };
    } else {
      payload = { tipoInput: "texto", texto };
    }

    resetear();
    onEnviar(payload);
  });

  function resetear() {
    textarea.value = "";
    autoresize();
    quitarAudio();
    status.textContent = "";
    actualizarEnviar();
  }

  actualizarEnviar();

  return el;
}
