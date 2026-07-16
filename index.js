// Memoria en caché interna para almacenar las imágenes en Base64
var imagenes = { 1: null, 2: null, 3: null, 4: null };

// Opciones dinámicas ordenadas meticulosamente por rango de relevancia y jerarquía
var subCategoriasPorEvento = {
  visita_ie: ["INSTITUCIÓN EDUCATIVA", "COLEGIO"],
  visita_adultos: ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA"],
  taller_ie: ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "INSTITUTO", "INSTITUCIÓN EDUCATIVA", "COLEGIO", "CEBA", "INICIAL", "NIDO"],
  taller_empresas: ["SEDAPAL", "MUNICIPALIDAD", "UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "CENTRO COMERCIAL", "MERCADO", "URBANIZACIÓN", "ASOCIACIÓN", "A.H."]
};

// Escuchador dinámico para controlar el intercambio de subcategorías en la misma fila
document.getElementById('tipoEvento').addEventListener('change', function () {
  var tipo = this.value;
  var comboSub = document.getElementById('subCategoria');
  var inputNombre = document.getElementById('institucion');
  
  // Limpieza total del combo dependiente
  comboSub.innerHTML = '<option value="" disabled selected>-- Selecciona Tipo --</option>';
  comboSub.disabled = false;
  
  // Habilitar cuadro de texto para el nombre propio
  inputNombre.disabled = false;
  inputNombre.placeholder = "Escribe el nombre aquí...";

  // Inyección selectiva de opciones correspondientes en mayúsculas
  if (subCategoriasPorEvento[tipo]) {
    subCategoriasPorEvento[tipo].forEach(function (opcion) {
      var opt = document.createElement('option');
      opt.value = opcion; 
      opt.textContent = opcion;
      comboSub.appendChild(opt);
    });
  }
});

// Monitor de carga de archivos y actualización de miniaturas de control
[1, 2, 3, 4].forEach(function (n) {
  var input = document.getElementById('foto' + n);
  var formPreview = document.getElementById('form-preview' + n);

  input.addEventListener('change', function () {
    var archivo = input.files[0];
    if (!archivo) return;

    var reader = new FileReader();
    reader.onload = function (e) {
      imagenes[n] = e.target.result;
      if (formPreview) {
        formPreview.src = e.target.result;
        formPreview.classList.add('visible');
      }
    };
    reader.readAsDataURL(archivo);
  });
});

// Convierte la fecha del formato HTML (YYYY-MM-DD) a estándar con puntos (DD.MM.YYYY)
function formatearFecha(valor) {
  if (!valor) return '';
  var partes = valor.split('-');
  return partes[2] + '.' + partes[1] + '.' + partes[0];
}

// Devuelve las cadenas del título en SINGULAR y MAYÚSCULAS según el tipo de evento seleccionado
function tituloHTML(valor, texto) {
  if (valor === 'visita_ie') {
    return 'VISITA DE INSTITUCIÓN<br>EDUCATIVA A LA PLANTA';
  }
  if (valor === 'visita_adultos') {
    return 'VISITA DE ADULTOS A LA PLANTA';
  }
  if (valor === 'taller_ie') {
    return 'TALLER A INSTITUCIONES<br>EDUCATIVAS';
  }
  if (valor === 'taller_empresas') {
    return 'TALLER A EMPRESAS';
  }
  return (texto || '').toUpperCase();
}

// FILTRO DE BLINDAJE ABSOLUTO: Nombres limpios sin prefijos ni palabras repetidas. 
// Además, si la subcategoría es SEDAPAL, se limpia del nombre del archivo final para evitar redundancias.
function obtenerNombreCorto(nombreCompleto, subCategoriaSeleccionada) {
  var texto = nombreCompleto.toUpperCase();
  var sub = (subCategoriaSeleccionada || '').toUpperCase();
  
  if (sub === 'SEDAPAL') {
    // Si la subcategoría es SEDAPAL, removemos la palabra "SEDAPAL" si fue tipeada de nuevo en el cuadro libre
    texto = texto.replace(/\bSEDAPAL\b/gi, '');
  }
  
  // Limpieza general de caracteres extraños o tildes corruptas móviles
  texto = texto.replace(/[^A-Z0-9\s]/g, '');
  
  var resultado = texto.trim().replace(/\s+/g, '_');
  
  // Retorno de seguridad por si queda vacío
  return resultado || 'REPORTE';
}

