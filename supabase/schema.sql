-- Couple Wine: a adega do Wang e da Clara.
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar de novo sem problema.
-- Tudo aqui começa com cw_ para não misturar com as tabelas do Partiu Viajar.

-- ---------------------------------------------------------------------------
-- Quem é o casal: e-mail da conta → pessoa
-- ---------------------------------------------------------------------------
create schema if not exists private;

create table if not exists private.cw_convites (
  email text primary key,
  pessoa text not null unique check (pessoa in ('wang', 'clara'))
);

insert into private.cw_convites (email, pessoa) values
  ('wangvitor4@gmail.com', 'wang'),
  ('EMAIL_DA_CLARA', 'clara')
on conflict (pessoa) do update set email = excluded.email;

create table if not exists public.cw_casal (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pessoa text not null unique check (pessoa in ('wang', 'clara'))
);
alter table public.cw_casal enable row level security;
drop policy if exists cw_casal_ler on public.cw_casal;
create policy cw_casal_ler on public.cw_casal for select using (user_id = auth.uid());

-- quem está logado: 'wang', 'clara' ou null (não faz parte do casal)
create or replace function public.cw_membro() returns text
language sql stable security definer set search_path = '' as $$
  select pessoa from public.cw_casal where user_id = auth.uid()
$$;

-- o app chama ao entrar: liga a conta à pessoa pelo e-mail do convite
create or replace function public.cw_vincular() returns text
language plpgsql security definer set search_path = '' as $$
declare p text;
begin
  select c.pessoa into p from private.cw_convites c
  where lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
  if p is null then return null; end if;
  insert into public.cw_casal (user_id, pessoa) values (auth.uid(), p)
  on conflict (pessoa) do update set user_id = excluded.user_id;
  return p;
end $$;

-- ---------------------------------------------------------------------------
-- Vinhos
-- ---------------------------------------------------------------------------
create table if not exists public.cw_vinhos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  criado_por text check (criado_por in ('wang', 'clara')),
  status text not null default 'bebido' check (status in ('quero', 'bebido')),
  nome text not null,
  produtor text,
  safra int,
  tipo text not null default 'tinto' check (tipo in ('tinto', 'branco', 'rose')),
  uva text,
  pais text,
  regiao text,
  teor text,
  descricao text,
  imagem_url text,              -- foto da garrafa achada na internet
  rotulo_path text,             -- foto do rótulo que vocês tiraram (Storage)
  nota_critica numeric,         -- 0 a 5 (Vivino ou parecido)
  fonte_critica text,
  preco_min numeric,            -- preço de mercado no Brasil (R$)
  preco_max numeric,
  preco_lojas jsonb,
  preco_em date,
  quem text check (quem in ('nos', 'wang', 'clara')),
  preco_pago numeric,
  onde text,
  bebido_em date,
  compraria boolean,
  foto_path text,               -- foto de vocês com a garrafa (Storage)
  obs text                      -- por que quer provar, lembretes
);

-- notas e posição no ranking de cada um
create table if not exists public.cw_notas (
  vinho_id uuid not null references public.cw_vinhos(id) on delete cascade,
  pessoa text not null check (pessoa in ('wang', 'clara')),
  nota int check (nota between 0 and 10),
  ordem double precision,       -- posição no ranking do tipo (menor = melhor); vazio = falta encaixar
  primary key (vinho_id, pessoa)
);

alter table public.cw_vinhos enable row level security;
alter table public.cw_notas enable row level security;

drop policy if exists cw_vinhos_casal on public.cw_vinhos;
create policy cw_vinhos_casal on public.cw_vinhos for all
  using (public.cw_membro() is not null) with check (public.cw_membro() is not null);

drop policy if exists cw_notas_casal on public.cw_notas;
create policy cw_notas_casal on public.cw_notas for all
  using (public.cw_membro() is not null) with check (public.cw_membro() is not null);

-- ---------------------------------------------------------------------------
-- Fotos (rótulos e fotos de vocês): pasta privada, só o casal vê
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('cw-fotos', 'cw-fotos', false)
on conflict (id) do nothing;

drop policy if exists cw_fotos_casal on storage.objects;
create policy cw_fotos_casal on storage.objects for all
  using (bucket_id = 'cw-fotos' and public.cw_membro() is not null)
  with check (bucket_id = 'cw-fotos' and public.cw_membro() is not null);
