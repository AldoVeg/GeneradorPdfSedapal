document.addEventListener('DOMContentLoaded', function() {
  
  // 1. Memoria caché para imágenes
  var imagenes = { 1: null, 2: null, 3: null, 4: null };

  // 2. Diccionario de Subcategorías (Sincronización exacta con los 'value' del HTML)
  var subCategoriasPorEvento = {
    "VISITA_IE": ["INSTITUCIÓN EDUCATIVA", "COLEGIO"],
    "VISITA_ADULTOS": ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA"],
    "TALLER_IE": ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "INSTITUTO", "INSTITUCIÓN EDUCATIVA", "COLEGIO", "CEBA", "INICIAL", "NIDO"],
    "TALLER_EMPRESAS": ["SEDAPAL", "MUNICIPALIDAD", "UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "CENTRO COMERCIAL", "MERCADO", "URBANIZACIÓN", "ASOCIACIÓN", "A.H."]
  };

  // 3. Captura segura de Elementos del DOM
  var tipoEvento = document.getElementById('tipoEvento');
  var comboSub = document.getElementById('subCategoria');
  var inputInstitucion = document.getElementById('institucion');
  var inputDistrito = document.getElementById('distrito');
  var inputFecha = document.getElementById('fecha');
  var btnGenerar = document.querySelector('.btn-generar');

  // 4. Forzar mayúsculas en caliente (Blindaje visual)
  if (inputInstitucion) {
    inputInstitucion.addEventListener('input', function() {
      this.value = this.value.toUpperCase();
    });
  }
  if (inputDistrito) {
    inputDistrito.addEventListener('input', function() {
      this.value = this.value.toUpperCase();
    });
  }

  // 5. Escuchador de Tipo de Evento (El motor del combo dependiente)
  if (tipoEvento) {
    tipoEvento.addEventListener('change', function () {
      var tipo = this.value;
      
      // Control de existencia para evitar errores
      if (!comboSub || !inputInstitucion) return;

      // Reset reactivo
      comboSub.innerHTML = '<option value="" disabled selected>-- Tipo --</option>';
      inputInstitucion.value = '';

      if (tipo && subCategoriasPorEvento[tipo]) {
        comboSub.disabled = false;
        inputInstitucion.disabled = false;
        inputInstitucion.placeholder = "Escribe el nombre aquí...";

        subCategoriasPorEvento[tipo].forEach(function (opcion) {
          var opt = document.createElement('option');
          opt.value = opcion;
          opt.textContent = opcion;
          comboSub.appendChild(opt);
        });
      } else {
        comboSub.disabled = true;
        inputInstitucion.disabled = true;
        inputInstitucion.placeholder = "Selecciona tipo de evento primero";
      }
    });
  }

  // 6. Escuchador seguro para Fotos
  [1, 2, 3, 4].forEach(function (n) {
    var input = document.getElementById('foto' + n);
    var formPreview = document.getElementById('form-preview' + n);

    if (input) {
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
    }
  });

  // 7. Funciones de Procesamiento Interno
  function formatearFecha(valor) {
    if (!valor) return '';
    var partes = valor.split('-');
    return partes[2] + '.' + partes[1] + '.' + partes[0];
  }

  function obtenerTituloPDF(valor) {
    if (valor === 'VISITA_IE') return 'VISITA DE INSTITUCIÓN<br>EDUCATIVA A LA PLANTA';
    if (valor === 'VISITA_ADULTOS') return 'VISITA DE ADULTOS A LA PLANTA';
    if (valor === 'TALLER_IE') return 'TALLER A INSTITUCIONES<br>EDUCATIVAS';
    if (valor === 'TALLER_EMPRESAS') return 'TALLER A EMPRESAS';
    return '';
  }

  function obtenerNombreCorto(nombreCompleto, subCategoriaSeleccionada) {
    var texto = nombreCompleto.toUpperCase().trim();
    var sub = (subCategoriaSeleccionada || '').toUpperCase().trim();
    
    texto = texto.replace(/[^A-Z0-9\s-_]/g, '');
    var resultado = '';
    
    if (sub === 'SEDAPAL') {
      var textoLimpio = texto.replace(/\bSEDAPAL\b/gi, '').trim();
      if (textoLimpio === '') {
        resultado = 'SEDAPAL';
      } else {
        resultado = 'SEDAPAL_' + textoLimpio.replace(/\s+/g, '_');
      }
    } else {
      resultado = sub + '_' + texto.replace(/\s+/g, '_');
    }
    
    return resultado.replace(/_+/g, '_').replace(/-+/g, '-');
  }

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

  // 8. Generación del PDF
  function generarPDF() {
    if (!tipoEvento || !comboSub || !inputInstitucion || !inputDistrito || !inputFecha) return;

    var tipoVal = tipoEvento.value;
    if (!tipoVal) {
      alert('Por favor selecciona un tipo de evento.');
      return;
    }
    if (!comboSub.value) {
      alert('Por favor selecciona el tipo de institución o entidad.');
      return;
    }

    var subCategoriaTexto = comboSub.value;
    var nombreInstitucion = inputInstitucion.value.trim().toUpperCase();
    var distrito          = inputDistrito.value.trim().toUpperCase();
    var fecha             = formatearFecha(inputFecha.value);

    if (!nombreInstitucion || !distrito || !fecha) {
      alert('Por favor completa todos los datos del evento y ubicación.');
      return;
    }
    if (!imagenes[1] || !imagenes[2] || !imagenes[3] || !imagenes[4]) {
      alert('Por favor selecciona las 4 fotos.');
      return;
    }

    var titulo = obtenerTituloPDF(tipoVal);
    var subtituloFormateado = (subCategoriaTexto + ' ' + nombreInstitucion + ' – ' + distrito).toUpperCase();

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

    var template = document.getElementById('pdf-template');
    template.style.cssText = 'display:block; position:fixed; top:0; left:0; z-index:9999;';

    ajustarFuenteAdaptativa('pdf-institucion-1', 25);
    ajustarFuenteAdaptativa('pdf-institucion-2', 25);

    var paginas = Array.from(document.querySelectorAll('.pdf-pagina'));
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    function capturarPagina(index) {
      if (index >= paginas.length) {
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

  // 9. Asignar Evento al Botón Generar
  if (btnGenerar) {
    btnGenerar.addEventListener('click', generarPDF);
  }

});
