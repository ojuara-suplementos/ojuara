-- Execute este script uma única vez no SQL Editor do Supabase.
-- Ele não altera dados existentes: apenas garante unicidade daqui em diante.

-- 1) products.slug UNIQUE
--    Verifique antes se há duplicados:
--    select slug, count(*) from public.products group by slug having count(*) > 1;
create unique index if not exists products_slug_unique on public.products (slug);

-- 2) categorias sem nomes duplicados (ignora caixa e espaços extras)
--    select lower(btrim(name)), count(*) from public.categories group by 1 having count(*) > 1;
create unique index if not exists categories_name_unique on public.categories (lower(btrim(name)));

-- 3) marcas sem nomes duplicados
--    select lower(btrim(name)), count(*) from public.brands group by 1 having count(*) > 1;
create unique index if not exists brands_name_unique on public.brands (lower(btrim(name)));
