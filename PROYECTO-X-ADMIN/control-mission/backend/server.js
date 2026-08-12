/**
 * CONTROL MISSION - Servidor Principal
 * 
 * Centro de comando para agentes de desarrollo de software
 * Conecta Telegram, Dashboard Web, y Agentes AI
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Importar módulos internos
const AgentManager = require('./agent-manager');
const TaskQueue = require('./task-queue');
const TelegramBot = require('./telegram-bot');
const Logger = require('./logger');
const Database = require('./database');
const CoordinatorAgent = require('./coordinator-agent');

// Inicializar express
const app = express();
const server = http.createServer(app);

// Configurar Socket.io para tiempo real
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Inicializar base de datos
const db = new Database();

// Inicializar logger
const logger = new Logger();

// Inicializar manager de agentes
const agentManager = new AgentManager(io, db, logger);

// Inicializar cola de tareas
const taskQueue = new TaskQueue(io, db, logger, agentManager);

// Inicializar coordinador (NUNCA DUERME)
const coordinator = new CoordinatorAgent(io, db, logger, agentManager, taskQueue);

// Inicializar bot de Telegram (con referencia a JARVIS)
const telegramBot = new TelegramBot(io, db, logger, coordinator);

// Middlewares
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));
app.use(express.json());

// Servir archivos estáticos del frontend
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// ===========================================
// API REST ENDPOINTS
// ===========================================

// Obtener estado del sistema
app.get('/api/status', (req, res) => {
  const status = {
    server: 'online',
    agents: agentManager.getAgentsStatus(),
    queue: taskQueue.getQueueStatus(),
    timestamp: new Date().toISOString()
  };
  res.json(status);
});

// Obtener todas las tareas
app.get('/api/tasks', (req, res) => {
  const tasks = db.getTasks();
  res.json(tasks);
});

// Obtener tarea específica
app.get('/api/tasks/:id', (req, res) => {
  const task = db.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }
  res.json(task);
});

// Crear nueva tarea
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, type, priority = 'medium', assignedAgent } = req.body;

    if (!title || !type) {
      return res.status(400).json({ error: 'Title y type son requeridos' });
    }

    const task = await taskQueue.createTask({
      title,
      description,
      type,
      priority,
      assignedAgent
    });

    res.status(201).json(task);
  } catch (error) {
    logger.error('Error creando tarea', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancelar tarea
app.post('/api/tasks/:id/cancel', (req, res) => {
  try {
    taskQueue.cancelTask(req.params.id);
    res.json({ success: true, message: 'Tarea cancelada' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Obtener logs
app.get('/api/logs', (req, res) => {
  const logs = db.getLogs(100);
  res.json(logs);
});

// ===========================================
// SOCKET.IO - Eventos en Tiempo Real
// ===========================================

io.on('connection', (socket) => {
  logger.info(`Cliente conectado: ${socket.id}`);

  // Enviar estado inicial
  socket.emit('system:status', {
    agents: agentManager.getAgentsStatus(),
    queue: taskQueue.getQueueStatus()
  });

  // Escuchar comandos del dashboard
  socket.on('command:createTask', async (data) => {
    try {
      const task = await taskQueue.createTask(data);
      socket.emit('task:created', task);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('command:cancelTask', (taskId) => {
    taskQueue.cancelTask(taskId);
  });

  socket.on('command:restartAgent', (agentId) => {
    agentManager.restartAgent(agentId);
  });

  socket.on('disconnect', () => {
    logger.info(`Cliente desconectado: ${socket.id}`);
  });
});

// ===========================================
// INICIAR SERVIDOR
// ===========================================

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  logger.info(`🚀 CONTROL MISSION iniciado en puerto ${PORT}`);
  logger.info(`📊 Dashboard: http://localhost:${PORT}`);
  logger.info(`🔌 Socket.io: http://localhost:${PORT}`);
  logger.info(`📱 Telegram Bot: @${process.env.TELEGRAM_BOT_NAME || 'Configurado'}`);
  logger.info(`🤖 JARVIS: Just A Rather Very Intelligent System - Nunca Duerme`);

  // Iniciar agentes
  agentManager.initializeAllAgents();

  // Iniciar bot de Telegram
  telegramBot.start();

  // Iniciar JARVIS (NUNCA DUERME)
  coordinator.start();
});

// Manejar cierre graceful
process.on('SIGTERM', () => {
  logger.info('Recibida señal SIGTERM, cerrando...');
  agentManager.shutdown();
  telegramBot.stop();
  coordinator.stop();
  server.close(() => {
    logger.info('Servidor cerrado');
    logger.info('🤖 JARVIS: Hasta luego...');
    process.exit(0);
  });
});

module.exports = { app, server, io };
