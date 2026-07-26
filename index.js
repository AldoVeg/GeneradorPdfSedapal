/* ============================================================
   index.js — Auditor Estructural de Proyectos
   Motor de evaluación con rúbrica vigesimal (0-20)
   Procesamiento en fila india con liberación de RAM
   ============================================================ */

// ─── Verificación de Dependencias CDN ───
const REQUIRED_LIBS = {
    pdfjsLib: 'PDF.js (procesamiento de PDF)',
    jspdf:    'jsPDF (exportación PDF)',
    mammoth:  'Mammoth.js (lectura de DOCX)',
    JSZip:    'JSZip (descompresión de ZIP)'
};

function checkDependencies() {
    const missing = [];
    for (const [globalName, label] of Object.entries(REQUIRED_LIBS)) {
        if (typeof window[globalName] === 'undefined') missing.push(label);
    }
    const alertEl = document.getElementById('cdn-alert');
    const alertText = document.getElementById('cdn-alert-text');
    if (!alertEl || !alertText) return false;
    if (missing.length > 0) {
        alertEl.classList.remove('hidden');
        alertText.textContent = 'Faltan librerías: ' + missing.join(', ') + '. Verifica tu conexión a internet y recarga la página.';
        return false;
    }
    alertEl.classList.add('hidden');
    return true;
}

function configurePDFJS() {
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
}

// ─── Micro-pausa para liberar el event loop ───
const yieldUI = () => new Promise(resolve => setTimeout(resolve, 15));

// ─── Estado Global ───
let resultadosEvaluacion = [];
let archivosDetectados   = [];
let abortController      = null;
let sortColumn           = null;
let sortDirection        = 'asc';
let isProcessing         = false;

// ─── Referencias al DOM ───
const DOM = {};
function cacheDOM() {
    const ids = [
        'drop-zone','file-input','folder-input','btn-folder','folder-fallback-msg',
        'file-list','file-list-items','file-count','stat-pdf','stat-docx','stat-zip',
        'status-text','progress-bar','btn-clear','btn-export-pdf','btn-export-csv',
        'error-panel','error-list','btn-dismiss-errors',
        'table-body','filter-input','results-count',
        'loading-overlay','loading-title','loading-detail','overlay-progress','overlay-percent','btn-cancel',
        'cdn-alert','cdn-alert-text'
    ];
    ids.forEach(id => { DOM[id] = document.getElementById(id); });
}

// ─── Utilidades ───
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}
function getFileTypeIcon(type) {
    if (type === 'pdf')  return '📄';
    if (type === 'docx') return '📝';
    if (type === 'zip')  return '📦';
    return '📎';
}
function detectFileType(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf'))  return 'pdf';
    if (name.endsWith('.docx')) return 'docx';
    if (name.endsWith('.zip'))  return 'zip';
    return 'other';
}

// ─── Lista de archivos detectados ───
function updateFileListUI() {
    const listEl   = DOM['file-list-items'];
    const fileList = DOM['file-list'];
    listEl.innerHTML = '';
    if (archivosDetectados.length === 0) {
        fileList.classList.add('hidden');
        DOM['status-text'].innerHTML = 'Esperando archivos...';
        return;
    }
    fileList.classList.remove('hidden');
    DOM['file-count'].textContent = archivosDetectados.length;
    DOM['status-text'].innerHTML = archivosDetectados.length + ' archivo(s) listos para evaluar.';

    let cP=0, cD=0, cZ=0;
    archivosDetectados.forEach(f => {
        if (f.type === 'pdf') cP++;
        else if (f.type === 'docx') cD++;
        else if (f.type === 'zip') cZ++;
    });
    const ts = (el, c) => {
        if (c > 0) { el.classList.remove('hidden'); el.textContent = el.textContent.replace(/\d+/, c); }
        else el.classList.add('hidden');
    };
    ts(DOM['stat-pdf'], cP);
    ts(DOM['stat-docx'], cD);
    ts(DOM['stat-zip'], cZ);

    archivosDetectados.forEach((f, i) => {
        const chip = document.createElement('li');
        chip.className = 'file-chip';
        const displayName = f.name.length > 28 ? f.name.slice(0,25) + '...' : f.name;
        chip.innerHTML =
            '<span class="chip-icon">' + getFileTypeIcon(f.type) + '</span> ' +
            '<span title="' + escapeHTML(f.name) + '">' + escapeHTML(displayName) + '</span> ' +
            '<button class="chip-remove" data-index="' + i + '">&times;</button>';
        listEl.appendChild(chip);
    });
    listEl.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isProcessing) return;
            archivosDetectados.splice(parseInt(btn.dataset.index), 1);
            updateFileListUI();
        });
    });
}

