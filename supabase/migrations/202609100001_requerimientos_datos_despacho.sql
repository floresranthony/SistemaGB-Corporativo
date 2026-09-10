-- Migración: Agregar campos de despacho y contacto a la tabla requerimientos
ALTER TABLE requerimientos 
ADD COLUMN IF NOT EXISTS horario_atencion VARCHAR(150) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS personal_contacto VARCHAR(150) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS numero_contacto VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lugar_despacho TEXT DEFAULT NULL;

COMMENT ON COLUMN requerimientos.horario_atencion IS 'Horario de recepción o atención en la sede para entrega del requerimiento';
COMMENT ON COLUMN requerimientos.personal_contacto IS 'Nombre del personal, operario o vigilancia encargado de recibir en la sede';
COMMENT ON COLUMN requerimientos.numero_contacto IS 'Teléfono o celular del personal o vigilancia de contacto en la sede';
COMMENT ON COLUMN requerimientos.lugar_despacho IS 'Dirección exacta, puerta o área específica donde se despachará el requerimiento';
