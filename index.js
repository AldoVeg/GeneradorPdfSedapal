// Almacena las imágenes en base64 para reutilizarlas en el PDF
var imagenes = { 1: null, 2: null, 3: null, 4: null };

// Preview de fotos al seleccionarlas
[1, 2, 3, 4].forEach(function (n) {
  var input   = document.getElementById('foto' + n);
  var preview = document.getElementById('preview' + n);

  input.addEventListener('change', function () {
    var archivo = input.files[0];
    if (!archivo) return;

    var reader = new FileReader();
    reader.onload = function (e) {
      imagenes[n] = e.target.result;
      preview.src = e.target.result;
      preview.classList.add('visible');
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

// Devuelve el HTML del título según el tipo seleccionado
function tituloHTML(valor,texto) {
  if (valor === 'instituciones') {
    return 'VISITA DE INSTITUCIONES<br>EDUCATIVAS A LA PLANTA';
  }
  return texto;
}

// Genera el PDF capturando cada página de forma independiente
function generarPDF() {
  var tipoEvento  = document.getElementById('tipoEvento').value;
  
  var comboTipoEvento = document.getElementById('tipoEvento');
  var tipoEventoTexto  = comboTipoEvento.options[comboTipoEvento.selectedIndex].text;


  var institucion = document.getElementById('institucion').value.trim();
  var fecha       = formatearFecha(document.getElementById('fecha').value);

  if (!tipoEvento || !institucion || !fecha) {
    alert('Por favor completa todos los datos del evento.');
    return;
  }
  if (!imagenes[1] || !imagenes[2] || !imagenes[3] || !imagenes[4]) {
    alert('Por favor selecciona las 4 fotos.');
    return;
  }

  var titulo = tituloHTML(tipoEvento,tipoEventoTexto);

  // Poblar página 1
  document.getElementById('pdf-titulo-1').innerHTML        = titulo;
  document.getElementById('pdf-institucion-1').textContent = institucion;
  document.getElementById('pdf-fecha-1').textContent       = fecha;
  document.getElementById('pdf-foto-1').src                = imagenes[1];
  document.getElementById('pdf-foto-2').src                = imagenes[2];

  // Poblar página 2
  document.getElementById('pdf-titulo-2').innerHTML        = titulo;
  document.getElementById('pdf-institucion-2').textContent = institucion;
  document.getElementById('pdf-fecha-2').textContent       = fecha;
  document.getElementById('pdf-foto-3').src                = imagenes[3];
  document.getElementById('pdf-foto-4').src                = imagenes[4];

  // Mostrar plantilla fija en la esquina superior para que html2canvas la capture sin offset
  var template = document.getElementById('pdf-template');
  template.style.cssText = 'display:block; position:fixed; top:0; left:0; z-index:9999;';

  var paginas = Array.from(document.querySelectorAll('.pdf-pagina'));
  var doc     = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  function capturarPagina(index) {
    if (index >= paginas.length) {
      doc.save('informe-sedapal.pdf');
        //  template.style.cssText = 'display:none;';
      return;
    }

    html2canvas(paginas[index], {
      scale:   2,
      useCORS: true,
      logging: false,
      width:   794,
      height:  1123
    }).then(function (canvas) {
      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      if (index > 0) doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      capturarPagina(index + 1);
    });
  }

  capturarPagina(0);
}

// Botón Generar PDF
document.querySelector('.btn-generar').addEventListener('click', generarPDF);
