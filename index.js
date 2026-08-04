/* ═══════════════════════════════════════════════
   index.js — MOTOR INTEGRADO DE REPORTES PDF (SEDAPAL)
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Validar carga de motores externos
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      var errBanner = document.getElementById('cdn-error');
      if (errBanner) errBanner.classList.remove('hidden');
      return;
    }

    // Mapeo unificado del DOM
    var DOM = {
      tipoEvento:       document.getElementById('tipoEvento'),
      comboSub:          document.getElementById('subCategoria'),
      inputInstitucion: document.getElementById('institucion'),
      inputDistrito:    document.getElementById('distrito'),
      inputFecha:       document.getElementById('fecha'),
      btnGenerar:       document.getElementById('btnGenerar'),
      overlay:          document.getElementById('loading-overlay'),
      loadingText:      document.getElementById('loading-text'),
      progressBar:      document.getElementById('progress-bar'),
      template:         document.getElementById('pdf-template'),
      offscreenCanvas:  document.getElementById('offscreen-canvas')
    };

    var imagenesComprimidas = { 1: null, 2: null, 3: null, 4: null };
    var isGenerating = false;

    // 1. DICCIONARIO DE ESTRUCTURA INSTITUCIONAL (Reglas de Negocio)
    var subCategoriasPorEvento = {
      "VISITA_IE":        ["INSTITUCIÓN EDUCATIVA", "COLEGIO"],
      "VISITA_ADULTOS":   ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA"],
      "TALLER_IE":        ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "INSTITUTO", "INSTITUCIÓN EDUCATIVA", "COLEGIO", "CEBA", "INICIAL", "NIDO"],
      "TALLER_EMPRESAS":  ["SEDAPAL", "UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "CENTRO COMERCIAL"],
      "TALLER_COMUNIDAD": ["MUNICIPALIDAD", "MERCADO", "URBANIZACIÓN", "ASOCIACIÓN", "A.H."],
      "TALLER_VIRTUAL":   ["MUNICIPALIDAD", "INSTITUCIÓN", "EMPRESA", "UNIVERSIDAD", "LIBRE"]
    };

    var COMPRESS_WIDTH   = 1600;
    var COMPRESS_HEIGHT  = 1200;
    var COMPRESS_QUALITY = 0.85;

    // 2. LOGICA DE SUB-CATEGORÍAS DINÁMICAS
    if (DOM.tipoEvento) {
      DOM.tipoEvento.addEventListener('change', function () {
        var tipo = this.value;
        DOM.comboSub.innerHTML = '<option value="" disabled selected>-- Tipo --</option>';
        DOM.inputInstitucion.value = '';

        if (tipo && subCategoriasPorEvento[tipo]) {
          DOM.comboSub.disabled = false;
          DOM.inputInstitucion.disabled = false;
          DOM.inputInstitucion.placeholder = "Escribe el nombre aquí...";
          
          subCategoriasPorEvento[tipo].forEach(function (opcion) {
            var opt = document.createElement('option');
            opt.value = opcion;
            opt.textContent = opcion;
            DOM.comboSub.appendChild(opt);
          });
        } else {
          DOM.comboSub.disabled = true;
          DOM.inputInstitucion.disabled = true;
          DOM.inputInstitucion.placeholder = "Selecciona tipo de evento primero";
        }
        evaluarEstadoBoton();
      });
    }

    // Auto-formato Mayúsculas y Validaciones
    ['inputInstitucion', 'inputDistrito'].forEach(function (key) {
      if (DOM[key]) {
        DOM[key].addEventListener('input', function () {
          this.value = this.value.toUpperCase();
          evaluarEstadoBoton();
        });
      }
    });

    if (DOM.comboSub) DOM.comboSub.addEventListener('change', evaluarEstadoBoton);
    if (DOM.inputFecha) DOM.inputFecha.addEventListener('change', evaluarEstadoBoton);

    // 3. PROCESAMIENTO Y COMPRESIÓN DE FOTOS
    [1, 2, 3, 4].forEach(function (n) {
      var input = document.getElementById('foto' + n);
      var preview = document.getElementById('form-preview' + n);
      
      if (input) {
        input.addEventListener('change', function () {
          var archivo = input.files[0];
          if (!archivo) return;

          showLoader('Procesando imagen ' + n + '...', false);
          var reader = new FileReader();
          
          reader.onload = function (e) {
            comprimirImagen(e.target.result, n).then(function (compUrl) {
              if (preview) {
                preview.src = compUrl;
                preview.style.display = 'block';
              }
              hideLoader();
              evaluarEstadoBoton();
            });
          };
          reader.readAsDataURL(archivo);
        });
      }
    });

    function evaluarEstadoBoton() {
      var ok = DOM.tipoEvento.value && 
               DOM.comboSub.value && 
               DOM.inputInstitucion.value.trim() && 
               DOM.inputDistrito.value.trim() && 
               DOM.inputFecha.value && 
               imagenesComprimidas[1] && 
               imagenesComprimidas[2] && 
               imagenesComprimidas[3] && 
               imagenesComprimidas[4];

      DOM.btnGenerar.disabled = !ok;
    }

    function comprimirImagen(dataURL, slot) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          var canvas = DOM.offscreenCanvas;
          if (!canvas) { resolve(dataURL); return; }
          var ctx = canvas.getContext('2d');
          var w = img.width;
          var h = img.height;
          var ratio = Math.min(COMPRESS_WIDTH / w, COMPRESS_HEIGHT / h, 1);
          
          canvas.width  = Math.round(w * ratio);
          canvas.height = Math.round(h * ratio);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          var compressed = canvas.toDataURL('image/jpeg', COMPRESS_QUALITY);
          imagenesComprimidas[slot] = compressed;
          resolve(compressed);
        };
        img.onerror = function () {
          imagenesComprimidas[slot] = dataURL;
          resolve(dataURL);
        };
        img.src = dataURL;
      });
    }

    // 4. TIPOGRAFÍA ADAPTATIVA (Ajuste a contenedor)
    function ajustarFuenteAdaptativa(elementoId, tamanoMaximoBase, forzarUnaFila) {
      var el = document.getElementById(elementoId);
      if (!el) return;
      el.style.whiteSpace = forzarUnaFila ? 'nowrap' : 'normal';
      el.style.fontSize = tamanoMaximoBase + 'px';
      
      var anchoContenedor = 682; 
      var anchoTexto = el.scrollWidth;
      
      if (anchoTexto > anchoContenedor) {
        var nuevoTamano = Math.floor((anchoContenedor / anchoTexto) * tamanoMaximoBase);
        if (nuevoTamano < 14) nuevoTamano = 14;
        el.style.fontSize = nuevoTamano + 'px';
      }
    }

    // 5. COMPILACIÓN Y RENDERIZADO DEL PDF
    function generarPDF() {
      if (isGenerating) return;
      isGenerating = true;
      showLoader('Generando documento PDF...', true);

      var tipoVal = DOM.tipoEvento.value;
      var subCategoriaTexto = DOM.comboSub.value;
      var nombreInstitucion = DOM.inputInstitucion.value.trim().toUpperCase();
      var distrito          = DOM.inputDistrito.value.trim().toUpperCase();
      
      var partesFecha = DOM.inputFecha.value.split('-');
      var fechaFormateada = partesFecha[2] + '.' + partesFecha[1] + '.' + partesFecha[0];

      // Formato de Título
      var tituloHtml = '';
      if (tipoVal === 'VISITA_IE')         tituloHtml = 'VISITA DE INSTITUCIÓN<br>EDUCATIVA A LA PLANTA';
      else if (tipoVal === 'VISITA_ADULTOS')   tituloHtml = 'VISITA DE ADULTOS A LA PLANTA';
      else if (tipoVal === 'TALLER_IE')        tituloHtml = 'TALLER A INSTITUCIONES EDUCATIVAS';
      else if (tipoVal === 'TALLER_EMPRESAS')  tituloHtml = 'TALLER A EMPRESAS';
      else if (tipoVal === 'TALLER_COMUNIDAD') tituloHtml = 'TALLER A LA COMUNIDAD';
      else if (tipoVal === 'TALLER_VIRTUAL')   tituloHtml = 'TALLER VIRTUAL';

      // Control de la Opción "LIBRE" (sin prefijo indeseado)
      var prefijoSubcategoria = (subCategoriaTexto === 'LIBRE') ? '' : (subCategoriaTexto + ' ');
      var subtituloTexto = (prefijoSubcategoria + nombreInstitucion + ' – ' + distrito).toUpperCase();

      // Inyección en la plantilla HTML
      [1, 2].forEach(function (i) {
        document.getElementById('pdf-titulo-' + i).innerHTML = tituloHtml;
        document.getElementById('pdf-institucion-' + i).textContent = subtituloTexto;
        document.getElementById('pdf-fecha-' + i).textContent = fechaFormateada;
      });

      // Asignar imágenes cargadas
      document.getElementById('pdf-foto-1').src = imagenesComprimidas[1];
      document.getElementById('pdf-foto-2').src = imagenesComprimidas[2];
      document.getElementById('pdf-foto-3').src = imagenesComprimidas[3];
      document.getElementById('pdf-foto-4').src = imagenesComprimidas[4];

      // Reajustes de diseño adaptativo
      var forzarUnaFila = (tipoVal !== 'VISITA_IE');
      ajustarFuenteAdaptativa('pdf-titulo-1', 34, forzarUnaFila);
      ajustarFuenteAdaptativa('pdf-titulo-2', 34, forzarUnaFila);
      ajustarFuenteAdaptativa('pdf-institucion-1', 24, true);
      ajustarFuenteAdaptativa('pdf-institucion-2', 24, true);

      // Posicionamiento para captura de html2canvas
      DOM.template.style.cssText = 'position:fixed; left:0; top:0; z-index:99999; visibility:visible; background:#fff;';

      var paginas = Array.from(DOM.template.querySelectorAll('.pdf-pagina'));
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      function procesarPagina(index) {
        if (index >= paginas.length) {
          var limpio = nombreInstitucion.replace(/[^A-Z0-9\s\-_]/g, '').replace(/\s+/g, '_');
          var nombreArchivo = 'F-(' + fechaFormateada + ')-' + (limpio || 'INFORME') + '.pdf';
          
          doc.save(nombreArchivo);
          DOM.template.style.cssText = 'position:fixed; left:-9999px; top:-9999px; visibility:hidden;';
          isGenerating = false;
          hideLoader();
          showToast('¡PDF generado exitosamente!', 'success');
          return;
        }

        DOM.loadingText.textContent = 'Procesando página ' + (index + 1) + ' de ' + paginas.length + '...';
        updateProgress(index, paginas.length);

        html2canvas(paginas[index], {
          scale: 2,
          useCORS: true,
          logging: false,
          width: 794,
          height: 1123,
          backgroundColor: '#ffffff'
        }).then(function (canvas) {
          var imgData = canvas.toDataURL('image/jpeg', 0.95);
          if (index > 0) doc.addPage();
          doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
          procesarPagina(index + 1);
        }).catch(function (err) {
          console.error(err);
          DOM.template.style.cssText = 'position:fixed; left:-9999px; top:-9999px; visibility:hidden;';
          isGenerating = false;
          hideLoader();
          showToast('Error de renderizado visual al capturar la plantilla.', 'error');
        });
      }

      setTimeout(function () {
        procesarPagina(0);
      }, 300);
    }

    if (DOM.btnGenerar) {
      DOM.btnGenerar.addEventListener('click', generarPDF);
    }

    // Métodos auxiliares de UI
    function showToast(msg, type) {
      var container = document.getElementById('toast-container');
      if (!container) return;
      var toast = document.createElement('div');
      toast.className = 'toast toast-' + (type || 'error');
      toast.textContent = msg;
      container.appendChild(toast);
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
    }

    function showLoader(msg, withProgress) {
      if (!DOM.overlay) return;
      DOM.loadingText.textContent = msg;
      DOM.overlay.classList.remove('hidden');
      if (withProgress) DOM.progressBar.classList.remove('hidden');
    }

    function updateProgress(curr, tot) {
      if (DOM.progressBar) DOM.progressBar.value = Math.round((curr / tot) * 100);
    }

    function hideLoader() {
      if (DOM.overlay) DOM.overlay.classList.add('hidden');
    }
  }
})();