// ALGORITMO ADAPTATIVO: Encoge la fuente del subtítulo si el texto unificado excede los límites útiles
function ajustarFuenteAdaptativa(elementoId, tamañoMaximoBase) {
  var el = document.getElementById(elementoId);
  if (!el) return;
  
  el.style.fontSize = tamañoMaximoBase + 'px';
  var anchoContenedor = el.parentElement.clientWidth || 682; 
  var anchoTexto = el.scrollWidth;
  
  if (anchoTexto > anchoContenedor) {
    var nuevoTamaño = Math.floor((anchoContenedor / anchoTexto) * tamañoMaximoBase);
    if (nuevoTamaño < 14) nuevoTamaño = 14; 
    el.style.fontSize = nuevoTamaño + 'px';
  }
}

// PROCESADOR Y COMPILADOR GENERAL DEL PDF
function generarPDF() {
  var tipoEvento = document.getElementById('tipoEvento').value;
  var comboTipoEvento = document.getElementById('tipoEvento');
  var comboSub = document.getElementById('subCategoria');
  
  if (!tipoEvento) {
    alert('Por favor selecciona un tipo de evento.');
    return;
  }
  if (!comboSub.value) {
    alert('Por favor selecciona el tipo de institución o entidad.');
    return;
  }

  var tipoEventoTexto = comboTipoEvento.options[comboTipoEvento.selectedIndex].text;
  var subCategoriaTexto = comboSub.options[comboSub.selectedIndex].text;
  var nombreInstitucion = document.getElementById('institucion').value.trim();
  var distrito          = document.getElementById('distrito').value.trim();
  var fecha             = formatearFecha(document.getElementById('fecha').value);

  if (!nombreInstitucion || !distrito || !fecha) {
    alert('Por favor completa todos los datos del evento y ubicación.');
    return;
  }
  if (!imagenes[1] || !imagenes[2] || !imagenes[3] || !imagenes[4]) {
    alert('Por favor selecciona las 4 fotos.');
    return;
  }

  var titulo = tituloHTML(tipoEvento, tipoEventoTexto);
  
  // Unificación del texto para el subtítulo impreso (Ej: SEDAPAL LA ATARJEA – EL AGUSTINO)
  var subtituloFormateado = (subCategoriaTexto + ' ' + nombreInstitucion + ' – ' + distrito).toUpperCase();

  // Carga de datos reales en la estructura oculta (Página 1)
  document.getElementById('pdf-titulo-1').innerHTML = titulo;
  document.getElementById('pdf-institucion-1').textContent = subtituloFormateado;
  document.getElementById('pdf-fecha-1').textContent = fecha;
  document.getElementById('pdf-foto-1').src = imagenes[1];
  document.getElementById('pdf-foto-2').src = imagenes[2];

  // Carga de datos reales en la estructura oculta (Página 2)
  document.getElementById('pdf-titulo-2').innerHTML = titulo;
  document.getElementById('pdf-institucion-2').textContent = subtituloFormateado;
  document.getElementById('pdf-fecha-2').textContent = fecha;
  document.getElementById('pdf-foto-3').src = imagenes[3];
  document.getElementById('pdf-foto-4').src = imagenes[4];

  var template = document.getElementById('pdf-template');
  template.style.cssText = 'display:block; position:fixed; top:0; left:0; z-index:9999;';

  // Ajuste en caliente para prevenir saltos de línea destructivos
  ajustarFuenteAdaptativa('pdf-institucion-1', 25);
  ajustarFuenteAdaptativa('pdf-institucion-2', 25);

  var paginas = Array.from(document.querySelectorAll('.pdf-pagina'));
  var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  function capturarPagina(index) {
    if (index >= paginas.length) {
      // Uso directo del nombre limpio libre de prefijos genéricos y robusto ante SEDAPAL
      var nombreCorto = obtenerNombreCorto(nombreInstitucion, subCategoriaTexto);
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
