const express = require('express');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const client = twilio(accountSid, authToken);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Base de datos de proyectos
let projects = [
  {
    id: 1,
    name: 'Ampliación Adidas Soleil',
    status: 'Por iniciar',
    progress: 0,
    startDate: '2026-04-24',
    deadline: '2026-06-09',
    riskLevel: 'ALTO',
    description: 'Cateos + Ingeniería (30 días) + Permiso (45 días)',
    milestones: [
      { name: 'Cateos de estructuras', date: '2026-04-24', duration: '5-7 días', status: 'pendiente' },
      { name: 'Ingeniería', date: '2026-05-01', duration: '30 días', status: 'pendiente' },
      { name: 'Permiso de obra', date: '2026-04-24', duration: '45 días', status: 'pendiente' }
    ],
    nextActions: [
      'Confirmar equipo de cateos',
      'Verificar gestor de permisos',
      'Coordinar fechas con cliente'
    ]
  },
  {
    id: 2,
    name: 'Ampliación Alto Avellaneda',
    status: 'Bloqueado',
    progress: 15,
    startDate: '2026-04-15',
    deadline: 'TBD',
    riskLevel: 'MEDIO',
    description: 'Esperando aprobaciones de stakeholders',
    approvals: [
      { name: 'Carrefour', status: 'OK', priority: 'PRIORITARIO' },
      { name: 'Rock&Fellers', status: 'Pendiente firma', priority: 'PRIORITARIO' },
      { name: 'Grupo América', status: 'En proceso', priority: 'normal' },
      { name: 'Grafo CAPEX', status: 'En proceso', priority: 'normal' }
    ],
    nextActions: [
      'Contactar a Carrefour para confirmar OK',
      'Enviar documentos a Rock&Fellers para firma',
      'Seguimiento con Grupo América',
      'Cerrar CAPEX con Grafo'
    ]
  }
];

let chatMessages = [];

function processMessage(message) {
  const msg = message.toLowerCase();

  if (msg.includes('hola') || msg.includes('hi') || msg.includes('inicio')) {
    return `¡Hola! Soy tu bot de gestión de proyectos. Puedo ayudarte con:\n\n📋 Escribe:\n• "estado" - Ver estado de proyectos\n• "adidas" - Info Adidas Soleil\n• "avellaneda" - Info Alto Avellaneda\n• "reporte" - Generar reporte\n• "ayuda" - Ver todas las opciones`;
  }

  if (msg.includes('estado') || msg.includes('proyectos')) {
    return `📊 ESTADO DE PROYECTOS:\n\n🚀 Adidas Soleil:\nEstado: Por iniciar\nProgreso: 0%\nDeadline: 9 junio\n\n⏸️ Alto Avellaneda:\nEstado: Bloqueado\nProgreso: 15%\nEsperando: Carrefour y Rock&Fellers`;
  }

  if (msg.includes('adidas')) {
    return `🚀 AMPLIACIÓN ADIDAS SOLEIL\n\n📅 Hitos:\n• Cateos: 24 abr (5-7 días)\n• Ingeniería: 30 días\n• Permiso: 45 días\n\n⚠️ Riesgo: ALTO (inicia viernes)\n\nPróximos pasos:\n✓ Confirmar equipo cateos\n✓ Verificar gestor permisos`;
  }

  if (msg.includes('avellaneda')) {
    return `⏸️ AMPLIACIÓN ALTO AVELLANEDA\n\n📋 Aprobaciones pendientes:\n⏳ Carrefour - OK (PRIORITARIO)\n⏳ Rock&Fellers - Firma (PRIORITARIO)\n⏰ Grupo América - Cierre\n⏰ Grafo CAPEX - Cierre\n\n💬 Próxima acción:\nContactar a Carrefour y Rock&Fellers para confirmar timeline`;
  }

  if (msg.includes('reporte')) {
    generateAndSendReport();
    return `📊 Reporte generado y enviado a lilyfn@gmail.com\n\n⏰ Próximo reporte automático: Mañana a las 16:00 hs`;
  }

  if (msg.includes('ayuda')) {
    return `❓ OPCIONES DISPONIBLES:\n\n• "estado" - Ver estado todos los proyectos\n• "adidas" - Detalles Ampliación Adidas\n• "avellaneda" - Detalles Alto Avellaneda\n• "cateos" - Info sobre cateos\n• "permiso" - Info sobre permiso de obra\n• "reporte" - Generar reporte ahora\n\n¿En qué puedo ayudarte?`;
  }

  if (msg.includes('cateos')) {
    return `🔨 CATEOS DE ESTRUCTURAS\n\n📅 Fecha inicio: Viernes 24 de abril\n⏱️ Duración: ~5-7 días\n📍 Lugar: Adidas Soleil\n\n✓ Estado: Listo para iniciar\n✓ Equipo: Confirmado\n\n📊 Después de cateos: Comienza ingeniería (30 días)`;
  }

  if (msg.includes('permiso')) {
    return `📜 PERMISO DE OBRA\n\n⏱️ Duración: 45 días desde inicio\n📅 Inicio: 24 de abril\n📅 Fin estimado: 8 de junio\n\n👤 Gestor: Confirmado\n⚠️ Riesgo: CRÍTICO (es bloqueante)\n\n💡 Recomendación: Monitorear progreso semanalmente`;
  }

  if (msg.includes('carrefour') || msg.includes('rock')) {
    return `📧 SEGUIMIENTO APROBACIONES:\n\n⏳ Carrefour:\nEstado: En seguimiento\nAcción: Contactar para confirmar OK\n\n⏳ Rock&Fellers:\nEstado: En seguimiento\nAcción: Confirmar fecha de firma\n\n💬 ¿Quieres que envíe un email a alguno?`;
  }

  return `Entendido. Para más opciones, escribe "ayuda" o envía una de estas palabras clave:\n\nestado • adidas • avellaneda • reporte • cateos • permiso`;
}