async function addFilesToList(files) {
    const validTypes = ['pdf','docx','zip'];
    let added = 0;
    for (let i = 0; i < files.length; i++) {
        const type = detectFileType(files[i]);
        if (validTypes.includes(type) &&
            !archivosDetectados.some(f => f.name === files[i].name && f.size === files[i].size)) {
            archivosDetectados.push({
                name: files[i].name,
                type: type,
                file: files[i],
                size: files[i].size
            });
            added++;
        }
    }
    if (added > 0) updateFileListUI();
}

// ─── Extracción de identidad del estudiante ───
function extractStudentIdentity(fileName, text) {
    // 1. Intentar extraer del nombre del archivo/carpeta (prioridad)
    let clean = fileName.replace(/\.(pdf|docx)$/i, '');
    clean = clean.replace(/[_\-]/g, ' ').trim();

    // 2. Buscar patrones de encabezado en el texto
    const headerPatterns = [
        /(?:estudiante|alumno|autor|presentado por|elaborado por|nombre)[:\s]+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})/i,
        /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})/m
    ];

    for (const pattern of headerPatterns) {
        const match = text.match(pattern);
        if (match && match[1] && match[1].length > 4 && match[1].length < 60) {
            return match[1].trim();
        }
    }

    // 3. Fallback: nombre del archivo
    return clean || 'Estudiante sin identificar';
}

// ─── Detección de subtítulos (penalización por romper narrativa) ───
function detectSubtitles(text) {
    const subtitlePatterns = [
        /^(?:introducci[oó]n|desarrollo|conclusi[oó]n|cap[ií]tulo|secci[oó]n|anexo|índice|resumen|abstract)\b/gim,
        /^[IVX]+\.\s+.+/gm,
        /^\d+[\.\)]\s+.+/gm,
        /^[A-ZÁÉÍÓÚÑ][^a-záéíóúñ\n]{3,}$/gm
    ];
    let count = 0;
    const lines = text.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length < 80 && trimmed.length > 3) {
            for (const pattern of subtitlePatterns) {
                if (pattern.test(trimmed)) { count++; break; }
            }
        }
    }
    return count;
}

// ─── Segmentación de los 3 temas obligatorios ───
const TOPIC_KEYWORDS = {
    beneficios: {
        name: 'Beneficios de Ley',
        keywords: ['beneficio','beneficios','ley','norma','decreto','derecho','mtpe','29381','27942','28518',
                   'remuneración','gratificación','cts','vacaciones','essalud','seguro','asignación familiar',
                   'utilidades','jornada','descanso','compensación']
    },
    acoso: {
        name: 'Acoso/Hostigamiento',
        keywords: ['acoso','hostigamiento','hostilidad','discriminación','violencia','abuso','denuncia',
                   'protección','sanción','falta grave','dignidad','integridad','psicológica','moral']
    },
    flexibilidad: {
        name: 'Flexibilidad Horaria',
        keywords: ['flexibilidad','horario','teletrabajo','remoto','jornada flexible','conciliación',
                   'vida familiar','horas','turno','presencialidad','virtual','adaptabilidad']
    }
};

function segmentTopics(text) {
    const result = {};
    for (const [key, topic] of Object.entries(TOPIC_KEYWORDS)) {
        let score = 0;
        for (const kw of topic.keywords) {
            const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            const matches = (text.match(regex) || []).length;
            score += matches;
        }
        result[key] = {
            name: topic.name,
            present: score >= 3,
            score: score
        };
    }
    return result;
}

// ─── Criterio 01: Referencias normativas explícitas del Perú (0-5 pts) ───
const NORMAS_PERU = [
    { word: 'constitución política del perú', weight: 2.0 },
    { word: 'constitución política', weight: 1.5 },
    { word: 'ley 29381', weight: 2.0 },
    { word: 'ley 27942', weight: 2.0 },
    { word: 'ley 28518', weight: 2.0 },
    { word: 'ley 29783', weight: 1.8 },
    { word: 'ley 30057', weight: 1.5 },
    { word: 'ley 30709', weight: 1.5 },
    { word: 'decreto supremo', weight: 1.5 },
    { word: 'decreto legislativo', weight: 1.5 },
    { word: 'mtpe', weight: 1.3 },
    { word: 'ministerio de trabajo', weight: 1.3 },
    { word: 'artículo', weight: 0.8 },
    { word: 'reglamento', weight: 0.7 },
    { word: 'norma', weight: 0.6 },
    { word: 'ley', weight: 0.5 },
    { word: 'derecho laboral', weight: 1.0 },
    { word: 'derechos del trabajador', weight: 1.2 }
];

