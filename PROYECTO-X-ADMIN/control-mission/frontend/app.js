/**
 * CONTROL MISSION - Dashboard JavaScript
 * Conecta con Socket.io para actualizaciones en tiempo real
 */

// Conectar con Socket.io
const socket = io();

// Estado local
let tasks = [];
let agents = [];
let currentFilter = 'all';

// ===========================================
// INICIALIZACIÓN
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 CONTROL MISSION Dashboard iniciado');
  loadInitialData();
  setupSocketListeners();
  startLiveUpdates();
});

// ===========================================
// SOCKET.IO LISTENERS
// ===========================================

function setupSocketListeners() {
  // Estado del sistema
  socket.on('system:status', (data) => {
    console.log('Estado del sistema:', data);
    updateSystemStatus(data);
  });

  // JARVIS iniciado
  socket.on('jarvis:started', (data) => {
    console.log('🤖 JARVIS iniciado:', data);
    addLog(`🤖 JARVIS iniciado - ${data.uptime}`);
    // Agregar JARVIS a la lista de agentes
    if (!agents.find(a => a.id === 'jarvis-agent')) {
      agents.unshift({
        id: 'jarvis-agent',
        name: '🤖 JARVIS',
        type: 'coordinator',
        status: 'active',
        currentTask: null,
        tasksCompleted: data.metrics?.tasksSupervised || 0,
        tasksFailed: 0,
        color: '#FFD700',
        metadata: {
          neverSleeps: true,
          uptime: data.uptime,
          supervisor: true,
          jarvis: true
        }
      });
      renderAgents();
    }
  });

  // JARVIS alertas
  socket.on('jarvis:alert', (alert) => {
    console.log('⚠️ Alerta de JARVIS:', alert);
    const levelEmoji = {
      'info': 'ℹ️',
      'warning': '⚠️',
      'critical': '🚨'
    }[alert.level] || '📢';
    addLog(`${levelEmoji} [JARVIS] ${alert.message}`);
  });

  // JARVIS reportes
  socket.on('jarvis:report', (report) => {
    console.log('📊 Reporte de JARVIS:', report.summary);
    addLog(`📊 JARVIS: ${report.summary.completedToday} tareas completadas hoy`);
  });

  // Tarea reasignada
  socket.on('task:reassigned', (data) => {
    console.log('🔄 Tarea reasignada:', data);
    addLog(`🔄 Tarea ${data.taskId} reasignada`);
  });

  // Tarea recuperada
  socket.on('task:recovered', (data) => {
    console.log('♻️ Tarea recuperada:', data);
    addLog(`♻️ Tarea ${data.taskId} recuperada`);
  });

  // Agentes inicializados
  socket.on('agents:initialized', (agentsData) => {
    console.log('Agentes inicializados:', agentsData);
    agents = agentsData;
    renderAgents();
  });

  // Nueva tarea creada
  socket.on('task:created', (task) => {
    console.log('Tarea creada:', task);
    tasks.unshift(task);
    renderTasks();
    updateStats();
    addLog(`Tarea creada: ${task.title}`);
  });

  // Tarea iniciada
  socket.on('task:started', (data) => {
    console.log('Tarea iniciada:', data);
    updateTaskStatus(data.taskId, 'in_progress');
    addLog(`Tarea iniciada por agente ${data.agentId}`);
  });

  // Progreso de tarea
  socket.on('task:progress', (data) => {
    console.log('Progreso:', data);
    updateTaskProgress(data.taskId, data.progress, data.log);
  });

  // Tarea completada
  socket.on('task:completed', (data) => {
    console.log('Tarea completada:', data);
    updateTaskStatus(data.task.taskId || data.task.id, 'completed');
    addLog(`✅ Tarea completada: ${data.task.title}`);
    showNotification('Tarea Completada', data.task.title, 'success');
  });

  // Tarea fallida
  socket.on('task:failed', (data) => {
    console.log('Tarea fallida:', data);
    updateTaskStatus(data.task.taskId || data.task.id, 'failed');
    addLog(`❌ Tarea fallida: ${data.task.title} - ${data.error}`);
    showNotification('Tarea Fallida', data.task.title, 'error');
  });

  // Tarea cancelada
  socket.on('task:cancelled', (data) => {
    console.log('Tarea cancelada:', data);
    updateTaskStatus(data.taskId, 'cancelled');
    addLog(`Tarea cancelada: ${data.taskId}`);
  });

  // Agente asignado
  socket.on('agent:assigned', (data) => {
    console.log('Agente asignado:', data);
    updateAgentStatus(data.agentId, 'busy', data.taskId);
  });

  // Agente liberado
  socket.on('agent:released', (data) => {
    console.log('Agente liberado:', data);
    updateAgentStatus(data.agentId, 'idle', null);
  });

  // Agente reiniciado
  socket.on('agent:restarted', (data) => {
    console.log('Agente reiniciado:', data);
    renderAgents();
  });

  // Agentes apagados
  socket.on('agents:shutdown', (data) => {
    console.log('Agentes apagados:', data);
    agents = data;
    renderAgents();
    showNotification('Sistema Apagado', 'Todos los agentes han sido detenidos', 'warning');
  });
}

