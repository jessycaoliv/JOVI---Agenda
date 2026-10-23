-- AGENDA DP JOVI: estrutura + dados iniciais
create table if not exists public.processos (id text primary key, nome text not null, ordem int not null default 0);
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '', email text not null,
  perfil text not null default 'leitor' check (perfil in ('mestre','editor','leitor','solicitante')),
  ativo boolean not null default false, processos jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());
create table if not exists public.rotinas (
  id text primary key default gen_random_uuid()::text, nome text not null,
  processo text not null references public.processos(id),
  freq text not null check (freq in ('mensal','quinzenal','semanal','anual','diaria')),
  dia int check (dia between 0 and 31), dia2 int check (dia2 between 1 and 31), mes int check (mes between 1 and 12),
  resp text not null default '', unidade text not null default 'Todas', ativo boolean not null default true, obs text not null default '',
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());
create table if not exists public.demandas (
  id uuid primary key default gen_random_uuid(), titulo text not null check (length(titulo) between 1 and 140),
  setor text not null default 'Outro', processo text not null references public.processos(id),
  colaborador text not null default '', unidade text not null default 'Matriz', data_ref date, prazo date,
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta')),
  resp text not null default '',
  status text not null default 'nova' check (status in ('nova','andamento','aguardando','concluida','cancelada')),
  descricao text not null default '', criado_por uuid not null default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());
create index if not exists demandas_processo_idx on public.demandas(processo);
create index if not exists demandas_prazo_idx on public.demandas(prazo);
create index if not exists demandas_criador_idx on public.demandas(criado_por);
create table if not exists public.demanda_etapas (
  demanda_id uuid not null references public.demandas(id) on delete cascade, etapa int not null check (etapa >= 0),
  feito_por uuid not null default auth.uid() references public.usuarios(id), feito_em timestamptz not null default now(),
  primary key (demanda_id, etapa));
create table if not exists public.demanda_notas (
  id bigint generated always as identity primary key,
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  texto text not null check (length(texto) between 1 and 1000),
  autor uuid not null default auth.uid() references public.usuarios(id), criado_em timestamptz not null default now());
create index if not exists notas_demanda_idx on public.demanda_notas(demanda_id);
create table if not exists public.feitos (
  chave text primary key, rotina_id text not null references public.rotinas(id) on delete cascade,
  processo text not null references public.processos(id), data date not null,
  feito_por uuid not null default auth.uid() references public.usuarios(id), feito_em timestamptz not null default now());
create index if not exists feitos_data_idx on public.feitos(data);
create table if not exists public.pagamentos (
  competencia text not null check (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  fornecedor text not null check (fornecedor in ('piwi','docusign','caju','saude','singular','ifractal')),
  item text not null check (item in ('boleto','nf','bpm','vchat')),
  feito_por uuid not null default auth.uid() references public.usuarios(id), feito_em timestamptz not null default now(),
  primary key (competencia, fornecedor, item));

create or replace function public.is_ativo() returns boolean language sql stable security definer set search_path = public as
$f$ select exists (select 1 from public.usuarios where id = auth.uid() and ativo) $f$;
create or replace function public.is_mestre() returns boolean language sql stable security definer set search_path = public as
$f$ select exists (select 1 from public.usuarios where id = auth.uid() and ativo and perfil = 'mestre') $f$;
create or replace function public.nivel(p text) returns text language sql stable security definer set search_path = public as
$f$ select coalesce((select case when u.perfil = 'mestre' then 'editar' when u.perfil = 'solicitante' then 'nenhum'
  else coalesce(u.processos ->> p, 'nenhum') end from public.usuarios u where u.id = auth.uid() and u.ativo), 'nenhum') $f$;
create or replace function public.pode_ver(p text) returns boolean language sql stable security definer set search_path = public as
$f$ select public.nivel(p) in ('ver','editar') $f$;
create or replace function public.pode_editar(p text) returns boolean language sql stable security definer set search_path = public as
$f$ select public.is_mestre() or exists (select 1 from public.usuarios u where u.id = auth.uid() and u.ativo
  and u.perfil = 'editor' and coalesce(u.processos ->> p, 'nenhum') = 'editar') $f$;
create or replace function public.equipe() returns table (id uuid, nome text) language sql stable security definer set search_path = public as
$f$ select u.id, coalesce(nullif(u.nome, ''), u.email) from public.usuarios u where public.is_ativo() $f$;

create or replace function public.novo_login() returns trigger language plpgsql security definer set search_path = public as
$f$ declare primeiro boolean;
begin
  primeiro := not exists (select 1 from public.usuarios where perfil = 'mestre');
  insert into public.usuarios (id, email, nome, perfil, ativo)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
          case when primeiro then 'mestre' else 'leitor' end, primeiro)
  on conflict (id) do nothing;
  return new;
