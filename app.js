const STORAGE_KEY = 'loan_ledger_records_v2';
const CLOUD_KEY = 'loan_ledger_cloud_config_v1';

const monthInput = document.getElementById('month');
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

function cloudConfig() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveCloudConfig(cfg) {
  localStorage.setItem(CLOUD_KEY, JSON.stringify(cfg));
}

function isCloudEnabled() {
  const c = cloudConfig();
  return Boolean(c.url && c.anonKey && c.profileId);
}

function getCloudHeaders() {
  const c = cloudConfig();
  return {
    apikey: c.anonKey,
    Authorization: `Bearer ${c.anonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
}

function loadRecordsLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecordsLocal(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function formatMoney(v) {
  return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchRecordsCloud() {
  const c = cloudConfig();
  const url = `${c.url}/rest/v1/ledger_records?profile_id=eq.${encodeURIComponent(c.profileId)}&select=*&order=created_at.desc`;
  const resp = await fetch(url, { headers: getCloudHeaders() });
  if (!resp.ok) throw new Error(`云端读取失败: ${resp.status}`);
  const rows = await resp.json();
  return rows.map((r) => ({
    id: r.id,
    month: r.month,
    type: r.type,
    amount: Number(r.amount),
    note: r.note || '',
    createdAt: new Date(r.created_at).getTime()
  }));
}

async function addRecordCloud(record) {
  const c = cloudConfig();
  const payload = {
    id: record.id,
    profile_id: c.profileId,
    month: record.month,
    type: record.type,
    amount: record.amount,
    note: record.note || ''
  };
  const resp = await fetch(`${c.url}/rest/v1/ledger_records`, {
    method: 'POST',
    headers: getCloudHeaders(),
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error(`云端新增失败: ${resp.status}`);
}

async function deleteRecordCloud(id) {
  const c = cloudConfig();
  const url = `${c.url}/rest/v1/ledger_records?id=eq.${encodeURIComponent(id)}&profile_id=eq.${encodeURIComponent(c.profileId)}`;
  const resp = await fetch(url, { method: 'DELETE', headers: getCloudHeaders() });
  if (!resp.ok) throw new Error(`云端删除失败: ${resp.status}`);
}

async function clearRecordsCloud() {
  const c = cloudConfig();
  const url = `${c.url}/rest/v1/ledger_records?profile_id=eq.${encodeURIComponent(c.profileId)}`;
  const resp = await fetch(url, { method: 'DELETE', headers: getCloudHeaders() });
  if (!resp.ok) throw new Error(`云端清空失败: ${resp.status}`);
}

function setupCloudControls() {
  const panel = document.createElement('section');
  panel.className = 'card';
  panel.innerHTML = `
    <h2>☁️ 云同步设置（Supabase）</h2>
    <div class="grid">
      <label>Supabase URL
        <input type="text" id="cloudUrl" placeholder="https://xxxx.supabase.co" />
      </label>
      <label>Anon Key
        <input type="text" id="cloudKey" placeholder="eyJhbGciOi..." />
      </label>
      <label>个人标识（同一个人所有设备保持一致）
        <input type="text" id="cloudProfile" placeholder="例如 li-home" />
      </label>
    </div>
    <div style="margin-top:10px;">
      <button id="saveCloudBtn">保存并启用云同步</button>
      <button id="disableCloudBtn" class="danger">停用云同步</button>
      <button id="syncNowBtn">立即同步</button>
      <span id="cloudStatus" style="margin-left:10px;color:#666;"></span>
    </div>
  `;

  document.querySelector('.container').insertBefore(panel, document.querySelectorAll('.card')[1]);

  const c = cloudConfig();
  document.getElementById('cloudUrl').value = c.url || '';
  document.getElementById('cloudKey').value = c.anonKey || '';
  document.getElementById('cloudProfile').value = c.profileId || '';

  const statusEl = document.getElementById('cloudStatus');
  statusEl.textContent = isCloudEnabled() ? '已启用云同步' : '当前仅本地存储';

  document.getElementById('saveCloudBtn').addEventListener('click', async () => {
    const url = document.getElementById('cloudUrl').value.trim().replace(/\/$/, '');
    const anonKey = document.getElementById('cloudKey').value.trim();
    const profileId = document.getElementById('cloudProfile').value.trim();

    if (!url || !anonKey || !profileId) return alert('请填完整 Supabase URL / Anon Key / 个人标识');
    saveCloudConfig({ url, anonKey, profileId });

    try {
      await syncFromCloud();
      statusEl.textContent = '已启用云同步';
      alert('云同步已启用');
    } catch (e) {
      statusEl.textContent = '云同步连接失败';
      alert(`启用失败：${e.message}`);
    }
  });

  document.getElementById('disableCloudBtn').addEventListener('click', () => {
    localStorage.removeItem(CLOUD_KEY);
    statusEl.textContent = '当前仅本地存储';
    alert('已停用云同步');
  });

  document.getElementById('syncNowBtn').addEventListener('click', async () => {
    try {
      await syncFromCloud();
      statusEl.textContent = '同步成功';
      alert('同步完成');
    } catch (e) {
      statusEl.textContent = '同步失败';
      alert(`同步失败：${e.message}`);
    }
  });
}

async function syncFromCloud() {
  if (!isCloudEnabled()) return;
  const records = await fetchRecordsCloud();
  saveRecordsLocal(records);
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

  const month = monthInput.value;
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

  const newRecord = {
    id: (crypto?.randomUUID?.() || (Date.now() + Math.random().toString(16).slice(2))),
    month,
    type,
    amount,
    note,
    createdAt: Date.now()
  };

  const records = loadRecordsLocal();
  records.push(newRecord);
  saveRecordsLocal(records);
  render();

  try {
    if (isCloudEnabled()) {
      await addRecordCloud(newRecord);
      await syncFromCloud();
    }
  } catch (e) {
    alert(`已保存本地，但云端写入失败：${e.message}`);
  }

  amountInput.value = '';
  noteInput.value = '';
});

recordsBody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;

  const id = btn.dataset.id;
  const records = loadRecordsLocal().filter(r => r.id !== id);
  saveRecordsLocal(records);
  render();

  try {
    if (isCloudEnabled()) {
      await deleteRecordCloud(id);
      await syncFromCloud();
    }
  } catch (err) {
    alert(`本地已删除，但云端删除失败：${err.message}`);
  }
});

monthInput.addEventListener('change', render);

exportBtn.addEventListener('click', () => {
  const records = loadRecordsLocal();
  if (!records.length) return alert('暂无可导出的数据');

  const header = ['月份', '类型', '金额', '内容说明', '创建时间'];
  const rows = records.map(r => [
    r.month,
    TYPE_NAME[r.type] || r.type,
    r.amount,
    (r.note || '').replaceAll('"', '""'),
    new Date(r.createdAt).toLocaleString('zh-CN')
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(v => `"${String(v ?? '')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `还贷记账-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

clearBtn.addEventListener('click', async () => {
  if (!confirm('确定清空全部记录吗？此操作不可恢复。')) return;
  saveRecordsLocal([]);
  render();

  try {
    if (isCloudEnabled()) await clearRecordsCloud();
  } catch (e) {
    alert(`本地已清空，但云端清空失败：${e.message}`);
  }
});

setupCloudControls();
render();
if (isCloudEnabled()) syncFromCloud().catch(() => {});