// ===========================================
// CARGA DE DATOS INICIALES
// ===========================================

async function loadInitialData() {
  try {
    // Cargar tareas
    const tasksResponse = await fetch('/api/tasks');
    tasks = await tasksResponse.json();
    renderTasks();
    updateStats();

    // Cargar estado
    const statusResponse = await fetch('/api/status');
    const status = await statusResponse.json();

    if (status.agents) {
      agents = status.agents;
      renderAgents();
    }

    addLog('Dashboard conectado al servidor');
  } catch (error) {
    console.error('Error cargando datos:', error);
    addLog(`Error conectando: ${error.message}`, 'error');
  }
}

// ===========================================
// RENDERIZADO DE AGENTES
// ===========================================

function renderAgents() {
  const grid = document.getElementById('agents-grid');
  const countEl = document.getElementById('agents-count');

  countEl.textContent = `${agents.length} agentes`;

  grid.innerHTML = agents.map(agent => {
    const isJARVIS = agent.id === 'jarvis-agent';
    const statusClass = agent.status === 'active' || agent.status === 'busy' ? 'active' : '';
    const statusDotClass = isJARVIS ? 'idle' : (agent.status === 'idle' ? 'idle' : agent.status === 'busy' ? 'busy' : 'offline');
    const statusText = isJARVIS ? '👁️ Siempre Activo' : (agent.status === 'idle' ? 'Disponible' : agent.status === 'busy' ? 'Trabajando' : 'Offline');

    return `
      <div class="agent-card ${statusClass} ${isJARVIS ? 'coordinator-card' : ''} glass rounded-xl p-6 relative overflow-hidden"
           style="border-left: 4px solid ${agent.color}">
        ${isJARVIS ? `
          <div class="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-bl-lg">
            🤖 JARVIS
          </div>
        ` : ''}
        
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-lg font-bold">${agent.name}</h3>
            <p class="text-gray-400 text-sm">${agent.type}</p>
          </div>
          <div class="flex items-center space-x-2">
            <span class="status-dot ${statusDotClass}"></span>
            <span class="text-xs font-medium ${statusDotClass === 'idle' ? 'text-green-400' : statusDotClass === 'busy' ? 'text-yellow-400' : 'text-gray-400'}">
              ${statusText}
            </span>
          </div>
        </div>

        ${isJARVIS ? `
          <div class="bg-gradient-to-r from-yellow-900/50 to-orange-900/50 rounded-lg p-3 mb-4 border border-yellow-700">
            <p class="text-xs text-yellow-300 mb-2">🦾 Funciones de JARVIS:</p>
            <div class="grid grid-cols-2 gap-1 text-xs text-yellow-100">
              <div>👁️ Monitoreo Constante</div>
              <div>⚡ Optimización</div>
              <div>🔄 Reasignación</div>
              <div>📊 Reportes</div>
            </div>
          </div>
        ` : (agent.currentTask ? `
          <div class="bg-gray-800 rounded-lg p-3 mb-4">
            <p class="text-xs text-gray-400 mb-1">Tarea Actual:</p>
            <p class="text-sm font-mono truncate">${agent.currentTask}</p>
          </div>
        ` : '')}

        ${isJARVIS ? `
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-gray-800 rounded-lg p-2">
              <p class="text-xs text-gray-400">Supervisadas</p>
              <p class="text-lg font-bold text-green-400">${agent.tasksCompleted || 0}</p>
            </div>
            <div class="bg-gray-800 rounded-lg p-2">
              <p class="text-xs text-gray-400">Alertas</p>
              <p class="text-lg font-bold text-yellow-400">${agent.metadata?.alerts || 0}</p>
            </div>
            <div class="bg-gray-800 rounded-lg p-2">
              <p class="text-xs text-gray-400">Uptime</p>
              <p class="text-lg font-bold text-blue-400">${agent.metadata?.uptime || '∞'}</p>
            </div>
          </div>
        ` : `
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-gray-800 rounded-lg p-2">
              <p class="text-xs text-gray-400">Completadas</p>
              <p class="text-lg font-bold text-green-400">${agent.tasksCompleted || 0}</p>
            </div>
            <div class="bg-gray-800 rounded-lg p-2">
              <p class="text-xs text-gray-400">Fallidas</p>
              <p class="text-lg font-bold text-red-400">${agent.tasksFailed || 0}</p>
            </div>
            <div class="bg-gray-800 rounded-lg p-2">
              <p class="text-xs text-gray-400">Eficiencia</p>
              <p class="text-lg font-bold text-blue-400">${agent.metadata?.efficiency || 100}%</p>
            </div>
          </div>
        `}

        ${isJARVIS ? `
          <div class="mt-4 flex space-x-2">
            <button onclick="viewJARVISDetails()"
              class="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-xs font-medium transition-all">
              <i class="fas fa-robot mr-1"></i> Ver Estado
            </button>
            <button onclick="viewAgentDetails('${agent.id}')"
              class="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium transition-all">
              <i class="fas fa-info-circle mr-1"></i> Detalles
            </button>
          </div>
        ` : `
          <div class="mt-4 flex space-x-2">
            <button onclick="restartAgent('${agent.id}')"
              class="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium transition-all">
              <i class="fas fa-redo mr-1"></i> Reiniciar
            </button>
            <button onclick="viewAgentDetails('${agent.id}')"
              class="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium transition-all">
              <i class="fas fa-info-circle mr-1"></i> Detalles
            </button>
          </div>
        `}
      </div>
    `;
  }).join('');
}

