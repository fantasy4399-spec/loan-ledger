const STORAGE_KEY = 'loan_ledger_records_v3';
const CLOUD_KEY = 'loan_ledger_supabase_auth_config_v1';

const monthInput = document.getElementById('month');
const summaryMonthInput = document.getElementById('summaryMonth');
const typeInput = document.getElementById('type');
const amountInput = document.getElementById('amount');
const noteInput = document.getElementById('note');
const addBtn = document.getElementById('addBtn');
const recordsBody = document.getElementById('recordsBody');
const summaryEl = document.getElementById('summary');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');

const TYPE_NAME = {
  income: '收入',
  repayment: '还款',
  borrowing: '借款',
  expense: '支出'
};

monthInput.value = new Date().toISOString().slice(0, 7);
summaryMonthInput.value = monthInput.value;

let supabaseClient = null;
let currentUser = null;

function loadRecordsLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveRecordsLocal(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function loadCloudConfig() {
  try { return JSON.parse(localStorage.getItem(CLOUD_KEY) || '{}'); }
  catch { return {}; }
}

function saveCloudConfig(cfg) {
  localStorage.setItem(CLOUD_KEY, JSON.stringify(cfg));
}

function formatMoney(v) {
  return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toViewRecord(r) {
  return {
    id: r.id,
    month: r.month,
    type: r.type,
    amount: Number(r.amount),
    note: r.note || '',
    createdAt: new Date(r.created_at || Date.now()).getTime()
  };
}

function setupAuthPanel() {
  const panel = document.createElement('section');
  panel.className = 'card';
  panel.innerHTML = `
    <h2>🔐 云同步登录（Supabase Auth）</h2>
    <div class="grid">
      <label>Supabase URL
        <input type="text" id="sbUrl" placeholder="https://xxxx.supabase.co" />
      </label>
      <label>Supabase Anon Key
        <input type="text" id="sbKey" placeholder="eyJhbGciOi..." />
      </label>
      <label>登录邮箱
        <input type="email" id="loginEmail" placeholder="you@example.com" />
      </label>
    </div>
    <div style="margin-top:10px;">
      <button id="saveCfgBtn">保存配置</button>
      <button id="sendMagicBtn">发送登录链接</button>
      <button id="syncBtn">立即同步</button>
      <button id="logoutBtn" class="danger">退出登录</button>
      <div id="authStatus" style="margin-top:8px;color:#666;">未配置</div>
    </div>
  `;

  document.querySelector('.container').insertBefore(panel, document.querySelectorAll('.card')[1]);

  const cfg = loadCloudConfig();
  document.getElementById('sbUrl').value = cfg.url || '';
  document.getElementById('sbKey').value = cfg.anonKey || '';
  document.getElementById('loginEmail').value = cfg.email || 'fantasy4399@gmail.com';

  document.getElementById('saveCfgBtn').addEventListener('click', async () => {
    const url = document.getElementById('sbUrl').value.trim().replace(/\/$/, '');
    const anonKey = document.getElementById('sbKey').value.trim();
    const email = document.getElementById('loginEmail').value.trim();
    if (!url || !anonKey || !email) return alert('请填完整 URL / Anon Key / 邮箱');

    saveCloudConfig({ url, anonKey, email });
    try {
      await initSupabase();
      setAuthStatus(currentUser ? `已登录：${currentUser.email}` : '配置已保存，待登录');
      alert('配置已保存');
    } catch (e) {
      setAuthStatus('配置无效');
      alert(`配置失败：${e.message}`);
    }
  });

  document.getElementById('sendMagicBtn').addEventListener('click', async () => {
    if (!supabaseClient) return alert('请先保存 Supabase 配置');
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) return alert('请填写邮箱');

    const origin = window.location.origin + window.location.pathname;
    const { error } = await supabaseClient.auth.signInWithOtp({ email, options: { emailRedirectTo: origin } });
    if (error) return alert(`发送失败：${error.message}`);
    setAuthStatus(`登录链接已发送到 ${email}`);
    alert('登录链接已发送，请去邮箱点击');
  });

  document.getElementById('syncBtn').addEventListener('click', async () => {
    try {
      await syncFromCloud();
      alert('同步成功');
    } catch (e) {
      alert(`同步失败：${e.message}`);
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    currentUser = null;
    setAuthStatus('已退出登录');
  });
}

function setAuthStatus(text) {
  const el = document.getElementById('authStatus');
  if (el) el.textContent = text;
}

async function initSupabase() {
  const cfg = loadCloudConfig();
  if (!cfg.url || !cfg.anonKey) return null;
  if (!window.supabase?.createClient) throw new Error('Supabase SDK 未加载');

  supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);

  const { data } = await supabaseClient.auth.getSession();
  currentUser = data?.session?.user || null;
  setAuthStatus(currentUser ? `已登录：${currentUser.email}` : '配置已保存，待登录');

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    setAuthStatus(currentUser ? `已登录：${currentUser.email}` : '未登录');
    if (currentUser) syncFromCloud().catch(() => {});
  });

  return supabaseClient;
}

async function fetchCloudRecords() {
  if (!supabaseClient || !currentUser) throw new Error('请先登录');
  const { data, error } = await supabaseClient
    .from('ledger_records')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(toViewRecord);
}

