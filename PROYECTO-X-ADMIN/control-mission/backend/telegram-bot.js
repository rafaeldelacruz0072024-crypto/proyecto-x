/**
 * Telegram Bot Integration - JARVIS Edition
 * Permite controlar JARVIS desde Telegram con texto y audios
 */

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

class TelegramBotService {
  constructor(io, db, logger, jarvis) {
    this.io = io;
    this.db = db;
    this.logger = logger;
    this.jarvis = jarvis; // Referencia a JARVIS para ejecutar comandos
    this.bot = null;
    this.authorizedUsers = [];

    // Cargar usuarios autorizados
    const authorizedUsersStr = process.env.TELEGRAM_AUTHORIZED_USERS || '';
    this.authorizedUsers = authorizedUsersStr.split(',').map(id => id.trim()).filter(id => id);

    // Configuración de Whisper para audio
    this.whisperApiKey = process.env.OPENAI_API_KEY;
    this.whisperEndpoint = 'https://api.openai.com/v1/audio/transcriptions';
  }

  /**
   * Iniciar el bot
   */
  start() {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN') {
      this.logger.warn('📱 Telegram Bot no configurado - Token faltante');
      return;
    }

    try {
      this.bot = new TelegramBot(token, { polling: true });
      this.setupEventHandlers();
      this.logger.info('📱 Telegram Bot iniciado - Conectado a JARVIS');

      // Notificar a usuarios autorizados
      this.notifyAuthorizedUsers('🤖 JARVIS en línea - Listo para recibir comandos');
    } catch (error) {
      this.logger.error('Error iniciando Telegram Bot', { error: error.message });
    }
  }

  /**
   * Configurar handlers de eventos
   */
  setupEventHandlers() {
    // Manejar mensajes de texto
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text?.trim();

      // Verificar usuario autorizado
      if (!this.isAuthorized(userId)) {
        this.sendMessage(chatId, '❌ No estás autorizado para usar JARVIS.\n\nContacta al administrador para obtener acceso.');
        this.logger.logTelegram(userId, 'No autorizado');
        return;
      }

      // Manejar comandos
      if (text) {
        await this.handleTextMessage(chatId, userId, text);
      }
    });

    // Manejar mensajes de voz/audio
    this.bot.on('voice', async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAuthorized(userId)) {
        return;
      }

      await this.handleVoiceMessage(chatId, userId, msg.voice);
    });

    // Manejar mensajes de audio
    this.bot.on('audio', async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.isAuthorized(userId)) {
        return;
      }

      await this.handleAudioMessage(chatId, userId, msg.audio);
    });

    // Comandos específicos
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.sendWelcomeMessage(chatId);
    });

    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      this.sendHelpMessage(chatId);
    });

    this.bot.onText(/\/status/, (msg) => {
      const chatId = msg.chat.id;
      this.sendStatusReport(chatId);
    });

    this.bot.onText(/\/tasks/, (msg) => {
      const chatId = msg.chat.id;
      this.sendTasksReport(chatId);
    });

    this.bot.onText(/\/agents/, (msg) => {
      const chatId = msg.chat.id;
      this.sendAgentsReport(chatId);
    });

    this.bot.onText(/\/stats/, (msg) => {
      const chatId = msg.chat.id;
      this.sendStatsReport(chatId);
    });

    this.bot.onText(/\/commands/, (msg) => {
      const chatId = msg.chat.id;
      this.sendCommandsList(chatId);
    });

    this.bot.onText(/\/logs/, (msg) => {
      const chatId = msg.chat.id;
      this.sendLogsReport(chatId);
    });
  }

  /**
   * Manejar mensaje de texto
   */
  async handleTextMessage(chatId, userId, text) {
    this.logger.logTelegram(userId, 'Mensaje de texto', { text });

    // Si empieza con /jarvis o es un comando directo
    if (text.startsWith('/jarvis') || text.startsWith('jarvis')) {
      const command = text.replace(/^(\/jarvis|jarvis)\s*/i, '').trim();

      if (command) {
        await this.executeJarvisCommand(chatId, userId, command);
      } else {
        this.sendMessage(chatId, '🤖 JARVIS escucha...\n\nEnvía un comando después de "jarvis"\n\nEjemplo:\n`jarvis crear api llamada mi-api`', { parse_mode: 'Markdown' });
      }
      return;
    }

    // Si es un comando directo (sin jarvis)
    if (this.isJarvisCommand(text)) {
      await this.executeJarvisCommand(chatId, userId, text);
      return;
    }

    // Responder normalmente
    this.sendMessage(chatId, '💡 Usa `/jarvis <comando>` o envía un audio\n\nEjemplos:\n- `/jarvis crear api llamada test`\n- `/commands` para ver todos\n- O envía un audio diciendo el comando', { parse_mode: 'Markdown' });
  }

  /**
   * Manejar mensaje de voz
   */
  async handleVoiceMessage(chatId, userId, voice) {
    this.logger.logTelegram(userId, 'Mensaje de voz', { file_id: voice.file_id });

    // Enviar mensaje de "procesando"
    const processingMsg = await this.sendMessage(chatId, '🎤 Escuchando tu comando de voz...');

    try {
      // Descargar audio
      const fileLink = await this.bot.getFileLink(voice.file_id);
      const audioPath = await this.downloadFile(fileLink, `voice_${userId}_${Date.now()}.ogg`);

      // Transcribir con Whisper
      const transcription = await this.transcribeAudio(audioPath);

      // Eliminar archivo temporal
      fs.unlinkSync(audioPath);

      if (transcription) {
        // Actualizar mensaje
        await this.editMessage(processingMsg.chat.id, processingMsg.message_id,
          `🎤 Comando de voz detectado:\n\n"${transcription}"\n\n⏳ Ejecutando...`);

        // Ejecutar comando
        await this.executeJarvisCommand(chatId, userId, transcription);
      } else {
        await this.editMessage(processingMsg.chat.id, processingMsg.message_id,
          '❌ No pude entender el audio. Intenta de nuevo.');
      }
    } catch (error) {
      this.logger.error('Error procesando audio', error);
      await this.editMessage(processingMsg.chat.id, processingMsg.message_id,
        `❌ Error procesando audio: ${error.message}`);
    }
  }

  /**
   * Manejar mensaje de audio
   */
  async handleAudioMessage(chatId, userId, audio) {
    // Similar al manejo de voz
    await this.handleVoiceMessage(chatId, userId, { file_id: audio.file_id });
  }

  /**
   * Ejecutar comando de JARVIS
   */
  async executeJarvisCommand(chatId, userId, commandText) {
    this.logger.logTelegram(userId, 'Comando JARVIS', { command: commandText });

    // Notificar inicio
    this.sendMessage(chatId, `⏳ JARVIS procesando:\n"${commandText}"`, { parse_mode: 'Markdown' });

    try {
      // Ejecutar comando en JARVIS
      const result = await this.jarvis.executeCommand(commandText, { source: 'telegram', userId });

      // Enviar resultado
      if (result.success) {
        let message = `✅ **JARVIS Completó:**\n\n${result.message || 'Comando ejecutado'}`;

        if (result.nextSteps) {
          message += '\n\n📋 **Próximos Pasos:**\n';
          result.nextSteps.forEach(step => {
            message += `\n• ${step}`;
          });
        }

        if (result.files) {
          message += '\n\n📁 **Archivos Creados:**\n';
          result.files.forEach(file => {
            message += `\n• ${file}`;
          });
        }

        this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        this.sendMessage(chatId, `❌ **Error:**\n${result.error}`, { parse_mode: 'Markdown' });
      }

      // Actualizar métricas
      this.db.addLog({
        level: 'info',
        message: `Telegram: ${commandText}`,
        userId: userId,
        success: result.success
      });

    } catch (error) {
      this.logger.error('Error ejecutando comando', error);
      this.sendMessage(chatId, `❌ **Error:**\n${error.message}`, { parse_mode: 'Markdown' });
    }
  }

  /**
   * Transcribir audio con Whisper
   */
  async transcribeAudio(audioPath) {
    if (!this.whisperApiKey) {
      throw new Error('OpenAI API Key no configurada. Agrega OPENAI_API_KEY a .env');
    }

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(audioPath));
      formData.append('model', 'whisper-1');
      formData.append('language', 'es');

      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.whisperApiKey}`,
          ...formData.getHeaders()
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response.text || null);
          } catch {
            reject(new Error('Error parseando respuesta de Whisper'));
          }
        });
      });

      req.on('error', reject);
      formData.pipe(req);
    });
  }

  /**
   * Descargar archivo
   */
  async downloadFile(url, filename) {
    const tempDir = path.join(__dirname, '..', 'temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, filename);

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);

      https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(filePath);
        });
      }).on('error', (err) => {
        fs.unlink(filePath, () => reject(err));
      });
    });
  }

  /**
   * Verificar si es comando de JARVIS
   */
  isJarvisCommand(text) {
    const commands = ['crear', 'instalar', 'ejecutar', 'listar', 'limpiar', 'build', 'deploy'];
    const lowerText = text.toLowerCase();

    return commands.some(cmd => lowerText.startsWith(cmd));
  }

  /**
   * Verificar usuario autorizado
   */
  isAuthorized(userId) {
    if (this.authorizedUsers.length === 0) {
      return true; // Si no hay usuarios configurados, permitir todos
    }
    return this.authorizedUsers.includes(userId.toString());
  }

  /**
   * Enviar mensaje
   */
  async sendMessage(chatId, text, options = {}) {
    try {
      return await this.bot.sendMessage(chatId, text, options);
    } catch (error) {
      this.logger.error('Error enviando mensaje', error);
    }
  }

  /**
   * Editar mensaje
   */
  async editMessage(chatId, messageId, text, options = {}) {
    try {
      return await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...options
      });
    } catch (error) {
      this.logger.error('Error editando mensaje', error);
    }
  }

  /**
   * Notificar a usuarios autorizados
   */
  async notifyAuthorizedUsers(message) {
    if (this.authorizedUsers.length === 0) return;

    for (const userId of this.authorizedUsers) {
      await this.sendMessage(userId, message);
    }
  }

  /**
   * Mensaje de bienvenida
   */
  sendWelcomeMessage(chatId) {
    this.sendMessage(chatId,
      `🤖 **JARVIS - Just A Rather Very Intelligent System**\n\n` +
      `Tu asistente personal que **nunca duerme** está listo.\n\n` +
      `📋 **Comandos Disponibles:**\n` +
      `/start - Iniciar el bot\n` +
      `/help - Mostrar ayuda\n` +
      `/commands - Lista de comandos\n` +
      `/status - Estado del sistema\n` +
      `/tasks - Ver tareas\n` +
      `/agents - Ver agentes\n` +
      `/stats - Estadísticas\n` +
      `/logs - Ver logs\n\n` +
      `💡 **Cómo Usar:**\n` +
      `• Envía: \`/jarvis crear api llamada test\`\n` +
      `• O envía un **audio** diciendo el comando\n\n` +
      `🚀 **Ejemplos:**\n` +
      `• \`jarvis crear api llamada mi-api\`\n` +
      `• \`jarvis crear frontend con react llamado app\`\n` +
      `• \`jarvis instalar npm express cors\`\n\n` +
      `🎤 **Comandos de Voz:**\n` +
      `Envía un audio diciendo:\n` +
      `"Crear API llamada test"`,
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Mensaje de ayuda
   */
  sendHelpMessage(chatId) {
    this.sendMessage(chatId,
      `📖 **AYUDA DE JARVIS**\n\n` +
      `🤖 **Comandos de Texto:**\n` +
      `Envía: \`/jarvis <comando>\`\n\n` +
      `🎤 **Comandos de Voz:**\n` +
      `Envía un audio diciendo el comando\n\n` +
      `📋 **Comandos Disponibles:**\n` +
      `/commands - Ver lista completa\n\n` +
      `📊 **Información:**\n` +
      `/status - Estado del sistema\n` +
      `/tasks - Ver tareas\n` +
      `/agents - Agentes activos\n` +
      `/stats - Estadísticas\n` +
      `/logs - Logs recientes\n\n` +
      `💡 **Ejemplos:**\n` +
      `• \`/jarvis crear api llamada test\`\n` +
      `• \`/jarvis instalar npm express\`\n` +
      `• Audio: "Crear frontend con react"\n\n` +
      `🔗 **Dashboard:**\n` +
      `http://localhost:4000`,
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Lista de comandos
   */
  sendCommandsList(chatId) {
    this.sendMessage(chatId,
      `📋 **COMANDOS DE JARVIS**\n\n` +
      `🚀 **Backend:**\n` +
      `• \`crear api llamada "nombre"\`\n` +
      `• \`instalar npm express, cors\`\n` +
      `• \`ejecutar script server.js\`\n\n` +
      `🎨 **Frontend:**\n` +
      `• \`crear frontend con react llamado "app"\`\n` +
      `• \`crear frontend con vue llamado "app"\`\n\n` +
      `🏗️ **Proyectos:**\n` +
      `• \`crear proyecto llamado "fullstack"\`\n` +
      `• \`listar archivos\`\n` +
      `• \`limpiar proyecto\`\n\n` +
      `🔧 **Utilidades:**\n` +
      `• \`build\` - Compilar\n` +
      `• \`ejecutar tests\`\n` +
      `• \`deploy\`\n\n` +
      `🎤 **Audio:**\n` +
      `Envía un audio diciendo el comando`,
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Reporte de estado
   */
  async sendStatusReport(chatId) {
    const stats = this.db.getStats();
    const agents = this.db.getAgents();
    const activeAgents = agents.filter(a => a.status === 'active').length;

    this.sendMessage(chatId,
      `📊 **ESTADO DEL SISTEMA**\n\n` +
      `📋 Tareas Totales: ${stats.total}\n` +
      `⏳ Pendientes: ${stats.pending}\n` +
      `🔄 En Progreso: ${stats.inProgress}\n` +
      `✅ Completadas: ${stats.completed}\n` +
      `❌ Fallidas: ${stats.failed}\n\n` +
      `🤖 Agentes: ${agents.length} (${activeAgents} activos)\n\n` +
      `🕐 ${new Date().toLocaleString()}`,
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Reporte de tareas
   */
  sendTasksReport(chatId) {
    const tasks = this.db.getTasks().slice(-10);

    if (tasks.length === 0) {
      this.sendMessage(chatId, '📋 No hay tareas registradas');
      return;
    }

    let message = '📋 **ÚLTIMAS TAREAS**\n\n';

    tasks.forEach(task => {
      const statusEmoji = {
        'pending': '⏳',
        'in_progress': '🔄',
        'completed': '✅',
        'failed': '❌',
        'cancelled': '❎'
      }[task.status] || '📋';

      message += `${statusEmoji} [${task.priority.toUpperCase()}] ${task.title}\n`;
      message += `   ID: \`${task.id}\` | Estado: ${task.status}\n\n`;
    });

    this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  /**
   * Reporte de agentes
   */
  sendAgentsReport(chatId) {
    const agents = this.db.getAgents();

    if (agents.length === 0) {
      this.sendMessage(chatId, '🤖 No hay agentes registrados');
      return;
    }

    let message = '🤖 **AGENTES**\n\n';

    agents.forEach(agent => {
      const statusEmoji = agent.status === 'active' ? '🟢' : '🔴';
      message += `${statusEmoji} *${agent.name}* (${agent.type})\n`;
      message += `   Estado: ${agent.status}\n`;
      if (agent.currentTask) {
        message += `   Tarea actual: ${agent.currentTask}\n`;
      }
      message += '\n';
    });

    this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  /**
   * Reporte de estadísticas
   */
  sendStatsReport(chatId) {
    const stats = this.db.getStats();
    const tasks = this.db.getTasks();

    const completedToday = tasks.filter(t => {
      if (!t.completedAt) return false;
      const today = new Date().toDateString();
      return new Date(t.completedAt).toDateString() === today;
    }).length;

    this.sendMessage(chatId,
      `📈 **ESTADÍSTICAS**\n\n` +
      `📊 Total Tareas: ${stats.total}\n` +
      `✅ Tasa de Éxito: ${stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%\n` +
      `📅 Completadas Hoy: ${completedToday}\n` +
      `🤖 Agentes Activos: ${stats.agentsActive}/${stats.agents}\n` +
      `⚡ Prioridad Alta: ${tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length}\n` +
      `🔥 Críticas: ${tasks.filter(t => t.priority === 'critical' && t.status !== 'completed').length}`,
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Reporte de logs
   */
  sendLogsReport(chatId) {
    const logs = this.db.getLogs(20);

    if (logs.length === 0) {
      this.sendMessage(chatId, '📜 No hay logs registrados');
      return;
    }

    let message = '📜 **ÚLTIMOS LOGS**\n\n';

    logs.slice(-10).reverse().forEach(log => {
      const levelEmoji = {
        'error': '❌',
        'warn': '⚠️',
        'info': 'ℹ️',
        'debug': '🐛'
      }[log.level] || '📝';

      const time = new Date(log.timestamp).toLocaleTimeString();
      message += `${levelEmoji} [${time}] ${log.message}\n`;
    });

    this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  /**
   * Enviar notificación de comando completado
   */
  async notifyCommandCompleted(command, result) {
    if (this.authorizedUsers.length === 0) return;

    const message =
      `✅ **Comando Completado**\n\n` +
      `📋 Comando: \`${command}\`\n` +
      `✅ Resultado: ${result.message || 'Exitoso'}`;

    for (const userId of this.authorizedUsers) {
      await this.sendMessage(userId, message, { parse_mode: 'Markdown' });
    }
  }

  /**
   * Enviar notificación de error
   */
  async notifyCommandError(command, error) {
    if (this.authorizedUsers.length === 0) return;

    const message =
      `❌ **Error en Comando**\n\n` +
      `📋 Comando: \`${command}\`\n` +
      `❌ Error: ${error}`;

    for (const userId of this.authorizedUsers) {
      await this.sendMessage(userId, message, { parse_mode: 'Markdown' });
    }
  }

  /**
   * Detener el bot
   */
  stop() {
    if (this.bot) {
      this.bot.stopPolling();
      this.logger.info('📱 Telegram Bot detenido');
    }
  }
}

module.exports = TelegramBotService;