end $f$;
create or replace trigger ao_criar_login after insert on auth.users for each row execute function public.novo_login();

create or replace function public.tocar_atualizado() returns trigger language plpgsql as
$f$ begin new.atualizado_em := now(); return new; end $f$;
create or replace trigger t_usuarios_upd before update on public.usuarios for each row execute function public.tocar_atualizado();
create or replace trigger t_rotinas_upd before update on public.rotinas for each row execute function public.tocar_atualizado();
create or replace trigger t_demandas_upd before update on public.demandas for each row execute function public.tocar_atualizado();

create or replace function public.feito_processo() returns trigger language plpgsql security definer set search_path = public as
$f$ begin select processo into new.processo from public.rotinas where id = new.rotina_id; return new; end $f$;
create or replace trigger t_feitos_proc before insert on public.feitos for each row execute function public.feito_processo();

create or replace function public.etapa_inicia_demanda() returns trigger language plpgsql security definer set search_path = public as
$f$ begin update public.demandas set status = 'andamento' where id = new.demanda_id and status = 'nova'; return new; end $f$;
create or replace trigger t_etapa_inicia after insert on public.demanda_etapas for each row execute function public.etapa_inicia_demanda();

create or replace function public.protege_usuarios() returns trigger language plpgsql security definer set search_path = public as
$f$ begin
  if not public.is_mestre() and auth.uid() is not null then raise exception 'Somente o mestre altera usuarios'; end if;
  return new;
end $f$;
create or replace trigger t_protege_usuarios before update on public.usuarios for each row execute function public.protege_usuarios();

alter table public.processos enable row level security;
alter table public.usuarios enable row level security;
alter table public.rotinas enable row level security;
alter table public.demandas enable row level security;
alter table public.demanda_etapas enable row level security;
alter table public.demanda_notas enable row level security;
alter table public.feitos enable row level security;
alter table public.pagamentos enable row level security;

do $f$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('processos','usuarios','rotinas','demandas','demanda_etapas','demanda_notas','feitos','pagamentos') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $f$;

create policy processos_ler on public.processos for select to authenticated using (public.is_ativo());
create policy processos_mestre on public.processos for all to authenticated using (public.is_mestre()) with check (public.is_mestre());
create policy usuarios_ler on public.usuarios for select to authenticated using (id = auth.uid() or public.is_mestre());
create policy usuarios_mestre on public.usuarios for all to authenticated using (public.is_mestre()) with check (public.is_mestre());
create policy rotinas_ler on public.rotinas for select to authenticated using (public.pode_ver(processo));
create policy rotinas_criar on public.rotinas for insert to authenticated with check (public.pode_editar(processo));
create policy rotinas_alterar on public.rotinas for update to authenticated using (public.pode_editar(processo)) with check (public.pode_editar(processo));
create policy rotinas_excluir on public.rotinas for delete to authenticated using (public.pode_editar(processo));
create policy demandas_ler on public.demandas for select to authenticated
  using (public.pode_ver(processo) or (criado_por = auth.uid() and public.is_ativo()));
