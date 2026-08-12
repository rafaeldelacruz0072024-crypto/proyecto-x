/**
 * AgentManager - Gestor de Agentes AI
 * Crea, gestiona y distribuye tareas a agentes especializados
 */

const { v4: uuidv4 } = require('uuid');

class AgentManager {
  constructor(io, db, logger) {
    this.io = io;
    this.db = db;
    this.logger = logger;
    this.agents = new Map(); // Agentes instanciados
    this.agentDefinitions = this.getAgentDefinitions();
  }

  /**
   * Definiciones de agentes especializados
   */
  getAgentDefinitions() {
    return [
      {
        id: 'backend-agent',
        name: '🔧 Backend Agent',
        type: 'backend',
        description: 'Especializado en Node.js, Express, APIs REST, GraphQL, bases de datos',
        capabilities: ['api', 'database', 'authentication', 'microservices', 'nodejs', 'python'],
        color: '#4CAF50'
      },
      {
        id: 'frontend-agent',
        name: '🎨 Frontend Agent',
        type: 'frontend',
        description: 'Especializado en React, Vue, Angular, TypeScript, CSS, Tailwind',
        capabilities: ['react', 'vue', 'angular', 'typescript', 'css', 'tailwind', 'javascript'],
        color: '#2196F3'
      },
      {
        id: 'design-agent',
        name: '🎭 Design Agent',
        type: 'design',
        description: 'Especializado en UI/UX, mockups, wireframes, diseño responsive',
        capabilities: ['ui', 'ux', 'mockup', 'wireframe', 'figma', 'responsive'],
        color: '#E91E63'
      },
      {
        id: 'database-agent',
        name: '🗄️ Database Agent',
        type: 'database',
        description: 'Especializado en SQL, NoSQL, modelado de datos, optimización',
        capabilities: ['sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'optimization'],
        color: '#FF9800'
      },
      {
        id: 'fullstack-agent',
        name: '🚀 FullStack Agent',
        type: 'fullstack',
        description: 'Especializado en desarrollo completo, arquitectura, integración',
        capabilities: ['fullstack', 'architecture', 'integration', 'devops', 'deployment'],
        color: '#9C27B0'
      },
      {
        id: 'testing-agent',
        name: '✅ Testing Agent',
        type: 'testing',
        description: 'Especializado en tests unitarios, e2e, integración, QA',
        capabilities: ['testing', 'jest', 'cypress', 'pytest', 'qa', 'automation'],
        color: '#00BCD4'
      }
    ];
  }

  /**
   * Inicializar todos los agentes
   */
  initializeAllAgents() {
    this.agentDefinitions.forEach(def => {
      this.createAgent(def);
    });

    this.logger.info(`🤖 ${this.agents.size} agentes inicializados`);
    this.io.emit('agents:initialized', this.getAgentsStatus());
  }

  /**
   * Crear un agente
   */
  createAgent(definition) {
    const agent = {
      id: definition.id,
      name: definition.name,
      type: definition.type,
      description: definition.description,
      capabilities: definition.capabilities,
      color: definition.color,
      status: 'idle', // idle, busy, offline
      currentTask: null,
      tasksCompleted: 0,
      tasksFailed: 0,
      createdAt: new Date().toISOString(),
      lastActiveAt: null,
      metadata: {
        cpu: 0,
        memory: 0,
        efficiency: 100
      }
    };

    this.db.addAgent(agent);
    this.agents.set(definition.id, agent);
    this.logger.logAgent(definition.id, 'Inicializado');

    return agent;
  }

  /**
   * Seleccionar el mejor agente para un tipo de tarea
   */
  selectBestAgent(taskType) {
    // Mapeo de tipos de tarea a agentes
    const typeMapping = {
      'backend': 'backend-agent',
      'frontend': 'frontend-agent',
      'design': 'design-agent',
      'database': 'database-agent',
      'fullstack': 'fullstack-agent',
      'testing': 'testing-agent',
      'api': 'backend-agent',
      'ui': 'design-agent',
      'ux': 'design-agent'
    };

    const agentId = typeMapping[taskType?.toLowerCase()] || 'fullstack-agent';
    const agent = this.agents.get(agentId);

    if (agent && agent.status === 'idle') {
      return agentId;
    }

    // Buscar agente alternativo disponible
    for (const [id, agent] of this.agents) {
      if (agent.status === 'idle') {
        return id;
      }
    }

    // Si todos están ocupados, retornar el fullstack
    return 'fullstack-agent';
  }

  /**
   * Asignar tarea a un agente
   */
  assignTask(agentId, taskId) {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      throw new Error(`Agente ${agentId} no encontrado`);
    }

    agent.status = 'busy';
    agent.currentTask = taskId;
    agent.lastActiveAt = new Date().toISOString();

    this.db.updateAgent(agentId, {
      status: 'busy',
      currentTask: taskId,
      lastActiveAt: agent.lastActiveAt
    });

    this.logger.logAgent(agentId, 'Tarea asignada', { taskId });
    this.io.emit('agent:assigned', { agentId, taskId });
  }

