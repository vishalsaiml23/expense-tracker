import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pool from './db.js';
import { requireAuth } from './auth.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const SESSION_COOKIE_NAME = 'moneta_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE_MS,
};

const sessionTokenFromRequest = (req) => {
  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!cookie) return null;
  return decodeURIComponent(cookie.slice(SESSION_COOKIE_NAME.length + 1));
};

const setSessionCookie = (res, token) => {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}${secureFlag}`);
};

const clearSessionCookie = (res) => {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`);
};

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '32kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }));

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const validId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const validAmount = (value) => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 999999999;
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const tokenFor = (user) => jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(409).json({ error: 'An account with that email already exists.' });
  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hash]);
  const user = { id: result.insertId, name, email };
  const token = tokenFor(user);
  setSessionCookie(res, token);
  return res.status(201).json({ token, user });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const [rows] = await pool.execute('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  const { id, name, email: userEmail } = rows[0];
  const user = { id, name, email: userEmail };
  const token = tokenFor(user);
  setSessionCookie(res, token);
  return res.json({ token, user });
}));

app.post('/api/auth/logout', asyncRoute(async (_req, res) => {
  clearSessionCookie(res);
  return res.json({ message: 'Signed out.' });
}));

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT id, name, email FROM users WHERE id = ?', [req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'Account not found.' });
  return res.json({ user: rows[0] });
}));

app.get('/api/categories', requireAuth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute('SELECT id, name, type, color, icon FROM categories ORDER BY type, name');
  res.json({ categories: rows });
}));

app.get('/api/dashboard', requireAuth, asyncRoute(async (req, res) => {
  const userId = req.user.id;
  const [totals] = await pool.execute(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS totalIncome,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS totalExpenses,
      COALESCE(SUM(CASE WHEN type = 'income' AND DATE_FORMAT(date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE, '%Y-%m') THEN amount ELSE 0 END), 0) AS monthlyIncome,
      COALESCE(SUM(CASE WHEN type = 'expense' AND DATE_FORMAT(date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE, '%Y-%m') THEN amount ELSE 0 END), 0) AS monthlyExpenses
     FROM transactions WHERE user_id = ?`,
    [userId],
  );
  const [recent] = await pool.execute(
    `SELECT t.id, t.type, t.amount, t.date, t.description, t.payment_method AS paymentMethod,
      c.name AS category, c.color AS categoryColor
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ? ORDER BY t.date DESC, t.id DESC LIMIT 6`,
    [userId],
  );
  const [trend] = await pool.execute(
    `SELECT DATE_FORMAT(date, '%Y-%m') AS month,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses
     FROM transactions WHERE user_id = ? AND date >= DATE_SUB(CURRENT_DATE, INTERVAL 5 MONTH)
     GROUP BY DATE_FORMAT(date, '%Y-%m') ORDER BY month`,
    [userId],
  );
  const [categories] = await pool.execute(
    `SELECT c.name AS category, c.color, SUM(t.amount) AS amount
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ? AND t.type = 'expense'
       AND DATE_FORMAT(t.date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE, '%Y-%m')
     GROUP BY c.id, c.name, c.color ORDER BY amount DESC`,
    [userId],
  );
  res.json({ summary: totals[0], recent, trend, categories });
}));

app.get('/api/transactions', requireAuth, asyncRoute(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const conditions = ['t.user_id = ?'];
  const values = [userId];
  if (['income', 'expense'].includes(req.query.type)) {
    conditions.push('t.type = ?');
    values.push(req.query.type);
  }
  if (req.query.category) {
    conditions.push('c.name = ?');
    values.push(String(req.query.category).slice(0, 80));
  }
  if (req.query.from && validDate(req.query.from)) {
    conditions.push('t.date >= ?');
    values.push(req.query.from);
  }
  if (req.query.to && validDate(req.query.to)) {
    conditions.push('t.date <= ?');
    values.push(req.query.to);
  }
  if (req.query.search) {
    conditions.push('(t.description LIKE ? OR c.name LIKE ? OR t.source LIKE ?)');
    const term = `%${String(req.query.search).slice(0, 100)}%`;
    values.push(term, term, term);
  }
  const where = conditions.join(' AND ');
  const order = req.query.sort === 'amount-asc' ? 't.amount ASC, t.date DESC'
    : req.query.sort === 'amount-desc' ? 't.amount DESC, t.date DESC'
      : req.query.sort === 'date-asc' ? 't.date ASC, t.id ASC' : 't.date DESC, t.id DESC';
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM transactions t JOIN categories c ON c.id = t.category_id WHERE ${where}`,
    values,
  );
  const [rows] = await pool.execute(
    `SELECT t.id, t.type, t.amount, t.date, t.description, t.source, t.payment_method AS paymentMethod,
      c.id AS categoryId, c.name AS category, c.color AS categoryColor
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...values, limit, (page - 1) * limit],
  );
  res.json({ transactions: rows, total: countRows[0].total, page, pages: Math.ceil(countRows[0].total / limit) });
}));

app.post('/api/transactions', requireAuth, asyncRoute(async (req, res) => {
  const { type, amount, date, categoryId, description = '', source = '', paymentMethod = '' } = req.body;
  if (!['income', 'expense'].includes(type) || !validAmount(amount) || !validDate(date) || !validId(categoryId)) {
    return res.status(400).json({ error: 'Enter a valid type, amount, date, and category.' });
  }
  const [categories] = await pool.execute('SELECT id FROM categories WHERE id = ? AND type = ?', [categoryId, type]);
  if (!categories.length) return res.status(400).json({ error: 'Choose a category that matches this transaction type.' });
  const [result] = await pool.execute(
    `INSERT INTO transactions (user_id, category_id, type, amount, date, description, source, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, categoryId, type, amount, date, String(description).slice(0, 255), String(source).slice(0, 100), String(paymentMethod).slice(0, 50)],
  );
  res.status(201).json({ id: result.insertId, message: 'Transaction created.' });
}));

