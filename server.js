const express = require('express');
const twilio = require('twilio');
const axios = require('axios');
const cron = require('node-cron');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const client = twilio(accountSid, authToken);

// BREVO REST API - SIN SMTP
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// PROYECTOS
let projects = [
  {
    id: 1,
    name: 'Ampliación Adidas Soleil',
    status: 'Por iniciar',
    progress: 0,
    deadline: '2026-06-09',
    description: 'Cateos + Ingeniería (30 días) + Permiso (45 días)',
    location: 'Soleil, CABA',
    budget: '$250,000 USD',
    manager: 'Ing. Juan García',
    risks: ['Permiso es bloqueante', 'Cateos pueden extenderse'],
    nextSteps: ['Confirmar equipo cateos', 'Verificar documentos', 'Contactar gestor']
  },
  {
    id: 2,
    name: 'Ampliación Alto Avellaneda',
    status: 'Bloqueado',
    progress: 15,
    deadline: 'TBD',
    description: 'Esperando Carrefour y Rock&Fellers',
    location: 'Alto Avellaneda',
    budget: 'TBD',
    approvals: ['Carrefour - PRIORITARIO', 'Rock&Fellers - PRIORITARIO', 'Grupo América', 'Grafo CAPEX']
  }
];

// COMANDOS
let commands = {
  hola: {
    keywords: ['hola', 'hi', 'inicio'],
    response: `¡Hola! Soy tu bot de gestión de proyectos. Puedo ayudarte con:

📋 Escribe:
• "estado" - Ver estado de proyectos
• "adidas" - Info Adidas Soleil
• "avellaneda" - Info Alto Avellaneda
• "reporte" - Generar reporte
• "ayuda" - Ver todas las opciones`
  },
  estado: {
    keywords: ['estado', 'proyectos'],
    response: `📊 ESTADO DE PROYECTOS:

🚀 Adidas Soleil:
Estado: Por iniciar
Progreso: 0%
Deadline: 9 junio

⏸️ Alto Avellaneda:
Estado: Bloqueado
Progreso: 15%
Esperando: Carrefour y Rock&Fellers`
  },
  adidas: {
    keywords: ['adidas'],
    response: `🚀 AMPLIACIÓN ADIDAS SOLEIL

📅 Hitos:
• Cateos: 24 abr (5-7 días)
• Ingeniería: 30 días
• Permiso: 45 días

⚠️ Riesgo: ALTO (inicia viernes)

Próximos pasos:
✓ Confirmar equipo cateos
✓ Verificar gestor permisos`
  },
  avellaneda: {
    keywords: ['avellaneda'],
    response: `⏸️ AMPLIACIÓN ALTO AVELLANEDA

📋 Aprobaciones pendientes:
⏳ Carrefour - OK (PRIORITARIO)
⏳ Rock&Fellers - Firma (PRIORITARIO)
⏰ Grupo América - Cierre
⏰ Grafo CAPEX - Cierre

💬 Próxima acción:
Contactar a Carrefour y Rock&Fellers para confirmar timeline`
  }
};

let chatMessages = [];
let reportConfig = {
  email: 'lilyfn@gmail.com',
  time: '16:00',
  frequency: 'daily'
};

function processMessage(message) {
  const msg = message.toLowerCase();

  for (let cmdKey in commands) {
    const cmd = commands[cmdKey];
    if (cmd.keywords.some(keyword => msg.includes(keyword))) {
      return cmd.response;
    }
  }

  return `Entendido. Para más opciones, escribe "ayuda" o envía una de estas palabras clave:\n\nestado • adidas • avellaneda • reporte • cateos • permiso`;
}

// WEBHOOK WHATSAPP
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

  console.log(`✅ Mensaje respondido`);
});

// API: OBTENER PROYECTOS
app.get('/api/projects', (req, res) => {
  res.json(projects);
});

// API: ACTUALIZAR PROYECTO
app.post('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const index = projects.findIndex(p => p.id == id);
  
  if (index !== -1) {
    projects[index] = { ...projects[index], ...req.body };
    console.log(`✅ Proyecto ${id} actualizado`);
    res.json({ success: true, project: projects[index] });
  } else {
    res.status(404).json({ error: 'Proyecto no encontrado' });
  }
});

// API: OBTENER COMANDOS
app.get('/api/commands', (req, res) => {
  res.json(commands);
});

// API: ACTUALIZAR COMANDO
app.post('/api/commands/:name', (req, res) => {
  const { name } = req.params;
  const { keywords, response } = req.body;
  
  if (commands[name]) {
    commands[name] = { keywords, response };
    console.log(`✅ Comando "${name}" actualizado`);
    res.json({ success: true, command: commands[name] });
  } else {
    res.status(404).json({ error: 'Comando no encontrado' });
  }
});

