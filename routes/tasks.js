const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Task = require('../models/Task');
const database = require('../database/database');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 60 });
const router = express.Router();

router.use(authMiddleware);

// ROTA GET / ATUALIZADA COM FILTROS AVANÇADOS
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        // Adiciona os novos filtros da query
        const { completed, priority, category, tags, startDate, endDate } = req.query;
        
        let sql = 'SELECT * FROM tasks WHERE userId = ?';
        const params = [req.user.id];

        if (completed !== undefined) {
            sql += ' AND completed = ?';
            params.push(completed === 'true' ? 1 : 0);
        }
        if (priority) {
            sql += ' AND priority = ?';
            params.push(priority);
        }
        // LÓGICA DOS NOVOS FILTROS
        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }
        if (tags) { // Busca por tags que contenham o valor
            sql += ' AND tags LIKE ?';
            params.push(`%${tags}%`);
        }
        if (startDate) {
            sql += " AND date(createdAt) >= date(?)";
            params.push(startDate);
        }
        if (endDate) {
            sql += " AND date(createdAt) <= date(?)";
            params.push(endDate);
        }

        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
        const totalResult = await database.get(countSql, params);
        const totalItems = totalResult.count;

        sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const rows = await database.all(sql, params);
        const tasks = rows.map(row => new Task({...row, completed: row.completed === 1}));
        
        res.json({
            success: true,
            data: tasks.map(task => task.toJSON()),
            meta: {
                totalItems,
                totalPages: Math.ceil(totalItems / limit),
                currentPage: page,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        req.log.error(error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// ROTA POST / ATUALIZADA PARA SALVAR NOVOS CAMPOS
router.post('/', validate('task'), async (req, res) => {
    try {
        const taskData = { id: uuidv4(), ...req.body, userId: req.user.id };
        const task = new Task(taskData);
        if (!task.validate().isValid) {
            return res.status(400).json({ success: false, message: 'Dados inválidos' });
        }
        // Adiciona category e tags ao INSERT
        await database.run('INSERT INTO tasks (id, title, description, priority, category, tags, userId) VALUES (?, ?, ?, ?, ?, ?, ?)', [task.id, task.title, task.description, task.priority, req.body.category, req.body.tags, task.userId]);
        cache.flushAll();
        req.log.info('Cache limpo devido a nova tarefa.');
        res.status(201).json({ success: true, message: 'Tarefa criada com sucesso', data: task.toJSON() });
    } catch (error) {
        req.log.error(error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// ... (rota /stats/summary e GET /:id permanecem iguais)
router.get('/stats/summary', async (req, res) => {
    try {
        const stats = await database.get(`SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending FROM tasks WHERE userId = ?`, [req.user.id]);
        res.json({ success: true, data: { ...stats, completionRate: stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(2) : 0 }});
    } catch (error) {
        req.log.error(error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const cacheKey = `task_${req.user.id}_${req.params.id}`;
        if (cache.has(cacheKey)) {
            req.log.info(`Cache HIT para a chave: ${cacheKey}`);
            return res.json({ success: true, data: cache.get(cacheKey) });
        }
        req.log.info(`Cache MISS para a chave: ${cacheKey}`);
        const row = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
        if (!row) {
            return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
        }
        const task = new Task({...row, completed: row.completed === 1});
        const taskJSON = task.toJSON();
        cache.set(cacheKey, taskJSON);
        res.json({ success: true, data: taskJSON });
    } catch (error) {
        req.log.error(error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});


// ROTA PUT /:id ATUALIZADA PARA SALVAR NOVOS CAMPOS
router.put('/:id', async (req, res) => {
    try {
        const { title, description, completed, priority, category, tags } = req.body;
        const result = await database.run('UPDATE tasks SET title = ?, description = ?, completed = ?, priority = ?, category = ?, tags = ? WHERE id = ? AND userId = ?', [title, description, completed ? 1 : 0, priority, category, tags, req.params.id, req.user.id]);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
        }
        const cacheKey = `task_${req.user.id}_${req.params.id}`;
        cache.del(cacheKey);
        cache.flushAll();
        req.log.info(`Cache DELETADO para a chave: ${cacheKey}`);
        const updatedRow = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
        const task = new Task({...updatedRow, completed: updatedRow.completed === 1});
        res.json({ success: true, message: 'Tarefa atualizada com sucesso', data: task.toJSON() });
    } catch (error) {
        req.log.error(error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// ... (rota DELETE /:id permanece igual)
router.delete('/:id', async (req, res) => {
    try {
        const cacheKey = `task_${req.user.id}_${req.params.id}`;
        cache.del(cacheKey);
        cache.flushAll();
        req.log.info(`Cache DELETADO para a chave: ${cacheKey}`);
        const result = await database.run('DELETE FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
        }
        res.json({ success: true, message: 'Tarefa deletada com sucesso' });
    } catch (error) {
        req.log.error(error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

module.exports = router;