app.put('/api/transactions/:id', requireAuth, asyncRoute(async (req, res) => {
  const { type, amount, date, categoryId, description = '', source = '', paymentMethod = '' } = req.body;
  if (!validId(req.params.id) || !['income', 'expense'].includes(type) || !validAmount(amount) || !validDate(date) || !validId(categoryId)) {
    return res.status(400).json({ error: 'Enter a valid type, amount, date, and category.' });
  }
  const [categories] = await pool.execute('SELECT id FROM categories WHERE id = ? AND type = ?', [categoryId, type]);
  if (!categories.length) return res.status(400).json({ error: 'Choose a category that matches this transaction type.' });
  const [result] = await pool.execute(
    `UPDATE transactions SET category_id = ?, type = ?, amount = ?, date = ?, description = ?, source = ?, payment_method = ?
     WHERE id = ? AND user_id = ?`,
    [categoryId, type, amount, date, String(description).slice(0, 255), String(source).slice(0, 100), String(paymentMethod).slice(0, 50), req.params.id, req.user.id],
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Transaction not found.' });
  res.json({ message: 'Transaction updated.' });
}));

app.delete('/api/transactions/:id', requireAuth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid transaction.' });
  const [result] = await pool.execute('DELETE FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Transaction not found.' });
  res.json({ message: 'Transaction deleted.' });
}));

app.get('/api/budgets', requireAuth, asyncRoute(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
  const [rows] = await pool.execute(
    `SELECT b.id, b.amount AS budget, c.id AS categoryId, c.name AS category, c.color,
      COALESCE(SUM(t.amount), 0) AS spent
     FROM budgets b JOIN categories c ON c.id = b.category_id
     LEFT JOIN transactions t ON t.user_id = b.user_id AND t.category_id = b.category_id
       AND t.type = 'expense' AND DATE_FORMAT(t.date, '%Y-%m') = ?
     WHERE b.user_id = ? AND b.month = ?
     GROUP BY b.id, b.amount, c.id, c.name, c.color ORDER BY c.name`,
    [month, req.user.id, `${month}-01`],
  );
  res.json({ budgets: rows, month });
}));