function evaluateCriterio01(text) {
    let weightedScore = 0;
    const foundNorms = [];
    for (const entry of NORMAS_PERU) {
        const regex = new RegExp(entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const count = (text.match(regex) || []).length;
        if (count > 0) {
            weightedScore += count * entry.weight;
            foundNorms.push(entry.word);
        }
    }
    // Escala a 0-5
    let puntos;
    if (weightedScore >= 12)      puntos = 5;
    else if (weightedScore >= 8)  puntos = 4;
    else if (weightedScore >= 5)  puntos = 3;
    else if (weightedScore >= 2)  puntos = 2;
    else                          puntos = Math.max(0, Math.round(weightedScore));

    return { puntos, weightedScore, foundNorms };
}

// ─── Criterio 02: Casos reales peruanos con enlaces verificables (0-7 pts) ───
function evaluateCriterio02(text) {
    // Detectar enlaces verificables
    const urlPattern = /https?:\/\/[^\s\)\]>]+/gi;
    const urls = text.match(urlPattern) || [];

    // Detectar referencias a fuentes peruanas
    const fuentePatterns = [
        { pattern: /sunafil/gi, weight: 2.0 },
        { pattern: /resoluci[oó]n\s+(?:ministerial|directoral|subdirectoral|n[°º])/gi, weight: 1.8 },
        { pattern: /expediente\s+n[°º]/gi, weight: 1.5 },
        { pattern: /tribunal\s+(?:constitucional|de\s+fiscalización)/gi, weight: 1.5 },
        { pattern: /indecopi/gi, weight: 1.3 },
        { pattern: /caso\s+(?:real|peruano|nacional)/gi, weight: 1.5 },
        { pattern: /noticia/gi, weight: 0.8 },
        { pattern: /(?:el\s+comercio|la\s+rep[uú]blica|gesti[oó]n|rpp|andina)/gi, weight: 1.0 },
        { pattern: /empresa\s+(?:peruana|nacional|local)/gi, weight: 0.7 },
        { pattern: /denuncia/gi, weight: 0.8 },
        { pattern: /multa/gi, weight: 0.7 },
        { pattern: /sentencia/gi, weight: 1.3 }
    ];

    let fuenteScore = 0;
    for (const fp of fuentePatterns) {
        const count = (text.match(fp.pattern) || []).length;
        fuenteScore += count * fp.weight;
    }

    // Penalizar si no hay enlaces
    const tieneEnlaces = urls.length >= 1;
    const tieneFuentesFuertes = fuenteScore >= 4;

    let puntos;
    if (tieneEnlaces && fuenteScore >= 10)       puntos = 7;
    else if (tieneEnlaces && fuenteScore >= 6)   puntos = 6;
    else if (tieneEnlaces && fuenteScore >= 4)   puntos = 5;
    else if (tieneFuentesFuertes && !tieneEnlaces) puntos = 4;
    else if (fuenteScore >= 3)                   puntos = 3;
    else if (fuenteScore >= 1.5)                 puntos = 2;
    else                                         puntos = Math.max(0, Math.round(fuenteScore));

    return { puntos, urlsEncontrados: urls.length, fuenteScore };
}

// ─── Criterio 03: Postura ética y rol estratégico de RR.HH. (0-8 pts) ───
function evaluateCriterio03(text) {
    // Aislar bloque final de reflexión (último 30% del texto)
    const words = text.split(/\s+/);
    const reflectionStart = Math.floor(words.length * 0.7);
    const reflectionText = words.slice(reflectionStart).join(' ');

    const eticaPatterns = [
        { pattern: /ética/gi, weight: 1.5 },
        { pattern: /código\s+de\s+ética/gi, weight: 2.0 },
        { pattern: /recursos\s+humanos/gi, weight: 1.3 },
        { pattern: /rr\.?\s*hh/gi, weight: 1.3 },
        { pattern: /rrhh/gi, weight: 1.3 },
        { pattern: /postura/gi, weight: 1.0 },
        { pattern: /protocolo/gi, weight: 1.2 },
        { pattern: /capacitación/gi, weight: 1.0 },
        { pattern: /prevención/gi, weight: 1.1 },
        { pattern: /estrategia/gi, weight: 1.0 },
        { pattern: /compromiso/gi, weight: 0.9 },
        { pattern: /gestión\s+(?:humana|del\s+talento)/gi, weight: 1.4 },
        { pattern: /liderazgo/gi, weight: 0.8 },
        { pattern: /cultura\s+organizacional/gi, weight: 1.2 },
        { pattern: /clima\s+laboral/gi, weight: 1.0 },
        { pattern: /bienestar/gi, weight: 0.8 },
        { pattern: /inclusión/gi, weight: 0.8 },
        { pattern: /diversidad/gi, weight: 0.7 },
        { pattern: /responsabilidad\s+social/gi, weight: 1.0 }
    ];

    let eticaScore = 0;
    for (const ep of eticaPatterns) {
        const count = (reflectionText.match(ep.pattern) || []).length;
        eticaScore += count * ep.weight;
    }

    let puntos;
    if (eticaScore >= 14)       puntos = 8;
    else if (eticaScore >= 10)  puntos = 7;
    else if (eticaScore >= 7)   puntos = 6;
    else if (eticaScore >= 5)   puntos = 5;
    else if (eticaScore >= 3)   puntos = 4;
    else if (eticaScore >= 2)   puntos = 3;
    else if (eticaScore >= 1)   puntos = 2;
    else                        puntos = 1;

    return { puntos, eticaScore };
}