// API: CREAR NUEVO COMANDO
app.post('/api/commands/create/new', (req, res) => {
  const { name, keywords, response } = req.body;
  
  if (!name || !keywords || !response) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  
  commands[name] = { keywords: keywords.split(',').map(k => k.trim()), response };
  console.log(`✅ Nuevo comando "${name}" creado`);
  res.json({ success: true, command: commands[name] });
});

// API: OBTENER CONFIG REPORTES
app.get('/api/report-config', (req, res) => {
  res.json(reportConfig);
});

// API: ACTUALIZAR CONFIG REPORTES
app.post('/api/report-config', (req, res) => {
  const { email, time, frequency } = req.body;
  
  if (email) reportConfig.email = email;
  if (time) reportConfig.time = time;
  if (frequency) reportConfig.frequency = frequency;
  
  console.log(`✅ Configuración de reportes actualizada`);
  res.json({ success: true, config: reportConfig });
});

// API: STATUS
app.get('/api/status', (req, res) => {
  res.json({
    status: 'Bot WhatsApp activo',
    timestamp: new Date(),
    projects: projects.length,
    messages: chatMessages.length
  });
});

// GENERAR REPORTE
function generateReport() {
  const timestamp = new Date().toLocaleString('es-AR');
  let reportText = `═══════════════════════════════════════
📊 REPORTE AUTOMÁTICO DE PROYECTOS
═══════════════════════════════════════
Generado: ${timestamp}

`;

  projects.forEach(proj => {
    reportText += `${proj.id === 1 ? '🚀' : '⏸️'} ${proj.name.toUpperCase()}
Estado: ${proj.status}
Progreso: ${proj.progress}%
Ubicación: ${proj.location || 'TBD'}
Presupuesto: ${proj.budget || 'TBD'}
Gerente: ${proj.manager || 'TBD'}
Deadline: ${proj.deadline || 'TBD'}

${proj.description}

`;

    if (proj.risks) {
      reportText += `Riesgos:\n`;
      proj.risks.forEach(risk => reportText += `  • ${risk}\n`);
      reportText += '\n';
    }

    if (proj.nextSteps) {
      reportText += `Próximos pasos:\n`;
      proj.nextSteps.forEach((step, i) => reportText += `  ${i+1}. ${step}\n`);
      reportText += '\n';
    }

    if (proj.approvals) {
      reportText += `Aprobaciones pendientes:\n`;
      proj.approvals.forEach(app => reportText += `  ⏳ ${app}\n`);
      reportText += '\n';
    }
  });

  reportText += `═══════════════════════════════════════
Próximo reporte: Mañana a las ${reportConfig.time} hs`;

  return reportText;
}

// ENVIAR EMAIL POR BREVO API
async function sendEmailByBrevo(emailText) {
  try {
    const payload = {
      sender: {
        name: 'Bot PM',
        email: 'lilyfn@gmail.com'
      },
      to: [
        {
          email: reportConfig.email,
          name: 'Lily'
        }
      ],
      subject: `📊 Reporte Proyectos - ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
      textContent: emailText
    };

    const response = await axios.post(BREVO_API_URL, payload, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Email enviado por Brevo REST API - Message ID:', response.data.messageId);
    return true;
  } catch (err) {
    console.error('❌ Error al enviar email por Brevo:', err.response?.data || err.message);
    return false;
  }
}

function generateAndSendReport() {
  const report = generateReport();
  sendEmailByBrevo(report);
}

// API: GENERAR REPORTE AHORA
app.post('/api/generate-report', (req, res) => {
  generateAndSendReport();
  res.json({ success: true, message: 'Reporte generado y enviado' });
});

// REPORTES AUTOMÁTICOS - 16:00 HS
cron.schedule('0 16 * * *', () => {
  console.log('⏰ [16:00 hs] Generando reporte automático diario...');
  generateAndSendReport();
});

// SERVIR DASHBOARD
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// INICIAR SERVIDOR
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n✅ SERVIDOR INICIADO`);
  console.log(`📌 Puerto: ${PORT}`);
  console.log(`🤖 Bot WhatsApp: ACTIVO`);
  console.log(`📧 Email: Brevo REST API (sin SMTP)`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`📧 Reportes automáticos: Diariamente a las ${reportConfig.time} hs`);
  console.log(`\n⏳ Esperando mensajes de WhatsApp...\n`);
});
