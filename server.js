const express = require('express');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (dashboard)
app.use(express.static(path.join(__dirname)));

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

// Procesar comandos de actualización
function parseUpdateCommand(message) {
  const msg = message.toLowerCase().trim();
  
  // Formato: "actualizar <proyecto> <campo> <valor>"
  // Ejemplo: "actualizar 1 progreso 50"
  // Ejemplo: "actualizar 2 estado en progreso"
  
  const parts = msg.split('|').map(p => p.trim());
  
  if (parts[0].includes('actualizar') && parts.length >= 2) {
    return {
      isUpdate: true,
      projectId: parseInt(parts[0].split(' ')[1]),
      field: parts[1] ? parts[1].toLowerCase() : null,
      value: parts[2] || parts.slice(2).join(' ')
    };
  }
  
  return { isUpdate: false };
}

function updateProjectField(projectId, field, value) {
  const projectIndex = projects.findIndex(p => p.id === projectId);
  
  if (projectIndex === -1) {
    return { success: false, message: '❌ Proyecto no encontrado' };
  }

  const project = projects[projectIndex];
  field = field.toLowerCase().trim();

  switch(field) {
    case 'progreso':
    case 'progress':
      const progress = parseInt(value);
      if (isNaN(progress) || progress < 0 || progress > 100) {
        return { success: false, message: '❌ El progreso debe ser un número entre 0 y 100' };
      }
      project.progress = progress;
      return { success: true, message: `✅ Progreso actualizado a ${progress}%` };

    case 'estado':
    case 'status':
      const validStates = ['por iniciar', 'en progreso', 'bloqueado', 'completado'];
      if (!validStates.includes(value.toLowerCase())) {
        return { success: false, message: '❌ Estados válidos: Por iniciar, En progreso, Bloqueado, Completado' };
      }
      project.status = value.charAt(0).toUpperCase() + value.slice(1);
      return { success: true, message: `✅ Estado actualizado a: ${project.status}` };

    case 'riesgo':
    case 'risk':
      const validRisks = ['bajo', 'medio', 'alto'];
      if (!validRisks.includes(value.toLowerCase())) {
        return { success: false, message: '❌ Riesgos válidos: BAJO, MEDIO, ALTO' };
      }
      project.riskLevel = value.toUpperCase();
      return { success: true, message: `✅ Nivel de riesgo actualizado a: ${project.riskLevel}` };

    case 'descripción':
    case 'description':
      project.description = value;
      return { success: true, message: `✅ Descripción actualizada` };

    case 'acción':
    case 'action':
    case 'agregar acción':
      if (!project.nextActions) project.nextActions = [];
      project.nextActions.push(value);
      return { success: true, message: `✅ Acción agregada: "${value}"` };

    case 'deadline':
      project.deadline = value;
      return { success: true, message: `✅ Deadline actualizado a: ${value}` };

    default:
      return { success: false, message: `❌ Campo no reconocido: ${field}` };
  }
}

function processMessage(message) {
  const msg = message.toLowerCase().trim();

  // Verificar si es comando de actualización
  if (msg.includes('actualizar')) {
    // Formato mejorado: "actualizar proyecto 1 | progreso 50"
    const lines = message.split('|').map(l => l.trim());
    
    if (lines.length >= 2) {
      const firstLine = lines[0].toLowerCase();
      const projectMatch = firstLine.match(/\d+/);
      const projectId = projectMatch ? parseInt(projectMatch[0]) : null;

      if (!projectId) {
        return '❌ Formato incorrecto. Usa:\nactualizar proyecto 1 | progreso 50\nactualizar proyecto 2 | estado en progreso';
      }

      const project = projects.find(p => p.id === projectId);
      if (!project) {
        return `❌ Proyecto ${projectId} no encontrado`;
      }

      let responses = [`📝 Actualizando ${project.name}...\n`];
      
      for (let i = 1; i < lines.length; i++) {
        const [field, ...valueParts] = lines[i].split(' ');
        const value = valueParts.join(' ');
        
        if (field && value) {
          const result = updateProjectField(projectId, field, value);
          responses.push(result.message);
        }
      }

      return responses.join('\n');
    }

    // Formato antiguo
    const parts = message.split(' ');
    if (parts.length >= 4) {
      const projectId = parseInt(parts[1]);
      const field = parts[2];
      const value = parts.slice(3).join(' ');
      
      const result = updateProjectField(projectId, field, value);
      return result.message;
    }

    return `📝 COMANDO ACTUALIZAR
Use este formato:
actualizar proyecto 1 | progreso 50
actualizar proyecto 1 | estado en progreso
actualizar proyecto 2 | riesgo bajo
actualizar proyecto 2 | acción Nueva acción importante`;
  }

  // Otros comandos
  if (msg.includes('hola') || msg.includes('hi') || msg.includes('inicio')) {
    return `¡Hola! 👋 Soy tu bot de gestión de proyectos.\n\n📋 COMANDOS:\n• "estado" - Ver estado actual\n• "actualizar" - Actualizar proyecto\n• "adidas" - Info Adidas\n• "avellaneda" - Info Avellaneda\n• "reporte" - Enviar reporte\n• "ayuda" - Ver todas las opciones`;
  }

  if (msg.includes('estado') || msg.includes('proyectos')) {
    return `📊 ESTADO DE PROYECTOS:\n\n🚀 ${projects[0].name}\nEstado: ${projects[0].status}\nProgreso: ${projects[0].progress}%\nRiesgo: ${projects[0].riskLevel}\n\n⏸️ ${projects[1].name}\nEstado: ${projects[1].status}\nProgreso: ${projects[1].progress}%\nRiesgo: ${projects[1].riskLevel}`;
  }

  if (msg.includes('adidas')) {
    const project = projects[0];
    return `🚀 ${project.name}\n\nEstado: ${project.status}\nProgreso: ${project.progress}%\nRiesgo: ${project.riskLevel}\nDeadline: ${project.deadline}\n\nAcciones pendientes:\n${project.nextActions.map(a => '• ' + a).join('\n')}`;
  }

  if (msg.includes('avellaneda')) {
    const project = projects[1];
    return `⏸️ ${project.name}\n\nEstado: ${project.status}\nProgreso: ${project.progress}%\nRiesgo: ${project.riskLevel}\n\nAcciones pendientes:\n${project.nextActions.map(a => '• ' + a).join('\n')}`;
  }

  if (msg.includes('reporte')) {
    generateAndSendReport();
    return `📊 Reporte enviado a lilyfn@gmail.com\n\n⏰ Próximos reportes automáticos:\n• 09:00 hs\n• 16:00 hs`;
  }

  if (msg.includes('ayuda')) {
    return `❓ COMANDOS DISPONIBLES:\n\n📋 Información:\n• "estado" - Ver estado todos\n• "adidas" - Detalles Adidas\n• "avellaneda" - Detalles Avellaneda\n\n✏️ Actualizar:\n• "actualizar proyecto 1 | progreso 50"\n• "actualizar proyecto 1 | estado en progreso"\n• "actualizar proyecto 2 | riesgo bajo"\n• "actualizar proyecto 1 | acción Nueva tarea"\n\n📧 Reportes:\n• "reporte" - Enviar ahora`;
  }

  return `Comando no reconocido. Escribe "ayuda" para ver opciones.`;
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

  let response = processMessage(incomingMessage);

  chatMessages.push({
    type: 'bot',
    text: response,
    timestamp: new Date(),
    phone: phoneNumber
  });

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(response);

  res.type('text/xml');
  res.send(twiml.toString());

  console.log(`✅ Respuesta enviada`);
});