async function addCloudRecord(record) {
  if (!supabaseClient || !currentUser) throw new Error('请先登录');
  const { error } = await supabaseClient.from('ledger_records').insert({
    id: record.id,
    user_id: currentUser.id,
    month: record.month,
    type: record.type,
    amount: record.amount,
    note: record.note || ''
  });
  if (error) throw error;
}

async function deleteCloudRecord(id) {
  if (!supabaseClient || !currentUser) throw new Error('请先登录');
  const { error } = await supabaseClient.from('ledger_records').delete().eq('id', id);
  if (error) throw error;
}

async function clearCloudRecords() {
  if (!supabaseClient || !currentUser) throw new Error('请先登录');
  const { error } = await supabaseClient.from('ledger_records').delete().neq('id', '__none__');
  if (error) throw error;
}

async function syncFromCloud() {
  if (!supabaseClient || !currentUser) throw new Error('请先登录');
  const cloudRecords = await fetchCloudRecords();
  saveRecordsLocal(cloudRecords);
  render();
}

function render() {
  const records = loadRecordsLocal();
  records.sort((a, b) => (a.month === b.month ? b.createdAt - a.createdAt : b.month.localeCompare(a.month)));

  recordsBody.innerHTML = '';
  if (!records.length) {
    recordsBody.innerHTML = '<tr><td class="empty" colspan="5">暂无记录，先添加一条吧。</td></tr>';
  } else {
    for (const r of records) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.month}</td>
        <td>${TYPE_NAME[r.type] || r.type}</td>
        <td>¥ ${formatMoney(r.amount)}</td>
        <td>${r.note || '-'}</td>
        <td><button class="small-btn" data-id="${r.id}">删除</button></td>
      `;
      recordsBody.appendChild(tr);
    }
  }

  const month = summaryMonthInput.value || monthInput.value;
  const current = records.filter(r => r.month === month);
  const sum = (type) => current.filter(r => r.type === type).reduce((acc, r) => acc + Number(r.amount), 0);

  const income = sum('income');
  const repayment = sum('repayment');
  const borrowing = sum('borrowing');
  const expense = sum('expense');
  const net = income + borrowing - repayment - expense;

  summaryEl.innerHTML = `
    <div class="stat"><div class="label">${month} 收入</div><div class="value">¥ ${formatMoney(income)}</div></div>
    <div class="stat"><div class="label">${month} 还款</div><div class="value">¥ ${formatMoney(repayment)}</div></div>
    <div class="stat"><div class="label">${month} 借款</div><div class="value">¥ ${formatMoney(borrowing)}</div></div>
    <div class="stat"><div class="label">${month} 支出</div><div class="value">¥ ${formatMoney(expense)}</div></div>
    <div class="stat"><div class="label">${month} 净现金流</div><div class="value">¥ ${formatMoney(net)}</div></div>
  `;
}

addBtn.addEventListener('click', async () => {
  const month = monthInput.value;
  const type = typeInput.value;
  const amount = Number(amountInput.value);
  const note = noteInput.value.trim();

  if (!month) return alert('请选择月份');
  if (!amount || amount <= 0) return alert('请输入正确金额');

  const rec = {
    id: crypto?.randomUUID?.() || (Date.now() + Math.random().toString(16).slice(2)),
    month,
    type,
    amount,
    note,
    createdAt: Date.now()
  };

  const records = loadRecordsLocal();
  records.push(rec);
  saveRecordsLocal(records);
  render();

  try {
    if (supabaseClient && currentUser) {
      await addCloudRecord(rec);
      await syncFromCloud();
    }
  } catch (e) {
    alert(`本地已保存，云端失败：${e.message}`);
  }

  amountInput.value = '';
  noteInput.value = '';
});

recordsBody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;

  const id = btn.dataset.id;
  saveRecordsLocal(loadRecordsLocal().filter(r => r.id !== id));
  render();

  try {
    if (supabaseClient && currentUser) {
      await deleteCloudRecord(id);
      await syncFromCloud();
    }
  } catch (e) {
    alert(`本地已删，云端删除失败：${e.message}`);
  }
});

clearBtn.addEventListener('click', async () => {
  if (!confirm('确定清空全部记录吗？此操作不可恢复。')) return;
  saveRecordsLocal([]);
  render();

  try {
    if (supabaseClient && currentUser) {
      await clearCloudRecords();
      await syncFromCloud();
    }
  } catch (e) {
    alert(`本地已清空，云端失败：${e.message}`);
  }
});

exportBtn.addEventListener('click', () => {
  const records = loadRecordsLocal();
  if (!records.length) return alert('暂无可导出数据');

  const header = ['月份', '类型', '金额', '内容说明', '创建时间'];
  const rows = records.map(r => [
    r.month,
    TYPE_NAME[r.type] || r.type,
    r.amount,
    (r.note || '').replaceAll('"', '""'),
    new Date(r.createdAt).toLocaleString('zh-CN')
  ]);

  const csv = [header, ...rows].map(row => row.map(v => `"${String(v ?? '')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `还贷记账-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

monthInput.addEventListener('change', () => {
  if (!summaryMonthInput.value) summaryMonthInput.value = monthInput.value;
  render();
});
summaryMonthInput.addEventListener('change', render);

setupAuthPanel();
render();
initSupabase().then(() => {
  if (currentUser) syncFromCloud().catch(() => {});
}).catch(() => setAuthStatus('请先配置 Supabase'));
