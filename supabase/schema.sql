-- Mente da Anny — rodar uma vez no Supabase: SQL Editor → New query → colar → Run.
-- Uma tabela simples de "chave → valor" por usuária. Cada pessoa só enxerga e altera os próprios dados (RLS).

create table if not exists public.dados (
  user_id    uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  chave      text   not null,
  valor      jsonb,
  atualizado bigint not null,
  primary key (user_id, chave)
);

create index if not exists dados_atualizado_idx on public.dados (user_id, atualizado);

-- Projetos novos do Supabase nem sempre liberam tabelas criadas pelo SQL Editor
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on table public.dados to authenticated, service_role;

alter table public.dados enable row level security;

drop policy if exists "ler os meus dados" on public.dados;
drop policy if exists "criar os meus dados" on public.dados;
drop policy if exists "alterar os meus dados" on public.dados;
drop policy if exists "apagar os meus dados" on public.dados;

create policy "ler os meus dados"     on public.dados for select to authenticated using (user_id = auth.uid());
create policy "criar os meus dados"   on public.dados for insert to authenticated with check (user_id = auth.uid());
create policy "alterar os meus dados" on public.dados for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "apagar os meus dados"  on public.dados for delete to authenticated using (user_id = auth.uid());
