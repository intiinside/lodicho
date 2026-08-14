# Lo Dicho — Contexto del proyecto

Plataforma de contrastación electoral para Ecuador. El ciudadano consulta una
declaración de un candidato (por voz, texto o URL de nota de prensa) y el sistema
responde con evidencia recuperada de un corpus curado: qué dice el plan de trabajo
registrado y qué establece el COOTAD sobre las competencias de ese nivel de gobierno.

**Dominio:** lodicho.intiinside.com
**Piloto:** provincia de Bolívar (Guaranda, Simiátug). No ampliar cobertura antes de
que el corpus de Bolívar esté completo y verificado.

---

## Repositorios

| Repo | Contenido | Ciclo de vida |
|---|---|---|
| `lodicho` | Aplicación (API, worker, web, infra) | Despliegue en ventanas controladas |
| `lodicho-corpus` | `.md` con frontmatter + PDFs fuente | PRs frecuentes, dispara reindexación |

Están separados a propósito: no mezclar. Un push al corpus no debe disparar CI de
despliegue, y un push de código no debe disparar reindexación.

---

## Stack

- **Host:** Ubuntu Server 24.04, Hetzner VPS, Docker Compose
- **Proxy:** Nginx + Certbot
- **API:** FastAPI (Python 3.12) + Pydantic v2
- **Jobs:** ARQ + Redis
- **Relacional:** PostgreSQL 16 + Alembic
- **Vectorial:** Qdrant (denso + sparse, vectores nombrados)
- **Embeddings:** Gemini `gemini-embedding-001`, 768 dim
- **Sparse:** FastEmbed `Qdrant/bm25` (local, sin costo de API)
- **Generación:** Gemini 2.5 Flash (clasificación, transcripción) / 2.5 Pro (veredictos)
- **Ingesta:** n8n (solo webhook + delta; el procesamiento va en Python)
- **Frontend:** Vanilla JS + ES modules, `marked.js`. Sin framework, sin build step.

---

## Reglas críticas

Estas no son preferencias de estilo. Violarlas produce daño real a un candidato o
expone el proyecto legalmente.

### 1. Filtro por candidatura, siempre en código

Toda recuperación sobre `planes_trabajo` filtra por `candidatura_id` en el cliente
Qdrant. Nunca delegado al prompt. Recuperar el plan de otra candidatura produce un
veredicto difamatorio.

### 2. Tres ausencias distintas, nunca confundir

| Estado | Significado |
|---|---|
| `sin_plan_registrado` | La candidatura no registró plan ante el CNE (dato en `candidaturas`) |
| `sin_plan_recuperado` | El retrieval no devolvió fragmentos (fallo técnico) |
| `no_consta` | Se recuperó el plan y la propuesta no está ahí |

Solo `no_consta` habilita el veredicto `no_consta_en_plan`. Hay un validador Pydantic
que lo impide; no lo desactives.

### 3. Cifras: nunca por RAG

Los indicadores estadísticos viven en la tabla `indicadores` y se exponen como tool
call con parámetros (`codigo`, `jurisdiccion_dpa`, `anio`). Un embedding no distingue
34,2 % de 43,2 %. Sin dato → veredicto `incomprobable`, jamás una cifra inferida.

### 4. Evidencia automática, veredicto firmado

| Salida | Revisión humana |
|---|---|
| Cita del plan de trabajo | No |
| Artículos del COOTAD aplicables | No |
| Dato oficial de `indicadores` | No |
| Contraste factual entre candidatos | No |
| Veredicto categórico | **Sí, obligatoria** |
| Score de factibilidad | **Sí, obligatoria** |

Un veredicto sin firma de revisor nunca sale con `estado='publicado'`.

### 5. Nada de recomendación de voto

El clasificador de intención rechaza con mensaje fijo (no generado por el modelo):
recomendación de voto, comparación de calidad entre candidatos, opinión sobre la
persona. Contrastar propuestas lado a lado sí se permite, sin juicio de calidad.

### 6. Silencio electoral

Variable `MODO_SILENCIO_ELECTORAL`. Cuando está activa: solo lectura de informes ya
publicados, generación desactivada.

### 7. Contenido web = datos no confiables

