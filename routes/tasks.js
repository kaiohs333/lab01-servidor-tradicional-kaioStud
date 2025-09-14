// Local: lab01-pratica-kaio/routes/tasks.js

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Task = require('../models/Task');
const database = require('../database/database');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authMiddleware);

// ROTA GET / COM PAGINAÇÃO
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;
        
        const { completed, priority } = req.query;
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
                totalItems: totalItems,
                totalPages: Math.ceil(totalItems / limit),
                currentPage: page
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Criar tarefa
router.post('/', validate('task'), async (req, res) => {
    try {
        const taskData = { id: uuidv4(), ...req.body, userId: req.user.id };
        const task = new Task(taskData);
        if (!task.validate().isValid) {
            return res.status(400).json({ success: false, message: 'Dados inválidos' });
        }
        await database.run('INSERT INTO tasks (id, title, description, priority, userId) VALUES (?, ?, ?, ?, ?)', [task.id, task.title, task.description, task.priority, task.userId]);
        res.status(201).json({ success: true, message: 'Tarefa criada com sucesso', data: task.toJSON() });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Resto das rotas (GET por ID, PUT, DELETE, etc.)
router.get('/:id', async (req, res) => {
    try {
        const row = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
        if (!row) {
            return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
        }
        const task = new Task({...row, completed: row.completed === 1});
        res.json({ success: true, data: task.toJSON() });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { title, description, completed, priority } = req.body;
        const result = await database.run('UPDATE tasks SET title = ?, description = ?, completed = ?, priority = ? WHERE id = ? AND userId = ?', [title, description, completed ? 1 : 0, priority, req.params.id, req.user.id]);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
        }
        const updatedRow = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
        const task = new Task({...updatedRow, completed: updatedRow.completed === 1});
        res.json({ success: true, message: 'Tarefa atualizada com sucesso', data: task.toJSON() });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await database.run('DELETE FROM tasks WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
        }
        res.json({ success: true, message: 'Tarefa deletada com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

router.get('/stats/summary', async (req, res) => {
    // Esta rota pode não existir no seu Roteiro 1, não tem problema
});

module.exports = router;