// API para obtener proyectos
app.get('/api/projects', (req, res) => {
  res.json(projects);
});

// API para actualizar proyectos desde web
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

// API de estado
app.get('/api/status', (req, res) => {
  res.json({
    status: 'Bot WhatsApp activo',
    timestamp: new Date(),
    projects: projects.length,
    messages: chatMessages.length
  });
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
    .risk.low { background-color: #c8e6c9; color: #2e7d32; }
    .action { background-color: #f3e5f5; padding: 8px 10px; margin: 5px 0; border-left: 3px solid #7b1fa2; border-radius: 3px; }
    .progress-bar { background-color: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }
    .progress-fill { background-color: #4285f4; height: 100%; transition: width 0.3s; }
    .timestamp { color: #666; font-size: 12px; text-align: right; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 REPORTE DE PROYECTOS</h1>
    <p style="text-align: center; color: #666;"><strong>Fecha:</strong> ${date}</p>
  `;

  projects.forEach((project) => {
    reportHTML += `
    <div class="project">
      <h2>${project.name}</h2>
      
      <p>
        <strong>Estado:</strong> 
        <span class="status ${project.status === 'Bloqueado' ? 'blocked' : project.status === 'Completado' ? 'active' : 'pending'}">
          ${project.status}
        </span>
      </p>
      
      <p>
        <strong>Riesgo:</strong> 
        <span class="risk ${project.riskLevel === 'ALTO' ? 'high' : project.riskLevel === 'MEDIO' ? 'medium' : 'low'}">
          ${project.riskLevel}
        </span>
      </p>
      
      <p><strong>Progreso:</strong> ${project.progress}%</p>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${project.progress}%"></div>
      </div>
      
      <p><strong>Descripción:</strong> ${project.description}</p>
      <p><strong>Deadline:</strong> ${project.deadline}</p>
      
      ${project.nextActions && project.nextActions.length > 0 ? `
        <h3>🎯 Acciones Pendientes:</h3>
        ${project.nextActions.map(action => `<div class="action">▶ ${action}</div>`).join('')}
      ` : ''}
    </div>
    `;
  });

  reportHTML += `
    <div class="timestamp">
      <p>Reporte generado: ${timestamp}</p>
      <p style="margin: 10px 0 0 0; font-size: 11px; color: #999;">Próximos reportes: 09:00 hs y 16:00 hs</p>
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

// cron.schedule('0 9 * * *', () => {
//   console.log('⏰ [09:00 hs] Generando reporte automático...');
//   generateAndSendReport();
// });
// cron.schedule('0 16 * * *', () => {
//   console.log('⏰ [16:00 hs] Generando reporte automático...');
//   generateAndSendReport();
// });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n✅ SERVIDOR INICIADO`);
  console.log(`📌 Puerto: ${PORT}`);
  console.log(`🤖 Bot WhatsApp: ACTIVO`);
  console.log(`📧 Reportes automáticos: 09:00 hs y 16:00 hs`);
  console.log(`🌐 Dashboard: /dashboard.html`);
  console.log(`\n⏳ Esperando mensajes de WhatsApp...\n`);
});
