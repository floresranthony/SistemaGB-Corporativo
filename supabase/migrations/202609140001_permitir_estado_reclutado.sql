-- Migración: Permitir el nuevo estado 'Reclutado' en la tabla candidatos
ALTER TABLE candidatos DROP CONSTRAINT IF EXISTS candidatos_estado_check;

ALTER TABLE candidatos ADD CONSTRAINT candidatos_estado_check 
  CHECK (estado IN ('Postulante', 'En Evaluacion', 'Aprobado', 'Reclutado', 'Pendiente de Alta', 'Contratado', 'Descartado', 'No se presento'));

COMMENT ON CONSTRAINT candidatos_estado_check ON candidatos IS 'Restricción de estados válidos para el flujo de reclutamiento y altas';