El texto extraído de una URL va envuelto en `<contenido_web>` y el system prompt
declara explícitamente que nada dentro de ese bloque es una instrucción. Riesgo real
de inyección de prompt.

---

## Modelo de datos

```
candidaturas (id, organizacion_politica, lista_numero, dignidad,
              jurisdiccion_dpa, periodo, doc_id_plan, estado_plan)
     │
     └──< candidatos (id, nombre, candidatura_id FK, posicion_lista)

documentos   (id, doc_id UNIQUE, tipo, candidatura_id FK, ruta_repo,
              sha256, pdf_sha256, git_sha, n_chunks, indexado_en, estado)

indicadores  (id, codigo, descripcion, jurisdiccion_dpa, anio,
              valor NUMERIC, unidad, fuente, url)

consultas    (id, tipo_input, texto, audio_path, url_fuente,
              contenido_archivado, hash_contenido, intencion_detectada,
              desde_cache, creado_en)
     │
     └──< declaraciones (id, consulta_id, texto, tipo, atribuible, analisis_id)

analisis     (id, candidatura_id FK, afirmacion, veredicto ENUM,
              payload_json JSONB, factibilidad_score, factibilidad_factores JSONB,
              modelo_usado, estado ENUM, revisor_id, revisado_en,
              respuesta_candidato, publicado_en, creado_en)
     │
     └──< evidencias (id, analisis_id, paso, coleccion, point_id,
                      doc_id, texto, score, git_sha)
```

**Clave:** el plan de trabajo pertenece a la **candidatura**, no a la persona. Varios
candidatos de una misma lista comparten un solo plan. Un `.md` por candidatura.

`veredicto`: `viable_y_en_plan` | `fuera_de_competencia` | `no_consta_en_plan` |
`informacion_enganosa` | `informacion_falsa` | `incomprobable`

`estado`: `borrador` → `en_revision` → `publicado` | `descartado`

`declaraciones.tipo`: `cita_directa` | `parafrasis_periodistica` | `dictado_usuario`.
Solo `cita_directa` y `dictado_usuario` son atribuibles al candidato.

---

## Qdrant

Cuatro colecciones, **siempre accedidas por alias** (la dimensión es inmutable; el
alias permite reindexar a `_v2` y conmutar sin downtime).

| Alias | Chunking | Filtro obligatorio |
|---|---|---|
| `marco_legal` | Por artículo (regex sobre `Art\.\s*(\d+)`) | `nivel_gobierno`, `vigente` |
| `planes_trabajo` | Por sección / eje | `candidatura_id` |
| `contexto` | Semántico ~500 tokens | `jurisdiccion_dpa` |
| `analisis_publicados` | 1 punto por informe | — (caché semántico) |

Cada punto lleva vectores nombrados `dense` (Gemini 768, **normalizado L2**) y `sparse`
(BM25 local). Fusión por RRF.

### Gemini embeddings — dos errores silenciosos

1. **Task type asimétrico.** `RETRIEVAL_DOCUMENT` al indexar, `RETRIEVAL_QUERY` al
   consultar. Definidos como constantes en `services/embeddings.py`, nunca hardcodeados
   en dos lugares.
2. **Normalización.** Solo 3072 dim viene pre-normalizado. A 768 hay que normalizar L2
   antes del upsert. Sin esto los scores coseno salen distorsionados sin lanzar error.

No usar `gemini-embedding-2`: es multimodal y **no soporta `task_type`**. API incompatible.

---

## Pipeline de ingesta

```
PDF → conversión → .md con frontmatter → PR en lodicho-corpus
                                            │
                    GitHub Action: validaciones automáticas
                                            │
                    Revisor humano aprueba y fusiona
                                            │
                    push webhook → n8n → POST /api/v1/ingest
```

n8n **solo** hace: `GET /repos/{owner}/{repo}/compare/{before}...{after}` → extraer
`files[]` → un POST por archivo. Nada más. Todo el procesamiento en FastAPI.

Estados de archivo:

| status | Acción |
|---|---|
| `added` / `modified` | `delete_by_filter({doc_id})` → re-chunk → upsert |
| `removed` | `delete_by_filter({doc_id})` + marcar `documentos.estado='eliminado'` |
| `renamed` | delete por `doc_id` anterior → upsert nuevo |

