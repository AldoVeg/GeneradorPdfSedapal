/* ═══════════════════════════════════════════════
   index.js — Generador de PDF SEDAPAL (Optimizado)
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      var errBanner = document.getElementById('cdn-error');
      if(errBanner) errBanner.classList.remove('hidden');
      return;
    }

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

    var imagenes = { 1: null, 2: null, 3: null, 4: null };
    var imagenesComprimidas = { 1: null, 2: null, 3: null, 4: null };
    var isGenerating = false;

    var subCategoriasPorEvento = {
      "VISITA_IE":        ["INSTITUCIÓN EDUCATIVA", "COLEGIO"],
      "VISITA_ADULTOS":   ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA"],
      "TALLER_IE":        ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "INSTITUTO", "INSTITUCIÓN EDUCATIVA", "COLEGIO", "CEBA", "INICIAL", "NIDO"],
      "TALLER_EMPRESAS":  ["SEDAPAL", "MUNICIPALIDAD", "UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "CENTRO COMERCIAL"],
      "TALLER_COMUNIDAD": ["MERCADO", "URBANIZACIÓN", "ASOCIACIÓN", "A.H."]
    };

    var COMPRESS_WIDTH  = 1600;
    var COMPRESS_HEIGHT = 1200;
    var COMPRESS_QUALITY = 0.85;

    // Control de UI reactiva
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

    // Convertir a mayúsculas en tiempo real e interacciones básicas
    ['inputInstitucion', 'inputDistrito'].forEach(function(key) {
      if (DOM[key]) {
        DOM[key].addEventListener('input', function() {
          this.value = this.value.toUpperCase();
          evaluarEstadoBoton();
        });
      }
    });

    if (DOM.comboSub) DOM.comboSub.addEventListener('change', evaluarEstadoBoton);
    if (DOM.inputFecha) DOM.inputFecha.addEventListener('change', evaluarEstadoBoton);

    // Lector de fotos y miniaturas
    [1, 2, 3, 4].forEach(function (n) {
      var input = document.getElementById('foto' + n);
      var preview = document.getElementById('form-preview' + n);
      if (input) {
        input.addEventListener('change', function () {
          var archivo = input.files[0];
          if (!archivo) return;

          showLoader('Procesando e indexando imagen ' + n + '...', false);
          var reader = new FileReader();
          reader.onload = function (e) {
            imagenes[n] = e.target.result;
            comprimirImagen(e.target.result, n).then(function(compUrl) {
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
      var ok = DOM.tipoEvento.value && DOM.comboSub.value && 
               DOM.inputInstitucion.value.trim() && DOM.inputDistrito.value.trim() && 
               DOM.inputFecha.value && imagenesComprimidas[1] && 
               imagenesComprimidas[2] && imagenesComprimidas[3] && imagenesComprimidas[4];
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

    function generarPDF() {
      if (isGenerating) return;
      isGenerating = true;
      showLoader('Iniciando empaquetado de reporte...', true);

      var tipoVal = DOM.tipoEvento.value;
      var subCategoriaTexto = DOM.comboSub.value;
      var nombreInstitucion = DOM.inputInstitucion.value.trim().toUpperCase();
      var distrito          = DOM.inputDistrito.value.trim().toUpperCase();
      
      var partesFecha = DOM.inputFecha.value.split('-');
      var fechaFormateada = partesFecha[2] + '.' + partesFecha[1] + '.' + partesFecha[0];

      // TÍTULOS CON REGLA PRECISA: Sólo VISITA_IE lleva <br>
      var tituloHtml = '';
      if (tipoVal === 'VISITA_IE') tituloHtml = 'VISITA DE INSTITUCIÓN<br>EDUCATIVA A LA PLANTA';
      else if (tipoVal === 'VISITA_ADULTOS')   tituloHtml = 'VISITA DE ADULTOS A LA PLANTA';
      else if (tipoVal === 'TALLER_IE')        tituloHtml = 'TALLER A INSTITUCIONES EDUCATIVAS';
      else if (tipoVal === 'TALLER_EMPRESAS')  tituloHtml = 'TALLER A EMPRESAS';
      else if (tipoVal === 'TALLER_COMUNIDAD') tituloHtml = 'TALLER A LA COMUNIDAD';

      var subtituloTexto = (subCategoriaTexto + ' ' + nombreInstitucion + ' – ' + distrito).toUpperCase();

      // Cargar textos en el DOM del Template
      [1, 2].forEach(function(i) {
        document.getElementById('pdf-titulo-' + i).innerHTML = tituloHtml;
        document.getElementById('pdf-institucion-' + i).textContent = subtituloTexto;
        document.getElementById('pdf-fecha-' + i).textContent = fechaFormateada;
      });

      // Mapear fotos comprimidas
      document.getElementById('pdf-foto-1').src = imagenesComprimidas[1];
      document.getElementById('pdf-foto-2').src = imagenesComprimidas[2];
      document.getElementById('pdf-foto-3').src = imagenesComprimidas[3];
      document.getElementById('pdf-foto-4').src = imagenesComprimidas[4];

      // Ajustes de fuentes controlados y fluidos
      var forzarUnaFila = (tipoVal !== 'VISITA_IE');
      ajustarFuenteAdaptativa('pdf-titulo-1', 34, forzarUnaFila);
      ajustarFuenteAdaptativa('pdf-titulo-2', 34, forzarUnaFila);
      ajustarFuenteAdaptativa('pdf-institucion-1', 24, true);
      ajustarFuenteAdaptativa('pdf-institucion-2', 24, true);

      // Posicionamiento temporal seguro para renderizado html2canvas
      DOM.template.style.cssText = 'position:fixed; left:0; top:0; z-index:99999; visibility:visible; background:#fff;';

      var paginas = Array.from(DOM.template.querySelectorAll('.pdf-pagina'));
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      function procesarRender(index) {
        if (index >= paginas.length) {
          var limpio = nombreInstitucion.replace(/[^A-Z0-9\s\-_]/g, '').replace(/\s+/g, '_');
          var nombreArchivo = 'F-(' + fechaFormateada + ')-' + (limpio || 'DOCUMENTO') + '.pdf';
          
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
          procesarRender(index + 1);
        }).catch(function() {
          DOM.template.style.cssText = 'position:fixed; left:-9999px; top:-9999px; visibility:hidden;';
          isGenerating = false;
          hideLoader();
          showToast('Error en el renderizado del lienzo técnico.', 'error');
        });
      }

      setTimeout(function() {
        procesarRender(0);
      }, 300);
    }

    if (DOM.btnGenerar) {
      DOM.btnGenerar.addEventListener('click', generarPDF);
    }

    // Utilidades UI secundarias
    function showToast(msg, type) {
      var container = document.getElementById('toast-container');
      if (!container) return;
      var toast = document.createElement('div');
      toast.className = 'toast toast-' + (type || 'error');
      toast.textContent = msg;
      container.appendChild(toast);
      setTimeout(function () { if(toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
    }

    function showLoader(msg, withProgress) {
      if (!DOM.overlay) return;
      DOM.loadingText.textContent = msg;
      DOM.overlay.classList.remove('hidden');
      if(withProgress) DOM.progressBar.classList.remove('hidden');
    }

    function updateProgress(curr, tot) {
      if(DOM.progressBar) DOM.progressBar.value = Math.round((curr / tot) * 100);
    }

    function hideLoader() {
      if(DOM.overlay) DOM.overlay.classList.add('hidden');
    }
  }
})();
