/**
 * JARVIS - Just A Rather Very Intelligent System
 * El Coordinador que Nunca Duerme
 *
 * Supervisa todos los agentes, optimiza tareas, y mantiene el sistema funcionando 24/7
 * - Monitoreo constante de agentes
 * - Reasignación automática de tareas
 * - Optimización de carga de trabajo
 * - Alertas tempranas
 * - Reportes automáticos
 * - Ejecución de comandos en backend
 */

const { v4: uuidv4 } = require('uuid');
const JarvisInterpreter = require('./jarvis-interpreter');
const CommandExecutor = require('./command-executor');

class CoordinatorAgent {
  constructor(io, db, logger, agentManager, taskQueue) {
    this.io = io;
    this.db = db;
    this.logger = logger;
    this.agentManager = agentManager;
    this.taskQueue = taskQueue;
    this.id = 'jarvis-agent';
    this.name = '🤖 JARVIS';
    this.type = 'coordinator';
    this.status = 'active';
    this.neverSleeps = true;

    // Inicializar intérprete y ejecutor de comandos
    this.interpreter = new JarvisInterpreter(logger, io, db);
    this.executor = new CommandExecutor(logger, io);

    // Configuración
    this.checkInterval = 5000; // Revisar cada 5 segundos
    this.reportInterval = 3600000; // Reporte cada hora
    this.optimizationThreshold = 3; // Tareas para optimizar

    // Métricas
    this.metrics = {
      tasksSupervised: 0,
      optimizationsMade: 0,
      agentsManaged: 0,
      alertsGenerated: 0,
      reportsGenerated: 0,
      commandsExecuted: 0,
      commandsSuccess: 0,
      commandsFailed: 0,
      uptime: Date.now()
    };

    // Estado interno
    this.activeMonitors = new Map();
    this.alerts = [];
    this.lastOptimization = Date.now();
    this.commandQueue = [];
  }

  /**
   * Iniciar JARVIS
   */
  start() {
    this.logger.info('🤖 JARVIS iniciado - Just A Rather Very Intelligent System');
    this.logger.info('👁️ Monitoreo constante iniciado - Nunca Duerme');
    this.logger.info('📊 Reportes automáticos configurados');
    this.logger.info('⚡ Sistema de comandos ejecutables activado');

    // Iniciar monitoreo constante
    this.startMonitoring();

    // Iniciar reportes automáticos
    this.startAutoReports();

    // Registrar en la base de datos
    this.registerInDb();

    // Setup de listeners para comandos
    this.setupCommandListeners();

    // Notificar a todos los clientes
    this.io.emit('jarvis:started', this.getStatus());
  }

  /**
   * Configurar listeners para comandos
   */
  setupCommandListeners() {
    // Escuchar comandos desde el dashboard
    this.io.on('connection', (socket) => {
      socket.on('jarvis:command', async (data) => {
        await this.executeCommand(data.command, data.context);
      });
    });

    this.logger.info('🎤 Listeners de comandos activados');
  }

  /**
   * Ejecutar comando
   */
  async executeCommand(commandText, context = {}) {
    this.metrics.commandsExecuted++;

    this.logger.info(`🎯 JARVIS recibiendo comando: "${commandText}"`);

    // Notificar inicio
    this.io.emit('jarvis:command:started', {
      command: commandText,
      timestamp: new Date().toISOString()
    });

    // Interpretar y ejecutar
    const result = await this.interpreter.interpret(commandText, context);

    // Actualizar métricas
    if (result.success) {
      this.metrics.commandsSuccess++;
    } else {
      this.metrics.commandsFailed++;
    }

    return result;
  }

  /**
   * Registrar en la base de datos
   */
  registerInDb() {
    const coordinator = {
      id: this.id,
      name: this.name,
      type: this.type,
      description: 'Supervisa todos los agentes y optimiza el sistema 24/7',
      capabilities: ['monitoring', 'optimization', 'alerts', 'reports', 'management'],
      color: '#FFD700', // Dorado
      status: 'active',
      currentTask: null,
      tasksCompleted: 0,
      tasksFailed: 0,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      metadata: {
        neverSleeps: true,
        uptime: this.metrics.uptime,
        supervisor: true
      }
    };

    // Verificar si ya existe
    const existing = this.db.getAgent(this.id);
    if (!existing) {
      this.db.addAgent(coordinator);
    } else {
      this.db.updateAgent(this.id, { ...existing, ...coordinator });
    }
  }

  /**
   * Iniciar monitoreo constante
   */
  startMonitoring() {
    setInterval(() => {
      this.monitorSystem();
    }, this.checkInterval);

    this.logger.info('👁️ Monitoreo constante iniciado');
  }

  /**
   * Iniciar reportes automáticos
   */
  startAutoReports() {
    setInterval(() => {
      this.generateReport();
    }, this.reportInterval);

    this.logger.info('📊 Reportes automáticos iniciados');
  }

