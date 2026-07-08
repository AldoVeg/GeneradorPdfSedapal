// Memoria caché para las imágenes Base64
var imagenes = { 1: null, 2: null, 3: null, 4: null };

// Monitor de selección y activación de miniaturas en el formulario + Vista en vivo
[1, 2, 3, 4].forEach(function (n) {
  var input = document.getElementById('foto' + n);
  var formPreview = document.getElementById('form-preview1' + n ? document.getElementById('form-preview' + n) : null);

  input.addEventListener('change', function () {
    var archivo = input.files[0];
    if (!archivo) return;

    var reader = new FileReader();
    reader.onload = function (e) {
      imagenes[n] = e.target.result;
      
      // Activar miniatura de control en el formulario web
      if(formPreview) {
        formPreview.src = e.target.result;
        formPreview.classList.add('visible');
      }
      
      // Sincronizar instantáneamente con el monitor en vivo a la derecha (Muestra Pág 1)
      var liveFoto = document.getElementById('live-foto' + n);
      if (liveFoto) {
        liveFoto.src = e.target.result;
      }
    };
    reader.readAsDataURL(archivo);
  });
});

// Transforma la fecha nativa al estándar peruano con puntos
function formatearFecha(valor) {
  if (!valor) return '';
  var partes = valor.split('-');
  return partes[2] + '.' + partes[1] + '.' + partes[0];
}

function tituloHTML(valor, texto) {
  if (valor === 'instituciones') {
    return 'VISITAS DE INSTITUCIÓN<br>EDUCATIVA A LA PLANTA';
  }
  return (texto || '').toUpperCase();
}

// FILTRO DE BLINDAJE COMPLETO: Extrae de forma estricta el nombre propio para el archivo
function obtenerNombreCorto(nombreCompleto) {
  var texto = nombreCompleto.toUpperCase();

  // Expresión regular robustecida contra prefijos genéricos institucionales y educativos
  var patronPrefijos = /^(INSTITUCIÃ“N EDUCATIVA|INSTITUCION EDUCATIVA|I\.E\.P\.|I\.E\.|UNIVERSIDAD|COLEGIO|IEP|IE|ASOCIACIÃ“N|ASOCIACION|COMUNIDAD|COPRODELI|C\.E\.)\s+/i;
  texto = texto.replace(patronPrefijos, '');
  
  // Limpieza absoluta de símbolos dejando caracteres alfanuméricos puros
  texto = texto.replace(/[^A-Z0-9ÃÃ‰ÃÃ“ÃšÃ‘\s]/g, '');
  return texto.trim().replace(/\s+/g, '_');
}

// FUNCIÓN MATRIZ: Ajusta fluidamente la escala de la fuente para impedir desbordes
function ajustarFuenteAdaptativa(elementoId, tamañoMaximoBase) {
  var el = document.getElementById(elementoId);
  if (!el) return;
  
  // Reseteamos al tamaño base original antes del cálculo
  el.style.fontSize = tamañoMaximoBase + 'px';
  
  var anchoContenedor = el.parentElement.clientWidth || 682; // Ancho útil de impresión
  var anchoTexto = el.scrollWidth;
  
  // Si el texto intenta desbordar la fila, calculamos la tasa proporcional de reducción
  if (anchoTexto > anchoContenedor) {
    var nuevoTamaño = Math.floor((anchoContenedor / anchoTexto) * tamañoMaximoBase);
    // Margen de seguridad para evitar que baje a un tamaño ilegible
    if (nuevoTamaño < 14) nuevoTamaño = 14; 
    el.style.fontSize = nuevoTamaño + 'px';
  }
}

