begin;
select plan(6);

select has_table('public', 'islands', 'cloud island table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.islands'::regclass),
  'row level security is enabled'
);

select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'islands'),
  4,
  'four owner-scoped policies exist'
);

select ok(
  (select bool_and((coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%auth.uid%')
   from pg_policies where schemaname = 'public' and tablename = 'islands'),
  'each row policy checks the authenticated user id'
);

select ok(
  not has_table_privilege('anon', 'public.islands', 'select'),
  'anonymous users cannot read island rows'
);

select ok(
  has_table_privilege('authenticated', 'public.islands', 'select')
    and has_table_privilege('authenticated', 'public.islands', 'insert')
    and has_table_privilege('authenticated', 'public.islands', 'update')
    and has_table_privilege('authenticated', 'public.islands', 'delete'),
  'authenticated users have table grants subject to RLS'
);

select * from finish();
rollback;
