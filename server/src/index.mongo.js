import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import connectMongo from './db.mongo.js';
import { User } from './models/User.js';
import { Category } from './models/Category.js';
import { Transaction } from './models/Transaction.js';
import { Budget } from './models/Budget.js';
import { FinancialGoal } from './models/FinancialGoal.js';
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

const setSessionCookie = (res, token) => {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
      SESSION_MAX_AGE_MS / 1000
    )}${secureFlag}`
  );
};

const clearSessionCookie = (res) => {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`
  );
};

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '32kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }));

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const validObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value));
const validAmount = (value) =>
  Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 999999999;
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const tokenFor = (user) =>
  jwt.sign({ id: user.id || user._id.toString(), email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

/* ========================================================
   AUTHENTICATION ROUTES
======================================================== */

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const hash = await bcrypt.hash(password, 12);
  const userDoc = await User.create({ name, email, passwordHash: hash });
  const user = userDoc.toJSON();
  const token = tokenFor(user);
  setSessionCookie(res, token);
  return res.status(201).json({ token, user });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const userDoc = await User.findOne({ email });
  if (!userDoc || !(await bcrypt.compare(password, userDoc.passwordHash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }

  const user = userDoc.toJSON();
  const token = tokenFor(user);
  setSessionCookie(res, token);
  return res.json({ token, user });
}));

app.post('/api/auth/logout', asyncRoute(async (_req, res) => {
  clearSessionCookie(res);
  return res.json({ message: 'Signed out.' });
}));

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const userDoc = await User.findById(req.user.id);
  if (!userDoc) return res.status(404).json({ error: 'Account not found.' });
  return res.json({ user: userDoc.toJSON() });
}));

/* ========================================================
   CATEGORIES
======================================================== */

app.get('/api/categories', requireAuth, asyncRoute(async (_req, res) => {
  const categories = await Category.find().sort({ type: 1, name: 1 });
  res.json({ categories: categories.map((cat) => cat.toJSON()) });
}));

/* ========================================================
   DASHBOARD
======================================================== */

app.get('/api/dashboard', requireAuth, asyncRoute(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  // Summary totals
  const totalsAgg = await Transaction.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalIncome: {
          $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] },
        },
        totalExpenses: {
          $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] },
        },
        monthlyIncome: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$type', 'income'] },
                  { $eq: [{ $substrCP: ['$date', 0, 7] }, currentMonth] },
                ],
              },
              '$amount',
              0,
            ],
          },
        },
        monthlyExpenses: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$type', 'expense'] },
                  { $eq: [{ $substrCP: ['$date', 0, 7] }, currentMonth] },
                ],
              },
              '$amount',
              0,
            ],
          },
        },
      },
    },
  ]);

  const summary = totalsAgg[0] || {
    totalIncome: 0,
    totalExpenses: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
  };

  // Recent 6 transactions
  const recentDocs = await Transaction.find({ userId })
    .sort({ date: -1, createdAt: -1 })
    .limit(6)
    .populate('categoryId');

  const recent = recentDocs.map((t) => ({
    id: t._id.toString(),
    type: t.type,
    amount: t.amount,
    date: t.date,
    description: t.description,
    paymentMethod: t.paymentMethod,
    category: t.categoryId?.name || 'Uncategorized',
    categoryColor: t.categoryId?.color || '#9B8AFB',
  }));

  // Monthly trend (last 6 months)
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  const fromMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const trendAgg = await Transaction.aggregate([
    {
      $match: {
        userId,
        date: { $gte: `${fromMonth}-01` },
      },
    },
    {
      $group: {
        _id: { $substrCP: ['$date', 0, 7] },
        income: {
          $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] },
        },
        expenses: {
          $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const trend = trendAgg.map((item) => ({
    month: item._id,
    income: item.income,
    expenses: item.expenses,
  }));

  // Current month categories breakdown
  const categoryAgg = await Transaction.aggregate([
    {
      $match: {
        userId,
        type: 'expense',
        date: { $regex: `^${currentMonth}` },
      },
    },
    {
      $group: {
        _id: '$categoryId',
        amount: { $sum: '$amount' },
      },
    },
    { $sort: { amount: -1 } },
  ]);

  const populatedCategories = await Promise.resolve(
    Category.populate(categoryAgg, { path: '_id', select: 'name color' })
  );

  const categories = populatedCategories.map((item) => ({
    category: item._id?.name || 'Other',
    color: item._id?.color || '#8C9AA8',
    amount: item.amount,
  }));

  res.json({ summary, recent, trend, categories });
}));

/* ========================================================
   TRANSACTIONS
======================================================== */