// EVENTO DE ESCUCHA EN TIEMPO REAL: Sincroniza e inyecta datos en el panel de la derecha
function actualizarVistaPreviaEnVivo() {
  var tipoEventoCombo = document.getElementById('tipoEvento');
  var tipoTexto = tipoEventoCombo.selectedIndex > 0 ? tipoEventoCombo.options[tipoEventoCombo.selectedIndex].text : 'TIPO DE EVENTO';
  var institucion = document.getElementById('institucion').value.trim();
  var distrito = document.getElementById('distrito').value.trim();
  var fechaRaw = document.getElementById('fecha').value;

  var textoTitulo = tituloHTML(tipoEventoCombo.value, tipoTexto);
  var textoSubtitulo = ((institucion ? institucion : 'NOMBRE DE INSTITUCIÓN') + (distrito ? ' – ' + distrito : '')).toUpperCase();
  var textoFecha = fechaRaw ? formatearFecha(fechaRaw) : 'DD.MM.AAAA';

  document.getElementById('live-titulo').innerHTML = textoTitulo;
  document.getElementById('live-institucion').textContent = textoSubtitulo;
  document.getElementById('live-fecha').textContent = textoFecha;
}

// Registro de eventos en tiempo real para el panel interactivo
document.getElementById('tipoEvento').addEventListener('change', actualizarVistaPreviaEnVivo);
document.getElementById('institucion').addEventListener('input', actualizarVistaPreviaEnVivo);
document.getElementById('distrito').addEventListener('input', actualizarVistaPreviaEnVivo);
document.getElementById('fecha').addEventListener('change', actualizarVistaPreviaEnVivo);

// PROCESADOR Y COMPILADOR GENERAL DEL PDF
function generarPDF() {
  var tipoEvento = document.getElementById('tipoEvento').value;
  var comboTipoEvento = document.getElementById('tipoEvento');
  
  if (!tipoEvento) {
    alert('Por favor selecciona un tipo de evento.');
    return;
  }

  var tipoEventoTexto = comboTipoEvento.options[comboTipoEvento.selectedIndex].text;
  var institucion     = document.getElementById('institucion').value.trim();
  var distrito        = document.getElementById('distrito').value.trim();
  var fecha           = formatearFecha(document.getElementById('fecha').value);

  if (!institucion || !distrito || !fecha) {
    alert('Por favor completa todos los datos del evento y ubicación.');
    return;
  }
  if (!imagenes[1] || !imagenes[2] || !imagenes[3] || !imagenes[4]) {
    alert('Por favor selecciona las 4 fotos.');
    return;
  }

  var titulo = tituloHTML(tipoEvento, tipoEventoTexto);
  var subtituloFormateado = (institucion + ' – ' + distrito).toUpperCase();

  // Inyección física en los nodos ocultos del PDF
  document.getElementById('pdf-titulo-1').innerHTML = titulo;
  document.getElementById('pdf-institucion-1').textContent = subtituloFormateado;
  document.getElementById('pdf-fecha-1').textContent = fecha;
  document.getElementById('pdf-foto-1').src = imagenes[1];
  document.getElementById('pdf-foto-2').src = imagenes[2];

  document.getElementById('pdf-titulo-2').innerHTML = titulo;
  document.getElementById('pdf-institucion-2').textContent = subtituloFormateado;
  document.getElementById('pdf-fecha-2').textContent = fecha;
  document.getElementById('pdf-foto-3').src = imagenes[3];
  document.getElementById('pdf-foto-4').src = imagenes[4];

  // Visualizar la plantilla temporalmente para realizar el cálculo de caja métrica real
  var template = document.getElementById('pdf-template');
  template.style.cssText = 'display:block; position:fixed; top:0; left:0; z-index:9999;';

  // EJECUCIÓN CRÍTICA: Escalar dinámicamente las fuentes en ambas hojas antes de la captura
  ajustarFuenteAdaptativa('pdf-institucion-1', 25);
  ajustarFuenteAdaptativa('pdf-institucion-2', 25);

  var paginas = Array.from(document.querySelectorAll('.pdf-pagina'));
  var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  function capturarPagina(index) {
    if (index >= paginas.length) {
      var nombreCorto = obtenerNombreCorto(institucion);
      var nombreFinalArchivo = 'F-(' + fecha + ')-' + nombreCorto + '.pdf';
      
      doc.save(nombreFinalArchivo);
      template.style.cssText = 'display:none;';
      return;
    }

    html2canvas(paginas[index], {
      scale: 2,
      useCORS: true,
      logging: false,
      width: 794,
      height: 1123
    }).then(function (canvas) {
      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      if (index > 0) doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      capturarPagina(index + 1);
    });
  }

  capturarPagina(0);
}

document.querySelector('.btn-generar').addEventListener('click', generarPDF);