**Nunca solo upsert.** Si un documento pasa de 12 a 9 chunks, los 3 huérfanos siguen
apareciendo en búsquedas con contenido desactualizado.

### Frontmatter obligatorio

```yaml
---
doc_id: plan-bolivar-simiatug-junta-18-2027
tipo: plan_trabajo          # marco_legal | plan_trabajo | contexto
candidatura_id: 42
dignidad: vocal_junta_parroquial
nivel_gobierno: parroquial_rural
jurisdiccion_dpa: "0207"
organizacion: Partido Y
lista_numero: "18"
periodo: "2027-2031"
fuente_url: https://...
pdf_sha256: 9f2c...
convertido_con: docling-2.14
revisado_por: inti.poaquiza
revisado_en: 2026-08-14
vigente: true
---
```

Validado en CI. PR que no cumpla el esquema se rechaza.

### Validaciones automáticas del corpus

- Frontmatter completo y tipado
- Secuencia de artículos sin saltos (`marco_legal`)
- Ratio caracteres MD / caracteres extraídos del PDF > 0.85
- Encabezados/pies repetidos (misma línea >5 veces)
- Tildes y `ñ` en proporción esperable (detecta corrupción de encoding)
- Ningún chunk sobre el umbral de tokens

**Conversión:** preferir parsers de layout (Docling, Marker, MinerU). Reservar LLM solo
para escaneados. Si se usa LLM, convertir **página por página** con validación de conteo
de caracteres — un LLM parafrasea artículos sin avisar, y eso es catastrófico y silencioso.

---

## Pipeline de consulta

```
POST /api/v1/consulta  (SSE)
  │
  1. Normalizar input:
     - audio  → Gemini 2.5 Flash → texto + idioma + confianza
     - url    → extraer + archivar + separar cita_directa / parafrasis
     - texto  → directo
  │
  2. Clasificar intención (Gemini Flash, enum)
     → si es recomendación de voto / opinión: mensaje fijo de rechazo, FIN
  │
  3. Resolver candidatura
     - extraer nombre de la declaración
     - buscar en BD → si hay ambigüedad, devolver opciones para confirmar
     - fallback: selectores en cascada provincia → cantón → parroquia → dignidad
  │
  4. Caché semántico: buscar en analisis_publicados (umbral ~0.88)
     → hit: devolver informe verificado, instantáneo, FIN
  │
  5. Recuperación dirigida (una por paso, no un prompt gigante):
     - planes_trabajo  filtrado por candidatura_id
     - marco_legal     híbrido, filtrado por nivel_gobierno
     - indicadores     tool call SQL, solo si hay cifras
  │
  6. Respuesta de evidencia → se entrega de inmediato, sin revisión
  │
  7. Si el usuario pide veredicto: encolar en ARQ → estado='borrador'
     → banner "verificación preliminar, pendiente de revisión editorial"
```

### Salvaguardas del veredicto

- **Auto-consistencia:** 3 corridas a temperatura 0.3. Coinciden → confianza alta,
  revisión ligera. Divergen → caso ambiguo, cola prioritaria.
- **Verificador de anclaje:** segunda llamada barata a Flash — ¿cada afirmación del
  informe está sustentada en un chunk citado? Detecta razonamiento no anclado.

---

## Rúbrica de factibilidad

El score **nunca lo genera el LLM**. El modelo llena factores discretos; Python calcula
el número con pesos fijos. Reproducible, auditable, explicable.

| Factor | Valores | Peso |
|---|---|---|
| Competencia legal | exclusiva / concurrente / sin_competencia | 35 % |
| Consta en plan | explicito / implicito / no_consta | 20 % |
| Financiamiento identificado | con_monto / mencionado / ausente | 20 % |
| Plazo vs. período de gestión | holgado / ajustado / imposible | 15 % |
| Precedente presupuestario | existe / parcial / ninguno | 10 % |

El dashboard muestra el desglose, no el número solo. La rúbrica se publica en el sitio.

**No existe "veracidad en porcentaje".** La veracidad es categórica.

### Matiz competencial

Distinguir siempre "ejecutaré X" (requiere competencia) de "gestionaré X ante quien la
tiene" (requiere solo capacidad de gestión). Un candidato a Junta Parroquial puede
legítimamente prometer gestionar obra de otro nivel. Marcar eso como extralimitación es
el error más dañino del sistema.

