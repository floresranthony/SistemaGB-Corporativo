-- Migración para agregar la columna bono_asistencia_perfecta a vinculos_laborales
ALTER TABLE public.vinculos_laborales 
ADD COLUMN IF NOT EXISTS bono_asistencia_perfecta DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
