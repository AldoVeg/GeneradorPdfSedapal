/* ═══════════════════════════════════════════════
   index.js — Generador de PDF SEDAPAL (Fortificado)
   IIFE estricto · Validación CDN · Compresión de
   imágenes · Canvas offscreen · Progreso real
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Guard: DOM aún no listo ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ═══════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════ */
  function init() {

    /* ── Validación de CDNs ── */
    if (typeof html2canvas === 'undefined') {
      showToast('Librería html2canvas no disponible. Verifica tu conexión.', 'error');
      return;
    }
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
      showToast('Librería jsPDF no disponible. Verifica tu conexión.', 'error');
      return;
    }

    /* ── Referencias DOM cacheadas ── */
    var DOM = {
      tipoEvento:       document.getElementById('tipoEvento'),
      comboSub:         document.getElementById('subCategoria'),
      inputInstitucion: document.getElementById('institucion'),
      inputDistrito:    document.getElementById('distrito'),
      inputFecha:       document.getElementById('fecha'),
      btnGenerar:       document.getElementById('btnGenerar'),
      overlay:          document.getElementById('loading-overlay'),
      loadingText:      document.getElementById('loading-text'),
      progressBar:      document.getElementById('progress-bar'),
      template:         document.getElementById('pdf-template'),
      offscreenCanvas:  document.getElementById('offscreen-canvas'),
      cdnError:         document.getElementById('cdn-error')
    };

    /* ── Estado interno ── */
    var imagenes = { 1: null, 2: null, 3: null, 4: null };
    var imagenesComprimidas = { 1: null, 2: null, 3: null, 4: null };
    var btnOriginalText = DOM.btnGenerar ? DOM.btnGenerar.innerHTML : 'Generar PDF';
    var isGenerating = false;

    /* ── Diccionario de subcategorías ── */
    var subCategoriasPorEvento = {
      "VISITA_IE":        ["INSTITUCIÓN EDUCATIVA", "COLEGIO"],
      "VISITA_ADULTOS":   ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA"],
      "TALLER_IE":        ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "INSTITUTO", "INSTITUCIÓN EDUCATIVA", "COLEGIO", "CEBA", "INICIAL", "NIDO"],
      "TALLER_EMPRESAS":  ["SEDAPAL", "MUNICIPALIDAD", "UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "CENTRO COMERCIAL"],
      "TALLER_COMUNIDAD": ["MERCADO", "URBANIZACIÓN", "ASOCIACIÓN", "A.H."]
    };

    /* ── Tamaño máximo de imagen (bytes) ── */
    var MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

    /* ── Dimensiones de compresión ── */
    var COMPRESS_WIDTH  = 1600;
    var COMPRESS_HEIGHT = 1200;
    var COMPRESS_QUALITY = 0.85;

    /* ═══════════════════════════════════════════════
       UTILIDADES
       ═══════════════════════════════════════════════ */

    function showToast(msg, type) {
      var container = document.getElementById('toast-container');
      if (!container) return;
      var toast = document.createElement('div');
      toast.className = 'toast toast-' + (type || 'error');
      toast.textContent = msg;
      toast.addEventListener('click', function () {
        toast.classList.add('toast-out');
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
      });
      container.appendChild(toast);
      setTimeout(function () {
        if (toast.parentNode) {
          toast.classList.add('toast-out');
          setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
        }
      }, 5000);
    }

    function showLoader(msg, withProgress) {
      if (!DOM.overlay) return;
      DOM.loadingText.textContent = msg || 'Procesando...';
      DOM.overlay.classList.remove('hidden');
      if (withProgress) {
        DOM.progressBar.classList.remove('hidden');
        DOM.progressBar.value = 0;
      } else {
        DOM.progressBar.classList.add('hidden');
      }
    }

    function updateProgress(current, total) {
      if (!DOM.progressBar || DOM.progressBar.classList.contains('hidden')) return;
      DOM.progressBar.value = Math.round((current / total) * 100);
    }

    function hideLoader() {
      if (!DOM.overlay) return;
      DOM.overlay.classList.add('hidden');
      DOM.progressBar.classList.add('hidden');
    }

    function formatearFecha(valor) {
      if (!valor) return '';
      var partes = valor.split('-');
      return partes[2] + '.' + partes[1] + '.' + partes[0];
    }

    function obtenerTituloPDF(valor) {
      if (valor === 'VISITA_IE') return 'VISITA DE INSTITUCIÓN<br>EDUCATIVA A LA PLANTA';
      if (valor === 'VISITA_ADULTOS')   return 'VISITA DE ADULTOS A LA PLANTA';
      if (valor === 'TALLER_IE')        return 'TALLER A INSTITUCIONES EDUCATIVAS';
      if (valor === 'TALLER_EMPRESAS')  return 'TALLER A EMPRESAS';
      if (valor === 'TALLER_COMUNIDAD') return 'TALLER A LA COMUNIDAD';
      return '';
    }

    function obtenerNombreShortFile(nombreIngresado) {
      var texto = (nombreIngresado || '').toUpperCase().trim();
      texto = texto.replace(/[^A-Z0-9\s\-_]/g, '');
      texto = texto.replace(/\s+/g, '_').replace(/_+/g, '_').replace(/-+/g, '-');
      return texto || 'documento';
    }

    function ajustarFuenteAdaptativa(elementoId, tamanoMaximoBase, forzarUnaFila) {
      var el = document.getElementById(elementoId);
      if (!el) return;
      if (forzarUnaFila) {
        el.style.whiteSpace = 'nowrap';
      } else {
        el.style.whiteSpace = 'normal';
      }
      el.style.fontSize = tamanoMaximoBase + 'px';
      var anchoContenedor = (el.parentElement && el.parentElement.clientWidth) || 682;
      var anchoTexto = el.scrollWidth;
      if (anchoTexto > anchoContenedor) {
        var nuevoTamano = Math.floor((anchoContenedor / anchoTexto) * tamanoMaximoBase);
        if (nuevoTamano < 14) nuevoTamano = 14;
        el.style.fontSize = nuevoTamano + 'px';
      }
    }

    /* ═══════════════════════════════════════════════
       COMPRESIÓN DE IMAGEN (Canvas Offscreen)
       ═══════════════════════════════════════════════ */
    function comprimirImagen(dataURL, slot) {
      return new Promise(function (resolve, reject) {
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

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          resolve(compressed);
        };
        img.onerror = function () {
          imagenesComprimidas[slot] = dataURL;
          resolve(dataURL);
        };
        img.src = dataURL;
      });
    }

    /* ═══════════════════════════════════════════════
       VALIDACIÓN DE CAMPOS
       ═══════════════════════════════════════════════ */
    function validarCampos() {
      var errores = [];

      if (!DOM.tipoEvento || !DOM.tipoEvento.value) {
        errores.push('Selecciona un tipo de evento.');
        if (DOM.
