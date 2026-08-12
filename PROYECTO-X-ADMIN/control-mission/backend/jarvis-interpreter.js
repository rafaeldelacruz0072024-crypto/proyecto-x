/**
 * JARVIS Command Interpreter - Intérprete de Comandos
 * Traduce comandos en lenguaje natural a acciones ejecutables
 */

const CommandExecutor = require('./command-executor');

class JarvisInterpreter {
  constructor(logger, io, db) {
    this.logger = logger;
    this.io = io;
    this.db = db;
    this.executor = new CommandExecutor(logger, io);
    
    // Comandos disponibles
    this.commands = this.getAvailableCommands();
  }

  /**
   * Obtener comandos disponibles
   */
  getAvailableCommands() {
    return {
      // Backend
      'crear api': {
        pattern: /crear\s+(api|backend|servidor)/i,
        handler: this.createAPI.bind(this),
        description: 'Crear API REST con Express'
      },
      
      // Frontend
      'crear frontend': {
        pattern: /crear\s+(frontend|react|vue|angular)/i,
        handler: this.createFrontend.bind(this),
        description: 'Crear aplicación frontend'
      },
      
      // Proyecto
      'crear proyecto': {
        pattern: /crear\s+(proyecto|project)/i,
        handler: this.createProject.bind(this),
        description: 'Crear proyecto completo'
      },
      
      // Instalar
      'instalar': {
        pattern: /instalar\s+(npm|packages|dependencias)/i,
        handler: this.installPackages.bind(this),
        description: 'Instalar dependencias'
      },
      
      // Ejecutar
      'ejecutar': {
        pattern: /ejecutar\s+(script|app|server)/i,
        handler: this.executeScript.bind(this),
        description: 'Ejecutar script o aplicación'
      },
      
      // Test
      'test': {
        pattern: /ejecutar\s+(tests|test)/i,
        handler: this.runTests.bind(this),
        description: 'Ejecutar tests'
      },
      
      // Archivos
      'crear archivo': {
        pattern: /crear\s+(archivo|file)/i,
        handler: this.createFile.bind(this),
        description: 'Crear archivo'
      },
      
      // Listar
      'listar': {
        pattern: /listar\s+(archivos|files)/i,
        handler: this.listFiles.bind(this),
        description: 'Listar archivos'
      },
      
      // Limpiar
      'limpiar': {
        pattern: /limpiar\s+(proyecto|proyect|todo)/i,
        handler: this.cleanProject.bind(this),
        description: 'Limpiar proyecto'
      },
      
      // Build
      'build': {
        pattern: /build|compilar|construir/i,
        handler: this.buildProject.bind(this),
        description: 'Compilar proyecto'
      },
      
      // Deploy
      'deploy': {
        pattern: /deploy|desplegar|publicar/i,
        handler: this.deployProject.bind(this),
        description: 'Desplegar proyecto'
      }
    };
  }

  /**
   * Interpretar comando
   */
  async interpret(commandText, context = {}) {
    this.logger.info(`🧠 JARVIS interpretando: "${commandText}"`);
    
    // Buscar comando que matchee
    for (const [name, cmd] of Object.entries(this.commands)) {
      const match = commandText.match(cmd.pattern);
      
      if (match) {
        this.logger.info(`✅ Comando identificado: ${name}`);
        
        try {
          // Ejecutar handler
          const result = await cmd.handler(commandText, match, context);
          
          this.io.emit('jarvis:command:complete', {
            command: commandText,
            result,
            success: true
          });
          
          return {
            success: true,
            command: name,
            result
          };
        } catch (error) {
          this.logger.error(`Error ejecutando comando: ${name}`, error);
          
          this.io.emit('jarvis:command:error', {
            command: commandText,
            error: error.message
          });
          
          return {
            success: false,
            command: name,
            error: error.message
          };
        }
      }
    }
    
    // No se encontró comando
    this.logger.warn(`Comando no reconocido: ${commandText}`);
    
    return {
      success: false,
      error: 'Comando no reconocido. Usa "help" para ver comandos disponibles.'
    };
  }