create policy demandas_criar on public.demandas for insert to authenticated with check (public.is_ativo() and criado_por = auth.uid());
create policy demandas_alterar on public.demandas for update to authenticated
  using (public.pode_editar(processo) or (criado_por = auth.uid() and status = 'nova' and public.is_ativo()))
  with check (public.pode_editar(processo) or (criado_por = auth.uid() and status = 'nova'));
create policy demandas_excluir on public.demandas for delete to authenticated using (public.pode_editar(processo));
create policy etapas_ler on public.demanda_etapas for select to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id));
create policy etapas_marcar on public.demanda_etapas for insert to authenticated
  with check (feito_por = auth.uid() and exists (select 1 from public.demandas d where d.id = demanda_id and public.pode_editar(d.processo)));
create policy etapas_desmarcar on public.demanda_etapas for delete to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id and public.pode_editar(d.processo)));
create policy notas_ler on public.demanda_notas for select to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id));
create policy notas_criar on public.demanda_notas for insert to authenticated
  with check (autor = auth.uid() and exists (select 1 from public.demandas d where d.id = demanda_id
    and (public.pode_editar(d.processo) or d.criado_por = auth.uid())));
create policy notas_excluir on public.demanda_notas for delete to authenticated using (public.is_mestre());
create policy feitos_ler on public.feitos for select to authenticated using (public.pode_ver(processo));
create policy feitos_marcar on public.feitos for insert to authenticated
  with check (feito_por = auth.uid() and exists (select 1 from public.rotinas r where r.id = rotina_id and public.pode_editar(r.processo)));
create policy feitos_desmarcar on public.feitos for delete to authenticated using (public.pode_editar(processo));
create policy pagamentos_ler on public.pagamentos for select to authenticated using (public.pode_ver('titulos'));
create policy pagamentos_marcar on public.pagamentos for insert to authenticated with check (feito_por = auth.uid() and public.pode_editar('titulos'));
create policy pagamentos_desmarcar on public.pagamentos for delete to authenticated using (public.pode_editar('titulos'));

revoke execute on function public.equipe() from anon, public;
grant execute on function public.equipe() to authenticated;

create or replace view public.vw_demandas with (security_invoker = true) as
select d.*, p.nome as processo_nome,
  (select count(*) from public.demanda_etapas e where e.demanda_id = d.id) as etapas_feitas,
  (d.status not in ('concluida','cancelada') and d.prazo < current_date) as atrasada
from public.demandas d join public.processos p on p.id = d.processo;

