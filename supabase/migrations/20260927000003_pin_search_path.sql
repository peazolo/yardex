-- Pin the search_path on the two helpers the Supabase security advisor flagged.
alter function public._ngn(numeric) set search_path = public;
alter function public._require_user() set search_path = public;