  /**
   * Crear API REST
   */
  async createAPI(commandText, match, context) {
    const projectName = this.extractProjectName(commandText) || 'api-project';
    
    this.logger.info(`🚀 Creando API: ${projectName}`);
    
    // Crear directorio
    const projectDir = `projects/${projectName}`;
    
    // Crear estructura
    await this.executor.createFile(`${projectDir}/package.json`, JSON.stringify({
      name: projectName,
      version: '1.0.0',
      description: 'API REST creada por JARVIS',
      main: 'server.js',
      scripts: {
        start: 'node server.js',
        dev: 'nodemon server.js',
        test: 'jest'
      },
      dependencies: {
        express: '^4.18.2',
        cors: '^2.8.5'
      },
      devDependencies: {
        nodemon: '^2.0.22'
      }
    }, null, 2));
    
    await this.executor.createFile(`${projectDir}/server.js`, `
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'API creada por JARVIS' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(\`🚀 Server running on port \${PORT}\`);
});
`);
    
    await this.executor.createFile(`${projectDir}/.gitignore`, `node_modules/
.env
*.log
`);
    
    // Instalar dependencias
    await this.executor.executeWithProgress('npm install', {
      cwd: `projects/${projectName}`
    });
    
    return {
      success: true,
      message: `API creada exitosamente en ${projectDir}`,
      files: ['package.json', 'server.js', '.gitignore'],
      nextSteps: [
        'npm start - Para iniciar la API',
        'http://localhost:3000 - Endpoint principal',
        'http://localhost:3000/api/health - Health check'
      ]
    };
  }

  /**
   * Crear Frontend
   */
  async createFrontend(commandText, match, context) {
    const projectName = this.extractProjectName(commandText) || 'frontend-app';
    const framework = this.extractFramework(commandText) || 'react';
    
    this.logger.info(`🎨 Creando Frontend: ${projectName} con ${framework}`);
    
    // Comandos para crear proyecto
    const commands = {
      react: `npx create-react-app ${projectName}`,
      vue: `npm create vue@latest ${projectName}`,
      angular: `npx @angular/cli new ${projectName}`
    };
    
    const command = commands[framework] || commands.react;
    
    await this.executor.executeWithProgress(command, {
      cwd: 'projects'
    });
    
    return {
      success: true,
      message: `Frontend ${framework} creado en projects/${projectName}`,
      framework,
      nextSteps: [
        `cd ${projectName}`,
        'npm start - Para iniciar el servidor de desarrollo'
      ]
    };
  }

  /**
   * Crear Proyecto Completo
   */
  async createProject(commandText, match, context) {
    const projectName = this.extractProjectName(commandText) || 'fullstack-app';
    
    this.logger.info(`🏗️ Creando proyecto fullstack: ${projectName}`);
    
    // Crear estructura completa
    const structure = [
      `${projectName}/backend`,
      `${projectName}/frontend`,
      `${projectName}/shared`,
      `${projectName}/docs`
    ];
    
    for (const dir of structure) {
      await this.executor.execute(`mkdir -p projects/${dir}`);
    }
    
    // Crear backend
    await this.createAPI(`crear api ${projectName}-backend`);
    
    // Crear README
    await this.executor.createFile(`${projectName}/README.md`, `# ${projectName}

Proyecto Fullstack creado por JARVIS

## Estructura

- \`backend/\` - API REST con Express
- \`frontend/\` - Aplicación React
- \`shared/\` - Código compartido
- \`docs/\` - Documentación

## Comandos

### Backend
\`\`\`bash
cd backend
npm install
npm start
\`\`\`

### Frontend
\`\`\`bash
cd frontend
npm install
npm start
\`\`\`

## JARVIS Commands
- \`jarvis crear api\` - Crear nueva API
- \`jarvis crear frontend\` - Crear nuevo frontend
- \`jarvis ejecutar tests\` - Ejecutar tests
`);
    
    return {
      success: true,
      message: `Proyecto fullstack creado: ${projectName}`,
      structure,
      nextSteps: [
        'Configurar backend y frontend',
        'npm install en cada directorio',
        'npm start para iniciar'
      ]
    };
  }

  /**
   * Instalar Paquetes
   */
  async installPackages(commandText, match, context) {
    const packages = this.extractPackages(commandText);
    
    if (!packages || packages.length === 0) {
      return {
        success: false,
        error: 'No se especificaron paquetes para instalar'
      };
    }
    
    this.logger.info(`📦 Instalando paquetes: ${packages.join(', ')}`);
    
    await this.executor.installNpmPackages(packages);
    
    return {
      success: true,
      message: `Paquetes instalados: ${packages.join(', ')}`,
      packages
    };
  }

  /**
   * Ejecutar Script
   */
  async executeScript(commandText, match, context) {
    const scriptPath = this.extractScriptPath(commandText);
    
    if (!scriptPath) {
      return {
        success: false,
        error: 'No se especificó script para ejecutar'
      };
    }
    
    this.logger.info(`▶️ Ejecutando script: ${scriptPath}`);
    
    const result = await this.executor.runNodeScript(scriptPath);
    
    return {
      success: true,
      message: 'Script ejecutado exitosamente',
      output: result.stdout
    };
  }