app.get('/api/transactions', requireAuth, asyncRoute(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));

  const query = { userId };

  if (['income', 'expense'].includes(req.query.type)) {
    query.type = req.query.type;
  }

  if (req.query.category) {
    const cat = await Category.findOne({ name: String(req.query.category).slice(0, 80) });
    if (cat) query.categoryId = cat._id;
  }

  if (req.query.from && validDate(req.query.from)) {
    query.date = query.date || {};
    query.date.$gte = req.query.from;
  }

  if (req.query.to && validDate(req.query.to)) {
    query.date = query.date || {};
    query.date.$lte = req.query.to;
  }

  if (req.query.search) {
    const term = String(req.query.search).trim();
    query.$or = [
      { description: { $regex: term, $options: 'i' } },
      { source: { $regex: term, $options: 'i' } },
      { paymentMethod: { $regex: term, $options: 'i' } },
    ];
  }

  const sort =
    req.query.sort === 'amount-asc'
      ? { amount: 1, date: -1 }
      : req.query.sort === 'amount-desc'
      ? { amount: -1, date: -1 }
      : req.query.sort === 'date-asc'
      ? { date: 1, createdAt: 1 }
      : { date: -1, createdAt: -1 };

  const total = await Transaction.countDocuments(query);
  const docs = await Transaction.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('categoryId');

  const transactions = docs.map((t) => ({
    id: t._id.toString(),
    type: t.type,
    amount: t.amount,
    date: t.date,
    description: t.description,
    source: t.source,
    paymentMethod: t.paymentMethod,
    categoryId: t.categoryId?._id?.toString() || '',
    category: t.categoryId?.name || 'Uncategorized',
    categoryColor: t.categoryId?.color || '#9B8AFB',
  }));

  res.json({
    transactions,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
}));

app.post('/api/transactions', requireAuth, asyncRoute(async (req, res) => {
  const { type, amount, date, categoryId, description = '', source = '', paymentMethod = '' } = req.body;

  if (!['income', 'expense'].includes(type) || !validAmount(amount) || !validDate(date) || !validObjectId(categoryId)) {
    return res.status(400).json({ error: 'Enter a valid type, amount, date, and category.' });
  }

  const category = await Category.findOne({ _id: categoryId, type });
  if (!category) {
    return res.status(400).json({ error: 'Choose a category that matches this transaction type.' });
  }

  const doc = await Transaction.create({
    userId: req.user.id,
    categoryId,
    type,
    amount: Number(amount),
    date,
    description: String(description).slice(0, 255),
    source: String(source).slice(0, 100),
    paymentMethod: String(paymentMethod).slice(0, 50),
  });

  res.status(201).json({ id: doc._id.toString(), message: 'Transaction created.' });
}));

app.put('/api/transactions/:id', requireAuth, asyncRoute(async (req, res) => {
  const { type, amount, date, categoryId, description = '', source = '', paymentMethod = '' } = req.body;

  if (!validObjectId(req.params.id) || !['income', 'expense'].includes(type) || !validAmount(amount) || !validDate(date) || !validObjectId(categoryId)) {
    return res.status(400).json({ error: 'Enter a valid type, amount, date, and category.' });
  }

  const category = await Category.findOne({ _id: categoryId, type });
  if (!category) {
    return res.status(400).json({ error: 'Choose a category that matches this transaction type.' });
  }

  const result = await Transaction.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    {
      categoryId,
      type,
      amount: Number(amount),
      date,
      description: String(description).slice(0, 255),
      source: String(source).slice(0, 100),
      paymentMethod: String(paymentMethod).slice(0, 50),
    }
  );

  if (!result) return res.status(404).json({ error: 'Transaction not found.' });
  res.json({ message: 'Transaction updated.' });
}));

app.delete('/api/transactions/:id', requireAuth, asyncRoute(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid transaction.' });

  const result = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!result) return res.status(404).json({ error: 'Transaction not found.' });
  res.json({ message: 'Transaction deleted.' });
}));

/* ========================================================
   BUDGETS
======================================================== */

app.get('/api/budgets', requireAuth, asyncRoute(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month)
    ? req.query.month
    : new Date().toISOString().slice(0, 7);

  const userId = new mongoose.Types.ObjectId(req.user.id);

  // Get all budgets for user in this month
  const userBudgets = await Budget.find({ userId, month }).populate('categoryId');

  // Calculate spent per category in this month
  const spentAgg = await Transaction.aggregate([
    {
      $match: {
        userId,
        type: 'expense',
        date: { $regex: `^${month}` },
      },
    },
    {
      $group: {
        _id: '$categoryId',
        spent: { $sum: '$amount' },
      },
    },
  ]);

  const spentMap = new Map();
  spentAgg.forEach((item) => {
    spentMap.set(item._id.toString(), item.spent);
  });

  const budgets = userBudgets
    .filter((b) => b.categoryId)
    .map((b) => ({
      id: b._id.toString(),
      budget: b.amount,
      categoryId: b.categoryId._id.toString(),
      category: b.categoryId.name,
      color: b.categoryId.color,
      spent: spentMap.get(b.categoryId._id.toString()) || 0,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));

  res.json({ budgets, month });
}));

