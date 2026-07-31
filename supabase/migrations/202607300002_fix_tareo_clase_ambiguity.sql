-- Corrección para instalaciones que ya ejecutaron la primera migración.
create or replace function public.tareo_validar_marcacion() returns trigger language plpgsql security definer set search_path=public as $$
declare p public.tareo_periodos; v public.vinculos_laborales; v_clase text; total_horas numeric; avisos jsonb:='[]'::jsonb;
begin
 select * into p from public.tareo_periodos where id=new.periodo_id; if p is null then raise exception 'Periodo no encontrado'; end if;
 if new.fecha < make_date(p.anio,p.mes,1) or new.fecha > (make_date(p.anio,p.mes,1)+interval '1 month - 1 day')::date then raise exception 'La fecha no pertenece al periodo'; end if;
 if p.estado not in ('Borrador','Observado','Corregido') then raise exception 'El periodo está bloqueado'; end if;
 if new.sede_trabajada_id<>p.sede_id or not public.tareo_puede_operar_sede(new.sede_trabajada_id) then raise exception 'No tiene acceso a la sede trabajada'; end if;
 select * into v from public.vinculos_laborales where id=new.vinculo_laboral_id; if v.fecha_cese is not null and new.fecha>v.fecha_cese then raise exception 'No se permiten horas posteriores al cese'; end if;
 select tm.clase into v_clase from public.tipos_marcacion tm where tm.id=new.tipo_marcacion_id and tm.activo;
 if v_clase is null or ((v_clase='HORAS')<>(new.horas>0)) then raise exception 'Tipo u horas de marcación inválidos'; end if;
 if exists(select 1 from public.vacaciones_historico where vinculo_laboral_id=new.vinculo_laboral_id and new.fecha between fecha_inicio and fecha_fin) and new.horas>0 then avisos:=avisos||jsonb_build_array('Horas registradas durante vacaciones'); end if;
 select coalesce(sum(horas),0) into total_horas from public.tareo_marcaciones where vinculo_laboral_id=new.vinculo_laboral_id and fecha=new.fecha and id is distinct from new.id;
 if total_horas+new.horas>16 then avisos:=avisos||jsonb_build_array('Jornada diaria inusual'); end if;
 new.cliente_id:=(select cliente_id from public.sedes where id=new.sede_trabajada_id); new.supervisor_registro_id:=public.tareo_usuario_actual_id(); new.actualizado_por_id:=public.tareo_usuario_actual_id(); new.actualizado_en:=now(); new.alertas:=avisos;
 if tg_op='INSERT' then new.creado_por_id:=public.tareo_usuario_actual_id(); new.creado_en:=now(); end if; return new;
end $$;