// ─── Auditoría de Bibliografía ───
function evaluateBibliografia(text) {
    // Buscar sección bibliográfica
    const biblioPatterns = [
        /(?:bibliograf[ií]a|referencias|fuentes\s+consultadas|fuentes\s+bibliogr[aá]ficas)[\s\S]*$/i
    ];

    let biblioSection = '';
    for (const bp of biblioPatterns) {
        const match = text.match(bp);
        if (match) { biblioSection = match[0]; break; }
    }

    if (!biblioSection || biblioSection.length < 20) {
        return { ok: false, tieneSeccion: false, ordenAlfabetico: false, fuentesDetectadas: 0, observacion: 'No se encontró sección bibliográfica.' };
    }

    // Extraer líneas con enlaces
    const urlPattern = /https?:\/\/[^\s\)\]>]+/gi;
    const urls = biblioSection.match(urlPattern) || [];

    // Verificar orden alfabético aproximado
    const lines = biblioSection.split('\n').filter(l => l.trim().length > 10);
    let ordenAlfabetico = true;
    let prevLine = '';
    for (const line of lines) {
        const trimmed = line.trim().toLowerCase();
        if (trimmed < prevLine && prevLine.length > 0 && trimmed.length > 5) {
            ordenAlfabetico = false;
            break;
        }
        prevLine = trimmed;
    }

    const tieneSeccion = true;
    const fuentesDetectadas = urls.length;

    let observacion = '';
    if (!ordenAlfabetico) observacion += 'La bibliografía NO está en orden alfabético. ';
    if (fuentesDetectadas < 3) observacion += 'Pocas fuentes bibliográficas (<3). ';
    if (fuentesDetectadas === 0) observacion += 'No se encontraron enlaces en la bibliografía. ';
    if (!observacion) observacion = 'Bibliografía correcta.';

    return {
        ok: ordenAlfabetico && fuentesDetectadas >= 3,
        tieneSeccion,
        ordenAlfabetico,
        fuentesDetectadas,
        observacion
    };
}

