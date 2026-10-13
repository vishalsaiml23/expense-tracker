import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Check, ChevronDown, CircleHelp, CreditCard, Download, Edit3, FileText, Filter, Flame,
  LayoutDashboard, LogOut, Menu, Moon, MoreHorizontal, Plus, Search, Settings, ShieldCheck,
  Sparkles, Sun, Target, Trash2, TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const dateLabel = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthValue = () => localDate().slice(0, 7);
const today = () => localDate();
async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Transactions', icon: CreditCard },
  { label: 'Budgets', icon: Wallet },
  { label: 'Reports', icon: FileText },
  { label: 'Goals', icon: Target },
];
const categoryEmojis = { Food: '🍜', Travel: '✈️', Shopping: '🛍️', Education: '📚', Bills: '⚡', Healthcare: '💊', Entertainment: '🎬', Salary: '💼', Freelancing: '💻', Business: '🏢', Investment: '📈', Other: '✦' };
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'M';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(false);
  const [page, setPage] = useState('Overview');
  const [dark, setDark] = useState(() => localStorage.getItem('moneta-theme') === 'dark');
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [transactionDialog, setTransactionDialog] = useState(null);
  const [budgetDialog, setBudgetDialog] = useState(false);
  const [goalDialog, setGoalDialog] = useState(false);
  const [goalProgressDialog, setGoalProgressDialog] = useState(null);

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }, []);
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  const signOut = useCallback(() => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setToken(false);
    setUser(null);
    setDashboard(null);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark-theme', dark);
    localStorage.setItem('moneta-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    request('/auth/me')
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser);
      })
      .catch(() => { if (active) signOut(); });
    return () => { active = false; };
  }, [token, signOut]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    setError('');
    Promise.all([request('/categories'), request('/dashboard')])
      .then(([categoryData, dashboardData]) => {
        if (active) {
          setCategories(categoryData.categories);
          setDashboard(dashboardData);
        }
      })
      .catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [token, refreshKey]);

  const onAuthenticated = ({ user: newUser }) => {
    setToken(true);
    setUser(newUser);
    setError('');
  };

  if (!token) return <AuthScreen onAuthenticated={onAuthenticated} />;

  const goTo = (label) => {
    setPage(label);
    setMobileNav(false);
    setError('');
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><Sparkles size={19} /></span><span>moneta<span className="brand-dot">.</span></span></div>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switch"><span className="workspace-icon">M</span><span><strong>My finances</strong><small>Personal workspace</small></span><ChevronDown size={15} /></div>
        <div className="nav-group-label">MENU</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button type="button" key={label} className={`nav-link ${page === label ? 'active' : ''}`} onClick={() => goTo(label)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === 'Budgets' && <span className="nav-count">3</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <span className="upgrade-spark"><Sparkles size={16} /></span>
            <strong>Make your money<br />work smarter.</strong>
            <span>Little steps add up to big things.</span>
            <button type="button" onClick={() => goTo('Goals')}>Explore your goals <ArrowRight size={14} /></button>
          </div>
          <button type="button" className="nav-link muted-link" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}<span>{dark ? 'Light appearance' : 'Dark appearance'}</span></button>
          <button type="button" className="nav-link muted-link" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button>
          <div className="profile-card">
            <div className="avatar">{initials(user?.name)}</div>
            <span className="profile-copy"><strong>{user?.name || 'Your account'}</strong><small>{user?.email}</small></span>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      {mobileNav && <button className="nav-backdrop" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button type="button" className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-divider">/</span><strong>{page}</strong></div>
          <div className="topbar-actions">
            <div className="today-pill"><CalendarDays size={15} /><span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
            <button type="button" className="icon-button notification-button" aria-label="Notifications" onClick={() => notify('You’re all caught up!')}><Bell size={18} /><i /></button>
            <button type="button" className="avatar top-avatar" aria-label="Account">{initials(user?.name)}</button>
          </div>
        </header>

        <div className="content-wrap">
          {error && <div className="error-banner"><ShieldCheck size={17} /><span>{error} Check your API and MySQL connection.</span><button type="button" onClick={refresh} aria-label="Retry"><ArrowRight size={17} /></button></div>}
          {page === 'Overview' && <Dashboard data={dashboard} onAdd={() => setTransactionDialog({ type: 'expense' })} onSeeAll={() => goTo('Transactions')} />}
          {page === 'Transactions' && <Transactions categories={categories} onAdd={() => setTransactionDialog({ type: 'expense' })} onEdit={(item) => setTransactionDialog(item)} notify={notify} refresh={refresh} />}
          {page === 'Budgets' && <Budgets onAdd={() => setBudgetDialog(true)} refreshKey={refreshKey} notify={notify} refresh={refresh} />}
          {page === 'Reports' && <Reports />}
          {page === 'Goals' && <Goals onAdd={() => setGoalDialog(true)} onUpdate={(goal) => setGoalProgressDialog(goal)} refreshKey={refreshKey} notify={notify} refresh={refresh} />}
        </div>
        <footer className="app-footer"><span>Made for a little more financial clarity.</span><span><CircleHelp size={14} /> Your data is private & secure</span></footer>
      </main>

      {transactionDialog && <TransactionDialog value={transactionDialog} categories={categories} onClose={() => setTransactionDialog(null)} onSaved={() => { setTransactionDialog(null); refresh(); notify('Transaction saved successfully.'); }} />}
      {budgetDialog && <BudgetDialog categories={categories} onClose={() => setBudgetDialog(false)} onSaved={() => { setBudgetDialog(false); refresh(); notify('Budget saved successfully.'); }} />}
      {goalDialog && <GoalDialog onClose={() => setGoalDialog(false)} onSaved={() => { setGoalDialog(false); refresh(); notify('Goal created successfully.'); }} />}
      {goalProgressDialog && <GoalProgressDialog goal={goalProgressDialog} onClose={() => setGoalProgressDialog(null)} onSaved={() => { setGoalProgressDialog(null); refresh(); notify('Goal progress updated.'); }} />}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await request(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      onAuthenticated(result);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-screen">
      <div className="auth-showcase">
        <div className="auth-brand"><span className="brand-mark"><Sparkles size={19} /></span>moneta<span className="brand-dot">.</span></div>
        <div className="showcase-content">
          <span className="eyebrow"><Sparkles size={14} /> A clearer view of your money</span>
          <h1>Good money habits<br />start with <em>awareness.</em></h1>
          <p>All your finances, thoughtfully brought together. Make room for what matters most.</p>
          <div className="showcase-stat"><div className="stat-orbit"><TrendingUp size={24} /></div><div><strong>Small steps. Real progress.</strong><span>Build a healthier relationship with money.</span></div></div>
        </div>
        <div className="showcase-bottom"><span>YOUR FINANCIAL LIFE, IN FOCUS</span><span>01 — 03</span></div>
        <div className="showcase-decoration deco-one" /><div className="showcase-decoration deco-two" />
      </div>
      <div className="auth-form-side">
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-mobile-brand"><span className="brand-mark"><Sparkles size={18} /></span>moneta<span className="brand-dot">.</span></div>
          <div className="auth-kicker">WELCOME {mode === 'login' ? 'BACK' : 'ABOARD'}</div>
          <h2>{mode === 'login' ? 'Let’s get you in.' : 'Start your journey.'}</h2>
          <p className="auth-subtitle">{mode === 'login' ? 'Your money story is right where you left it.' : 'A more intentional way to manage your money.'}</p>
          {mode === 'register' && <label className="field-label">Full name<input required name="name" autoComplete="name" value={form.name} onChange={update} placeholder="e.g. Aanya Sharma" minLength="2" maxLength="80" /></label>}
          <label className="field-label">Email address<input required type="email" name="email" autoComplete="email" value={form.email} onChange={update} placeholder="you@example.com" /></label>
          <label className="field-label">Password<input required type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={update} placeholder="At least 8 characters" minLength="8" /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight size={17} /></button>
          <div className="auth-switch">{mode === 'login' ? 'New to Moneta?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}> {mode === 'login' ? 'Create an account' : 'Sign in'}</button></div>
          <div className="auth-safe"><ShieldCheck size={15} /> Your financial data is encrypted and private.</div>
        </form>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action, actionLabel = 'Add transaction', actionIcon: ActionIcon = Plus }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <button type="button" className="primary-button heading-action" onClick={action}><ActionIcon size={17} />{actionLabel}</button>}</div>;
}

function SummaryCard({ label, value, icon: Icon, tone, note, badge, loading }) {
  return (
    <article className="summary-card">
      <div className="summary-card-top"><span>{label}</span><span className={`summary-icon ${tone}`}><Icon size={18} /></span></div>
      <div className="summary-value">{loading ? <span className="skeleton skeleton-value" /> : typeof value === 'string' ? value : money.format(Number(value) || 0)}</div>
      <div className="summary-foot"><span className="summary-note">{badge && <span className="trend-badge"><TrendingUp size={12} />{badge}</span>}{note}</span></div>
    </article>
  );
}

function Dashboard({ data, onAdd, onSeeAll }) {
  const summary = data?.summary || {};
  const trend = data?.trend || [];
  const trendData = useMemo(() => trend.map((item) => ({
    ...item,
    label: new Date(`${item.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' }),
  })), [trend]);
  const categoryData = data?.categories || [];
  const savings = Number(summary.monthlyIncome || 0) - Number(summary.monthlyExpenses || 0);
  const savingsRate = summary.monthlyIncome ? Math.max(0, Math.round((savings / summary.monthlyIncome) * 100)) : 0;
  return (
    <>
      <PageHeading eyebrow="MONDAY, MAKE IT COUNT" title={<>Your money, <em>in focus.</em></>} description="Here’s a little snapshot of where you’re at." action={onAdd} />
      <div className="summary-grid">
        <SummaryCard label="Total balance" value={Number(summary.totalIncome || 0) - Number(summary.totalExpenses || 0)} icon={Wallet} tone="violet" note="Income minus expenses" loading={!data} />
        <SummaryCard label="Income this month" value={summary.monthlyIncome} icon={ArrowDownLeft} tone="green" note="Looking good this month" loading={!data} />
        <SummaryCard label="Spent this month" value={summary.monthlyExpenses} icon={ArrowUpRight} tone="peach" note="Across all categories" loading={!data} />
        <SummaryCard label="Savings rate" value={`${savingsRate}%`} icon={Sparkles} tone="blue" note="Of this month’s income" loading={!data} />
      </div>

      <div className="dashboard-grid">
        <section className="panel trend-panel">
          <div className="panel-heading"><div><h2>Your cash flow</h2><p>A little progress, month by month.</p></div><button className="select-pill" type="button">Last 6 months <ChevronDown size={14} /></button></div>
          <div className="chart-legend"><span><i className="legend-dot income-dot" />Income</span><span><i className="legend-dot expense-dot" />Expenses</span></div>
          <div className="trend-chart">
            {trendData.length ? <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 12, right: 7, left: -16, bottom: 0 }}>
                <defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#74b69c" stopOpacity={0.22} /><stop offset="90%" stopColor="#74b69c" stopOpacity={0.01} /></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ad9ef0" stopOpacity={0.2} /><stop offset="90%" stopColor="#ad9ef0" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="var(--grid-line)" strokeDasharray="3 5" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : value} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="income" name="Income" stroke="#6da98e" strokeWidth={2.5} fill="url(#incomeFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#9b8af0" strokeWidth={2.5} fill="url(#expenseFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer> : <EmptyChart message="Your monthly trends will appear here." />}
          </div>
          <div className="chart-insight"><span className="insight-icon"><Flame size={14} /></span><span>You’ve saved <strong>{money.format(Math.max(0, savings))}</strong> this month. Keep that gentle momentum going.</span></div>
        </section>

        <section className="panel spending-panel">
          <div className="panel-heading"><div><h2>Where it goes</h2><p>Your spending, at a glance.</p></div><span className="month-chip">{new Date().toLocaleDateString('en-IN', { month: 'short' })}</span></div>
          <div className="donut-wrap">
            {categoryData.length ? <>
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="amount" nameKey="category" innerRadius={68} outerRadius={91} paddingAngle={4} stroke="none" cornerRadius={5}>{categoryData.map((entry, index) => <Cell key={entry.category} fill={entry.color || ['#7aaf99', '#f1a57b', '#9b8af0', '#6c9ce6', '#e6b85c'][index % 5]} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer>
              <div className="donut-center"><strong>{money.format(Number(summary.monthlyExpenses) || 0)}</strong><span>this month</span></div>
            </> : <EmptyChart message="Add an expense to see your breakdown." />}
          </div>
          <div className="category-legend">{categoryData.slice(0, 4).map((item) => <div className="category-legend-row" key={item.category}><span><i style={{ background: item.color }} />{item.category}</span><strong>{money.format(item.amount)}</strong></div>)}</div>
        </section>
      </div>

      <section className="panel recent-panel">
        <div className="panel-heading"><div><h2>Recent activity</h2><p>The little details that add up.</p></div><button type="button" className="text-button" onClick={onSeeAll}>See all transactions <ArrowRight size={15} /></button></div>
        <TransactionTable rows={data?.recent || []} compact loading={!data} />
      </section>
      <div className="dashboard-note"><span className="note-star">✳</span><span><strong>A tiny reminder</strong> — progress isn’t always linear. You’re doing better than you think.</span></div>
    </>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><span>{label || payload[0].name}</span>{payload.map((item) => <strong key={item.dataKey} style={{ color: item.color }}>{item.name}: {money.format(Number(item.value) || 0)}</strong>)}</div>;
}

function EmptyChart({ message }) {
  return <div className="empty-chart"><div className="empty-chart-icon"><TrendingUp size={20} /></div><span>{message}</span></div>;
}

function TransactionTable({ rows, compact = false, loading = false, onEdit, onDelete }) {
  if (loading) return <div className="table-loading">{[1, 2, 3, 4].map((item) => <div className="skeleton table-skeleton" key={item} />)}</div>;
  if (!rows?.length) return <div className="empty-state"><div className="empty-state-icon"><CreditCard size={21} /></div><strong>No transactions just yet</strong><span>When you add one, it’ll find a home here.</span></div>;
  return (
    <div className="table-scroll">
      <table className="transactions-table">
        <thead><tr><th>TRANSACTION</th><th>CATEGORY</th><th>DATE</th><th>PAYMENT</th><th className="amount-cell">AMOUNT</th>{!compact && <th />}</tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id}>
            <td><div className="transaction-name"><span className={`category-icon ${row.type === 'income' ? 'category-income' : ''}`}>{categoryEmojis[row.category] || '✦'}</span><span><strong>{row.description || row.category || (row.type === 'income' ? row.source : 'Expense')}</strong><small>{row.type === 'income' ? row.source || row.category : row.category}</small></span></div></td>
            <td><span className="category-label"><i style={{ backgroundColor: row.categoryColor || '#9b8af0' }} />{row.category || 'Other'}</span></td>
            <td className="date-cell">{dateLabel(row.date)}</td>
            <td className="payment-cell">{row.paymentMethod || '—'}</td>
            <td className={`amount-cell amount-${row.type}`}>{row.type === 'income' ? '+' : '−'}{money.format(Number(row.amount) || 0)}</td>
            {!compact && <td className="row-actions"><button type="button" aria-label="Edit transaction" onClick={() => onEdit(row)}><Edit3 size={15} /></button><button type="button" aria-label="Delete transaction" onClick={() => onDelete(row)}><Trash2 size={15} /></button></td>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Transactions({ categories, onAdd, onEdit, notify, refresh }) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('date-desc');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '10', sort });
    if (query.trim()) params.set('search', query.trim());
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    request(`/transactions?${params}`)
      .then((result) => { if (active) { setRows(result.transactions); setPages(result.pages || 1); setLoadError(''); } })
      .catch((reason) => { if (active) setLoadError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, query, sort, type, category, from, to, refresh]);
  const remove = async (row) => {
    if (!window.confirm(`Delete this ${row.type} of ${money.format(Number(row.amount))}? This can’t be undone.`)) return;
    try {
      await request(`/transactions/${row.id}`, { method: 'DELETE' });
      notify('Transaction deleted.');
      refresh();
    } catch (reason) { setLoadError(reason.message); }
  };
  return (
    <>
      <PageHeading eyebrow="THE FULL PICTURE" title="Transactions" description="Every little money moment, all in one place." action={onAdd} />
      {loadError && <div className="form-error page-error">{loadError}</div>}
      <section className="panel transactions-panel">
        <div className="transaction-toolbar"><div className="search-box"><Search size={17} /><input aria-label="Search transactions" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search transactions..." /></div>
          <label className="filter-select"><Filter size={15} /><select aria-label="Filter by type" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select></label>
          <label className="filter-select"><select aria-label="Filter by category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="">All categories</option>{[...new Set(categories.map((item) => item.name))].map((name) => <option key={name} value={name}>{name}</option>)}</select><ChevronDown size={14} /></label>
          <label className="date-filter"><span>From</span><input aria-label="Filter from date" type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
          <label className="date-filter"><span>To</span><input aria-label="Filter to date" type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
          <label className="filter-select"><select aria-label="Sort transactions" value={sort} onChange={(event) => setSort(event.target.value)}><option value="date-desc">Newest first</option><option value="date-asc">Oldest first</option><option value="amount-desc">Highest amount</option><option value="amount-asc">Lowest amount</option></select><ChevronDown size={14} /></label>
        </div>
        <TransactionTable rows={rows} loading={loading} onEdit={onEdit} onDelete={remove} />
        <div className="pagination"><span>Page {page} of {pages}</span><div><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ArrowLeft size={15} /></button><button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)}><ArrowRight size={15} /></button></div></div>
      </section>
      <div className="privacy-note"><ShieldCheck size={17} /><span>Your transactions are private and only visible to you.</span></div>
    </>
  );
}

function Budgets({ onAdd, refreshKey, notify, refresh }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(monthValue);
  useEffect(() => {
    let active = true;
    setLoading(true);
    request(`/budgets?month=${month}`)
      .then((result) => { if (active) { setBudgets(result.budgets); setError(''); } })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, refreshKey]);
  const deleteBudget = async (budget) => {
    if (!window.confirm(`Remove the ${budget.category} budget?`)) return;
    try { await request(`/budgets/${budget.id}`, { method: 'DELETE' }); notify('Budget removed.'); refresh(); }
    catch (reason) { setError(reason.message); }
  };
  const spent = budgets.reduce((total, budget) => total + Number(budget.spent || 0), 0);
  const totalBudget = budgets.reduce((total, budget) => total + Number(budget.budget || 0), 0);
  return (
    <>
      <PageHeading eyebrow="A LITTLE PLAN GOES A LONG WAY" title="Your budgets" description="Give every rupee a soft landing spot." action={onAdd} actionLabel="Create budget" />
      {error && <div className="form-error page-error">{error}</div>}
      <section className="budget-summary panel"><div className="budget-summary-main"><div className="eyebrow">YOUR MONTHLY PLAN</div><h2>{money.format(spent)} <span>of {money.format(totalBudget)}</span></h2><p>You’ve used {totalBudget ? Math.round((spent / totalBudget) * 100) : 0}% of your planned spending this month.</p><div className="overall-progress"><span style={{ width: `${totalBudget ? Math.min(100, (spent / totalBudget) * 100) : 0}%` }} /></div></div><div className="budget-month"><CalendarDays size={16} /><input aria-label="Budget month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div></section>
      <div className="section-title-row"><div><h2>Category budgets</h2><p>A little guardrail, not a hard rule.</p></div><span className="count-chip">{budgets.length} {budgets.length === 1 ? 'category' : 'categories'}</span></div>
      {loading ? <div className="budget-grid">{[1, 2, 3].map((item) => <div className="skeleton budget-skeleton" key={item} />)}</div> : budgets.length ? <div className="budget-grid">{budgets.map((budget) => {
        const ratio = Number(budget.budget) ? Number(budget.spent) / Number(budget.budget) : 0;
        const over = ratio >= 1;
        return <article className="budget-card panel" key={budget.id}><div className="budget-card-head"><span className="category-icon" style={{ background: `${budget.color}22` }}>{categoryEmojis[budget.category] || '✦'}</span><span className="budget-category-copy"><strong>{budget.category}</strong><small>{over ? 'A little over your plan' : 'Looking good so far'}</small></span><button type="button" className="icon-button subtle-icon" aria-label={`Delete ${budget.category} budget`} onClick={() => deleteBudget(budget)}><Trash2 size={16} /></button></div><div className="budget-numbers"><strong>{money.format(budget.spent)}</strong><span>of {money.format(budget.budget)}</span></div><div className={`progress-track ${over ? 'progress-over' : ''}`}><span style={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: over ? '#e77f8a' : budget.color }} /></div><div className={`budget-remaining ${over ? 'over-text' : ''}`}>{over ? `${money.format(budget.spent - budget.budget)} over budget` : `${money.format(budget.budget - budget.spent)} left to spend`}<span>{Math.round(ratio * 100)}%</span></div></article>;
      })}</div> : <div className="panel empty-state budgets-empty"><div className="empty-state-icon"><Wallet size={21} /></div><strong>No budgets for this month</strong><span>Set a gentle spending limit for the categories that matter.</span><button type="button" className="primary-button" onClick={onAdd}><Plus size={16} />Create your first budget</button></div>}
      <div className="budget-tip"><span className="note-star">✳</span><span><strong>Make it yours</strong> — budgets are guides, not rules. Adjust them as life changes.</span></div>
    </>
  );
}

function Reports() {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(today);
  const [period, setPeriod] = useState('month');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    request(`/reports?from=${from}&to=${to}`)
      .then((result) => { if (active) { setRows(result.transactions); setError(''); } })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);
  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc[row.type] += Number(row.amount);
    if (row.type === 'expense') acc.byCategory[row.category] = (acc.byCategory[row.category] || 0) + Number(row.amount);
    return acc;
  }, { income: 0, expense: 0, byCategory: {} }), [rows]);
  const monthly = useMemo(() => {
    const values = new Map();
    rows.forEach((row) => {
      const date = new Date(`${String(row.date).slice(0, 10)}T00:00:00`);
      let key = String(row.date).slice(0, 7);
      let label = date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (period === 'day') {
        key = String(row.date).slice(0, 10);
        label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      } else if (period === 'week') {
        const monday = new Date(date);
        monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
        key = localDate(monday);
        label = `Week of ${monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
      }
      if (!values.has(key)) values.set(key, { month: key, label, income: 0, expenses: 0 });
      values.get(key)[row.type === 'income' ? 'income' : 'expenses'] += Number(row.amount);
    });
    return [...values.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [rows, period]);
  const exportCsv = () => {
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const content = [['Date', 'Type', 'Category', 'Description', 'Source', 'Payment method', 'Amount (INR)'], ...rows.map((row) => [String(row.date).slice(0, 10), row.type, row.category, row.description, row.source, row.paymentMethod, row.amount])]
      .map((line) => line.map(escape).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    link.download = `moneta-report-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const savingsRate = totals.income ? Math.round(((totals.income - totals.expense) / totals.income) * 100) : 0;
  return (
    <>
      <PageHeading eyebrow="ZOOM OUT, SEE THE PATTERNS" title="Your money story" description="A thoughtful look at where it’s been and where it’s going." />
      {error && <div className="form-error page-error">{error}</div>}
      <section className="panel report-filter"><div><h2>Choose your dates</h2><p>Find the story in any time frame.</p></div><div className="report-date-controls"><label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label><label>Group by<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label><button type="button" className="outline-button" onClick={exportCsv} disabled={loading}><Download size={16} />Export CSV</button></div></section>
      <div className="report-stats"><SummaryCard label="Income" value={totals.income} icon={ArrowDownLeft} tone="green" note="In this date range" loading={loading} /><SummaryCard label="Expenses" value={totals.expense} icon={ArrowUpRight} tone="peach" note="In this date range" loading={loading} /><SummaryCard label="Net savings" value={totals.income - totals.expense} icon={Wallet} tone="violet" note="Income minus expenses" loading={loading} /><SummaryCard label="Savings rate" value={`${savingsRate}%`} icon={Sparkles} tone="blue" note="Of total income" loading={loading} /></div>
      <div className="dashboard-grid report-charts">
        <section className="panel trend-panel"><div className="panel-heading"><div><h2>Income & expenses</h2><p>How each month found its balance.</p></div></div><div className="trend-chart">{monthly.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={monthly} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--grid-line)" strokeDasharray="3 5" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="income" name="Income" stroke="#6da98e" strokeWidth={2.5} fill="#74b69c20" /><Area type="monotone" dataKey="expenses" name="Expenses" stroke="#9b8af0" strokeWidth={2.5} fill="#ad9ef020" /></AreaChart></ResponsiveContainer> : <EmptyChart message="No transactions in this range." />}</div></section>
        <section className="panel spending-panel"><div className="panel-heading"><div><h2>Spending by category</h2><p>Every category has its own story.</p></div></div><div className="report-category-list">{Object.entries(totals.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([category, amount], index) => <div className="report-category-row" key={category}><span className="category-icon">{categoryEmojis[category] || '✦'}</span><span>{category}</span><div className="report-category-progress"><i style={{ width: `${totals.expense ? amount / totals.expense * 100 : 0}%`, background: ['#7aaf99', '#f1a57b', '#9b8af0', '#6c9ce6', '#e6b85c'][index % 5] }} /></div><strong>{money.format(amount)}</strong></div>)}{!Object.keys(totals.byCategory).length && <EmptyChart message="Your category breakdown will appear here." />}</div></section>
      </div>
      <section className="panel recent-panel report-transactions"><div className="panel-heading"><div><h2>Included transactions</h2><p>{rows.length} money moments in this date range.</p></div></div><TransactionTable rows={rows.slice(0, 8)} compact loading={loading} /></section>
    </>
  );
}

function Goals({ onAdd, onUpdate, refreshKey, notify, refresh }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    request('/goals')
      .then((result) => { if (active) { setGoals(result.goals); setError(''); } })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);
  const deleteGoal = async (goal) => {
    if (!window.confirm(`Remove your “${goal.name}” goal?`)) return;
    try { await request(`/goals/${goal.id}`, { method: 'DELETE' }); notify('Goal removed.'); refresh(); }
    catch (reason) { setError(reason.message); }
  };
  const totalTarget = goals.reduce((sum, goal) => sum + Number(goal.targetAmount), 0);
  const totalSaved = goals.reduce((sum, goal) => sum + Number(goal.savedAmount), 0);
  return (
    <>
      <PageHeading eyebrow="DREAM A LITTLE, PLAN A LITTLE" title="Goals worth reaching for" description="The lovely things you’re making room for." action={onAdd} actionLabel="Add a goal" actionIcon={Target} />
      {error && <div className="form-error page-error">{error}</div>}
      <section className="goal-hero panel"><div><span className="goal-hero-icon"><Sparkles size={20} /></span><div className="eyebrow">A LITTLE PROGRESS ADDS UP</div><h2>{money.format(totalSaved)} <span>saved toward {money.format(totalTarget)}</span></h2><p>Every small step is a step closer to something wonderful.</p></div><div className="goal-hero-art"><div className="goal-art-orbit orbit-a" /><div className="goal-art-orbit orbit-b" /><div className="goal-art-center"><Target size={32} /></div></div></section>
      <div className="section-title-row"><div><h2>Your goals</h2><p>Big or small, they’re worth showing up for.</p></div></div>
      {loading ? <div className="budget-grid">{[1, 2].map((item) => <div className="skeleton budget-skeleton" key={item} />)}</div> : goals.length ? <div className="goal-grid">{goals.map((goal, index) => {
        const progress = Math.min(100, Number(goal.targetAmount) ? Number(goal.savedAmount) / Number(goal.targetAmount) * 100 : 0);
        return <article className="goal-card panel" key={goal.id}><div className={`goal-card-icon goal-icon-${index % 4}`}>{index % 2 ? '🌱' : '✨'}</div><button type="button" aria-label={`Delete ${goal.name} goal`} className="icon-button subtle-icon goal-delete" onClick={() => deleteGoal(goal)}><Trash2 size={16} /></button><h3>{goal.name}</h3><p>{goal.targetDate ? `Aiming for ${dateLabel(goal.targetDate)}` : 'Your own time, your own pace'}</p><div className="goal-progress-label"><strong>{money.format(goal.savedAmount)}</strong><span>of {money.format(goal.targetAmount)}</span></div><div className="progress-track"><span style={{ width: `${progress}%`, background: ['#76ae91', '#a18fe8', '#eaa77c', '#6c9ce6'][index % 4] }} /></div><div className="goal-progress-foot"><span>{Math.round(progress)}% there</span><strong>{progress >= 100 ? 'You did it!' : `${money.format(Math.max(0, goal.targetAmount - goal.savedAmount))} to go`}</strong></div><button type="button" className="goal-update-button" onClick={() => onUpdate(goal)}>Update savings <ArrowRight size={14} /></button></article>;
      })}</div> : <div className="panel empty-state goals-empty"><div className="empty-state-icon"><Target size={21} /></div><strong>What are you saving for?</strong><span>That trip, a new home, or a little more peace of mind.</span><button type="button" className="primary-button" onClick={onAdd}><Plus size={16} />Create a savings goal</button></div>}
      <div className="budget-tip"><span className="note-star">✳</span><span><strong>Good things take time</strong> — celebrate every step, not just the finish line.</span></div>
    </>
  );
}

function Modal({ title, description, onClose, children, wide = false }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>{children}</section></div>;
}

function TransactionDialog({ value, categories, onClose, onSaved }) {
  const editing = Boolean(value.id);
  const [form, setForm] = useState({
    type: value.type || 'expense',
    amount: value.amount || '',
    categoryId: value.categoryId || '',
    date: String(value.date || today()).slice(0, 10),
    description: value.description || '',
    source: value.source || '',
    paymentMethod: value.paymentMethod || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const available = categories.filter((category) => category.type === form.type);
  useEffect(() => {
    if (available.length && !available.some((item) => String(item.id) === String(form.categoryId))) {
      setForm((current) => ({ ...current, categoryId: available[0].id }));
    }
  }, [available, form.categoryId]);
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request(editing ? `/transactions/${value.id}` : '/transactions', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, amount: Number(form.amount), categoryId: form.categoryId }),
      });
      onSaved();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={editing ? 'Edit transaction' : 'Add a money moment'} description="Every little detail helps you see the bigger picture." onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <div className="type-switch"><button type="button" className={form.type === 'expense' ? 'selected expense-selected' : ''} onClick={() => setForm({ ...form, type: 'expense', categoryId: '' })}><ArrowUpRight size={16} />Expense</button><button type="button" className={form.type === 'income' ? 'selected income-selected' : ''} onClick={() => setForm({ ...form, type: 'income', categoryId: '' })}><ArrowDownLeft size={16} />Income</button></div>
        <label className="field-label">Amount <span className="input-prefix"><span>₹</span><input required type="number" min="0.01" step="0.01" name="amount" value={form.amount} onChange={update} placeholder="0.00" /></span></label>
        <div className="form-two-col"><label className="field-label">Category<select required name="categoryId" value={form.categoryId} onChange={update}>{available.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="field-label">Date<input required type="date" name="date" value={form.date} onChange={update} /></label></div>
        <label className="field-label">Description<input name="description" maxLength="255" value={form.description} onChange={update} placeholder="What was this for?" /></label>
        {form.type === 'income' ? <label className="field-label">Source<input name="source" maxLength="100" value={form.source} onChange={update} placeholder="Salary, freelance project…" /></label> : <label className="field-label">Payment method<input name="paymentMethod" maxLength="50" value={form.paymentMethod} onChange={update} placeholder="UPI, cash, credit card…" /></label>}
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions"><button type="button" className="outline-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save transaction'}<ArrowRight size={16} /></button></div>
      </form>
    </Modal>
  );
}

function BudgetDialog({ categories, onClose, onSaved }) {
  const [form, setForm] = useState({ categoryId: '', amount: '', month: monthValue() });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const expenses = categories.filter((category) => category.type === 'expense');
  useEffect(() => { if (!form.categoryId && expenses.length) setForm((current) => ({ ...current, categoryId: expenses[0].id })); }, [expenses, form.categoryId]);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { await request('/budgets', { method: 'POST', body: JSON.stringify({ ...form, categoryId: form.categoryId, amount: Number(form.amount) }) }); onSaved(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  return <Modal title="A little spending plan" description="Choose a category and give it a monthly limit." onClose={onClose}><form className="dialog-form" onSubmit={submit}><label className="field-label">Category<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>{expenses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-label">Monthly limit<span className="input-prefix"><span>₹</span><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /></span></label><label className="field-label">For the month<input required type="month" value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} /></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="outline-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save budget'}<ArrowRight size={16} /></button></div></form></Modal>;
}

function GoalDialog({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', targetAmount: '', savedAmount: '0', targetDate: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { await request('/goals', { method: 'POST', body: JSON.stringify({ ...form, targetAmount: Number(form.targetAmount), savedAmount: Number(form.savedAmount) }) }); onSaved(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  return <Modal title="Something to look forward to" description="Give your next big (or little) thing a name." onClose={onClose}><form className="dialog-form" onSubmit={submit}><label className="field-label">Your goal<input required minLength="2" maxLength="100" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="A trip to the mountains…" /></label><label className="field-label">Savings target<span className="input-prefix"><span>₹</span><input required type="number" min="0.01" step="0.01" value={form.targetAmount} onChange={(event) => setForm({ ...form, targetAmount: event.target.value })} placeholder="0.00" /></span></label><div className="form-two-col"><label className="field-label">Already saved<input type="number" min="0" step="0.01" value={form.savedAmount} onChange={(event) => setForm({ ...form, savedAmount: event.target.value })} /></label><label className="field-label">Target date <span className="optional-label">optional</span><input type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /></label></div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="outline-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Create goal'}<ArrowRight size={16} /></button></div></form></Modal>;
}

function GoalProgressDialog({ goal, onClose, onSaved }) {
  const [savedAmount, setSavedAmount] = useState(String(goal.savedAmount || 0));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request(`/goals/${goal.id}`, { method: 'PUT', body: JSON.stringify({ savedAmount: Number(savedAmount) }) });
      onSaved();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  return <Modal title={`Update “${goal.name}”`} description="Keep your progress up to date, one step at a time." onClose={onClose}><form className="dialog-form" onSubmit={submit}><label className="field-label">Total saved so far<span className="input-prefix"><span>₹</span><input required type="number" min="0" step="0.01" value={savedAmount} onChange={(event) => setSavedAmount(event.target.value)} /></span></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="outline-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save progress'}<ArrowRight size={16} /></button></div></form></Modal>;
}
