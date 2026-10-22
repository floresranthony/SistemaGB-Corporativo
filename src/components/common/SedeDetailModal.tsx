import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Building2,
  Users,
  Phone,
  User,
  Copy,
  Check,
  ExternalLink,
  X,
  Compass,
  Share2,
  CheckCircle2,
  MessageCircle
} from "lucide-react";
import { obtenerCentroideDistrito } from "../../utils/geoUtils";

interface SedeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sede: any | null;
}

const createSedeIcon = () => {
  return L.divIcon({
    className: "custom-sede-detail-pin",
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        border: 3px solid #ffffff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.45);
      ">
        <svg style="transform: rotate(45deg); width: 18px; height: 18px; color: #ffffff;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38]
  });
};

export function SedeDetailModal({ isOpen, onClose, sede }: SedeDetailModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedPostulante, setCopiedPostulante] = useState(false);

  // Escuchar tecla Escape para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Inicializar o actualizar el mapa Leaflet
  useEffect(() => {
    if (!isOpen || !sede || !mapContainerRef.current) return;

    // Destruir instancia previa si existe
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const hasExactCoords =
      sede.latitud != null &&
      sede.longitud != null &&
      !isNaN(Number(sede.latitud)) &&
      !isNaN(Number(sede.longitud)) &&
      Number(sede.latitud) !== 0;

    let targetLat = -12.046374;
    let targetLng = -77.042793;
    let zoomLevel = 13;

    if (hasExactCoords) {
      targetLat = Number(sede.latitud);
      targetLng = Number(sede.longitud);
      zoomLevel = 16;
    } else if (sede.distrito) {
      const distCoords = obtenerCentroideDistrito(sede.distrito);
      if (distCoords) {
        targetLat = distCoords.lat;
        targetLng = distCoords.lng;
        zoomLevel = 14;
      }
    }

    const map = L.map(mapContainerRef.current, {
      center: [targetLat, targetLng],
      zoom: zoomLevel,
      zoomControl: true,
      scrollWheelZoom: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    // Añadir Pin
    const marker = L.marker([targetLat, targetLng], {
      icon: createSedeIcon()
    }).addTo(map);

    const popupHtml = `
      <div style="font-family: inherit; font-size: 12px; line-height: 1.4; padding: 2px;">
        <strong style="color: #1e293b; font-size: 13px; display: block; margin-bottom: 3px;">${sede.nombre}</strong>
        <span style="color: #64748b; font-size: 11px; display: block;">${sede.direccion || "Sin dirección"}</span>
        <span style="color: #2563eb; font-weight: bold; font-size: 10px; display: block; margin-top: 4px;">
          ${hasExactCoords ? "📍 Ubicación Exacta GPS" : "📍 Ubicación Aproximada (" + (sede.distrito || "") + ")"}
        </span>
      </div>
    `;
    marker.bindPopup(popupHtml).openPopup();

    mapInstanceRef.current = map;

    // Forzar recalculo de dimensiones una vez renderizado el modal
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, sede]);

  if (!isOpen || !sede) return null;

  const hasExactCoords =
    sede.latitud != null &&
    sede.longitud != null &&
    !isNaN(Number(sede.latitud)) &&
    !isNaN(Number(sede.longitud)) &&
    Number(sede.latitud) !== 0;

  // Generar link de Google Maps
  const googleMapsUrl = hasExactCoords
    ? `https://www.google.com/maps/search/?api=1&query=${sede.latitud},${sede.longitud}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${sede.direccion || ""}, ${sede.distrito || ""}, Lima, Peru`
      )}`;

  // Copiar solo la dirección
  const handleCopyAddress = () => {
    const text = `${sede.direccion || ""}, ${sede.distrito || ""}`.trim();
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Copiar formato listo para enviar por WhatsApp al postulante
  const handleCopyPostulante = () => {
    const sups = sede.usuario_sedes?.map((us: any) => us.usuarios).filter(Boolean) || [];
    const supNames = sups.map((s: any) => `${s.nombres} ${s.apellidos}`).join(", ");

    const text = [
      `📍 *SEDE:* ${sede.nombre}`,
      sede.clientes?.razon_social ? `🏢 *CLIENTE:* ${sede.clientes.razon_social}` : null,
      `🏙️ *DISTRITO:* ${sede.distrito || "Por confirmar"}`,
      `🗺️ *DIRECCIÓN:* ${sede.direccion || "Por confirmar"}`,
      sede.contacto_nombre ? `👤 *CONTACTO EN SEDE:* ${sede.contacto_nombre} ${sede.contacto_telefono ? `(${sede.contacto_telefono})` : ""}` : null,
      supNames ? `👮 *SUPERVISOR:* ${supNames}` : null,
      `📌 *UBICACIÓN GOOGLE MAPS:* ${googleMapsUrl}`
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text);
    setCopiedPostulante(true);
    setTimeout(() => setCopiedPostulante(false), 2500);
  };

  const sups = sede.usuario_sedes?.map((us: any) => us.usuarios).filter(Boolean) || [];

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl border border-slate-100 overflow-hidden transform animate-slide-in flex flex-col max-h-[92vh]">
        
        {/* Header Panorámico */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-2xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold font-heading tracking-tight text-white">
                  {sede.nombre}
                </h3>
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    sede.activo
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {sede.activo ? "Activo" : "Inactivo"}
                </span>
                {hasExactCoords ? (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <Compass className="w-3 h-3" /> GPS Calibrado
                  </span>
                ) : (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Aproximado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Cliente: <strong className="text-slate-200">{sede.clientes?.razon_social || "No asignado"}</strong></span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 shrink-1">
          
          {/* Card Principal: Dirección y Accesos Rápidos */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                  Distrito y Dirección Física
                </span>
                <div className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>{sede.distrito || "Distrito no especificado"}</span>
                </div>
                <p className="text-sm font-semibold text-slate-700 leading-relaxed max-w-xl">
                  {sede.direccion || "Sin dirección física registrada"}
                </p>
              </div>

              {/* Botón de apertura externa en Google Maps */}
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-200 hover:shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir en Google Maps
              </a>
            </div>

            {/* Acciones de Copiado para Reclutador */}
            <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-200/70">
              <button
                type="button"
                onClick={handleCopyAddress}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
              >
                {copiedAddress ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    <span className="text-emerald-700">¡Dirección Copiada!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copiar Dirección</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyPostulante}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                title="Copia los datos de la sede formateados para pegar en WhatsApp del candidato"
              >
                {copiedPostulante ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    <span className="text-emerald-800">¡Ficha para Postulante Copiada!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copiar Ficha para Postulante (WhatsApp)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Grilla Secundaria: Contacto en Sede y Supervisores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Contacto */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Contacto / Encargado en Sede
              </span>
              <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{sede.contacto_nombre || "No especificado"}</span>
              </div>
              {sede.contacto_telefono ? (
                <div className="flex items-center gap-3 pt-1">
                  <a
                    href={`tel:${sede.contacto_telefono}`}
                    className="inline-flex items-center gap-1 text-xs font-mono font-bold text-blue-600 hover:text-blue-800"
                  >
                    <Phone className="w-3 h-3" />
                    {sede.contacto_telefono}
                  </a>
                  <a
                    href={`https://wa.me/51${sede.contacto_telefono.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
                  >
                    <MessageCircle className="w-3 h-3" />
                    WhatsApp
                  </a>
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">Sin teléfono registrado</span>
              )}
            </div>

            {/* Supervisores */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Supervisores Asignados
              </span>
              {sups.length === 0 ? (
                <span className="text-xs text-slate-400 italic block pt-1">Sin supervisores asignados</span>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {sups.map((sup: any) => (
                    <span
                      key={sup.id}
                      className="inline-flex items-center gap-1 text-[11px] font-bold bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg border border-purple-100"
                    >
                      <User className="w-3 h-3 text-purple-500" />
                      {sup.nombres} {sup.apellidos}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Visor de Mapa Interactivo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Mapa de Ubicación</span>
              </div>
              {hasExactCoords && (
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  GPS: {Number(sede.latitud).toFixed(5)}, {Number(sede.longitud).toFixed(5)}
                </span>
              )}
            </div>

            {/* Contenedor Leaflet */}
            <div className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-300 shadow-inner relative z-0">
              <div ref={mapContainerRef} className="w-full h-full" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            {hasExactCoords
              ? "Ubicación GPS calibrada con exactitud."
              : "Ubicación referencial basada en el distrito."}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
