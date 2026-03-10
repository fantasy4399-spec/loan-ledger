const summaryMonthInput = document.getElementById('summaryMonth');
const summaryEl = document.getElementById('summary');

let records = [];
summaryMonthInput.value = new Date().toISOString().slice(0, 7);

const TYPE_NAME = {
  income: '收入',
  repayment: '还款',
  borrowing: '借款',
  expense: '支出'
};

function formatMoney(v) {
  return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchRecords() {
  const res = await fetch('/api/records');
  if (!res.ok) throw new Error('读取失败，请先完成密码验证');
  records = await res.json();
}

function renderSummary() {
  const month = summaryMonthInput.value;
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

summaryMonthInput.addEventListener('change', renderSummary);

(async () => {
  try {
    await fetchRecords();
    renderSummary();
  } catch (e) {
    summaryEl.innerHTML = '<div class="stat"><div class="label">提示</div><div class="value" style="font-size:14px;">请先通过密码验证，再刷新页面。</div></div>';
  }
})();