  /**
   * Monitorear todo el sistema
   */
  async monitorSystem() {
    try {
      // 1. Monitorear salud de agentes
      await this.monitorAgentsHealth();

      // 2. Monitorear cola de tareas
      await this.monitorTaskQueue();

      // 3. Optimizar distribución de carga
      await this.optimizeWorkload();

      // 4. Verificar tareas estancadas
      await this.checkStuckTasks();

      // 5. Actualizar métricas
      this.updateMetrics();

    } catch (error) {
      this.logger.error('Error en monitoreo', { error: error.message });
    }
  }

  /**
   * Monitorear salud de agentes
   */
  async monitorAgentsHealth() {
    const agents = this.db.getAgents();

    for (const agent of agents) {
      // Saltar el coordinador
      if (agent.id === this.id) continue;

      // Verificar agente inactivo por mucho tiempo
      if (agent.status === 'busy' && agent.currentTask) {
        const task = this.db.getTask(agent.currentTask);

        if (task && task.startedAt) {
          const runningTime = Date.now() - new Date(task.startedAt).getTime();
          const maxTime = 30 * 60 * 1000; // 30 minutos máximo

          if (runningTime > maxTime) {
            this.generateAlert('warning', `Agente ${agent.name} con tarea por más de 30 minutos`, {
              taskId: task.id,
              runningTime: Math.round(runningTime / 60000) + ' min'
            });

            // Intentar reasignar tarea
            await this.reassignTask(task.id, agent.id);
          }
        }
      }

      // Verificar agente offline
      if (agent.status === 'offline') {
        this.generateAlert('info', `Agente ${agent.name} está offline`, {
          agentId: agent.id
        });
      }
    }
  }

  /**
   * Monitorear cola de tareas
   */
  async monitorTaskQueue() {
    const queueStatus = this.taskQueue.getQueueStatus();

    // Alerta si hay muchas tareas pendientes
    if (queueStatus.pending > 20) {
      this.generateAlert('warning', 'Cola de tareas saturada', {
        pending: queueStatus.pending,
        inProgress: queueStatus.inProgress
      });
    }

    // Alerta si no hay agentes disponibles
    const agents = this.db.getAgents();
    const availableAgents = agents.filter(a => a.status === 'idle' && a.id !== this.id).length;

    if (queueStatus.pending > 0 && availableAgents === 0) {
      this.generateAlert('critical', 'No hay agentes disponibles para tareas pendientes', {
        pending: queueStatus.pending
      });
    }
  }

  /**
   * Optimizar distribución de carga
   */
  async optimizeWorkload() {
    const agents = this.db.getAgents();
    const busyAgents = agents.filter(a => a.status === 'busy' && a.id !== this.id);
    const idleAgents = agents.filter(a => a.status === 'idle' && a.id !== this.id);

    // Si hay agentes idle y busy, verificar balance
    if (busyAgents.length > 0 && idleAgents.length > 0) {
      // Verificar si algún agente busy tiene múltiples tareas
      for (const busyAgent of busyAgents) {
        const agentTasks = this.db.getTasksByAgent(busyAgent.id);
        const pendingTasks = agentTasks.filter(t => t.status === 'in_progress');

        if (pendingTasks.length > 1 && idleAgents.length > 0) {
          // Reasignar tarea más reciente a agente idle
          const taskToReassign = pendingTasks[pendingTasks.length - 1];
          const idleAgent = idleAgents[0];

          this.logger.info('⚖️ Optimizando carga de trabajo', {
            from: busyAgent.id,
            to: idleAgent.id,
            task: taskToReassign.id
          });

          await this.reassignTask(taskToReassign.id, busyAgent.id, idleAgent.id);
          this.metrics.optimizationsMade++;
        }
      }
    }
  }

  /**
   * Verificar tareas estancadas
   */
  async checkStuckTasks() {
    const tasks = this.db.getTasks();
    const now = Date.now();

    for (const task of tasks) {
      if (task.status === 'in_progress' && task.startedAt) {
        const runningTime = now - new Date(task.startedAt).getTime();
        const stuckThreshold = 60 * 60 * 1000; // 1 hora

        if (runningTime > stuckThreshold) {
          this.generateAlert('critical', `Tarea estancada por más de 1 hora`, {
            taskId: task.id,
            title: task.title,
            runningTime: Math.round(runningTime / 3600000 * 10) / 10 + ' horas'
          });

          // Intentar recuperar tarea
          await this.recoverStuckTask(task);
        }
      }
    }
  }

  /**
   * Reasignar tarea de un agente a otro
   */
  async reassignTask(taskId, fromAgentId, toAgentId = null) {
    const task = this.db.getTask(taskId);
    if (!task) return;

    this.logger.info('🔄 Reasignando tarea', {
      taskId,
      from: fromAgentId,
      to: toAgentId || 'pendiente'
    });

    // Liberar agente original
    this.agentManager.releaseAgent(fromAgentId);

    // Si hay agente destino, asignar
    if (toAgentId) {
      const toAgent = this.db.getAgent(toAgentId);
      if (toAgent && toAgent.status === 'idle') {
        task.assignedAgent = toAgentId;
        task.status = 'pending';
        this.db.updateTask(taskId, {
          assignedAgent: toAgentId,
          status: 'pending'
        });

        // Encolar para procesamiento
        this.taskQueue.processingQueue.push(taskId);
        this.taskQueue.processQueue();
      }
    } else {
      // Devolver a pendientes
      task.status = 'pending';
      this.db.updateTask(taskId, { status: 'pending' });
    }

    this.io.emit('task:reassigned', {
      taskId,
      from: fromAgentId,
      to: toAgentId
    });
  }

