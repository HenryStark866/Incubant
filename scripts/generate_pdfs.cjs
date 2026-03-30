/**
 * Generador de PDFs - Incubant Monitor
 * Genera: Guía iOS, Guía Android y Propuesta de Mejora en el Escritorio (OneDrive/Escritorio)
 */

const { jsPDF } = require('C:/Users/tabor/Incubant/node_modules/jspdf/dist/jspdf.node.js');
const fs = require('fs');
const path = require('path');

// Detected actual desktop path
const DESKTOP = 'C:\\Users\\tabor\\OneDrive\\Escritorio';

const C = {
  dark: [15, 23, 42],
  accent: [245, 166, 35],
  white: [255, 255, 255],
  gray: [148, 163, 184],
  lightGray: [241, 245, 249],
  blue: [59, 130, 246],
  green: [34, 197, 94]
};

function setupDoc(title, subtitle) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, pageW, 40, 'F');
  doc.setFillColor(...C.accent);
  doc.rect(0, 40, pageW, 2, 'F');
  
  doc.setTextColor(...C.accent);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INCUBANT', 15, 20);
  
  doc.setTextColor(...C.white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('MONITORING SYSTEM', 15, 28);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageW - 15, 20, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(subtitle, pageW - 15, 28, { align: 'right' });
  
  return doc;
}

// --- GUIA IOS ---
function genIOS() {
  const doc = setupDoc('GUÍA DE INSTALACIÓN iOS', 'iPhone / iPad');
  let y = 60;
  
  doc.setTextColor(...C.dark);
  doc.setFontSize(14);
  doc.text('Instalación rápida vía Safari', 15, y);
  y += 10;
  
  const steps = [
    '1. Abra Safari e ingrese a: incubant.onrender.com',
    '2. Toque el botón "Compartir" (cuadrado con flecha hacia arriba).',
    '3. Busque y seleccione: "Agregar a la pantalla de inicio".',
    '4. Toque "Agregar" en la esquina superior derecha.',
    '5. ¡Listo! La app aparecerá en su pantalla como una app nativa.'
  ];
  
  doc.setFontSize(11);
  steps.forEach(s => {
    doc.text(s, 20, y);
    y += 8;
  });
  
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('Ventajas:', 15, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.text('• Acceso instantáneo sin login repetitivo.', 20, y);
  y += 6;
  doc.text('• Pantalla completa sin barras de navegación.', 20, y);
  
  const outPath = path.join(DESKTOP, 'Guia_Instalacion_iOS.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
}

// --- GUIA ANDROID ---
function genAndroid() {
  const doc = setupDoc('GUÍA DE INSTALACIÓN ANDROID', 'Samsung / Xiaomi / Huawei');
  let y = 60;
  
  doc.setTextColor(...C.dark);
  doc.setFontSize(14);
  doc.text('Instalación vía Google Chrome', 15, y);
  y += 10;
  
  const steps = [
    '1. Abra Chrome e ingrese a: incubant.onrender.com',
    '2. Espere el aviso automático "Instalar aplicación".',
    '3. Si no aparece, toque los 3 puntos (menú) arriba a la derecha.',
    '4. Seleccione la opción: "Instalar aplicación".',
    '5. Confirme la instalación y busque el ícono en su menú.'
  ];
  
  doc.setFontSize(11);
  steps.forEach(s => {
    doc.text(s, 20, y);
    y += 8;
  });
  
  const outPath = path.join(DESKTOP, 'Guia_Instalacion_Android.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
}

// --- PROPUESTA DE MEJORA ---
function genProposal() {
  const doc = setupDoc('PROPUESTA DE MEJORA OPERATIVA', 'Incubant Integral 2026');
  let y = 60;
  
  doc.setTextColor(...C.dark);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Objetivo: Digitalización y Eficiencia de Planta', 15, y);
  y += 12;
  
  const points = [
    { t: '1. Eliminación del Papel', d: 'Sustitución de bitácoras físicas por registros digitales auditables en tiempo real.' },
    { t: '2. Supervisión Remota', d: 'Monitoreo de todas las máquinas desde cualquier lugar, reduciendo tiempos de respuesta.' },
    { t: '3. Inteligencia Artificial (Gemini)', d: 'Validación automática de datos detectando anomalías antes de que afecten la producción.' },
    { t: '4. Bóveda Cloud de Evidencia', d: 'Sincronización directa con Google Drive para auditorías de calidad sin procesos manuales.' },
    { t: '5. Índice de Eficiencia Individual', d: 'Medición del cumplimiento de cada operario facilitando incentivos y capacitación.' }
  ];
  
  points.forEach(p => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(p.t, 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const splitD = doc.splitTextToSize(p.d, 180);
    doc.text(splitD, 15, y);
    y += (splitD.length * 5) + 5;
  });
  
  y += 10;
  doc.setFillColor(...C.lightGray);
  doc.rect(15, y, 180, 20, 'F');
  doc.setTextColor(...C.accent);
  doc.setFont('helvetica', 'bold');
  doc.text('Impacto Estimado: Reducción del 25% en tiempos de reporte y 100% en pérdida de trazabilidad.', 20, y + 12);
  
  const outPath = path.join(DESKTOP, 'Propuesta_Mejora_Incubant.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
}

try {
  genIOS();
  genAndroid();
  genProposal();
  console.log('PDFs generados correctamente en el Escritorio de OneDrive.');
} catch (e) {
  console.error('Error:', e);
}
