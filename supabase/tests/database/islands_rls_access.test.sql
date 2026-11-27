begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email)
values
  ('123e4567-e89b-12d3-a456-426614174000', 'island-owner-1@test.invalid'),
  ('987fcdeb-51a2-43d7-9012-345678901234', 'island-owner-2@test.invalid');

insert into public.islands (id, owner_id, name, save_data)
values
  ('11111111-1111-4111-8111-111111111111', '123e4567-e89b-12d3-a456-426614174000', 'Owner 1 island', '{}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', '987fcdeb-51a2-43d7-9012-345678901234', 'Owner 2 island', '{}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = '123e4567-e89b-12d3-a456-426614174000';

select results_eq(
  'select count(*) from public.islands',
  array[1::bigint],
  'owner 1 sees only their island'
);

select results_eq(
  $$insert into public.islands (owner_id, name, save_data)
    values ('123e4567-e89b-12d3-a456-426614174000'::uuid, 'Owner 1 new island', '{}'::jsonb)
    returning name$$,
  array['Owner 1 new island']::text[],
  'owner 1 can create their own island'
);

select is_empty(
  $$select id from public.islands where id = '22222222-2222-4222-8222-222222222222'::uuid$$,
  'owner 1 cannot read owner 2 island'
);

select results_eq(
  $$update public.islands set name = 'Owner 1 updated'
    where id = '11111111-1111-4111-8111-111111111111'::uuid returning name$$,
  array['Owner 1 updated']::text[],
  'owner 1 can update their own island'
);

set local request.jwt.claim.sub = '987fcdeb-51a2-43d7-9012-345678901234';

select results_eq(
  'select count(*) from public.islands',
  array[1::bigint],
  'owner 2 sees only their island'
);

select is_empty(
  $$select id from public.islands where id = '11111111-1111-4111-8111-111111111111'::uuid$$,
  'owner 2 cannot read owner 1 island'
);

select is_empty(
  $$update public.islands set name = 'Unauthorized'
    where id = '11111111-1111-4111-8111-111111111111'::uuid returning id$$,
  'owner 2 cannot update owner 1 island'
);

select is_empty(
  $$delete from public.islands where id = '11111111-1111-4111-8111-111111111111'::uuid returning id$$,
  'owner 2 cannot delete owner 1 island'
);

select results_eq(
  $$insert into public.islands (owner_id, name, save_data)
    values ('987fcdeb-51a2-43d7-9012-345678901234'::uuid, 'Owner 2 new island', '{}'::jsonb)
    returning name$$,
  array['Owner 2 new island']::text[],
  'owner 2 can create their own island'
);

set local request.jwt.claim.sub = '123e4567-e89b-12d3-a456-426614174000';
select is_empty(
  $$delete from public.islands where id = '22222222-2222-4222-8222-222222222222'::uuid returning id$$,
  'owner 1 cannot delete owner 2 island'
);

select * from finish();
rollback;