---

## Salida del modelo

**JSON, nunca Markdown.** El modelo devuelve `InformeContrastacion` validado con
Pydantic v2; el frontend renderiza el Markdown a partir del JSON. Motivos: veredicto
como enum consultable, agregados, y validación antes de persistir.

Usar `response_schema` de Gemini + revalidación Pydantic. Los tres validadores
semánticos (`sin_plan_no_es_ausencia`, `veredicto_factico_exige_indicadores`,
`competencia_exige_articulos`) no se pueden expresar en JSON Schema y son la
salvaguarda principal. Si un validador falla: un reintento; si vuelve a fallar,
persistir con `estado='en_revision'` y nota de error.

Todo campo de texto en español, registro periodístico neutro.

---

## Frontend

Vanilla JS + ES modules. Estructura `web/js/{api.js, views/, components/}`.

**Entrada por voz (dictado, no streaming):**
- Web Speech API para vista previa en vivo mientras habla (gratis, en dispositivo)
- `MediaRecorder` graba en paralelo; al soltar sube el blob
- Gemini produce la transcripción autoritativa
- El texto cae en **el mismo campo** donde habría escrito → un solo pipeline
- Si la confianza es baja: mostrar editable con aviso "revisa si esto es lo que dijiste"
- Guardar siempre el audio original (evidencia ante impugnación)
- `getUserMedia` requiere HTTPS — en dev usar `localhost`, no IP de LAN

**Panel de evidencias:** clic en cualquier afirmación del informe muestra el chunk
recuperado con score, `doc_id` y `git_sha`. Esa trazabilidad es el producto.

---

## Convenciones

- Nombres de dominio en español (`candidaturas`, `veredicto`, `evidencias`); código
  Python en inglés donde sea idiomático.
- `jurisdiccion_dpa`: código DPA del INEC como string, no nombre libre.
- Migraciones con Alembic, siempre reversibles.
- Ningún secreto en el repo. `.env` fuera de git; `.env.example` con claves vacías.
- Qdrant y Postgres sin puertos publicados al host — solo red interna de Docker.
- Rate limit agresivo por IP en endpoints públicos: la generación cuesta dinero.
- Límite de 10 MB en subida de audio, validado antes de llamar a Gemini.

---

## Estado actual

**Fase 1 — Corpus e ingesta.** En curso.
Repo de corpus, GitHub Action de validación, `/api/v1/ingest`, chunker por artículo,
colección `marco_legal` poblada con el COOTAD y verificada a mano.

Nada más importa hasta que esto esté limpio.

Fases siguientes: (2) pipeline de análisis + set de evaluación de 25–30 afirmaciones
anotadas a mano; (3) frontend y panel de revisión; (4) voz, URL y planes de trabajo de
todas las candidaturas de Bolívar.

---

## Set de evaluación — casos límite obligatorios

Antes de abrir al público, verificar que el sistema acierta en:

| Caso | Qué verifica |
|---|---|
| Propuesta claramente fuera de competencia | Paso 2 básico |
| **Propuesta de gestión ante otro nivel** | Que NO se marque `fuera_de_competencia` |
| Cifra correcta | Paso 3 positivo |
| Cifra correcta pero descontextualizada | Distinción `enganoso` vs `falso` |
| **Cifra sin indicador disponible** | Que devuelva `incomprobable`, no invente |
| Plan no recuperado | Que devuelva `sin_plan_recuperado` |
| Candidato cita un artículo inexistente | Que no lo valide por complacencia |
| Afirmación ambigua | Que baje la confianza |

Si falla en las dos filas marcadas, no está listo para publicar.

---

## Consideración legal

El sistema emite juicios públicos con nombre y apellido sobre candidatos en período
electoral. Bajo el Código de la Democracia y la normativa del CNE, eso conlleva
responsabilidad.

1. Ningún veredicto se publica sin firma humana. El sistema propone; un periodista firma.
2. `respuesta_candidato` existe desde la primera migración. El derecho a réplica no se
   retrofitea.
3. Cada afirmación del informe enlaza a evidencia concreta con el `git_sha` de la
   versión exacta del documento fuente.