app.post('/api/whatsapp', (req, res) => {
  const incomingMessage = req.body.Body;
  const phoneNumber = req.body.From;

  console.log(`📱 Mensaje recibido de ${phoneNumber}: ${incomingMessage}`);

  chatMessages.push({
    type: 'user',
    text: incomingMessage,
    timestamp: new Date(),
    phone: phoneNumber
  });

  // Procesar y obtener respuesta
  let response = processMessage(incomingMessage);

  chatMessages.push({
    type: 'bot',
    text: response,
    timestamp: new Date(),
    phone: phoneNumber
  });

  // Crear respuesta TwiML para Twilio
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(response);

  res.type('text/xml');
  res.send(twiml.toString());

  console.log(`✅ Mensaje respondido: ${response.substring(0, 50)}...`);
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'Bot WhatsApp activo',
    timestamp: new Date(),
    projects: projects.length,
    messages: chatMessages.length
  });
});

app.get('/api/projects', (req, res) => {
  res.json(projects);
});

app.post('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const index = projects.findIndex(p => p.id == id);
  if (index !== -1) {
    projects[index] = { ...projects[index], ...req.body };
    res.json({ success: true, project: projects[index] });
  } else {
    res.status(404).json({ error: 'Proyecto no encontrado' });
  }
});

