/**
 * TaskQueue - Sistema de cola de tareas
 * Gestiona creación, asignación y seguimiento de tareas
 */

const { v4: uuidv4 } = require('uuid');

class TaskQueue {
  constructor(io, db, logger, agentManager) {
    this.io = io;
    this.db = db;
    this.logger = logger;
    this.agentManager = agentManager;
    this.processingQueue = [];
  }

  /**
   * Crear nueva tarea
   */
  async createTask(taskData) {
    const task = {
      id: uuidv4(),
      title: taskData.title,
      description: taskData.description || '',
      type: taskData.type, // 'backend', 'frontend', 'design', 'database', 'fullstack'
      priority: taskData.priority || 'medium', // 'low', 'medium', 'high', 'critical'
      status: 'pending',
      assignedAgent: taskData.assignedAgent || null,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      result: null,
      error: null,
      logs: [],
      metadata: taskData.metadata || {}
    };

    // Asignar agente automáticamente si no se especificó
    if (!task.assignedAgent) {
      task.assignedAgent = this.agentManager.selectBestAgent(task.type);
    }

    this.db.addTask(task);
    this.logger.logTask(task.id, 'Creada', { type: task.type, priority: task.priority });

    // Notificar a todos los clientes
    this.io.emit('task:created', task);

    // Encolar para procesamiento
    this.processingQueue.push(task.id);
    this.processQueue();

    return task;
  }

  /**
   * Procesar cola de tareas
   */
  async processQueue() {
    while (this.processingQueue.length > 0) {
      const taskId = this.processingQueue[0];
      const task = this.db.getTask(taskId);

      if (!task || task.status !== 'pending') {
        this.processingQueue.shift();
        continue;
      }

      const agent = this.agentManager.getAgent(task.assignedAgent);
      
      if (agent && agent.status === 'active' && !agent.currentTask) {
        // Asignar tarea al agente
        this.assignTaskToAgent(task, agent);
        this.processingQueue.shift();
      } else {
        // No hay agente disponible, esperar
        break;
      }
    }
  }

  /**
   * Asignar tarea a agente
   */
  assignTaskToAgent(task, agent) {
    this.db.updateTask(task.id, {
      status: 'in_progress',
      startedAt: new Date().toISOString()
    });

    this.agentManager.assignTask(agent.id, task.id);

    this.logger.logTask(task.id, 'Iniciada', { agent: agent.id });
    this.io.emit('task:started', { taskId: task.id, agentId: agent.id });

    // Ejecutar tarea en el agente
    this.executeTask(task, agent);
  }

  /**
   * Ejecutar tarea en el agente
   */
  async executeTask(task, agent) {
    try {
      const agentInstance = this.agentManager.getAgentInstance(agent.id);
      
      if (!agentInstance) {
        throw new Error(`Agente ${agent.id} no disponible`);
      }

      const result = await agentInstance.execute(task);

      // Tarea completada exitosamente
      this.completeTask(task.id, result);

    } catch (error) {
      this.logger.error(`Error ejecutando tarea ${task.id}`, { error: error.message });
      this.failTask(task.id, error.message);
    }
  }

  /**
   * Completar tarea exitosamente
   */
  completeTask(taskId, result) {
    const task = this.db.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      result: result,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    this.agentManager.releaseAgent(task.assignedAgent);

    this.logger.logTask(taskId, 'Completada', { result: typeof result === 'object' ? 'object' : result });
    this.io.emit('task:completed', { task, result });

    // Procesar siguiente tarea
    this.processQueue();
  }

  /**
   * Marcar tarea como fallida
   */
  failTask(taskId, error) {
    const task = this.db.updateTask(taskId, {
      status: 'failed',
      error: error,
      updatedAt: new Date().toISOString()
    });

    this.agentManager.releaseAgent(task.assignedAgent);

    this.logger.logTask(taskId, 'Fallida', { error });
    this.io.emit('task:failed', { task, error });

    // Procesar siguiente tarea
    this.processQueue();
  }

  /**
   * Cancelar tarea
   */
  cancelTask(taskId) {
    const task = this.db.getTask(taskId);
    
    if (!task) {
      throw new Error('Tarea no encontrada');
    }

    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new Error(`Tarea ya ${task.status}`);
    }

    this.db.updateTask(taskId, {
      status: 'cancelled',
      updatedAt: new Date().toISOString()
    });

    // Liberar agente si estaba asignado
    if (task.assignedAgent && task.status === 'in_progress') {
      this.agentManager.releaseAgent(task.assignedAgent);
    }

    // Remover de la cola
    const index = this.processingQueue.indexOf(taskId);
    if (index > -1) {
      this.processingQueue.splice(index, 1);
    }

    this.logger.logTask(taskId, 'Cancelada');
    this.io.emit('task:cancelled', { taskId });

    return { success: true };
  }

  /**
   * Actualizar progreso de tarea
   */
  updateProgress(taskId, progress, log = null) {
    const task = this.db.getTask(taskId);
    
    if (!task) {
      throw new Error('Tarea no encontrada');
    }

    const updates = {
      progress: Math.min(100, Math.max(0, progress)),
      updatedAt: new Date().toISOString()
    };

    if (log) {
      task.logs = task.logs || [];
      task.logs.push({
        timestamp: new Date().toISOString(),
        message: log
      });
      updates.logs = task.logs;
    }

    this.db.updateTask(taskId, updates);
    this.io.emit('task:progress', { taskId, progress, log });
  }

  /**
   * Obtener estado de la cola
   */
  getQueueStatus() {
    const tasks = this.db.getTasks();
    return {
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      processing: this.processingQueue.length,
      total: tasks.length
    };
  }
}

module.exports = TaskQueue;