// ===========================================
// RENDERIZADO DE TAREAS
// ===========================================

function renderTasks() {
  const tbody = document.getElementById('tasks-table');

  let filteredTasks = tasks;
  if (currentFilter !== 'all') {
    filteredTasks = tasks.filter(t => t.status === currentFilter);
  }

  tbody.innerHTML = filteredTasks.map(task => {
    const statusConfig = getStatusConfig(task.status);
    const priorityConfig = getPriorityConfig(task.priority);

    return `
      <tr class="hover:bg-gray-800 transition-all">
        <td class="px-6 py-4">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusConfig.class}">
            <span class="status-dot ${task.status}" style="margin-right: 6px;"></span>
            ${statusConfig.text}
          </span>
        </td>
        <td class="px-6 py-4">
          <div>
            <p class="font-medium">${task.title}</p>
            ${task.description ? `<p class="text-gray-400 text-sm truncate max-w-md">${task.description}</p>` : ''}
          </div>
        </td>
        <td class="px-6 py-4">
          <span class="px-3 py-1 bg-gray-800 rounded-lg text-xs font-medium">
            ${task.type}
          </span>
        </td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${priorityConfig.class}">
            ${priorityConfig.text}
          </span>
        </td>
        <td class="px-6 py-4">
          <span class="text-sm text-gray-400 font-mono">
            ${task.assignedAgent || 'No asignado'}
          </span>
        </td>
        <td class="px-6 py-4">
          <div class="w-32">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-gray-400">${task.progress}%</span>
            </div>
            <div class="w-full bg-gray-800 rounded-full h-2">
              <div class="progress-bar h-2 rounded-full" 
                   style="width: ${task.progress}%; background-color: ${getProgressColor(task.progress)}"></div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4">
          <div class="flex items-center space-x-2">
            ${task.status === 'pending' || task.status === 'in_progress' ? `
              <button onclick="cancelTask('${task.id}')" 
                class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-medium transition-all">
                <i class="fas fa-stop"></i>
              </button>
            ` : ''}
            <button onclick="viewTaskDetails('${task.id}')" 
              class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium transition-all">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (filteredTasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-12 text-center text-gray-400">
          <i class="fas fa-inbox text-4xl mb-4"></i>
          <p>No hay tareas ${currentFilter !== 'all' ? currentFilter : ''}</p>
        </td>
      </tr>
    `;
  }
}

// ===========================================
// ACTUALIZACIONES
// ===========================================

function updateStats() {
  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length
  };

  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-progress').textContent = stats.inProgress;
  document.getElementById('stat-completed').textContent = stats.completed;
  document.getElementById('stat-failed').textContent = stats.failed;
}

