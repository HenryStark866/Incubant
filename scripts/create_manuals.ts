import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function createPDF(title: string, sections: {title: string, content: string[]}[], outputName: string) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const orange = rgb(0.96, 0.58, 0.1);
  const darkGray = rgb(0.2, 0.2, 0.2);

  const { width, height } = page.getSize();
  let y = height - 80;

  // Header
  page.drawRectangle({ x: 0, y: y, width, height: 80, color: orange });
  page.drawText(title, { x: 40, y: y + 30, size: 24, font: boldFont, color: rgb(1,1,1) });
  
  y -= 40;

  const getNewPage = () => {
    page = pdfDoc.addPage([595.28, 841.89]);
    y = height - 60;
  };

  for (const sec of sections) {
    if (y < 100) getNewPage();
    
    page.drawText(sec.title, { x: 40, y, size: 16, font: boldFont, color: orange });
    page.drawLine({ start: { x: 40, y: y - 5 }, end: { x: width - 40, y: y - 5 }, thickness: 1, color: orange });
    y -= 25;

    for (const line of sec.content) {
      if (y < 60) getNewPage();
      
      const words = line.split(' ');
      let lineText = '';
      for (const word of words) {
        const testLine = lineText + word + ' ';
        const textWidth = font.widthOfTextAtSize(testLine, 11);
        if (textWidth > width - 100) {
          page.drawText(lineText, { x: 40, y, size: 11, font, color: darkGray });
          lineText = word + ' ';
          y -= 16;
          if (y < 60) getNewPage();
        } else {
          lineText = testLine;
        }
      }
      page.drawText(lineText, { x: 40, y, size: 11, font, color: darkGray });
      y -= 20;
    }
    y -= 15;
  }

  const pdfBytes = await pdfDoc.save();
  const docsDir = path.join(process.cwd(), 'public/docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(docsDir, outputName), pdfBytes);
  console.log(`Creado ${outputName}`);
}

async function generateAll() {
  await createPDF('MANUAL DEL OPERADOR - INCUBANT', [
    {
      title: '1. Introducción y Objetivo',
      content: [
        'Bienvenido al sistema Incubant Zero-Touch.',
        'Este manual le guiara sobre como registrar el estado de las incubadoras y nacedoras.',
        'El objetivo es tomar fotos de los tableros y dejar que la IA lea y complete los datos automaticamente.'
      ]
    },
    {
      title: '2. Registro de Parametros (Foto)',
      content: [
        'Pasos para reportar de forma eficiente:',
        '1. Seleccione la opcion "Escanear Tablero / Subir Foto" desde su vista asignada.',
        '2. Tame una fotografia clara y enfocada del panel (Ovoscan, Synchro, etc.).',
        '3. Espere unos 5 segundos mientras el sistema Inteligente de Google lee los numeros de temperatura y humedad.',
        '4. Verifique que los numeros extraidos cuadran con el panel.',
        '5. Presione "Confirmar y Reportar".'
      ]
    },
    {
      title: '3. Novedades y Alarmas',
      content: [
        'Si encuentra el sistema pitando o con luces rojas, no espere.',
        'Presione "Reportar Novedad". Seleccione la maquina, escriba de forma breve cual fue el problema y si realizo algo para mitigarlo.',
        'El jefe o supervisor recibira una notificacion silenciosa al instante.'
      ]
    },
    {
      title: '4. Cierre de Turno',
      content: [
        'Al finalizar su jornada, pulse el boton rojo [Cerrar Turno].',
        'Esto compilara todas las maquinas verificadas durante sus 8 o 12 horas en un archivo PDF.',
        'Este PDF se archivara legalmente como prueba de su cumplimiento y el estado fisico del galpon al que usted fue responsable.'
      ]
    }
  ], 'manual_operador.pdf');

  await createPDF('MANUAL DEL ADMINISTRADOR - INCUBANT', [
    {
      title: '1. Dashboard Monitor (Tiempo Real)',
      content: [
        'El Dashboard de Admin esta pensado para operar en una pantalla encendida o TV.',
        'El modulo ciclara automaticamente de incubadoras a nacedoras cada 10 segundos, asegurando refresco ininterrumpido.',
        'Visualizara colores rojos (alarmas) y verdes (en flujo normativo).'
      ]
    },
    {
      title: '2. Historial de Archivos',
      content: [
        'Como supervisor, usted cuenta con una bodega integral en la nube (Supabase).',
        'Ubicado en la pestana "Historial", vera la cronologia exacta de cada inspeccion.',
        'Puede pulsar "Abrir PDF" para ver los cierres de turno completos e imprimir reportes con un solo toque.'
      ]
    },
    {
      title: '3. Rendimiento Operativo',
      content: [
        'En todo momento, vea cuantos operarios iniciaron su turno en la central de control superior.',
        'El sistema le resume exactamente cuantos reportes ha recibido en el dia.'
      ]
    }
  ], 'manual_administrador.pdf');

  await createPDF('PROPUESTA DE MEJORA ESCALABLE - INCUBANT', [
    {
      title: 'Contexto de la Optimizacion',
      content: [
        'Antioquena de Incubacion S.A.S maneja volumenes masivos. Este software ha estabilizado la operacion transaccional automatizando la captura humana.',
        'Para escalar el crecimiento un 30% adicional con un ahorro masivo en tiempos operativos, se formula el siguiente plan tecnologico.'
      ]
    },
    {
      title: '1. Integracion con API IoT Edge',
      content: [
        'Instalar microcontroladores (ESP32 o Modbus-TCP) integrados directamente a los PLC Ovoscan y Synchro de Petersime.',
        'A traves de una base de datos de series de tiempo (Clickhouse o InfluxDB), el dashboard web de Incubant que hoy opera con reportes fotograficos podra leer el 100% de la granja a milisegundos.',
        'Impacto: cero intervencion humana para medir temperaturas. El operario sera redirigido unicamente para resolver novedades y cargar bandejas, no como transcriptor.'
      ]
    },
    {
      title: '2. Prediccion de Erupciones / Nacimientos con IA Vision',
      content: [
        'Instalacion de videocamaras Infrarojas internas en Nacedoras.',
        'Mediante algoritmos de computer vision integrados al backend, el sistema de Incubant emitira alertas cuando la "Ventana de Nacimiento" empiece a expandirse, cruzandolo con el dato de la bolsa de calor generada (aumento de grados).',
        'Impacto: Mejora la logistica de retiro de canastillas en los tiempos optimos, maximizando la superviviencia.'
      ]
    },
    {
      title: '3. Arquitectura PWA Escalar en Offline',
      content: [
        'Transicionar el React actual a un esquema de base de datos offline local robusta (WatermelonDB).',
        'Dado que los galpones suelen tener mala senal, el operario tomara fotografias en zona muerta, y en el segundo en el que se detecta WiFi, todo el buffer encolado sube a Supabase de forma atonica y paralela.',
        'Impacto: Resiliencia absoluta ante caidas en red corporativa de las bodegas.'
      ]
    }
  ], 'propuesta_mejora.pdf');
}

generateAll().catch(console.error);
