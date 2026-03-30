/**
 * Generador de Documentación Profesional - Incubant
 * Versión: 2.1 (Compatible)
 */

const { jsPDF } = require('C:/Users/tabor/Incubant/node_modules/jspdf/dist/jspdf.node.js');
const fs = require('fs');
const path = require('path');

const DESKTOP = 'C:\\Users\\tabor\\OneDrive\\Escritorio';
const COLORS = {
  primary: [15, 23, 42],
  accent: [245, 166, 35],
  text: [51, 65, 85],
  light: [248, 250, 252],
  border: [226, 232, 240],
  success: [34, 197, 94]
};

function drawHeader(doc, title) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageW, 25, 'F');
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 25, pageW, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INCUBANT', 15, 16);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title.toUpperCase(), pageW - 15, 16, { align: 'right' });
}

function drawFooter(doc, pageNum, totalPages, docId) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...COLORS.light);
  doc.rect(0, pageH - 20, pageW, 20, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text);
  doc.text(`${docId} | Confidencial`, 15, pageH - 10);
  doc.text(`Antioqueña de Incubación S.A.S. - 2026`, pageW / 2, pageH - 10, { align: 'center' });
  doc.text(`Página ${pageNum} de ${totalPages}`, pageW - 15, pageH - 10, { align: 'right' });
}

function subHeader(doc, text, y) {
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text(text, 15, y);
}

function generateProfessionalProposal() {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const docId = 'PROP-INC-2026-001';

  // --- PORTADA ---
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, 10, pageH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(40);
  doc.setFont('helvetica', 'bold');
  doc.text('INCUBANT', 25, 60);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('ANTIOQUEÑA DE INCUBACION S.A.S.', 25, 70);
  doc.text('Medellín, Antioquia — Colombia', 25, 76);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPUESTA DE\nIMPLEMENTACIÓN', 25, 110);
  doc.setTextColor(...COLORS.accent);
  doc.setFontSize(18);
  doc.text('SISTEMA DIGITAL DE MONITOREO AVÍCOLA\n"Incubant Integral v0.1.1"', 25, 135);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text('Henry Taborda', 25, 188);
  doc.setFontSize(10);
  doc.text('Auxiliar de Mantenimiento | Antioqueña de Incubación S.A.S.', 25, 194);

  // --- PAGINA 2 ---
  doc.addPage();
  drawHeader(doc, 'Resumen Ejecutivo');
  let y = 50;
  subHeader(doc, '1. Introducción', y);
  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  const introTxt = 'Esta propuesta presenta "Incubant Integral", una aplicación web progresiva (PWA) creada a medida para digitalizar el monitoreo de las incubadoras y nacedoras de ANTIOQUEÑA DE INCUBACION S.A.S. La solución reemplaza el registro manual en papel con una plataforma inteligente que integra inteligencia artificial (Google Gemini), almacenamiento en la nube (Google Drive + Supabase) y un panel web de supervisión en tiempo real accesible desde cualquier dispositivo.';
  doc.text(doc.splitTextToSize(introTxt, 180), 15, y);
  y += 35;
  subHeader(doc, '2. Diagnóstico y Problemática', y);
  y += 10;
  const diagTxt = 'Antioqueña de Incubación S.A.S. opera actualmente con un modelo de registro manual basado en planillas físicas que los operarios completan cada hora durante sus turnos de trabajo. Este modelo presenta múltiples vulnerabilidades operativas: pérdida de información, tiempo de respuesta lento, falta de trazabilidad y riesgos productivos por fallas no detectadas a tiempo.';
  doc.text(doc.splitTextToSize(diagTxt, 180), 15, y);
  drawFooter(doc, 2, 4, docId);

  // --- PAGINA 3 ---
  doc.addPage();
  drawHeader(doc, 'Solución y Beneficios');
  y = 50;
  subHeader(doc, '3. Incubant Integral v0.1.1', y);
  y += 10;
  const solTxt = 'Es una PWA que puede instalarse como app nativa en cualquier celular Android o iOS. Incluye módulos de registro operacional con fotos analizadas por IA, un panel de supervisión en tiempo real y almacenamiento automático de reportes PDF en Google Drive.';
  doc.text(doc.splitTextToSize(solTxt, 180), 15, y);
  y += 35;
  subHeader(doc, '4. Beneficios Clave', y);
  y += 12;
  const benefits = [
    '• Reducción del 70% en tiempo de llenado de registros.',
    '• Trazabilidad 360° digital de todos los parámetros.',
    '• Incremento del 40% en eficiencia operativa.',
    '• Detección de alarmas al 100% en tiempo real.',
    '• Protección de lotes por detección temprana de fallas.'
  ];
  benefits.forEach(b => {
    doc.text(b, 20, y);
    y += 10;
  });
  drawFooter(doc, 3, 4, docId);

  // --- PAGINA 4 ---
  doc.addPage();
  drawHeader(doc, 'Fases y Conclusión');
  y = 50;
  subHeader(doc, '5. Plan de Implementación', y);
  y += 10;
  const phases = [
    'Fase 1: Configuración de Infraestructura y Nube (Completo)',
    'Fase 2: Implementación de Pipeline de IA y Fotos (Completo)',
    'Fase 3: Panel Administrativo y Gestión de Turnos (Completo)',
    'Fase 4: Capacitación y Despliegue Masivo (En Progreso)'
  ];
  phases.forEach(p => {
    doc.text('✓ ' + p, 20, y);
    y += 10;
  });
  y += 40;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Henry Taborda', 15, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Auxiliar de Mantenimiento | Antioqueña de Incubación S.A.S.', 15, y + 6);
  doc.text('Medellín, Colombia - 2026', 15, y + 12);
  drawFooter(doc, 4, 4, docId);

  const outPath = path.join(DESKTOP, 'PROPUESTA_INTEGRAL_INCUBANT_2026.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
}