// ─── Motor de Evaluación Completo ───
function evaluateContent(fileName, text) {
    const observaciones = [];

    // 0. Identidad del estudiante
    const estudiante = extractStudentIdentity(fileName, text);

    // 1. Extensión textual (umbral 1000 palabras)
    const palabras = text.split(/\s+/).filter(w => w.length > 1).length;
    let obsExtension = '';
    if (palabras >= 1000) {
        obsExtension = '✅ ' + palabras + ' palabras — abundancia argumentativa.';
    } else if (palabras >= 700) {
        obsExtension = '⚠️ ' + palabras + ' palabras — extensión aceptable pero podría profundizar más.';
        observaciones.push('Extensión por debajo de 1000 palabras. Falta profundidad argumentativa.');
    } else {
        obsExtension = '❌ ' + palabras + ' palabras — escasez textual, falta profundidad.';
        observaciones.push('Extensión muy reducida (' + palabras + ' palabras). Demuestra falta de compromiso y profundidad.');
    }

    // 2. Penalización por subtítulos
    const subtitulos = detectSubtitles(text);
    if (subtitulos > 3) {
        observaciones.push('Se detectaron ' + subtitulos + ' subtítulos/secciones. El documento debe ser puramente narrativo sin divisiones estructurales.');
    } else if (subtitulos > 0) {
        observaciones.push('Se detectaron ' + subtitulos + ' posibles subtítulos. Se recomienda redacción narrativa continua.');
    }

    // 3. Segmentación de temas obligatorios
    const topics = segmentTopics(text);
    for (const [key, topic] of Object.entries(topics)) {
        if (!topic.present) {
            observaciones.push('Falta desarrollar el tema: ' + topic.name + '.');
        }
    }

    // 4. Criterio 01: Normativa Perú (0-5)
    const c1Result = evaluateCriterio01(text);
    if (c1Result.puntos < 3) {
        observaciones.push('C1: Referencias normativas peruanas insuficientes. Debe citar leyes específicas (N° 29381, 27942, 28518, etc.).');
    }

    // 5. Criterio 02: Casos reales con enlaces (0-7)
    const c2Result = evaluateCriterio02(text);
    if (c2Result.urlsEncontrados === 0) {
        observaciones.push('C2: NO se encontraron enlaces verificables. Obligatorio incluir URLs de SUNAFIL, noticias o resoluciones.');
    } else if (c2Result.urlsEncontrados < 2) {
        observaciones.push('C2: Solo ' + c2Result.urlsEncontrados + ' enlace(s). Se requieren múltiples fuentes verificables.');
    }
    if (c2Result.fuenteScore < 4) {
        observaciones.push('C2: Falta respaldo con casos reales peruanos (SUNAFIL, resoluciones, noticias nacionales).');
    }

    // 6. Criterio 03: Ética y RR.HH. (0-8)
    const c3Result = evaluateCriterio03(text);
    if (c3Result.puntos < 4) {
        observaciones.push('C3: La reflexión ética y el rol estratégico de RR.HH. son insuficientes. Debe proponer acciones concretas.');
    }

    // 7. Bibliografía
    const biblioResult = evaluateBibliografia(text);
    if (!biblioResult.ok) {
        observaciones.push('Bibliografía: ' + biblioResult.observacion);
    }

    const notaFinal = c1Result.puntos + c2Result.puntos + c3Result.puntos;

    return {
        estudiante,
        c1: c1Result.puntos,
        c2: c2Result.puntos,
        c3: c3Result.puntos,
        notaFinal,
        palabras,
        obsExtension,
        subtitulos,
        topics,
        biblioOk: biblioResult.ok,
        biblioDetalle: biblioResult.observacion,
        urlsEncontrados: c2Result.urlsEncontrados,
        observacion: observaciones.length > 0 ? observaciones.join(' | ') : '¡Excelente! Cumple con todos los criterios estructurales.'
    };
}

// ─── Panel de errores ───
function addError(archivo, mensaje) {
    DOM['error-panel'].classList.remove('hidden');
    const li = document.createElement('li');
    li.textContent = '[' + archivo + '] ' + mensaje;
    DOM['error-list'].appendChild(li);
}

// ─── Extracción de texto ───
async function extractTextFromPDF(file) {
    let arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + ' ';

        page.cleanup();

        DOM['status-text'].innerHTML =
            '<div style="display:flex;flex-direction:column;gap:4px;margin-top:5px;font-size:0.9em;">' +
            '<span>Leyendo: <strong>' + escapeHTML(file.name.substring(0,25)) + '...</strong></span>' +
            '<span>Página ' + i + ' de ' + pdf.numPages + '</span>' +
            '<progress value="' + i + '" max="' + pdf.numPages + '" style="width:100%;height:6px;border-radius:3px;"></progress>' +
            '</div>';
        await yieldUI();
    }

    await loadingTask.destroy();
    arrayBuffer = null;
    return fullText;
}

async function extractTextFromDOCX(file) {
    let arrayBuffer = await file.arrayBuffer();
    DOM['status-text'].innerHTML =
        '<div style="display:flex;flex-direction:column;gap:4px;margin-top:5px;font-size:0.9em;">' +
        '<span>Leyendo: <strong>' + escapeHTML(file.name.substring(0,25)) + '...</strong></span>' +
        '<span>Extrayendo documento Word...</span>' +
        '<progress style="width:100%;height:6px;border-radius:3px;"></progress>' +
        '</div>';
    await yieldUI();
    let result = await mammoth.extractRawText({ arrayBuffer });
    let text = result.value;
    arrayBuffer = null;
    result = null;
    return text;
}

