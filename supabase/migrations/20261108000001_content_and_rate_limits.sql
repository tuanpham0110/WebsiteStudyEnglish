create policy lessons_admin_read on public.lessons for select to authenticated using ((select public.is_admin()));
create policy lessons_admin_insert on public.lessons for insert to authenticated with check ((select public.is_admin()));
create policy lessons_admin_update on public.lessons for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant insert (id,kind,level,topic,title,title_vi,summary,content,sort_order,is_published), update (kind,level,topic,title,title_vi,summary,content,sort_order,is_published) on public.lessons to authenticated;

-- Questions belonging to unpublished lessons are private too.
drop policy exercises_read on public.exercises;
create policy exercises_read on public.exercises for select to authenticated using (lesson_id is null or exists (select 1 from public.lessons l where l.id = lesson_id and l.is_published));
create policy exercises_admin_read on public.exercises for select to authenticated using ((select public.is_admin()));
create policy exercises_admin_insert on public.exercises for insert to authenticated with check ((select public.is_admin()));
create policy exercises_admin_update on public.exercises for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy exercises_admin_delete on public.exercises for delete to authenticated using ((select public.is_admin()));
grant insert (id,lesson_id,type,level,prompt,data,answer,explanation_vi,explanation_en,sort_order), update (type,level,prompt,data,answer,explanation_vi,explanation_en,sort_order), delete on public.exercises to authenticated;
create policy vocabulary_admin_insert on public.vocabulary for insert to authenticated with check (owner_id is null and (select public.is_admin()));
create policy vocabulary_admin_update on public.vocabulary for update to authenticated using (owner_id is null and (select public.is_admin())) with check (owner_id is null and (select public.is_admin()));
create function public.assign_catalog_slug() returns trigger language plpgsql set search_path = '' as $$
begin
    if new.owner_id is null and new.slug is null and public.is_admin() then new.slug := 'cms-' || gen_random_uuid()::text; end if;
    return new;
end;
$$;
create trigger vocabulary_catalog_slug before insert on public.vocabulary for each row execute function public.assign_catalog_slug();

-- Preserve callers of the old signature; only the service role may reserve quota.
drop function public.consume_ai_quota(uuid,text,int,int,int,int,int,text,text,jsonb);
create function public.consume_ai_quota(
    p_user uuid, p_kind text, p_units int, p_requests int,
    p_user_daily_limit int, p_user_minute_limit int, p_global_daily_limit int,
    p_provider text default null, p_model text default null, p_meta jsonb default '{}'::jsonb,
    p_global_minute_limit int default 10
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
    v_user_today int; v_user_minute int; v_global_today int; v_global_minute int; v_id bigint;
begin
    if p_kind not in ('chat','assist','evaluation','stt','tts') or p_units < 1 or p_requests < 1 or p_global_minute_limit < 1 then
        raise exception 'invalid quota parameters' using errcode = '22023';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('quota:' || p_user::text, 0));
    select coalesce(sum(units),0) into v_user_today from public.usage_logs where user_id = p_user and kind = p_kind and status = 'ok' and created_at >= v_day_start;
    if v_user_today + p_units > p_user_daily_limit then return jsonb_build_object('allowed',false,'reason','user_daily','used',v_user_today,'limit',p_user_daily_limit); end if;
    select count(*) into v_user_minute from public.usage_logs where user_id = p_user and created_at >= now() - interval '1 minute';
    if v_user_minute >= p_user_minute_limit then return jsonb_build_object('allowed',false,'reason','rate_limited'); end if;
    -- This transaction lock coordinates users across all Worker isolates.
    perform pg_advisory_xact_lock(hashtextextended('quota:global',0));
    select coalesce(sum(requests),0) into v_global_today from public.usage_logs where kind in ('chat','assist','evaluation','stt','tts') and created_at >= v_day_start;
    if v_global_today + p_requests > p_global_daily_limit then return jsonb_build_object('allowed',false,'reason','global_daily'); end if;
    select coalesce(sum(requests),0) into v_global_minute from public.usage_logs where provider is not distinct from p_provider and model is not distinct from p_model and kind in ('chat','assist','evaluation','stt','tts') and created_at >= now() - interval '1 minute';
    if v_global_minute + p_requests > p_global_minute_limit then return jsonb_build_object('allowed',false,'reason','global_rate_limited'); end if;
    insert into public.usage_logs(user_id,kind,units,requests,provider,model,meta) values(p_user,p_kind,p_units,p_requests,p_provider,p_model,coalesce(p_meta,'{}'::jsonb)) returning id into v_id;
    return jsonb_build_object('allowed',true,'log_id',v_id,'used',v_user_today+p_units,'limit',p_user_daily_limit);
end;
$$;
revoke all on function public.consume_ai_quota(uuid,text,int,int,int,int,int,text,text,jsonb,int) from public,anon,authenticated;
grant execute on function public.consume_ai_quota(uuid,text,int,int,int,int,int,text,text,jsonb,int) to service_role;

-- Keep all existing dashboard calculations/permissions; only correct due words.
do $$
declare definition text;
begin
    definition := pg_get_functiondef('public.get_dashboard_stats(text)'::regprocedure);
    if position('and status <> ''mastered''' in definition) = 0 then raise exception 'dashboard due-word predicate changed; review migration'; end if;
    execute replace(definition, 'and status <> ''mastered''', '');
end;
$$;
