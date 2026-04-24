const express = require('express');
const twilio = require('twilio');
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

// ===== PROYECTOS =====
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
    manager: 'TBD',
    approvals: ['Carrefour - PRIORITARIO', 'Rock&Fellers - PRIORITARIO', 'Grupo América', 'Grafo CAPEX']
  }
];

// ===== COMANDOS BOT =====
let commands = {
  hola: {
    keywords: ['hola', 'hi', 'inicio'],
    response: `¡Hola! Soy tu bot de gestión de proyectos. Puedo ayudarte con:
📋 Escribe:
• "estado" - Ver estado de proyectos
• "adidas" - Info Adidas Soleil
• "avellaneda" - Info Alto Avellaneda
• "ayuda" - Ver todas las opciones`
  },
  estado: {
    keywords: ['estado', 'proyectos'],
    response: `📊 ESTADO DE PROYECTOS:
🚀 Adidas Soleil: Por iniciar | 0% | Deadline: 9 junio
⏸️ Alto Avellaneda: Bloqueado | 15% | Esperando aprobaciones`
  },
  adidas: {
    keywords: ['adidas'],
    response: `🚀 AMPLIACIÓN ADIDAS SOLEIL
Ubicación: Soleil, CABA
Gerente: Ing. Juan García
Presupuesto: $250,000 USD
Deadline: 9 junio
Estado: Por iniciar | Progreso: 0%

📅 Hitos:
• Cateos: 24 abr (5-7 días)
• Ingeniería: 30 días
• Permiso: 45 días

✓ Próximos pasos:
- Confirmar equipo cateos
- Verificar documentos
- Contactar gestor`
  },
  avellaneda: {
    keywords: ['avellaneda'],
    response: `⏸️ AMPLIACIÓN ALTO AVELLANEDA
Ubicación: Alto Avellaneda
Estado: Bloqueado | Progreso: 15%

📋 Aprobaciones pendientes:
⏳ Carrefour - PRIORITARIO
⏳ Rock&Fellers - PRIORITARIO
⏰ Grupo América
⏰ Grafo CAPEX`
  }
};

function processMessage(message) {
  const msg = message.toLowerCase();
  for (let cmdKey in commands) {
    const cmd = commands[cmdKey];
    if (cmd.keywords.some(keyword => msg.includes(keyword))) {
      return cmd.response;
    }
  }
  return `Entendido. Escribe "ayuda" para ver todas las opciones.`;
}

// ===== WEBHOOK WHATSAPP =====
app.post('/api/whatsapp', (req, res) => {
  const incomingMessage = req.body.Body;
  const phoneNumber = req.body.From;

  console.log(`📱 Mensaje: ${incomingMessage}`);

  let response = processMessage(incomingMessage);

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(response);

  res.type('text/xml');
  res.send(twiml.toString());

  console.log(`✅ Respondido`);
});

// ===== API: PROYECTOS =====
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

// ===== API: COMANDOS =====
app.get('/api/commands', (req, res) => {
  res.json(commands);
});

// ===== SERVIR DASHBOARD =====
app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard', (req, res) => {
  res.redirect('/dashboard.html');
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando' });
});

// ===== INICIAR SERVIDOR =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n✅ SERVIDOR INICIADO`);
  console.log(`📌 Puerto: ${PORT}`);
  console.log(`🤖 Bot WhatsApp: ACTIVO`);
  console.log(`🌐 Dashboard: /dashboard.html`);
  console.log(`\n⏳ Esperando mensajes de WhatsApp...\n`);
});