function updateTaskStatus(taskId, status) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.status = status;
    if (status === 'completed') {
      task.progress = 100;
      task.completedAt = new Date().toISOString();
    }
    renderTasks();
    updateStats();
  }
}

function updateTaskProgress(taskId, progress, log) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.progress = progress;
    if (log) {
      task.logs = task.logs || [];
      task.logs.push({ timestamp: new Date().toISOString(), message: log });
    }
    renderTasks();
  }
}

function updateAgentStatus(agentId, status, currentTask) {
  const agent = agents.find(a => a.id === agentId);
  if (agent) {
    agent.status = status === 'busy' ? 'busy' : 'idle';
    agent.currentTask = currentTask;
    renderAgents();
  }
}

function updateSystemStatus(data) {
  const statusEl = document.getElementById('system-status');
  const telegramEl = document.getElementById('telegram-status');

  if (data.server === 'online') {
    statusEl.textContent = 'ONLINE';
    statusEl.className = 'font-bold text-green-400';
  } else {
    statusEl.textContent = 'OFFLINE';
    statusEl.className = 'font-bold text-red-400';
  }

  if (data.telegram) {
    telegramEl.textContent = 'Connected';
    telegramEl.className = 'font-bold mono text-green-400';
  } else {
    telegramEl.textContent = 'Not Configured';
    telegramEl.className = 'font-bold mono text-gray-400';
  }
}

// ===========================================
// ACCIONES
// ===========================================

function toggleCreateModal() {
  const modal = document.getElementById('create-modal');
  modal.classList.toggle('hidden');
  modal.classList.toggle('flex');
}

async function createTask(event) {
  event.preventDefault();

  const taskData = {
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-description').value,
    type: document.getElementById('task-type').value,
    priority: document.getElementById('task-priority').value
  };

  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });

    if (response.ok) {
      const task = await response.json();
      toggleCreateModal();
      document.getElementById('create-task-form').reset();
      addLog(`Tarea creada desde dashboard: ${task.title}`);
      showNotification('Tarea Creada', task.title, 'success');
    } else {
      const error = await response.json();
      throw new Error(error.error);
    }
  } catch (error) {
    console.error('Error creando tarea:', error);
    addLog(`Error creando tarea: ${error.message}`, 'error');
    showNotification('Error', error.message, 'error');
  }
}