app.post('/api/budgets', requireAuth, asyncRoute(async (req, res) => {
  const { categoryId, amount, month } = req.body;

  if (!validObjectId(categoryId) || !validAmount(amount) || !/^\d{4}-\d{2}$/.test(month || '')) {
    return res.status(400).json({ error: 'Enter a valid category, monthly amount, and month.' });
  }

  const category = await Category.findOne({ _id: categoryId, type: 'expense' });
  if (!category) return res.status(400).json({ error: 'Choose an expense category.' });

  await Budget.findOneAndUpdate(
    { userId: req.user.id, categoryId, month },
    { amount: Number(amount) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({ message: 'Budget saved.' });
}));

app.delete('/api/budgets/:id', requireAuth, asyncRoute(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid budget.' });

  const result = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!result) return res.status(404).json({ error: 'Budget not found.' });
  res.json({ message: 'Budget deleted.' });
}));

/* ========================================================
   FINANCIAL GOALS
======================================================== */

app.get('/api/goals', requireAuth, asyncRoute(async (req, res) => {
  const goals = await FinancialGoal.find({ userId: req.user.id }).sort({ createdAt: -1 });

  const formatted = goals.map((g) => ({
    id: g._id.toString(),
    name: g.name,
    targetAmount: g.targetAmount,
    savedAmount: g.savedAmount,
    targetDate: g.targetDate,
    createdAt: g.createdAt,
  }));

  res.json({ goals: formatted });
}));

app.post('/api/goals', requireAuth, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const { targetAmount, savedAmount = 0, targetDate = null } = req.body;

  if (
    name.length < 2 ||
    name.length > 100 ||
    !validAmount(targetAmount) ||
    !Number.isFinite(Number(savedAmount)) ||
    Number(savedAmount) < 0 ||
    (targetDate && !validDate(targetDate))
  ) {
    return res.status(400).json({
      error: 'Enter a goal name, a positive target, and a valid target date.',
    });
  }

  const doc = await FinancialGoal.create({
    userId: req.user.id,
    name,
    targetAmount: Number(targetAmount),
    savedAmount: Number(savedAmount),
    targetDate: targetDate || null,
  });

  res.status(201).json({ id: doc._id.toString(), message: 'Goal created.' });
}));

app.put('/api/goals/:id', requireAuth, asyncRoute(async (req, res) => {
  const savedAmount = Number(req.body.savedAmount);
  if (
    !validObjectId(req.params.id) ||
    !Number.isFinite(savedAmount) ||
    savedAmount < 0 ||
    savedAmount > 999999999
  ) {
    return res.status(400).json({ error: 'Enter a valid saved amount.' });
  }

  const result = await FinancialGoal.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { savedAmount }
  );

  if (!result) return res.status(404).json({ error: 'Goal not found.' });
  res.json({ message: 'Goal progress updated.' });
}));

app.delete('/api/goals/:id', requireAuth, asyncRoute(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid goal.' });

  const result = await FinancialGoal.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!result) return res.status(404).json({ error: 'Goal not found.' });
  res.json({ message: 'Goal deleted.' });
}));

/* ========================================================
   REPORTS
======================================================== */

app.get('/api/reports', requireAuth, asyncRoute(async (req, res) => {
  const from = validDate(req.query.from)
    ? req.query.from
    : `${new Date().getFullYear()}-01-01`;
  const to = validDate(req.query.to)
    ? req.query.to
    : new Date().toISOString().slice(0, 10);

  const docs = await Transaction.find({
    userId: req.user.id,
    date: { $gte: from, $lte: to },
  })
    .sort({ date: -1, createdAt: -1 })
    .populate('categoryId');

  const transactions = docs.map((t) => ({
    id: t._id.toString(),
    type: t.type,
    amount: t.amount,
    date: t.date,
    description: t.description,
    source: t.source,
    paymentMethod: t.paymentMethod,
    category: t.categoryId?.name || 'Uncategorized',
  }));

  res.json({ transactions });
}));

/* ========================================================
   ERROR HANDLER & STARTUP
======================================================== */

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

async function startServer() {
  await connectMongo();
  app.listen(port, () => {
    console.log(`Expense Tracker MongoDB API listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

