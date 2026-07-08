// Almacena las imágenes en base64 de manera interna en memoria RAM
var imagenes = { 1: null, 2: null, 3: null, 4: null };

// Procesamiento y guardado silencioso de archivos (Sin previsualizaciones web)
[1, 2, 3, 4].forEach(function (n) {
  var input = document.getElementById('foto' + n);

  input.addEventListener('change', function () {
    var archivo = input.files[0];
    if (!archivo) return;

    var reader = new FileReader();
    reader.onload = function (e) {
      imagenes[n] = e.target.result;
    };
    reader.readAsDataURL(archivo);
  });
});

// Formatea fecha de YYYY-MM-DD a DD.MM.YYYY
function formatearFecha(valor) {
  if (!valor) return '';
  var partes = valor.split('-');
  return partes[2] + '.' + partes[1] + '.' + partes[0];
}

// Devuelve el HTML del título en mayúsculas según tipo de evento
function tituloHTML(valor, texto) {
  if (valor === 'instituciones') {
    return 'VISITAS DE INSTITUCIÓN<br>EDUCATIVA A LA PLANTA';
  }
  return texto.toUpperCase(); // Asegura mayúsculas en el texto libre del combo
}

// Algoritmo de limpieza para obtener el nombre corto de la institución (Sin prefijos genéricos)
function obtenerNombreCorto(nombreCompleto) {
  var texto = nombreCompleto.toUpperCase();

  // Remueve palabras iniciales de tipo de entidad comunes en Perú
  texto = texto.replace(/^(INSTITUCIÃ“N EDUCATIVA|INSTITUCION EDUCATIVA|I\.E\.P\.|I\.E\.|UNIVERSIDAD|COLEGIO|IEP|IE)\s+/i, '');
  
  // Elimina caracteres especiales y deja solo alfanuméricos y espacios
  texto = texto.replace(/[^A-Z0-9ÃÃ‰ÃÃ“ÃšÃ‘\s]/g, '');
  
  // Reemplaza espacios por guiones bajos para asegurar compatibilidad de descarga en celulares
  return texto.trim().replace(/\s+/g, '_');
}

// Genera el PDF capturando las vistas del DOM de manera secuencial y asíncrona
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

  // Validación de campos
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

  // Carga de datos dinámicos en la plantilla oculta de la Página 1
  document.getElementById('pdf-titulo-1').innerHTML = titulo;
  document.getElementById('pdf-institucion-1').textContent = subtituloFormateado;
  document.getElementById('pdf-fecha-1').textContent = fecha;
  document.getElementById('pdf-foto-1').src = imagenes[1];
  document.getElementById('pdf-foto-2').src = imagenes[2];

  // Carga de datos dinámicos en la plantilla oculta de la Página 2
  document.getElementById('pdf-titulo-2').innerHTML = titulo;
  document.getElementById('pdf-institucion-2').textContent = subtituloFormateado;
  document.getElementById('pdf-fecha-2').textContent = fecha;
  document.getElementById('pdf-foto-3').src = imagenes[3];
  document.getElementById('pdf-foto-4').src = imagenes[4];

  // Activación e inmovilización temporal de la hoja base para evitar saltos o recortes de html2canvas
  var template = document.getElementById('pdf-template');
  template.style.cssText = 'display:block; position:fixed; top:0; left:0; z-index:9999;';

  var paginas = Array.from(document.querySelectorAll('.pdf-pagina'));
  var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  function capturarPagina(index) {
    if (index >= paginas.length) {
      // Aplicación de nomenclatura estructurada automatizada
      var nombreCorto = obtenerNombreCorto(institucion);
      var nombreFinalArchivo = 'F-(' + fecha + ')-' + nombreCorto + '.pdf';
      
      // Guardado final y restauración de pantalla
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

// Vinculación segura de desencadenamiento de guardado
document.querySelector('.btn-generar').addEventListener('click', generarPDF);