do $f$
declare t text;
begin
  foreach t in array array['rotinas','demandas','demanda_etapas','demanda_notas','feitos','pagamentos'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when undefined_object then null;
    end;
  end loop;
end $f$;

insert into public.processos (id, nome, ordem) values
  ('admissao','Admissão',1),('beneficio_inicial','Benefício inicial',2),('beneficio_quinzenal','Benefício mensal 15/15',3),
  ('ferias','Férias',4),('rescisao','Rescisão',5),('titulos','Lançar pagamentos',6),('folha','Folha de pagamento',7),
  ('encargos','Encargos',8),('ponto','Gestão de ponto',9),('movimentacao','Movimentação',10),
  ('afastamento','Afastamentos INSS',11),('sst','ASO e SST',12),('outro','Outra demanda',13)
on conflict (id) do update set nome = excluded.nome, ordem = excluded.ordem;

insert into public.rotinas (id, nome, processo, freq, dia, dia2, mes, resp, unidade, ativo, obs) values
  ('r-afastamentos','Controle mensal de afastamentos','afastamento','mensal',10,null,null,'Analista DP','Todas',true,''),
  ('r-aniversariantes','Comunicado aniversariantes do próximo mês','outro','mensal',31,null,null,'Estagiário Matriz','Matriz',true,''),
  ('r-aso-vencidos','Conferir ASOs a vencer','sst','mensal',1,null,null,'Analista DP','Todas',true,''),
  ('r-benef-status','Verificar status do benefício inicial (todos ok)','beneficio_inicial','semanal',1,null,null,'DP','Todas',true,'Toda segunda'),
  ('r-conf-encargos','Conferência e fechamento de encargos (FGTS, INSS, IRRF)','encargos','mensal',15,null,null,'Analista Matriz','Todas',true,''),
  ('r-dist-quinzenal','Programação da distribuição do benefício quinzenal','beneficio_quinzenal','quinzenal',10,25,null,'Benefícios','Todas',true,'Pedido 5 dias antes dos créditos dos dias 15 e 30'),
  ('r-experiencia','Revisar vencimentos de experiência (45/90 dias)','admissao','semanal',1,null,null,'Analista DP','Todas',true,'Toda segunda'),
  ('r-ferias-prog','Conferir férias que começam em 30 a 45 dias (avisos)','ferias','semanal',1,null,null,'Analista Matriz','Todas',true,'Toda segunda'),
  ('r-folha-acrescimos','Buscar acréscimos com o Financeiro (premiação, bonificação)','folha','mensal',15,null,null,'DP','Todas',true,''),
  ('r-folha-adiant-pag','Adiantamento: acompanhar pagamento','folha','mensal',15,null,null,'DP','Todas',true,''),
  ('r-folha-adiant','Adiantamento: validar, informar líquido e subir planilha no BPM','folha','mensal',8,null,null,'DP/RH','Todas',true,'Informar ao Financeiro'),
  ('r-folha-apontamentos','Planilha de apontamentos no vChat - Folha NE','folha','mensal',16,null,null,'DP','Todas',true,'Descontos (faltas, plano de saúde novo, sindical) e acréscimos'),
  ('r-folha-pagamento','Pagamento da folha (último dia útil)','folha','mensal',31,null,null,'DP / Financeiro','Todas',true,''),
  ('r-folha-ponto','Validar o ponto','folha','mensal',21,null,null,'DP','Todas',true,''),
  ('r-folha-validar','Validar folha da Folha NE, subir no BPM e avisar o Financeiro','folha','mensal',27,null,null,'DP','Todas',true,'Dia sugerido, ajuste conforme o retorno da Folha NE'),
  ('r-kit-contabil','Contabilização - kit contábil','encargos','mensal',5,null,null,'Analista Matriz','Todas',true,''),
  ('r-pag-caju','CAJU','titulos','mensal',20,null,null,'DP','Todas',true,'Buscar boleto e NF; confirmar dia de vencimento'),
  ('r-pag-docusign','Docusign','titulos','mensal',10,null,null,'DP','Todas',true,'Buscar boleto e NF; confirmar dia de vencimento'),
  ('r-pag-ifractal','iFractal','titulos','mensal',15,null,null,'DP','Todas',true,'Buscar boleto e NF; confirmar dia de vencimento'),
  ('r-pag-piwi','Piwi (seguro de vida)','titulos','mensal',25,null,null,'DP','Todas',true,'Buscar boleto e NF; confirmar dia de vencimento'),
  ('r-pag-saude','Plano de saúde (seguradoras)','titulos','mensal',5,null,null,'DP','Todas',true,'Buscar boleto e NF; confirmar dia de vencimento'),
  ('r-pag-singular','Singular','titulos','mensal',10,null,null,'DP','Todas',true,'Buscar boleto e NF; confirmar dia de vencimento'),
  ('r-ponto-diario','Lançamentos de ponto e atestados','ponto','diaria',1,null,null,'Analista / Assistente','Todas',true,''),
  ('r-ponto-quinzenal','Fechamento quinzenal do ponto (trocas, abonos, HE, ausências)','ponto','quinzenal',15,31,null,'Analista Matriz','Matriz',true,''),
  ('r-titulos-encargos','Lançamento títulos de encargos','encargos','mensal',20,null,null,'Analista Matriz','Todas',true,'')
on conflict (id) do nothing;

select (select count(*) from public.processos) as processos, (select count(*) from public.rotinas) as rotinas;
