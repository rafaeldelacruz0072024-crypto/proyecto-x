/**
 * Database - Sistema de almacenamiento local (lowdb)
 * Almacena tareas, agentes, logs y configuración
 */

const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.dbPath = process.env.DB_FILE || 'config/db.json';
    this.ensureDbExists();
    this.data = this.loadData();
  }

  ensureDbExists() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, JSON.stringify({
        tasks: [],
        agents: [],
        logs: [],
        config: {
          maxConcurrentTasks: 5,
          agentTimeoutMinutes: 30
        }
      }, null, 2));
    }
  }

  loadData() {
    const content = fs.readFileSync(this.dbPath, 'utf-8');
    return JSON.parse(content);
  }

  saveData() {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
  }

  // ========== TAREAS ==========
  
  addTask(task) {
    this.data.tasks.push(task);
    this.saveData();
    return task;
  }

  getTasks() {
    return this.data.tasks;
  }

  getTask(id) {
    return this.data.tasks.find(t => t.id === id);
  }

  updateTask(id, updates) {
    const index = this.data.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      this.data.tasks[index] = { ...this.data.tasks[index], ...updates };
      this.saveData();
      return this.data.tasks[index];
    }
    return null;
  }

  deleteTask(id) {
    const index = this.data.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      const task = this.data.tasks.splice(index, 1)[0];
      this.saveData();
      return task;
    }
    return null;
  }

  getTasksByStatus(status) {
    return this.data.tasks.filter(t => t.status === status);
  }

  getTasksByAgent(agentId) {
    return this.data.tasks.filter(t => t.assignedAgent === agentId);
  }

  // ========== AGENTES ==========
  
  addAgent(agent) {
    this.data.agents.push(agent);
    this.saveData();
    return agent;
  }

  getAgents() {
    return this.data.agents;
  }

  getAgent(id) {
    return this.data.agents.find(a => a.id === id);
  }

  updateAgent(id, updates) {
    const index = this.data.agents.findIndex(a => a.id === id);
    if (index !== -1) {
      this.data.agents[index] = { ...this.data.agents[index], ...updates };
      this.saveData();
      return this.data.agents[index];
    }
    return null;
  }

  // ========== LOGS ==========
  
  addLog(log) {
    this.data.logs.push({
      ...log,
      timestamp: new Date().toISOString()
    });
    // Mantener solo los últimos 1000 logs
    if (this.data.logs.length > 1000) {
      this.data.logs = this.data.logs.slice(-1000);
    }
    this.saveData();
    return log;
  }

  getLogs(limit = 100) {
    return this.data.logs.slice(-limit);
  }

  getLogsByLevel(level) {
    return this.data.logs.filter(l => l.level === level);
  }

  // ========== ESTADÍSTICAS ==========
  
  getStats() {
    const tasks = this.data.tasks;
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      agents: this.data.agents.length,
      agentsActive: this.data.agents.filter(a => a.status === 'active').length
    };
  }
}

module.exports = Database;
