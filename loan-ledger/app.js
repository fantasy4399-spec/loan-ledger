const STORAGE_KEY = 'loan_ledger_records_v1';

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

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function formatMoney(v) {
  return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function render() {
  const records = loadRecords();
  records.sort((a, b) => (a.month === b.month ? b.createdAt - a.createdAt : b.month.localeCompare(a.month)));

  // 列表
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

  // 汇总（按当前月份）
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

addBtn.addEventListener('click', () => {
  const month = monthInput.value;
  const type = typeInput.value;
  const amount = Number(amountInput.value);
  const note = noteInput.value.trim();

  if (!month) return alert('请选择月份');
  if (!amount || amount <= 0) return alert('请输入正确金额');

  const records = loadRecords();
  records.push({
    id: Date.now() + Math.random().toString(16).slice(2),
    month,
    type,
    amount,
    note,
    createdAt: Date.now()
  });
  saveRecords(records);

  amountInput.value = '';
  noteInput.value = '';
  render();
});

recordsBody.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;

  const id = btn.dataset.id;
  const records = loadRecords().filter(r => r.id !== id);
  saveRecords(records);
  render();
});

monthInput.addEventListener('change', render);

exportBtn.addEventListener('click', () => {
  const records = loadRecords();
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

clearBtn.addEventListener('click', () => {
  if (!confirm('确定清空全部记录吗？此操作不可恢复。')) return;
  saveRecords([]);
  render();
});

render();