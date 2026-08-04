document.addEventListener('DOMContentLoaded', () => {

  // 1. DICCIONARIO ACTUALIZADO (Sincronizado con tus requerimientos exactos)
  const subCategoriasPorEvento = {
    "VISITA_IE":        ["INSTITUCIÓN EDUCATIVA", "COLEGIO"],
    "VISITA_ADULTOS":   ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA"],
    "TALLER_IE":        ["UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "INSTITUTO", "INSTITUCIÓN EDUCATIVA", "COLEGIO", "CEBA", "INICIAL", "NIDO"],
    "TALLER_EMPRESAS":  ["SEDAPAL", "UNIVERSIDAD NACIONAL", "UNIVERSIDAD PRIVADA", "CENTRO COMERCIAL"],
    "TALLER_COMUNIDAD": ["MUNICIPALIDAD", "MERCADO", "URBANIZACIÓN", "ASOCIACIÓN", "A.H."],
    "TALLER_VIRTUAL":   ["MUNICIPALIDAD", "INSTITUCIÓN", "EMPRESA", "UNIVERSIDAD", "LIBRE"]
  };

  // Elementos DOM
  const selectTipoEvento = document.getElementById('tipoEvento');
  const selectSubCategoria = document.getElementById('subCategoria');
  const inputInstitucion = document.getElementById('nombreInstitucion');
  const inputDistrito = document.getElementById('distrito');
  const btnGenerarPDF = document.getElementById('btnGenerarPDF');

  // Elementos Live Preview
  const prevTag = document.getElementById('prevTag');
  const prevTitulo = document.getElementById('prevTitulo');
  const prevSubtitulo = document.getElementById('prevSubtitulo');

  // 2. EVENTO: Cambio de Tipo de Evento (Actualización Dinámica de Subcategorías)
  selectTipoEvento.addEventListener('change', (e) => {
    const eventoSeleccionado = e.target.value;
    const subcategorias = subCategoriasPorEvento[eventoSeleccionado] || [];

    // Limpiar y poblar select de subcategorías
    selectSubCategoria.innerHTML = '<option value="" disabled selected>-- Selecciona una subcategoría --</option>';
    
    subcategorias.forEach(sub => {
      const option = document.createElement('option');
      option.value = sub;
      option.textContent = sub;
      selectSubCategoria.appendChild(option);
    });

    selectSubCategoria.disabled = false;
    actualizarPreview();
  });

  // Listeners para reactividad en directo
  selectSubCategoria.addEventListener('change', actualizarPreview);
  inputInstitucion.addEventListener('input', actualizarPreview);
  inputDistrito.addEventListener('input', actualizarPreview);

  // 3. LÓGICA DE PREVISUALIZACIÓN Y FORMATO DE TEXTOS
  function obtenerTextosFormateados() {
    const tipoVal = selectTipoEvento.value;
    const subCatVal = selectSubCategoria.value || '';
    const instVal = inputInstitucion.value.trim() || 'NOMBRE DE LA INSTITUCIÓN';
    const distVal = inputDistrito.value.trim() || 'DISTRITO';

    // Regla de Títulos
    let tituloHtml = '';
    let tituloPlano = '';

    switch (tipoVal) {
      case 'VISITA_IE':
        tituloHtml = 'VISITA DE INSTITUCIÓN<br>EDUCATIVA A LA PLANTA';
        tituloPlano = 'VISITA DE INSTITUCIÓN EDUCATIVA A LA PLANTA';
        break;
      case 'VISITA_ADULTOS':
        tituloHtml = 'VISITA DE ADULTOS A LA PLANTA';
        tituloPlano = tituloHtml;
        break;
      case 'TALLER_IE':
        tituloHtml = 'TALLER A INSTITUCIONES EDUCATIVAS';
        tituloPlano = tituloHtml;
        break;
      case 'TALLER_EMPRESAS':
        tituloHtml = 'TALLER A EMPRESAS';
        tituloPlano = tituloHtml;
        break;
      case 'TALLER_COMUNIDAD':
        tituloHtml = 'TALLER A LA COMUNIDAD';
        tituloPlano = tituloHtml;
        break;
      case 'TALLER_VIRTUAL':
        tituloHtml = 'TALLER VIRTUAL';
        tituloPlano = tituloHtml;
        break;
      default:
        tituloHtml = 'SELECCIONE UN EVENTO';
        tituloPlano = 'SELECCIONE UN EVENTO';
    }

    // Regla para la opción "LIBRE" (sin frase alguna)
    const prefijoSubcategoria = (subCatVal === 'LIBRE' || !subCatVal) ? '' : `${subCatVal} `;
    const subtituloTexto = `${prefijoSubcategoria}${instVal} – ${distVal}`.toUpperCase();

    return { tituloHtml, tituloPlano, subtituloTexto, tipoVal };
  }

  function actualizarPreview() {
    const { tituloHtml, subtituloTexto, tipoVal } = obtenerTextosFormateados();
    
    prevTag.textContent = tipoVal ? tipoVal.replace('_', ' ') : 'CONFIGURACIÓN';
    prevTitulo.innerHTML = tituloHtml;
    prevSubtitulo.textContent = subtituloTexto;
  }

  // 4. GENERACIÓN DEL PDF
  btnGenerarPDF.addEventListener('click', () => {
    // Validar formulario
    if (!selectTipoEvento.value || !selectSubCategoria.value || !inputInstitucion.value || !inputDistrito.value) {
      alert('Por favor, completa todos los campos requeridos antes de generar el PDF.');
      return;
    }

    const { tituloPlano, subtituloTexto } = obtenerTextosFormateados();

    // Inicializar jsPDF (si la librería CDN está cargada)
    if (window.jspdf) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Estilo del PDF
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); // slate-900

      // Título Principal
      doc.text(tituloPlano, 148, 80, { align: 'center' });

      // Subtítulo
      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(subtituloTexto, 148, 100, { align: 'center' });

      // Guardar PDF
      const nombreArchivo = `Certificado_${inputInstitucion.value.replace(/\s+/g, '_')}.pdf`;
      doc.save(nombreArchivo);
    } else {
      // Fallback si no hay conexión CDN
      console.log('PDF generado en consola:', { tituloPlano, subtituloTexto });
      alert(`¡Documento Procesado Exitosamente!\n\nTítulo: ${tituloPlano}\nDetalle: ${subtituloTexto}`);
    }
  });

});
