const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');

const config = require('./config/database');
const database = require('./database/database');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

const logger = pino({
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:dd-mm-yyyy HH:MM:ss', ignore: 'pid,hostname' }
    }
});

const app = express();

app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors());

const generalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 200,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
});

const userLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	limit: 500,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: (req, res) => req.user ? req.user.id : ipKeyGenerator(req),
	message: 'Muitas requisições originadas deste usuário, tente novamente mais tarde.',
});

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => res.json({ service: 'Task Management API', version: '1.0.0' }));
app.get('/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));

app.use('/api/auth', generalLimiter, authRoutes);
app.use('/api/tasks', userLimiter, taskRoutes);

app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Endpoint não encontrado' }));

app.use((error, req, res, next) => {
    req.log.error(error, 'Erro não tratado');
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
});

async function startServer() {
    try {
        await database.init();
        app.listen(config.port, () => {
            logger.info('🚀 =================================');
            logger.info(`🚀 Servidor iniciado na porta ${config.port}`);
            logger.info(`🚀 URL: http://localhost:${config.port}`);
            logger.info('🚀 =================================');
        });
    } catch (error) {
        logger.fatal({ err: error }, '❌ Falha na inicialização:');
        process.exit(1);
    }
}

startServer();