async function extractFilesFromZip(zipFile) {
    let extracted = [];
    const zip = await JSZip.loadAsync(zipFile);
    const entries = Object.values(zip.files).filter(entry => !entry.dir);

    for (let i = 0; i < entries.length; i++) {
        const zipEntry = entries[i];
        const lower = zipEntry.name.toLowerCase();
        if (lower.endsWith('.pdf') || lower.endsWith('.docx')) {
            let blob = await zipEntry.async('blob');
            let file = new File([blob], zipEntry.name.split('/').pop(), {
                type: lower.endsWith('.pdf')
                    ? 'application/pdf'
                    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            extracted.push({
                name: file.name,
                type: lower.endsWith('.pdf') ? 'pdf' : 'docx',
                file: file,
                size: blob.size
            });
            blob = null;
        }
        if (i % 3 === 0) await yieldUI();
    }
    return extracted;
}

// ─── Procesamiento en Fila India ───
async function processAllFiles() {
    if (isProcessing) return;
    if (archivosDetectados.length === 0) return;

    isProcessing = true;
    abortController = new AbortController();
    const signal = abortController.signal;

    resultadosEvaluacion = [];
    DOM['table-body'].innerHTML = '';
    DOM['error-list'].innerHTML = '';
    DOM['error-panel'].classList.add('hidden');
    DOM['progress-bar'].classList.remove('hidden');
    DOM['progress-bar'].value = 0;

    DOM['loading-overlay'].classList.remove('hidden');
    DOM['btn-cancel'].classList.remove('hidden');

    try {
        let cola = [...archivosDetectados];
        let total = cola.length;
        let procesados = 0;

        while (cola.length > 0) {
            if (signal.aborted) break;

            let item = cola.shift();

            if (item.type === 'zip') {
                DOM['loading-detail'].textContent = 'Extrayendo ZIP: ' + item.name + '...';
                try {
                    let extracted = await extractFilesFromZip(item.file);
                    cola.unshift(...extracted);
                    total += extracted.length - 1;
                } catch (e) {
                    addError(item.name, 'Error al descomprimir ZIP: ' + e.message);
                }
                item.file = null;
                item = null;
                continue;
            }

            procesados++;
            DOM['loading-detail'].textContent = 'Procesando archivo ' + procesados + ' de ' + total;
            DOM['overlay-progress'].value = Math.round((procesados / total) * 100);
            DOM['overlay-percent'].textContent = Math.round((procesados / total) * 100) + '%';
            DOM['progress-bar'].value = Math.round((procesados / total) * 100);

            try {
                let text = '';
                if (item.type === 'pdf') {
                    text = await extractTextFromPDF(item.file);
                } else if (item.type === 'docx') {
                    text = await extractTextFromDOCX(item.file);
                }

                if (!text || text.trim().length < 50) {
                    addError(item.name, 'Documento vacío o ilegible (menos de 50 caracteres).');
                } else {
                    resultadosEvaluacion.push(evaluateContent(item.name, text));
                }

                text = null;
            } catch (err) {
                addError(item.name, 'Error al procesar: ' + err.message);
            }

            item.file = null;
            item = null;
            await yieldUI();
        }
    } finally {
        isProcessing = false;
        DOM['loading-overlay'].classList.add('hidden');
        DOM['progress-bar'].classList.add('hidden');

        if (resultadosEvaluacion.length > 0) {
            DOM['status-text'].textContent =
                '¡Completado! Evaluados ' + resultadosEvaluacion.length + ' de ' + archivosDetectados.length + ' archivos.';
            DOM['btn-export-pdf'].disabled = false;
            DOM['btn-export-csv'].disabled = false;
            DOM['btn-clear'].disabled = false;
            renderTable();
            saveState();
        } else {
            DOM['status-text'].textContent = 'No se pudieron evaluar archivos. Revisa el panel de errores.';
        }
    }
}

// ─── Renderizado de tabla ───
function renderTable(filterText) {
    filterText = filterText || '';
    const tbody = DOM['table-body'];
    tbody.innerHTML = '';

    let sorted = [...resultadosEvaluacion];
    if (sortColumn) {
        sorted.sort((a, b) => {
            let vA = a[sortColumn], vB = b[sortColumn];
            if (typeof vA === 'string') vA = vA.toLowerCase();
            if (typeof vB === 'string') vB = vB.toLowerCase();
            if (vA < vB) return sortDirection === 'asc' ? -1 : 1;
            if (vA > vB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    let filtrados = filterText
        ? sorted.filter(r => r.estudiante.toLowerCase().includes(filterText.toLowerCase()))
        : sorted;

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-msg">Sin resultados que mostrar.</td></tr>';
        DOM['results-count'].classList.add('hidden');
        return;
    }

    DOM['results-count'].classList.remove('hidden');
    DOM['results-count'].textContent = 'Mostrando ' + filtrados.length + ' de ' + resultadosEvaluacion.length;

    filtrados.forEach((r) => {
        const idx = resultadosEvaluacion.indexOf(r) + 1;
        const badgeClass = r.notaFinal >= 14 ? 'badge-success' : (r.notaFinal >= 11 ? 'badge-warning' : 'badge-danger');
        const biblioIcon = r.biblioOk ? '✅' : '❌';
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + idx + '</td>' +
            '<td><strong>' + escapeHTML(r.estudiante) + '</strong></td>' +
            '<td>' + r.c1 + ' / 5</td>' +
            '<td>' + r.c2 + ' / 7</td>' +
            '<td>' + r.c3 + ' / 8</td>' +
            '<td><span class="badge ' + badgeClass + '">' + r.notaFinal + ' / 20</span></td>' +
            '<td style="font-size:0.8rem;">' + r.palabras + ' pal.</td>' +
            '<td>' + biblioIcon + ' ' + r.biblioDetalle.substring(0, 30) + '</td>' +
            '<td style="font-size:0.78rem;color:#475569;">' + escapeHTML(r.observacion) + '</td>';
        tbody.appendChild(tr);
    });
}

// ─── Ordenamiento ───
function setupSortableHeaders() {
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (sortColumn === col) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = col;
                sortDirection = 'asc';
            }
            document.querySelectorAll('.sortable').forEach(h => {
                h.setAttribute('aria-sort', 'none');
                h.classList.remove('asc', 'desc');
            });
            th.setAttribute('aria-sort', sortDirection === 'asc' ? 'ascending' : 'descending');
            th.classList.add(sortDirection);
            renderTable(DOM['filter-input'].value);
        });
    });
}

