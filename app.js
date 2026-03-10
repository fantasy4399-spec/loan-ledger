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

const TYPE_NAME = { income: '收入', repayment: '还款', borrowing: '借款', expense: '支出' };
let records = [];

monthInput.value = new Date().toISOString().slice(0, 7);
summaryMonthInput.value = monthInput.value;

function formatMoney(v) {
  return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchRecords() {
  const res = await fetch('/api/records');
  if (!res.ok) throw new Error('读取失败');
  records = await res.json();
}

async function addRecord(r) {
  const res = await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(r)
  });
  if (!res.ok) throw new Error('新增失败');
}

async function deleteRecord(id) {
  const res = await fetch(`/api/records/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('删除失败');
}

async function clearRecords() {
  const res = await fetch('/api/clear', { method: 'POST' });
  if (!res.ok) throw new Error('清空失败');
}

function render() {
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
    month, type, amount, note,
    createdAt: Date.now()
  };

  try {
    await addRecord(rec);
    await fetchRecords();
    render();
    amountInput.value = '';
    noteInput.value = '';
  } catch (e) {
    alert(e.message);
  }
});

recordsBody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  try {
    await deleteRecord(btn.dataset.id);
    await fetchRecords();
    render();
  } catch (err) {
    alert(err.message);
  }
});

clearBtn.addEventListener('click', async () => {
  if (!confirm('确定清空全部记录吗？')) return;
  try {
    await clearRecords();
    await fetchRecords();
    render();
  } catch (e) {
    alert(e.message);
  }
});

summaryMonthInput.addEventListener('change', render);
monthInput.addEventListener('change', () => {
  if (!summaryMonthInput.value) summaryMonthInput.value = monthInput.value;
  render();
});

exportBtn.addEventListener('click', () => {
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

(async () => {
  try {
    await fetchRecords();
    render();
  } catch (e) {
    alert('请先启动本机服务：python3 server.py');
  }
})();
