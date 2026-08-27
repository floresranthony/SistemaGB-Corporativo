-- Corrige el borrado desde Table Editor y desde la aplicación.
-- En un DELETE la fila de tareo_marcaciones ya no existe cuando corre el
-- trigger AFTER; por ello tareo_auditoria.marcacion_id debe ser NULL.
-- El identificador y el contenido eliminado siguen disponibles en valor_anterior.

create or replace function public.tareo_auditar_marcacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tareo_auditoria (
    periodo_id,
    marcacion_id,
    accion,
    valor_anterior,
    valor_nuevo,
    usuario_id,
    estado_periodo
  ) values (
    coalesce(new.periodo_id, old.periodo_id),
    case when tg_op = 'DELETE' then null else new.id end,
    tg_op,
    to_jsonb(old),
    to_jsonb(new),
    public.tareo_usuario_actual_id(),
    (select estado from public.tareo_periodos where id = coalesce(new.periodo_id, old.periodo_id))
  );

  return coalesce(new, old);
end;
$$;