app.post('/api/budgets', requireAuth, asyncRoute(async (req, res) => {
  const { categoryId, amount, month } = req.body;
  if (!validId(categoryId) || !validAmount(amount) || !/^\d{4}-\d{2}$/.test(month || '')) {
    return res.status(400).json({ error: 'Enter a valid category, monthly amount, and month.' });
  }
  const [categories] = await pool.execute('SELECT id FROM categories WHERE id = ? AND type = ?', [categoryId, 'expense']);
  if (!categories.length) return res.status(400).json({ error: 'Choose an expense category.' });
  await pool.execute(
    `INSERT INTO budgets (user_id, category_id, amount, month) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
    [req.user.id, categoryId, amount, `${month}-01`],
  );
  res.status(201).json({ message: 'Budget saved.' });
}));

app.delete('/api/budgets/:id', requireAuth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid budget.' });
  const [result] = await pool.execute('DELETE FROM budgets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Budget not found.' });
  res.json({ message: 'Budget deleted.' });
}));

app.get('/api/goals', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, name, target_amount AS targetAmount, saved_amount AS savedAmount, target_date AS targetDate, created_at AS createdAt FROM financial_goals WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id],
  );
  res.json({ goals: rows });
}));

app.post('/api/goals', requireAuth, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const { targetAmount, savedAmount = 0, targetDate = null } = req.body;
  if (name.length < 2 || name.length > 100 || !validAmount(targetAmount) || !Number.isFinite(Number(savedAmount)) || Number(savedAmount) < 0 || (targetDate && !validDate(targetDate))) {
    return res.status(400).json({ error: 'Enter a goal name, a positive target, and a valid target date.' });
  }
  const [result] = await pool.execute(
    'INSERT INTO financial_goals (user_id, name, target_amount, saved_amount, target_date) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, name, targetAmount, savedAmount, targetDate || null],
  );
  res.status(201).json({ id: result.insertId, message: 'Goal created.' });
}));

app.put('/api/goals/:id', requireAuth, asyncRoute(async (req, res) => {
  const savedAmount = Number(req.body.savedAmount);
  if (!validId(req.params.id) || !Number.isFinite(savedAmount) || savedAmount < 0 || savedAmount > 999999999) {
    return res.status(400).json({ error: 'Enter a valid saved amount.' });
  }
  const [result] = await pool.execute(
    'UPDATE financial_goals SET saved_amount = ? WHERE id = ? AND user_id = ?',
    [savedAmount, req.params.id, req.user.id],
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Goal not found.' });
  res.json({ message: 'Goal progress updated.' });
}));

app.delete('/api/goals/:id', requireAuth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid goal.' });
  const [result] = await pool.execute('DELETE FROM financial_goals WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Goal not found.' });
  res.json({ message: 'Goal deleted.' });
}));

app.get('/api/reports', requireAuth, asyncRoute(async (req, res) => {
  const from = validDate(req.query.from) ? req.query.from : `${new Date().getFullYear()}-01-01`;
  const to = validDate(req.query.to) ? req.query.to : new Date().toISOString().slice(0, 10);
  const [rows] = await pool.execute(
    `SELECT t.id, t.type, t.amount, t.date, t.description, t.source, t.payment_method AS paymentMethod,
      c.name AS category
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ? AND t.date BETWEEN ? AND ? ORDER BY t.date DESC, t.id DESC`,
    [req.user.id, from, to],
  );
  res.json({ transactions: rows });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(port, () => console.log(`Expense Tracker API listening on http://localhost:${port}`));
