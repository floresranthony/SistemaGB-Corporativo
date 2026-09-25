-- Migración para agregar la columna bono_alimentacion a vinculos_laborales
ALTER TABLE public.vinculos_laborales 
ADD COLUMN IF NOT EXISTS bono_alimentacion DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
