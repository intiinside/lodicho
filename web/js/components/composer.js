import { ICONS } from "../icons.js";

const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const URL_RE = /^https?:\/\/\S+$/i;
const LIMITE_AUDIO_BYTES = 10 * 1024 * 1024; 

export function crearComposer({ onEnviar }) {
  const el = document.createElement("div");
  el.className = "console-card";
  el.innerHTML = `
    <textarea
      class="console-textarea"
      id="composer-texto"
      placeholder="Escribí, pegá una URL, o dictá lo que dijo el candidato…"
    ></textarea>
    <div class="audio-file-preview" id="composer-chip" hidden style="margin-top: 16px;"></div>
    
    <div style="display: flex; gap: 12px; margin-top: 16px;">
      <button type="button" class="btn btn--ghost" id="composer-mic" aria-label="Dictar" style="flex: 1; padding: 10px;">${ICONS.mic}</button>
      <button type="button" class="btn btn--ghost" id="composer-attach" aria-label="Subir audio" style="flex: 1; padding: 10px;">${ICONS.attach}</button>
      <button type="button" class="btn btn--ghost" id="composer-link" aria-label="Pegar URL" style="flex: 1; padding: 10px;">${ICONS.link}</button>
      <input type="file" id="composer-file" accept="audio/*" hidden />
    </div>
    
    <button type="button" class="btn btn--primary" id="composer-enviar" disabled style="margin-top: 16px;">
      ${ICONS.send} Consultar Evidencia
    </button>
    <p class="field-hint" id="composer-status"></p>
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

  function actualizarEnviar() {
    botonEnviar.disabled = grabando || !(textarea.value.trim() || audioBlob);
  }

  function mostrarChip(etiqueta) {
    chip.hidden = false;
    chip.innerHTML = `
      <div class="audio-file-preview__icon">${ICONS.mic}</div>
      <div class="audio-file-preview__meta">
        <div class="audio-file-preview__name">${etiqueta}</div>
        <div class="audio-file-preview__size">Audio adjunto a la consulta</div>
      </div>
      <button type="button" class="audio-file-preview__clear" aria-label="Quitar audio">${ICONS.close}</button>
    `;
    chip.querySelector("button").addEventListener("click", quitarAudio);
  }

  function quitarAudio() {
    audioBlob = null;
    chip.hidden = true;
    chip.innerHTML = "";
    actualizarEnviar();
  }

  textarea.addEventListener("input", actualizarEnviar);

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

  botonLink.addEventListener("click", async () => {
    try {
      const texto = await navigator.clipboard.readText();
      if (texto) {
        textarea.value = texto.trim();
        actualizarEnviar();
      }
      textarea.focus();
    } catch {
      status.textContent = "No se pudo leer el portapapeles — pegala a mano (Ctrl/Cmd+V).";
      textarea.focus();
    }
  });

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
    botonMic.innerHTML = ICONS.stop;
    botonMic.style.color = "var(--veredicto-falso-text)";
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
      };
      reconocimiento.onerror = () => {};
      try {
        reconocimiento.start();
      } catch {}
    } else {
      status.textContent = "Grabando… (vista previa en vivo no disponible)";
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
    botonMic.innerHTML = ICONS.mic;
    botonMic.style.color = "";

    try { reconocimiento?.stop(); } catch {}

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.addEventListener(
        "stop",
        () => {
          audioBlob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
          mediaRecorder.stream.getTracks().forEach((track) => track.stop());
          mostrarChip("Audio dictado en la app");
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
    quitarAudio();
    status.textContent = "";
    actualizarEnviar();
  }

  actualizarEnviar();
  return el;
}