  /**
   * Ejecutar Tests
   */
  async runTests(commandText, match, context) {
    this.logger.info(`🧪 Ejecutando tests`);
    
    const result = await this.executor.executeWithProgress('npm test');
    
    return {
      success: true,
      message: 'Tests ejecutados',
      output: result.stdout,
      errors: result.stderr
    };
  }

  /**
   * Crear Archivo
   */
  async createFile(commandText, match, context) {
    const filePath = this.extractFilePath(commandText);
    const content = this.extractFileContent(commandText);
    
    if (!filePath) {
      return {
        success: false,
        error: 'No se especificó ruta del archivo'
      };
    }
    
    await this.executor.createFile(filePath, content || '');
    
    return {
      success: true,
      message: `Archivo creado: ${filePath}`,
      path: filePath
    };
  }

  /**
   * Listar Archivos
   */
  async listFiles(commandText, match, context) {
    const dirPath = this.extractDirPath(commandText) || '';
    
    const result = await this.executor.listFiles(dirPath);
    
    return {
      success: true,
      files: result.files,
      directory: dirPath || '/'
    };
  }

  /**
   * Limpiar Proyecto
   */
  async cleanProject(commandText, match, context) {
    this.logger.info(`🧹 Limpiando proyecto`);
    
    await this.executor.cleanDirectory('projects');
    
    return {
      success: true,
      message: 'Proyecto limpiado'
    };
  }

  /**
   * Build Project
   */
  async buildProject(commandText, match, context) {
    this.logger.info(`🏗️ Compilando proyecto`);
    
    const result = await this.executor.executeWithProgress('npm run build');
    
    return {
      success: true,
      message: 'Proyecto compilado',
      output: result.stdout
    };
  }

  /**
   * Deploy Project
   */
  async deployProject(commandText, match, context) {
    this.logger.info(`🚀 Desplegando proyecto`);
    
    // Aquí iría la lógica de deploy real
    return {
      success: true,
      message: 'Deploy simulado completado',
      note: 'Configurar deploy real según plataforma'
    };
  }

  // ========== UTILS ==========

  extractProjectName(text) {
    const match = text.match(/(?:llamado|named|nombre)\s+["']?([^"'\s]+)["']?/i);
    return match ? match[1] : null;
  }

  extractFramework(text) {
    const frameworks = ['react', 'vue', 'angular', 'nextjs', 'nuxt'];
    for (const fw of frameworks) {
      if (text.toLowerCase().includes(fw)) {
        return fw;
      }
    }
    return 'react';
  }

  extractPackages(text) {
    const match = text.match(/instalar\s+(?:npm\s+)?(?:packages?\s+)?(.+)$/i);
    if (match) {
      return match[1].split(/\s*,\s*|\s+/);
    }
    return null;
  }

  extractScriptPath(text) {
    const match = text.match(/ejecutar\s+(?:script\s+)?([^\s]+\.js)/i);
    return match ? match[1] : null;
  }

  extractFilePath(text) {
    const match = text.match(/crear\s+archivo\s+([^\s]+)\s*(?:con|contenido)?/i);
    return match ? match[1] : null;
  }

  extractFileContent(text) {
    const match = text.match(/(?:con|contenido)\s*[:\s]*(.+)/i);
    return match ? match[1] : '';
  }

  extractDirPath(text) {
    const match = text.match(/listar\s+(?:archivos\s+)?(?:en\s+)?([^\s]+)/i);
    return match ? match[1] : '';
  }

  /**
   * Obtener ayuda de comandos
   */
  getHelp() {
    return {
      message: 'Comandos disponibles de JARVIS:',
      commands: Object.entries(this.commands).map(([name, cmd]) => ({
        name,
        description: cmd.description,
        example: this.getExample(name)
      }))
    };
  }

  getExample(commandName) {
    const examples = {
      'crear api': 'jarvis crear api llamada "mi-api"',
      'crear frontend': 'jarvis crear frontend con react llamado "mi-app"',
      'crear proyecto': 'jarvis crear proyecto llamado "mi-proyecto"',
      'instalar': 'jarvis instalar npm express, cors, dotenv',
      'ejecutar': 'jarvis ejecutar script server.js',
      'test': 'jarvis ejecutar tests',
      'crear archivo': 'jarvis crear archivo test.js con console.log("hola")',
      'listar': 'jarvis listar archivos',
      'limpiar': 'jarvis limpiar proyecto',
      'build': 'jarvis build',
      'deploy': 'jarvis deploy'
    };
    
    return examples[commandName] || 'N/A';
  }
}

module.exports = JarvisInterpreter;
