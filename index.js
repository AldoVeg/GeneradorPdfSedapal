document.addEventListener('DOMContentLoaded', function() {
  
  // 1. Memoria caché para imágenes
  var imagenes = { 1: null, 2: null, 3: null, 4: null };

  // 2. Diccionario de Subcategorías reorganizado
  var subCategoriasPorEvento = {
    "VISITA_IE": ["INSTITUCIÓN EDUCATIVA", "COLEGIO"],
    "VISITA_ADULTOS": ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA"],
    "TALLER_IE": ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "INSTITUTO", "INSTITUCIÓN EDUCATIVA", "COLEGIO", "CEBA", "INICIAL", "NIDO"],
    "TALLER_EMPRESAS": ["SEDAPAL", "MUNICIPALIDAD", "UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "CENTRO COMERCIAL"],
    "TALLER_COMUNIDAD": ["MERCADO", "URBANIZACIÓN", "ASOCIACIÓN", "A.H."]
  };

  // 3. Captura segura de Elementos del DOM
  var tipoEvento = document.getElementById('tipoEvento');
  var comboSub = document.getElementById('subCategoria');
  var inputInstitucion = document.getElementById('institucion');
  var inputDistrito = document.getElementById('distrito');
  var inputFecha = document.getElementById('fecha');
  var btnGenerar = document.getElementById('btnGenerar');

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

  // Aporte de fluidez UX: Auto-enfocar el cuadro de texto al seleccionar subcategoría
  if (comboSub && inputInstitucion) {
    comboSub.addEventListener('change', function() {
      inputInstitucion.focus();
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
    if (valor === 'TALLER_COMUNIDAD') return 'TALLER A LA<br>COMUNIDAD';
    return '';
  }

  // NUEVO: Limpia todo prefijo y usa estrictamente el texto libre ingresado.
  function obtenerNombreCortoArchivo(nombreIngresado) {
    var texto = nombreIngresado.toUpperCase().trim();
    // Limpia caracteres raros dejando solo letras, números, espacios y guiones
    texto = texto.replace(/[^A-Z0-9\s-_]/g, '');
    // Reemplaza los espacios en blanco por guiones bajos
    return texto.replace(/\s+/g, '_').replace(/_+/g, '_').replace(/-+/g, '-');
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

    // Aporte de fluidez UX: Bloquear botón para evitar clics múltiples durante la generación
    var originalBtnText = btnGenerar.textContent;
    btnGenerar.textContent = 'Generando PDF... Espere';
    btnGenerar.disabled = true;

    var titulo = obtenerTituloPDF(tipoVal);
    // El subtitulo visual dentro del PDF sí lleva la subcategoría
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
        
        // AQUÍ SE CUMPLE LA REGLA: Nombre de archivo puramente con el texto libre.
        var nombreCortoLimpio = obtenerNombreCortoArchivo(nombreInstitucion);
        var nombreFinalArchivo = 'F-(' + fecha + ')-' + nombreCortoLimpio + '.pdf';
        
        doc.save(nombreFinalArchivo);
        template.style.cssText = 'display:none;'; 
        
        // Restaurar estado del botón
        btnGenerar.textContent = originalBtnText;
        btnGenerar.disabled = false;
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
      }).catch(function(error) {
        alert("Ocurrió un error procesando el PDF. Revisa las imágenes.");
        btnGenerar.textContent = originalBtnText;
        btnGenerar.disabled = false;
        template.style.cssText = 'display:none;'; 
      });
    }

    // Iniciar captura asíncrona pero con un ligero delay para asegurar redibujado de la vista (UX celular)
    setTimeout(function() {
      capturarPagina(0);
    }, 100);
  }

  // 9. Asignar Evento al Botón Generar
  if (btnGenerar) {
    btnGenerar.addEventListener('click', generarPDF);
  }

});
