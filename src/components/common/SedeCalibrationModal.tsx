import React, { useState } from "react";
import { X, MapPin, Save, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import { supabase } from "../../utils/supabase";
import { SedeLocationPicker } from "./SedeLocationPicker";

interface SedeCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sede: any;
  onSedeUpdated: (updatedSede: any) => void;
}

export function SedeCalibrationModal({
  isOpen,
  onClose,
  sede,
  onSedeUpdated
}: SedeCalibrationModalProps) {
  const [lat, setLat] = useState<number | null>(sede?.latitud != null ? Number(sede.latitud) : null);
  const [lng, setLng] = useState<number | null>(sede?.longitud != null ? Number(sede.longitud) : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !sede) return null;

  const handleSaveCoordinates = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { data, error: dbError } = await supabase
        .from("sedes")
        .update({
          latitud: lat,
          longitud: lng
        })
        .eq("id", sede.id)
        .select()
        .single();

      if (dbError) throw dbError;

      setSuccess(true);
      const updated = {
        ...sede,
        latitud: lat,
        longitud: lng
      };
      onSedeUpdated(updated);

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Error al calibrar ubicación de la sede:", err);
      setError(err.message || "No se pudo actualizar la ubicación de la sede.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden transform animate-slide-in">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold font-heading">
                Calibrar Ubicación de Sede
              </h3>
              <p className="text-xs text-slate-300">
                Ajusta el pin en el mapa para que el radar de postulantes calcule las distancias con exactitud.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Sede */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="font-bold text-slate-800 text-sm">{sede.nombre}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 font-semibold">{sede.distrito || "Sin distrito"}</span>
          </div>

          <span className="text-[11px] text-slate-500 truncate max-w-xs font-medium">
            {sede.direccion || "Sin dirección registrada"}
          </span>
        </div>

        {/* Body: Location Picker */}
        <div className="p-5 space-y-4">
          <SedeLocationPicker
            initialLat={lat}
            initialLng={lng}
            direccion={sede.direccion}
            distrito={sede.distrito}
            onCoordinatesChange={(coords) => {
              setLat(coords.lat);
              setLng(coords.lng);
            }}
          />

          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>¡Coordenadas guardadas exitosamente en la base de datos!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200/70 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSaveCoordinates}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-200 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? "Guardando en Sede..." : "Guardar Calibración"}
          </button>
        </div>

      </div>
    </div>
  );
}
