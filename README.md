# 还贷记账助手（正式登录云同步版）

## 功能
- 每月记录：收入 / 还款（含还款内容）/ 借款 / 支出
- 月度汇总、净现金流、CSV 导出
- Supabase Auth 邮箱登录（魔法链接）
- 同账号跨浏览器/跨设备自动同步

## Supabase 一次性配置（管理员）

> 这是我在后台配的内容；你只需要最后点邮箱登录链接。

### 1) 建表
```sql
create table if not exists public.ledger_records (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  type text not null,
  amount numeric(12,2) not null,
  note text,
  created_at timestamptz default now()
);
```

### 2) 开启 RLS + 用户隔离策略
```sql
alter table public.ledger_records enable row level security;

create policy "users_select_own"
on public.ledger_records
for select
using (auth.uid() = user_id);

create policy "users_insert_own"
on public.ledger_records
for insert
with check (auth.uid() = user_id);

create policy "users_update_own"
on public.ledger_records
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users_delete_own"
on public.ledger_records
for delete
using (auth.uid() = user_id);
```

### 3) Auth 设置
- 打开 Email 登录（Magic Link）
- Site URL / Redirect URL 加入：
  - `https://fantasy4399-spec.github.io/loan-ledger/`

## 前端配置项
网页顶部「🔐 云同步登录」里填：
- Supabase URL
- Supabase Anon Key
- 登录邮箱（默认已填 fantasy4399@gmail.com）

点击：
1. 保存配置
2. 发送登录链接
3. 去邮箱点链接回来
4. 立即同步