async function cancelTask(taskId) {
  if (!confirm('¿Estás seguro de cancelar esta tarea?')) return;

  try {
    const response = await fetch(`/api/tasks/${taskId}/cancel`, {
      method: 'POST'
    });

    if (response.ok) {
      addLog(`Tarea cancelada: ${taskId}`);
      showNotification('Tarea Cancelada', `ID: ${taskId}`, 'warning');
    } else {
      const error = await response.json();
      throw new Error(error.error);
    }
  } catch (error) {
    console.error('Error cancelando tarea:', error);
    addLog(`Error cancelando tarea: ${error.message}`, 'error');
    showNotification('Error', error.message, 'error');
  }
}

function restartAgent(agentId) {
  socket.emit('command:restartAgent', agentId);
  addLog(`Reiniciando agente: ${agentId}`);
  showNotification('Agente Reiniciado', agentId, 'info');
}

function filterTasks(filter) {
  currentFilter = filter;
  renderTasks();
}

function viewTaskDetails(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    alert(`Tarea: ${task.title}\nEstado: ${task.status}\nProgreso: ${task.progress}%\nAgente: ${task.assignedAgent || 'No asignado'}`);
  }
}

function viewAgentDetails(agentId) {
  const agent = agents.find(a => a.id === agentId);
  if (agent) {
    alert(`Agente: ${agent.name}\nTipo: ${agent.type}\nEstado: ${agent.status}\nTarea Actual: ${agent.currentTask || 'Ninguna'}`);
  }
}

// ===========================================
// UTILIDADES
// ===========================================

function getStatusConfig(status) {
  const configs = {
    pending: { text: 'Pendiente', class: 'bg-yellow-900 text-yellow-300' },
    in_progress: { text: 'En Progreso', class: 'bg-blue-900 text-blue-300' },
    completed: { text: 'Completada', class: 'bg-green-900 text-green-300' },
    failed: { text: 'Fallida', class: 'bg-red-900 text-red-300' },
    cancelled: { text: 'Cancelada', class: 'bg-gray-900 text-gray-300' }
  };
  return configs[status] || configs.pending;
}

function getPriorityConfig(priority) {
  const configs = {
    low: { text: 'Baja', class: 'bg-gray-800 text-gray-300' },
    medium: { text: 'Media', class: 'bg-blue-900 text-blue-300' },
    high: { text: 'Alta', class: 'bg-orange-900 text-orange-300' },
    critical: { text: 'Crítica', class: 'bg-red-900 text-red-300' }
  };
  return configs[priority] || configs.medium;
}

function getProgressColor(progress) {
  if (progress < 30) return '#F59E0B';
  if (progress < 70) return '#3B82F6';
  return '#10B981';
}

function addLog(message, level = 'info') {
  const logsEl = document.getElementById('live-logs');
  const timestamp = new Date().toLocaleTimeString();
  const levelColors = {
    info: 'text-green-400',
    warn: 'text-yellow-400',
    error: 'text-red-400',
    debug: 'text-blue-400'
  };

  const logEl = document.createElement('div');
  logEl.className = `${levelColors[level]} mb-1`;
  logEl.textContent = `[${timestamp}] ${message}`;

  logsEl.appendChild(logEl);
  logsEl.scrollTop = logsEl.scrollHeight;

  // Mantener solo los últimos 100 logs
  while (logsEl.children.length > 100) {
    logsEl.removeChild(logsEl.firstChild);
  }
}

function showNotification(title, message, type = 'info') {
  // Notificación simple (puede mejorarse con librerías como Toastify)
  console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
}

