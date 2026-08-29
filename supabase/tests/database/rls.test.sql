begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '70000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'chemist-one@example.test', 'test',
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'chemist-two@example.test', 'test',
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

select is(
  (select count(*)::integer from public.profiles where id::text like '70000000-%'),
  2,
  'auth trigger creates one profile per user'
);

insert into public.patents (id, owner_user_id, patent_number, title) values
  (
    '71000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'US-ONE',
    'User one patent'
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002',
    'US-TWO',
    'User two patent'
  );

insert into public.chemicals (
  id, owner_user_id, canonical_name, abbreviation
) values (
  '72000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'Private test chemical',
  'PTC'
);

insert into public.tags (id, owner_user_id, name) values (
  '73000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'Private tag'
);

insert into public.patent_tags (patent_id, tag_id) values (
  '71000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000001'
);

insert into public.ai_analysis_runs (
  id, patent_id, owner_user_id, status, prompt_version
) values
  (
    '75000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'REVIEW_REQUIRED', 'test-v1'
  ),
  (
    '75000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002',
    'REVIEW_REQUIRED', 'test-v1'
  );

insert into public.ai_analysis_suggestions (
  id, run_id, patent_id, owner_user_id, suggestion_type, label,
  matched_chemical_id, matched_role_id, confidence_score
) values
  (
    '76000000-0000-4000-8000-000000000001',
    '75000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'CHEMICAL', 'IPDA',
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002', 0.95
  ),
  (
    '76000000-0000-4000-8000-000000000002',
    '75000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002',
    'CHEMICAL', 'DGEBA',
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001', 0.91
  );

insert into public.ai_learning_feedback (
  id, owner_user_id, source_suggestion_id, source_run_id, source_patent_id,
  suggestion_type, observed_label, normalized_observed_label, decision, resolved_label
) values
  (
    '77000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    '76000000-0000-4000-8000-000000000001',
    '75000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    'CHEMICAL', 'IPDA', 'ipda', 'ACCEPTED', 'Isophorone diamine'
  ),
  (
    '77000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002',
    '76000000-0000-4000-8000-000000000002',
    '75000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002',
    'CHEMICAL', 'DGEBA', 'dgeba', 'CORRECTED', 'Bisphenol A diglycidyl ether'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.patents),
  1,
  'user one sees only their own patent'
);

select is(
  (select patent_number from public.patents limit 1),
  'US-ONE',
  'user one cannot retrieve user two patent by guessing its id'
);

update public.patents
set title = 'attempted cross-user update'
where id = '71000000-0000-4000-8000-000000000002';

delete from public.patents
where id = '71000000-0000-4000-8000-000000000002';

select is(
  (select count(*)::integer from public.chemicals),
  (select count(*)::integer + 1 from public.chemicals where owner_user_id is null),
  'user one sees shared chemicals plus their private chemical'
);

select is(
  (select count(*)::integer from public.patent_tags),
  1,
  'user one sees their patent tags'
);

select is(
  (select count(*)::integer from public.ai_analysis_runs),
  1,
  'user one sees only their own AI analysis run'
);

select is(
  (select count(*)::integer from public.ai_analysis_suggestions),
  1,
  'user one sees only their own AI suggestions'
);

select is(
  (select count(*)::integer from public.ai_learning_feedback),
  1,
  'user one sees only their own AI learning memory'
);

select throws_ok(
  $$ update public.ai_learning_feedback set resolved_label = 'tampered' where id = '77000000-0000-4000-8000-000000000001' $$,
  '42501',
  'permission denied for table ai_learning_feedback',
  'clients cannot directly alter AI learning memory'
);

select throws_ok(
  $$ update public.ai_analysis_suggestions set review_status = 'ACCEPTED' where id = '76000000-0000-4000-8000-000000000001' $$,
  '42501',
  'permission denied for table ai_analysis_suggestions',
  'clients cannot bypass the protected AI suggestion review function'
);

insert into storage.objects (bucket_id, name, owner_id)
values (
  'patent-pdfs',
  '70000000-0000-4000-8000-000000000001/71000000-0000-4000-8000-000000000001/74000000-0000-4000-8000-000000000001.pdf',
  '70000000-0000-4000-8000-000000000001'
);

select is(
  (select count(*)::integer from storage.objects where bucket_id = 'patent-pdfs'),
  1,
  'user one can access a PDF stored under their patent path'
);

reset role;

select is(
  (select title from public.patents where id = '71000000-0000-4000-8000-000000000002'),
  'User two patent',
  'cross-user update was blocked'
);

select is(
  (select count(*)::integer from public.patents where id = '71000000-0000-4000-8000-000000000002'),
  1,
  'cross-user delete was blocked'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.patents),
  1,
  'user two sees only their own patent'
);

select is(
  (select count(*)::integer from public.chemicals),
  (select count(*)::integer from public.chemicals where owner_user_id is null),
  'user two cannot see user one private chemical'
);

select is(
  (select count(*)::integer from public.patent_tags),
  0,
  'user two cannot see user one patent tags'
);

select is(
  (select count(*)::integer from public.ai_analysis_runs),
  1,
  'user two sees only their own AI analysis run'
);

select is(
  (select count(*)::integer from public.ai_analysis_suggestions),
  1,
  'user two sees only their own AI suggestions'
);

select is(
  (select count(*)::integer from public.ai_learning_feedback),
  1,
  'user two cannot see user one AI learning memory'
);

select is(
  (select count(*)::integer from storage.objects where bucket_id = 'patent-pdfs'),
  0,
  'user two cannot see user one PDF object'
);

select * from finish();
rollback;