  /**
   * Recuperar tarea estancada
   */
  async recoverStuckTask(task) {
    this.logger.info('♻️ Recuperando tarea estancada', { taskId: task.id });

    // Marcar como fallida con razón específica
    this.db.updateTask(task.id, {
      status: 'failed',
      error: 'Tarea estancada - Recuperada por Coordinator Agent',
      updatedAt: new Date().toISOString()
    });

    // Liberar agente
    if (task.assignedAgent) {
      this.agentManager.releaseAgent(task.assignedAgent);
    }

    // Notificar
    this.io.emit('task:recovered', {
      taskId: task.id,
      reason: 'stuck_timeout'
    });
  }

  /**
   * Generar alerta
   */
  generateAlert(level, message, data = {}) {
    const alert = {
      id: uuidv4(),
      level, // 'info', 'warning', 'critical'
      message,
      data,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    this.alerts.push(alert);
    this.metrics.alertsGenerated++;

    // Mantener solo últimas 100 alertas
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log
    this.logger.warn(`[ALERTA ${level.toUpperCase()}] ${message}`, data);

    // Notificar a clientes
    this.io.emit('jarvis:alert', alert);

    // Enviar por Telegram si es crítico
    if (level === 'critical') {
      this.sendCriticalAlert(message, data);
    }
  }

  /**
   * Enviar alerta crítica por Telegram
   */
  async sendCriticalAlert(message, data) {
    // Esta función se conectará con el bot de Telegram
    // Por ahora, solo loguea
    this.logger.info('📱 Alerta crítica enviada a Telegram', { message, data });
  }

  /**
   * Generar reporte
   */
  async generateReport() {
    const stats = this.db.getStats();
    const agents = this.db.getAgents();
    const tasks = this.db.getTasks();

    // Calcular métricas avanzadas
    const totalTasks = tasks.length;
    const completedToday = tasks.filter(t => {
      if (!t.completedAt) return false;
      const today = new Date().toDateString();
      return new Date(t.completedAt).toDateString() === today;
    }).length;

    const successRate = totalTasks > 0 ? Math.round((stats.completed / totalTasks) * 100) : 0;
    const avgCompletionTime = this.calculateAvgCompletionTime(tasks);

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTasks,
        completedToday,
        successRate: successRate + '%',
        avgCompletionTime: avgCompletionTime + ' min',
        activeAgents: stats.agentsActive,
        totalAgents: stats.agents
      },
      agents: agents.map(a => ({
        name: a.name,
        status: a.status,
        tasksCompleted: a.tasksCompleted,
        efficiency: a.metadata?.efficiency || 100
      })),
      metrics: { ...this.metrics },
      alerts: this.alerts.filter(a => !a.acknowledged).length
    };

    this.metrics.reportsGenerated++;

    // Log
    this.logger.info('📊 Reporte Generado', {
      tasks: totalTasks,
      completed: completedToday,
      successRate: successRate + '%'
    });

    // Notificar a clientes
    this.io.emit('jarvis:report', report);

    return report;
  }

  /**
   * Calcular tiempo promedio de completado
   */
  calculateAvgCompletionTime(tasks) {
    const completedTasks = tasks.filter(t => t.completedAt && t.startedAt);

    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((acc, task) => {
      const start = new Date(task.startedAt).getTime();
      const end = new Date(task.completedAt).getTime();
      return acc + (end - start);
    }, 0);

    return Math.round((totalTime / completedTasks.length) / 60000 * 10) / 10;
  }

  /**
   * Actualizar métricas
   */
  updateMetrics() {
    const agents = this.db.getAgents();
    const tasks = this.db.getTasks();

    this.metrics.tasksSupervised = tasks.length;
    this.metrics.agentsManaged = agents.filter(a => a.id !== this.id).length;
    this.metrics.uptime = Date.now() - this.metrics.uptime;
  }

  /**
   * Obtener estado del coordinador
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      neverSleeps: this.neverSleeps,
      metrics: this.metrics,
      alerts: this.alerts.length,
      uptime: this.formatUptime(this.metrics.uptime)
    };
  }

  /**
   * Formatear uptime
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Obtener todas las alertas
   */
  getAlerts(limit = 20) {
    return this.alerts.slice(-limit).reverse();
  }

  /**
   * Reconocer alerta (acknowledge)
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.io.emit('jarvis:alert:acknowledged', { alertId });
    }
  }

  /**
   * Detener coordinador (aunque nunca duerme, podemos simularlo)
   */
  stop() {
    this.status = 'inactive';
    this.logger.info('🤖 JARVIS detenido temporalmente...');
    this.io.emit('jarvis:stopped', this.getStatus());
  }
}

module.exports = CoordinatorAgent;
