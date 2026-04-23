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

// ============================================
// CONFIGURACIÓN TWILIO
// ============================================
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const client = twilio(accountSid, authToken);

// ============================================
// CONFIGURACIÓN EMAIL
// ============================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ============================================
// BASE DE DATOS EN MEMORIA
// ============================================
let projects = [
  {
    id: 1,
    name: 'Ampliación Adidas Soleil',
    status: 'Por iniciar',
    progress: 0,
    deadline: '2026-06-09',
    description: 'Cateos + Ingeniería (30 días) + Permiso (45 días)'
  },
  {
    id: 2,
    name: 'Ampliación Alto Avellaneda',
    status: 'Bloqueado',
    progress: 15,
    deadline: 'TBD',
    description: 'Esperando Carrefour y Rock&Fellers'
  }
];

let chatMessages = [];

// ============================================
// WEBHOOK PARA RECIBIR MENSAJES DE WHATSAPP
// ============================================
app.post('/api/whatsapp', (req, res) => {
  const incomingMessage = req.body.Body;
  const phoneNumber = req.body.From;

  console.log(`📱 Mensaje recibido de ${phoneNumber}: ${incomingMessage}`);

  // Guardar mensaje del usuario
  chatMessages.push({
    type: 'user',
    text: incomingMessage,
    timestamp: new Date(),
    phone: phoneNumber
  });

  // Procesar mensaje y generar respuesta
  let response = processMessage(incomingMessage);

  // Guardar respuesta
  chatMessages.push({
    type: 'bot',
    text: response,
    timestamp: new Date(),
    phone: phoneNumber
  });

  // Enviar respuesta por WhatsApp
  client.messages
    .create({
      body: response,
      from: `whatsapp:${twilioWhatsAppNumber}`,
      to: phoneNumber
    })
    .then(message => {
      console.log(`✅ Mensaje enviado: ${message.sid}`);
      res.status(200).send('OK');
    })
    .catch(err => {
      console.error('❌ Error enviando mensaje:', err);
      res.status(500).send('Error');
    });
});

// ============================================
// FUNCIÓN PROCESAR MENSAJES
// ============================================
function processMessage(message) {
  const msg = message.toLowerCase();

  // Casos de uso
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

  // Respuesta por defecto
  return `Entendido. Para más opciones, escribe "ayuda" o envía una de estas palabras clave:\n\nestado • adidas • avellaneda • reporte • cateos • permiso`;
}

// ============================================
// ENDPOINTS API
// ============================================

// GET: Obtener estado general
app.get('/api/status', (req, res) => {
  res.json({
    status: 'Bot WhatsApp activo',
    timestamp: new Date(),
    projects: projects.length,
    messages: chatMessages.length
  });
});

// GET: Obtener proyectos
app.get('/api/projects', (req, res) => {
  res.json(projects);
});

// POST: Actualizar proyecto
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

// ============================================
// FUNCIÓN GENERAR Y ENVIAR REPORTE
// ============================================
function generateReport() {
  const timestamp = new Date().toLocaleString('es-AR');
  return `
═══════════════════════════════════════
📊 REPORTE AUTOMÁTICO DE PROYECTOS
═══════════════════════════════════════
Generado: ${timestamp}

🚀 AMPLIACIÓN ADIDAS SOLEIL
Estado: Por iniciar (0%)
Hitos:
  • Cateos: 24 abr (5-7 días)
  • Ingeniería: 30 días
  • Permiso: 45 días - CRÍTICO
Próxima acción: Iniciar viernes 24

⏸️ AMPLIACIÓN ALTO AVELLANEDA
Estado: Bloqueado (15%)
Aprobaciones pendientes:
  • Carrefour (PRIORITARIO)
  • Rock&Fellers (PRIORITARIO)
  • Grupo América
  • Grafo CAPEX
Próxima acción: Contactar Carrefour y Rock&Fellers

═══════════════════════════════════════
Próximo reporte: Mañana a las 16:00 hs
  `;
}

function generateAndSendReport() {
  const report = generateReport();

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'lilyfn@gmail.com',
    subject: `📊 Reporte Proyectos - ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
    text: report
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('❌ Error al enviar email:', err);
    } else {
      console.log('✅ Email enviado:', info.response);
    }
  });
}

// ============================================
// CRON: REPORTES AUTOMÁTICOS DIARIAMENTE A LAS 16:00
// ============================================
cron.schedule('0 16 * * *', () => {
  console.log('⏰ [16:00 hs] Generando reporte automático diario...');
  generateAndSendReport();
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n✅ SERVIDOR INICIADO`);
  console.log(`📌 Puerto: ${PORT}`);
  console.log(`🤖 Bot WhatsApp: ACTIVO`);
  console.log(`📧 Reportes automáticos: Diariamente a las 16:00 hs`);
  console.log(`\n⏳ Esperando mensajes de WhatsApp...\n`);
});