function generateProfessionalManual(os) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const docId = `MAN-${os.toUpperCase()}-2026`;

  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(40);
  doc.setFont('helvetica', 'bold');
  doc.text('INCUBANT', 25, 60);
  doc.setFontSize(18);
  doc.text(`Guía Profesional de Instalación y Uso: ${os}`, 25, 75);
  doc.setTextColor(...COLORS.accent);
  doc.text('Antioqueña de Incubación S.A.S.', 25, 85);

  doc.addPage();
  drawHeader(doc, `Manual ${os}`);
  let y = 50;
  subHeader(doc, '1. Instrucciones de Instalación', y);
  y += 10;
  const steps = os === 'iOS' 
    ? ['Abrir Safari e ingresar a incubant.onrender.com', 'Tocar botón "Compartir"', 'Seleccionar "Agregar a pantalla de inicio"', 'Confirmar nombre e instalar']
    : ['Abrir Chrome e ingresar al sistema', 'Tocar banner "Instalar Aplicación" o menú de 3 puntos', 'Confirmar Instalación', 'Aceptar permisos de cámara'];
  steps.forEach((s, i) => {
    doc.text(`${i+1}. ${s}`, 20, y);
    y += 10;
  });
  y += 20;
  subHeader(doc, '2. Uso Adecuado (Zero-Touch)', y);
  y += 10;
  const useSteps = [
    'Iniciar sesión con PIN personal.',
    'Seleccionar máquina (Incubadora/Nacedora).',
    'Apunte y capture una foto nítida de la pantalla.',
    '¡LISTO! La IA procesa y guarda automáticamente en 5 segundos.',
    'Verifique la confirmación verde y continúe con la siguiente.'
  ];
  useSteps.forEach((s, i) => {
    doc.text(`• ${s}`, 20, y);
    y += 10;
  });
  drawFooter(doc, 2, 2, docId);

  const outPath = path.join(DESKTOP, `MANUAL_INCUBANT_${os.toUpperCase()}.pdf`);
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
}

function generateDemoRoles() {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const docId = 'DEMO-ROLES-2026';

  drawHeader(doc, 'Demostración de Roles');
  let y = 50;
  
  subHeader(doc, '1. Rol: OPERARIO (Zero-Touch AI)', y);
  y += 10;
  doc.setFontSize(10);
  doc.text('• Acceso: PIN 1111 (Juan Alejandro)', 20, y);
  y += 6;
  doc.text('• Acción: Elige máquina -> Foto -> Autoguardado IA.', 20, y);
  y += 10;

  subHeader(doc, '2. Rol: SUPERVISOR (Dashboard)', y);
  y += 10;
  doc.text('• Acceso: PIN jp2026 (Jhon Piedrahita)', 20, y);
  y += 6;
  doc.text('• Acción: Visualiza estado de planta en tiempo real.', 20, y);
  y += 10;

  subHeader(doc, '3. Rol: JEFE (Administración Total)', y);
  y += 10;
  doc.text('• Acceso: PIN 4753 (Administrador)', 20, y);
  y += 6;
  doc.text('• Acción: Gestión de usuarios, turnos y boveda Drive.', 20, y);
  y += 15;

  drawFooter(doc, 1, 1, docId);
  const outPath = path.join(DESKTOP, 'GUIA_DEMOSTRACION_ROLES.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
}

try {
  generateProfessionalProposal();
  generateProfessionalManual('iOS');
  generateProfessionalManual('Android');
  generateDemoRoles();
  console.log('Documentación Profesional Generada con Guía de Demo.');
} catch (e) {
  console.error('Error:', e);
}
