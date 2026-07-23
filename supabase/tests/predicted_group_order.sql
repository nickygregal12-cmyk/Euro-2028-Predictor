begin;
select plan(1);
select has_function('public', 'resolve_predicted_group_order', 'resolver is installed');
select * from finish();
rollback;
