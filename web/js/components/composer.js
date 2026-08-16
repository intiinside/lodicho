import { ICONS } from "../icons.js";

const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const URL_RE = /^https?:\/\/\S+$/i;
const LIMITE_AUDIO_BYTES = 10 * 1024 * 1024;

const SUGGESTIONS = [
  "Castillo propone eliminar la tasa de mantenimiento vial",
  "Guerra propone invertir $50 millones en Misión Violeta",
  "Zambrano propone destinar el 20% del presupuesto a parroquias rurales"
];

export function crearComposer({ onEnviar }) {
  const el = document.createElement("div");
  el.className = "composer-card";

  el.innerHTML = `
    <textarea
      class="composer-textarea"
      id="composer-texto"
      placeholder="Escribe una afirmación, pega el enlace a una noticia o presiona dictar..."
      rows="3"
    ></textarea>

    <div class="audio-preview-chip" id="composer-chip" style="display:none;"></div>
    <input type="file" id="composer-file" accept="audio/*" style="display:none;" />

    <div class="composer-toolbar">
      <div class="composer-actions-left">
        <button type="button" class="composer-pill-btn" id="composer-mic" aria-label="Dictar declaración">
          ${ICONS.mic} <span id="composer-mic-label">Dictar</span>
        </button>
        <button type="button" class="composer-pill-btn" id="composer-attach" aria-label="Subir archivo de audio">
          ${ICONS.attach} <span>Audio</span>
        </button>
      </div>

      <button type="button" class="btn-primary" id="composer-enviar" disabled>
        ${ICONS.search} <span>Contrastar Declaración</span>
      </button>
    </div>

    <div class="composer-suggestions">
      ${SUGGESTIONS.map((s) => `<button type="button" class="suggestion-pill" data-texto="${s}">${s}</button>`).join("")}
    </div>

    <p class="field-hint" id="composer-status" style="margin-top: 8px; font-size: 12px; color: var(--veredicto-falso-text);"></p>
  `;

  const textarea = el.querySelector("#composer-texto");
  const chip = el.querySelector("#composer-chip");
  const botonMic = el.querySelector("#composer-mic");
  const botonAttach = el.querySelector("#composer-attach");
  const inputFile = el.querySelector("#composer-file");
  const botonEnviar = el.querySelector("#composer-enviar");
  const status = el.querySelector("#composer-status");

  let audioBlob = null;
  let grabando = false;
  let mediaRecorder = null;
  let chunks = [];
  let reconocimiento = null;
  let enviando = false;

  const ETIQUETA_ENVIAR = `${ICONS.search} <span>Contrastar Declaración</span>`;
  const ETIQUETA_ENVIANDO = `<div class="btn-spinner"></div> <span>Contrastando...</span>`;

  function actualizarEnviar() {
    botonEnviar.disabled = enviando || grabando || !(textarea.value.trim() || audioBlob);
  }

  function mostrarChip(etiqueta) {
    chip.style.display = "inline-flex";
    chip.innerHTML = `
      <div class="audio-preview-chip__icon">${ICONS.mic}</div>
      <div class="audio-preview-chip__meta">
        <span class="audio-preview-chip__title">${etiqueta}</span>
        <span class="audio-preview-chip__subtitle">Audio listo para contrastar</span>
      </div>
      <button type="button" class="audio-preview-chip__close" aria-label="Eliminar audio">${ICONS.close}</button>
    `;
    chip.querySelector("button").addEventListener("click", quitarAudio);
  }

  function quitarAudio() {
    audioBlob = null;
    chip.style.display = "none";
    chip.innerHTML = "";
    actualizarEnviar();
  }

  textarea.addEventListener("input", actualizarEnviar);

  el.querySelectorAll(".suggestion-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      textarea.value = pill.dataset.texto;
      textarea.focus();
      actualizarEnviar();
    });
  });

  botonAttach.addEventListener("click", () => inputFile.click());

  inputFile.addEventListener("change", () => {
    const archivo = inputFile.files[0];
    inputFile.value = "";
    if (!archivo) return;
    if (archivo.size > LIMITE_AUDIO_BYTES) {
      status.textContent = "El archivo supera el límite permitido de 10 MB.";
      return;
    }
    audioBlob = archivo;
    status.textContent = "";
    mostrarChip(archivo.name);
    actualizarEnviar();
  });

  botonMic.addEventListener("click", () => (grabando ? detenerDictado() : iniciarDictado()));

  async function iniciarDictado() {
    if (!window.isSecureContext) {
      status.textContent = "El dictado requiere entorno seguro (HTTPS o localhost).";
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = "Este navegador no soporta captura de audio.";
      return;
    }

    grabando = true;
    chunks = [];
    botonMic.classList.add("composer-pill-btn--recording");
    botonMic.innerHTML = `${ICONS.stop} <span>Detener</span>`;
    status.textContent = "Escuchando...";
    status.style.color = "var(--color-brand)";
    actualizarEnviar();

    if (RecognitionCtor) {
      reconocimiento = new RecognitionCtor();
      reconocimiento.lang = "es-EC";
      reconocimiento.continuous = true;
      reconocimiento.interimResults = true;
      reconocimiento.onresult = (evento) => {
        let texto = "";
        for (let i = 0; i < evento.results.length; i++) {
          texto += evento.results[i][0].transcript;
        }
        textarea.value = texto;
      };
      try { reconocimiento.start(); } catch {}
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.start();
    } catch {
      status.textContent = "Permiso de micrófono denegado.";
      status.style.color = "var(--veredicto-falso-text)";
      detenerDictado();
    }
  }

  function detenerDictado() {
    if (!grabando) return;
    grabando = false;
    botonMic.classList.remove("composer-pill-btn--recording");
    botonMic.innerHTML = `${ICONS.mic} <span>Dictar</span>`;
    try { reconocimiento?.stop(); } catch {}

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.addEventListener("stop", () => {
        audioBlob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        mostrarChip("Dictado por voz");
        status.textContent = "Audio procesado. Revisa la transcripción antes de contrastar.";
        status.style.color = "var(--color-text-subtle)";
        actualizarEnviar();
      }, { once: true });
      mediaRecorder.stop();
    } else {
      actualizarEnviar();
    }
  }

  botonEnviar.addEventListener("click", async () => {
    const texto = textarea.value.trim();
    let payload;
    if (audioBlob) {
      payload = { tipoInput: "voz", texto, audioBlob };
    } else if (URL_RE.test(texto)) {
      payload = { tipoInput: "url", urlFuente: texto };
    } else {
      payload = { tipoInput: "texto", texto };
    }

    enviando = true;
    botonEnviar.innerHTML = ETIQUETA_ENVIANDO;
    actualizarEnviar();

    textarea.value = "";
    quitarAudio();
    status.textContent = "";

    try {
      await onEnviar(payload);
    } finally {
      enviando = false;
      botonEnviar.innerHTML = ETIQUETA_ENVIAR;
      actualizarEnviar();
    }
  });

  actualizarEnviar();
  return el;
}