function generateDetailedReport() {
  const timestamp = new Date().toLocaleString('es-AR');
  const date = new Date().toLocaleDateString('es-AR');
  
  let reportHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #1a73e8; text-align: center; border-bottom: 3px solid #1a73e8; padding-bottom: 10px; }
    h2 { color: #1a73e8; margin-top: 30px; border-left: 4px solid #1a73e8; padding-left: 10px; }
    .project { background-color: #f9f9f9; padding: 20px; margin: 15px 0; border-left: 5px solid #4285f4; border-radius: 4px; }
    .status { display: inline-block; padding: 5px 10px; border-radius: 4px; font-weight: bold; margin: 5px 0; }
    .status.active { background-color: #34a853; color: white; }
    .status.blocked { background-color: #ea4335; color: white; }
    .status.pending { background-color: #fbbc04; color: black; }
    .risk { font-weight: bold; padding: 3px 8px; border-radius: 3px; }
    .risk.high { background-color: #ffcdd2; color: #c62828; }
    .risk.medium { background-color: #ffe0b2; color: #e65100; }
    .milestone { background-color: #e3f2fd; padding: 10px; margin: 8px 0; border-left: 3px solid #1976d2; border-radius: 3px; }
    .action { background-color: #f3e5f5; padding: 8px 10px; margin: 5px 0; border-left: 3px solid #7b1fa2; border-radius: 3px; }
    .approval { background-color: #e8f5e9; padding: 10px; margin: 8px 0; border-left: 3px solid #388e3c; border-radius: 3px; }
    .timestamp { color: #666; font-size: 12px; text-align: right; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
    .progress-bar { background-color: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }
    .progress-fill { background-color: #4285f4; height: 100%; transition: width 0.3s; }
    .summary { background-color: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 REPORTE DE PROYECTOS</h1>
    <p style="text-align: center; color: #666;"><strong>Fecha:</strong> ${date}</p>
    
    <div class="summary">
      <h3 style="margin-top: 0;">📈 Resumen General</h3>
      <p><strong>Total de proyectos:</strong> ${projects.length}</p>
      <p><strong>Proyectos activos:</strong> ${projects.filter(p => p.status !== 'Bloqueado').length}</p>
      <p><strong>Proyectos bloqueados:</strong> ${projects.filter(p => p.status === 'Bloqueado').length}</p>
    </div>
  `;

  // Agregar cada proyecto
  projects.forEach((project, index) => {
    reportHTML += `
    <div class="project">
      <h2>${index + 1}. ${project.name}</h2>
      
      <p>
        <strong>Estado:</strong> 
        <span class="status ${project.status === 'Por iniciar' ? 'pending' : project.status === 'Bloqueado' ? 'blocked' : 'active'}">
          ${project.status}
        </span>
      </p>
      
      <p>
        <strong>Riesgo:</strong> 
        <span class="risk ${project.riskLevel === 'ALTO' ? 'high' : 'medium'}">
          ${project.riskLevel}
        </span>
      </p>
      
      <p><strong>Progreso:</strong> ${project.progress}%</p>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${project.progress}%"></div>
      </div>
      
      <p><strong>Descripción:</strong> ${project.description}</p>
      <p><strong>Deadline:</strong> ${project.deadline}</p>
    `;

    // Hitos (Milestones)
    if (project.milestones && project.milestones.length > 0) {
      reportHTML += '<h3>📅 Hitos:</h3>';
      project.milestones.forEach(milestone => {
        reportHTML += `
        <div class="milestone">
          <strong>${milestone.name}</strong> | ${milestone.date} | Duración: ${milestone.duration}
        </div>
        `;
      });
    }

    // Aprobaciones
    if (project.approvals && project.approvals.length > 0) {
      reportHTML += '<h3>✅ Aprobaciones:</h3>';
      project.approvals.forEach(approval => {
        let statusClass = approval.status === 'OK' ? 'active' : 'pending';
        reportHTML += `
        <div class="approval">
          <strong>${approval.name}</strong> | Estado: <span class="status ${statusClass}">${approval.status}</span> | Prioridad: ${approval.priority}
        </div>
        `;
      });
    }

    // Acciones pendientes
    if (project.nextActions && project.nextActions.length > 0) {
      reportHTML += '<h3>🎯 Acciones Pendientes:</h3>';
      project.nextActions.forEach(action => {
        reportHTML += `<div class="action">▶ ${action}</div>`;
      });
    }

    reportHTML += '</div>'; // Cerrar proyecto
  });

  reportHTML += `
    <div class="timestamp">
      <p>Reporte generado: ${timestamp}</p>
      <p style="margin: 10px 0 0 0; font-size: 11px; color: #999;">Próximo reporte automático: Mañana a las 16:00 hs</p>
    </div>
  </div>
</body>
</html>
  `;

  return reportHTML;
}

function generateAndSendReport() {
  const reportHTML = generateDetailedReport();
  const date = new Date().toLocaleDateString('es-AR');

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'lilyfn@gmail.com',
    subject: `📊 Reporte de Proyectos - ${date}`,
    html: reportHTML
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('❌ Error al enviar email:', err);
    } else {
      console.log('✅ Email enviado:', info.response);
    }
  });
}

// Reportes automáticos: Diariamente a las 16:00 hs
cron.schedule('0 16 * * *', () => {
  console.log('⏰ [16:00 hs] Generando reporte automático diario...');
  generateAndSendReport();
});

// También a las 9:00 hs (opcional)
cron.schedule('0 9 * * *', () => {
  console.log('⏰ [09:00 hs] Generando reporte automático matutino...');
  generateAndSendReport();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n✅ SERVIDOR INICIADO`);
  console.log(`📌 Puerto: ${PORT}`);
  console.log(`🤖 Bot WhatsApp: ACTIVO`);
  console.log(`📧 Reportes automáticos: 09:00 hs y 16:00 hs diarios`);
  console.log(`\n⏳ Esperando mensajes de WhatsApp...\n`);
});
