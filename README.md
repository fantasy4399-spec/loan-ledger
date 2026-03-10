# 还贷记账助手（云同步版）

## 已支持
- 每月记录：收入 / 还款（含还款内容）/ 借款 / 支出
- 月度汇总、净现金流
- CSV 导出
- Supabase 云同步（跨浏览器/跨设备）

## 一次性配置 Supabase（约 3 分钟）

1. 在 Supabase 新建项目
2. 执行 SQL 建表：

```sql
create table if not exists public.ledger_records (
  id text primary key,
  profile_id text not null,
  month text not null,
  type text not null,
  amount numeric(12,2) not null,
  note text,
  created_at timestamptz default now()
);

alter table public.ledger_records enable row level security;

create policy "anon can use ledger_records"
on public.ledger_records
for all
to anon
using (true)
with check (true);
```

3. 打开网页后，在“☁️ 云同步设置（Supabase）”填入：
   - Supabase URL（项目设置里）
   - Anon Key（项目 API 里）
   - 个人标识（例如 `li-home`，所有设备填同一个）
4. 点击“保存并启用云同步”

## 注意
- 当前为单用户轻量方案，靠 `profile_id` 区分数据。
- 如果要更安全版本，我可以再升级为 Supabase Auth 登录版（每个账号独立权限）。
