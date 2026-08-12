/**
 * JARVIS Command Executor - Sistema de Ejecución de Comandos
 * Permite a JARVIS ejecutar comandos reales en el backend
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class CommandExecutor {
  constructor(logger, io) {
    this.logger = logger;
    this.io = io;
    this.workingDir = path.join(__dirname, '..', 'projects');
    this.ensureWorkingDir();
  }

  ensureWorkingDir() {
    if (!fs.existsSync(this.workingDir)) {
      fs.mkdirSync(this.workingDir, { recursive: true });
    }
  }

  /**
   * Ejecutar comando en el backend
   */
  async execute(command, options = {}) {
    const {
      cwd = this.workingDir,
      timeout = 300000, // 5 minutos máximo
      env = process.env
    } = options;

    return new Promise((resolve, reject) => {
      this.logger.info(`🔧 Ejecutando comando: ${command}`);

      const child = exec(command, {
        cwd,
        env,
        timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        this.io.emit('command:output', {
          type: 'stdout',
          data: data.toString(),
          command
        });
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        this.io.emit('command:output', {
          type: 'stderr',
          data: data.toString(),
          command
        });
      });

      child.on('close', (code) => {
        const result = {
          command,
          code,
          stdout,
          stderr,
          success: code === 0
        };

        if (code === 0) {
          this.logger.info(`✅ Comando completado: ${command}`, result);
          resolve(result);
        } else {
          this.logger.error(`❌ Comando fallido: ${command}`, result);
          reject(new Error(`Comando falló con código ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        this.logger.error(`Error ejecutando comando: ${command}`, { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * Ejecutar comando con output en tiempo real
   */
  async executeWithProgress(command, options = {}) {
    const {
      cwd = this.workingDir,
      onProgress = null
    } = options;

    return new Promise((resolve, reject) => {
      this.logger.info(`🔧 Ejecutando con progreso: ${command}`);

      const child = spawn(command, [], {
        cwd,
        shell: true,
        env: process.env
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        if (onProgress) {
          onProgress({ type: 'stdout', data: output });
        }
        
        this.io.emit('command:progress', {
          type: 'stdout',
          data: output,
          command
        });
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        
        if (onProgress) {
          onProgress({ type: 'stderr', data: output });
        }
        
        this.io.emit('command:progress', {
          type: 'stderr',
          data: output,
          command
        });
      });

      child.on('close', (code) => {
        const result = {
          command,
          code,
          stdout,
          stderr,
          success: code === 0
        };

        if (code === 0) {
          resolve(result);
        } else {
          reject(new Error(`Comando falló con código ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Crear archivo
   */
  async createFile(filePath, content) {
    const fullPath = path.join(this.workingDir, filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content);
    this.logger.info(`📄 Archivo creado: ${filePath}`);
    
    return {
      success: true,
      path: fullPath,
      relativePath: filePath
    };
  }

  /**
   * Leer archivo
   */
  async readFile(filePath) {
    const fullPath = path.join(this.workingDir, filePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Archivo no existe: ${filePath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    this.logger.info(`📖 Archivo leído: ${filePath}`);
    
    return {
      success: true,
      path: fullPath,
      content
    };
  }

  /**
   * Listar archivos
   */
  async listFiles(dirPath = '') {
    const fullPath = path.join(this.workingDir, dirPath);
    
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: 'Directorio no existe' };
    }

    const files = fs.readdirSync(fullPath, { withFileTypes: true });
    
    return {
      success: true,
      files: files.map(f => ({
        name: f.name,
        isDirectory: f.isDirectory(),
        isFile: f.isFile()
      }))
    };
  }

  /**
   * Instalar dependencias npm
   */
  async installNpmPackages(packages, options = {}) {
    const { cwd = this.workingDir } = options;
    
    this.logger.info(`📦 Instalando paquetes: ${packages.join(', ')}`);
    
    return await this.execute(`npm install ${packages.join(' ')}`, { cwd });
  }

  /**
   * Inicializar proyecto Node.js
   */
  async initNodeProject(projectName) {
    const projectDir = path.join(this.workingDir, projectName);
    
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    await this.execute('npm init -y', { cwd: projectDir });
    
    this.logger.info(`📦 Proyecto Node.js inicializado: ${projectName}`);
    
    return {
      success: true,
      path: projectDir
    };
  }

  /**
   * Ejecutar script Node.js
   */
  async runNodeScript(scriptPath, args = []) {
    const command = `node ${scriptPath} ${args.join(' ')}`;
    return await this.execute(command);
  }

  /**
   * Ejecutar script Python
   */
  async runPythonScript(scriptPath, args = []) {
    const command = `python ${scriptPath} ${args.join(' ')}`;
    return await this.execute(command);
  }

  /**
   * Limpiar directorio
   */
  async cleanDirectory(dirPath) {
    const fullPath = path.join(this.workingDir, dirPath);
    
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      fs.mkdirSync(fullPath, { recursive: true });
      
      this.logger.info(`🧹 Directorio limpiado: ${dirPath}`);
    }
    
    return { success: true };
  }

  /**
   * Verificar si un comando existe
   */
  async commandExists(command) {
    try {
      await this.execute(`which ${command}`);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = CommandExecutor;