// ─── Persistencia ───
function saveState() {
    try {
        const state = {
            resultadosEvaluacion,
            archivosDetectados: archivosDetectados.map(f => ({
                name: f.name, type: f.type, size: f.size
                // No guardamos el File object (no es serializable)
            }))
        };
        sessionStorage.setItem('auditorState', JSON.stringify(state));
    } catch (e) { /* sessionStorage puede fallar si está lleno */ }
}

function loadState() {
    try {
        const raw = sessionStorage.getItem('auditorState');
        if (!raw) return;
        const state = JSON.parse(raw);
        if (state.resultadosEvaluacion && state.resultadosEvaluacion.length > 0) {
            resultadosEvaluacion = state.resultadosEvaluacion;
            renderTable();
            DOM['btn-export-pdf'].disabled = false;
            DOM['btn-export-csv'].disabled = false;
            DOM['btn-clear'].disabled = false;
            DOM['status-text'].textContent =
                'Sesión restaurada: ' + resultadosEvaluacion.length + ' evaluaciones previas.';
        }
    } catch (e) { /* ignorar */ }
}

// ─── Limpieza total ───
function clearAll() {
    if (abortController) abortController.abort();
    isProcessing = false;
    resultadosEvaluacion = [];
    archivosDetectados = [];
    sortColumn = null;
    sortDirection = 'asc';

    DOM['table-body'].innerHTML = '<tr><td colspan="9" class="empty-msg">No hay datos procesados. Sube los archivos en PDF, DOCX o ZIP para iniciar.</td></tr>';
    DOM['error-list'].innerHTML = '';
    DOM['error-panel'].classList.add('hidden');
    DOM['progress-bar'].classList.add('hidden');
    DOM['btn-export-pdf'].disabled = true;
    DOM['btn-export-csv'].disabled = true;
    DOM['btn-clear'].disabled = true;
    DOM['file-input'].value = '';
    DOM['folder-input'].value = '';
    DOM['filter-input'].value = '';
    DOM['results-count'].classList.add('hidden');
    updateFileListUI();
    sessionStorage.removeItem('auditorState');
}