  /**
   * Liberar agente después de completar tarea
   */
  releaseAgent(agentId) {
    const agent = this.agents.get(agentId);
    
    if (!agent) return;

    agent.status = 'idle';
    agent.currentTask = null;
    agent.lastActiveAt = new Date().toISOString();

    this.db.updateAgent(agentId, {
      status: 'idle',
      currentTask: null,
      lastActiveAt: agent.lastActiveAt
    });

    this.logger.logAgent(agentId, 'Liberado');
    this.io.emit('agent:released', { agentId });
  }

  /**
   * Reiniciar un agente
   */
  restartAgent(agentId) {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      throw new Error(`Agente ${agentId} no encontrado`);
    }

    // Simular reinicio
    agent.status = 'idle';
    agent.currentTask = null;
    agent.metadata = { cpu: 0, memory: 0, efficiency: 100 };

    this.db.updateAgent(agentId, agent);

    this.logger.logAgent(agentId, 'Reiniciado');
    this.io.emit('agent:restarted', { agentId });

    return agent;
  }

  /**
   * Obtener un agente
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Obtener instancia de agente (para ejecución)
   */
  getAgentInstance(agentId) {
    const agent = this.agents.get(agentId);
    
    if (!agent) return null;

    // Retornar objeto con método execute
    return {
      id: agentId,
      type: agent.type,
      execute: async (task) => {
        return await this.executeTaskWithAgent(agent, task);
      }
    };
  }

  /**
   * Ejecutar tarea con un agente (simulado)
   */
  async executeTaskWithAgent(agent, task) {
    this.logger.logAgent(agent.id, 'Ejecutando tarea', { taskId: task.id, type: task.type });

    // Simulación de progreso
    const steps = [
      'Analizando requerimientos...',
      'Generando solución...',
      'Escribiendo código...',
      'Revisando calidad...',
      'Finalizando...'
    ];

    for (let i = 0; i < steps.length; i++) {
      await this.sleep(1000); // Simular trabajo
      
      const progress = Math.round(((i + 1) / steps.length) * 100);
      
      // Actualizar progreso (si existe taskQueue)
      if (this.io) {
        this.io.emit('task:progress', {
          taskId: task.id,
          progress: progress,
          log: steps[i]
        });
      }

      this.logger.logAgent(agent.id, `Progreso: ${progress}%`, { taskId: task.id });
    }

    // Generar resultado basado en el tipo de tarea
    const result = this.generateTaskResult(agent.type, task);

    return result;
  }

  /**
   * Generar resultado de tarea basado en tipo
   */
  generateTaskResult(agentType, task) {
    const results = {
      backend: {
        type: 'code',
        language: 'javascript',
        description: `API ${task.type} implementada`,
        files: [`src/${task.type}.js`],
        endpoints: task.type === 'api' ? ['GET /', 'POST /'] : []
      },
      frontend: {
        type: 'code',
        language: 'react',
        description: `Componente ${task.type} creado`,
        files: [`src/components/${task.type}.jsx`],
        components: []
      },
      design: {
        type: 'design',
        format: 'figma',
        description: `Mockup ${task.type} diseñado`,
        files: [`designs/${task.type}.fig`],
        screens: []
      },
      database: {
        type: 'schema',
        language: 'sql',
        description: `Esquema ${task.type} creado`,
        files: [`migrations/${task.type}.sql`],
        tables: []
      },
      fullstack: {
        type: 'fullstack',
        description: `Solución completa ${task.type} implementada`,
        files: [`src/`],
        backend: [],
        frontend: []
      },
      testing: {
        type: 'tests',
        framework: 'jest',
        description: `Tests para ${task.type} creados`,
        files: [`tests/${task.type}.test.js`],
        testCases: []
      }
    };

    return results[agentType] || { type: 'generic', description: 'Tarea completada' };
  }

  /**
   * Obtener estado de todos los agentes
   */
  getAgentsStatus() {
    const status = [];
    for (const [id, agent] of this.agents) {
      status.push({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        currentTask: agent.currentTask,
        tasksCompleted: agent.tasksCompleted,
        tasksFailed: agent.tasksFailed,
        color: agent.color,
        metadata: agent.metadata
      });
    }
    return status;
  }

  /**
   * Apagar todos los agentes
   */
  shutdown() {
    for (const [id, agent] of this.agents) {
      agent.status = 'offline';
      this.db.updateAgent(id, { status: 'offline' });
      this.logger.logAgent(id, 'Apagado');
    }
    this.io.emit('agents:shutdown', this.getAgentsStatus());
  }

  /**
   * Utility: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AgentManager;