function viewJARVISDetails() {
  const jarvis = agents.find(a => a.id === 'jarvis-agent');
  if (jarvis) {
    alert(
      `🤖 ${jarvis.name} - J.A.R.V.I.S.\n` +
      `Just A Rather Very Intelligent System\n\n` +
      `Estado: ${jarvis.status}\n` +
      `Tipo: ${jarvis.type}\n` +
      `Nunca Duerme: ${jarvis.metadata?.neverSleeps ? '✅ SÍ' : '❌ NO'}\n` +
      `Uptime: ${jarvis.metadata?.uptime || '∞'}\n\n` +
      `📊 MÉTRICAS:\n` +
      `Tareas Supervisadas: ${jarvis.tasksCompleted || 0}\n` +
      `Agentes Gestionados: ${jarvis.metadata?.agentsManaged || 6}\n` +
      `Optimizaciones: ${jarvis.metadata?.optimizationsMade || 0}\n` +
      `Alertas Generadas: ${jarvis.metadata?.alertsGenerated || 0}\n` +
      `Reportes: ${jarvis.metadata?.reportsGenerated || 0}\n\n` +
      `🦾 FUNCIONES:\n` +
      `• Monitoreo constante cada 5 segundos\n` +
      `• Reasignación automática de tareas\n` +
      `• Optimización de carga de trabajo\n` +
      `• Detección de tareas estancadas\n` +
      `• Reportes automáticos cada hora\n` +
      `• Alertas tempranas inteligentes`
    );
  }
}

function startLiveUpdates() {
  // Actualizar cada 30 segundos
  setInterval(async () => {
    try {
      const response = await fetch('/api/tasks');
      tasks = await response.json();
      renderTasks();
      updateStats();
    } catch (error) {
      console.error('Error actualizando:', error);
    }
  }, 30000);
}

// ===========================================
// JARVIS COMMAND CONSOLE
// ===========================================

function sendCommand() {
  const input = document.getElementById('jarvis-command-input');
  const command = input.value.trim();

  if (!command) return;

  // Agregar comando al output
  appendCommandOutput(`📤 Tú: ${command}`, 'text-blue-400');

  // Enviar a JARVIS
  socket.emit('jarvis:command', {
    command: command,
    context: {}
  });

  // Limpiar input
  input.value = '';
}

function setCommand(command) {
  const input = document.getElementById('jarvis-command-input');
  input.value = command;
  input.focus();
}

function toggleCommandHelp() {
  const modal = document.getElementById('command-help-modal');
  modal.classList.toggle('hidden');
  modal.classList.toggle('flex');
}

function appendCommandOutput(message, className = 'text-gray-300') {
  const output = document.getElementById('command-output');
  const div = document.createElement('div');
  div.className = `mb-2 ${className}`;
  div.textContent = message;
  output.appendChild(div);
  output.scrollTop = output.scrollHeight;
}

// Socket listeners para comandos de JARVIS
socket.on('jarvis:command:started', (data) => {
  appendCommandOutput(`⏳ JARVIS procesando: "${data.command}"`, 'text-yellow-400');
});

socket.on('jarvis:command:complete', (data) => {
  if (data.result.success) {
    appendCommandOutput(`✅ JARVIS: ${data.result.message || 'Comando completado'}`, 'text-green-400');

    if (data.result.nextSteps) {
      data.result.nextSteps.forEach(step => {
        appendCommandOutput(`  → ${step}`, 'text-gray-400');
      });
    }
  } else {
    appendCommandOutput(`❌ JARVIS: ${data.result.error || 'Error en comando'}`, 'text-red-400');
  }
});

socket.on('jarvis:command:error', (data) => {
  appendCommandOutput(`❌ Error: ${data.error}`, 'text-red-400');
});

socket.on('command:output', (data) => {
  const type = data.type === 'stdout' ? 'text-gray-300' : 'text-red-400';
  const lines = data.data.split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      appendCommandOutput(`  ${line}`, type);
    }
  });
});

socket.on('command:progress', (data) => {
  const type = data.type === 'stdout' ? 'text-blue-300' : 'text-red-400';
  const lines = data.data.split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      appendCommandOutput(`  ${line}`, type);
    }
  });
});

// Manejar comando "help" especial
const originalSendCommand = sendCommand;
sendCommand = function () {
  const input = document.getElementById('jarvis-command-input');
  const command = input.value.trim();

  if (command.toLowerCase() === 'help') {
    toggleCommandHelp();
    appendCommandOutput('📖 Mostrando ayuda...', 'text-blue-400');
    input.value = '';
    return;
  }

  originalSendCommand();
};