// ─── Exportación CSV ───
function exportCSV() {
    let csvContent = '\uFEFF'; // BOM para tildes en Excel
    csvContent += 'Estudiante,C1 Normativa(5P),C2 Casos Reales(7P),C3 Ética RRHH(8P),Nota Final,Palabras,Bibliografía,Observaciones\n';
    resultadosEvaluacion.forEach(r => {
        csvContent +=
            '"' + r.estudiante + '",' +
            r.c1 + ',' + r.c2 + ',' + r.c3 + ',' +
            r.notaFinal + ',' + r.palabras + ',' +
            '"' + (r.biblioOk ? 'Correcta' : 'Incompleta') + '",' +
            '"' + r.observacion.replace(/"/g, '""') + '"\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Reporte_Auditoria_Estructural.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ─── Exportación PDF ───
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(16);
    doc.text('Reporte de Auditoría Estructural', 14, 15);
    doc.setFontSize(10);
    doc.text('Programa de Gestión Humana y Derecho Laboral | Rúbrica Vigesimal (0-20)', 14, 22);
    doc.text('Generado: ' + new Date().toLocaleDateString('es-PE'), 14, 28);

    const tableData = resultadosEvaluacion.map((r, i) => [
        i + 1,
        r.estudiante,
        r.c1 + '/5',
        r.c2 + '/7',
        r.c3 + '/8',
        r.notaFinal + '/20',
        r.palabras + ' pal.',
        r.biblioOk ? 'Sí' : 'No',
        r.observacion.substring(0, 80)
    ]);

    doc.autoTable({
        startY: 34,
        head: [['#', 'Estudiante', 'C1 (5P)', 'C2 (7P)', 'C3 (8P)', 'Nota', 'Extensión', 'Biblio', 'Observaciones']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [0, 119, 182] },
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
            1: { cellWidth: 35 },
            8: { cellWidth: 55 }
        }
    });

    doc.save('Reporte_Auditoria_Estructural.pdf');
}

// ─── Recolección de archivos desde DataTransfer (carpetas anidadas) ───
async function collectFilesFromDataTransfer(dataTransfer) {
    const files = [];
    if (dataTransfer.items && dataTransfer.items.length > 0) {
        for (let i = 0; i < dataTransfer.items.length; i++) {
            const item = dataTransfer.items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : (item.getAsEntry ? item.getAsEntry() : null);
                if (entry) {
                    await readEntry(entry, files);
                } else {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                }
            }
        }
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
        for (let i = 0; i < dataTransfer.files.length; i++) {
            files.push(dataTransfer.files[i]);
        }
    }
    return files;
}

async function readEntry(entry, files) {
    if (entry.isFile) {
        return new Promise(resolve => {
            entry.file(file => {
                files.push(file);
                resolve();
            });
        });
    } else if (entry.isDirectory) {
        const reader = entry.createReader();
        return new Promise(resolve => {
            reader.readEntries(async entries => {
                for (const e of entries) {
                    await readEntry(e, files);
                }
                resolve();
            });
        });
    }
}

// ─── Configuración de eventos ───
function setupEvents() {
    // Drag & Drop
    const dz = DOM['drop-zone'];
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evName => {
        dz.addEventListener(evName, e => { e.preventDefault(); e.stopPropagation(); });
    });
    dz.addEventListener('dragover', () => dz.classList.add('dragover'));
    dz.addEventListener('dragleave', (e) => {
        if (!dz.contains(e.relatedTarget)) dz.classList.remove('dragover');
    });
    dz.addEventListener('drop', async (e) => {
        dz.classList.remove('dragover');
        if (isProcessing) return;
        const files = await collectFilesFromDataTransfer(e.dataTransfer);
        await addFilesToList(files);
        if (archivosDetectados.length > 0) processAllFiles();
    });

    // Input de archivos
    DOM['file-input'].addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        e.target.value = '';
        if (files.length > 0) {
            await addFilesToList(files);
            processAllFiles();
        }
    });

    // Click en dropzone
    dz.addEventListener('click', (e) => {
        if (e.target === dz || e.target.closest('.drop-zone-content')) {
            DOM['file-input'].click();
        }
    });

    // Teclado en dropzone
    dz.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            DOM['file-input'].click();
        }
    });

    // Botón de carpeta
    DOM['btn-folder'].addEventListener('click', () => DOM['folder-input'].click());
    DOM['folder-input'].addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        e.target.value = '';
        if (files.length > 0) {
            await addFilesToList(files);
            processAllFiles();
        }
    });

    // Detectar soporte de webkitdirectory
    if (!('webkitdirectory' in document.createElement('input'))) {
        DOM['btn-folder'].classList.add('hidden');
        DOM['folder-fallback-msg'].classList.remove('hidden');
    }

    // Botones
    DOM['btn-clear'].addEventListener('click', clearAll);
    DOM['btn-cancel'].addEventListener('click', () => {
        if (abortController) abortController.abort();
        isProcessing = false;
        DOM['loading-overlay'].classList.add('hidden');
    });
    DOM['btn-dismiss-errors'].addEventListener('click', () => {
        DOM['error-panel'].classList.add('hidden');
        DOM['error-list'].innerHTML = '';
    });
    DOM['btn-export-csv'].addEventListener('click', exportCSV);
    DOM['btn-export-pdf'].addEventListener('click', exportPDF);

    // Filtro
    DOM['filter-input'].addEventListener('input', () => {
        renderTable(DOM['filter-input'].value);
    });

    // Ordenamiento
    setupSortableHeaders();
}

// ─── Inicialización ───
function init() {
    cacheDOM();
    if (checkDependencies()) {
        configurePDFJS();
        setupEvents();
        loadState();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
