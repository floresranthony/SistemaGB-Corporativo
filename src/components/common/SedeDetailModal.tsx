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
  MessageCircle,
  Bus,
  RotateCcw,
  Navigation,
  Info
} from "lucide-react";
import {
  obtenerCentroideDistrito,
  LISTA_DISTRITOS_CANONICOS,
  calcularDistanciaKm,
  formatearDistancia
} from "../../utils/geoUtils";

interface SedeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sede: any | null;
}

// Icono Azul para la Sede (Destino)
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

// Icono Verde para el Origen (Casa / Punto de partida del postulante)
const createOriginIcon = () => {
  return L.divIcon({
    className: "custom-origin-detail-pin",
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        background: linear-gradient(135deg, #10b981, #059669);
        border: 3px solid #ffffff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 6px 16px rgba(16, 185, 129, 0.45);
        cursor: grab;
      ">
        <svg style="transform: rotate(45deg); width: 18px; height: 18px; color: #ffffff;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
  const originMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedPostulante, setCopiedPostulante] = useState(false);

  // Estados para cálculo de ruta de carros / origen
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [originName, setOriginName] = useState<string>("");
  const [selectedOriginDistrito, setSelectedOriginDistrito] = useState<string>("");
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  // Coordenadas calculadas de la sede destino
  const getDestCoords = () => {
    if (!sede) return { lat: -12.046374, lng: -77.042793, hasExact: false };
    const hasExact =
      sede.latitud != null &&
      sede.longitud != null &&
      !isNaN(Number(sede.latitud)) &&
      !isNaN(Number(sede.longitud)) &&
      Number(sede.latitud) !== 0;

    if (hasExact) {
      return { lat: Number(sede.latitud), lng: Number(sede.longitud), hasExact: true };
    }
    if (sede.distrito) {
      const distCoords = obtenerCentroideDistrito(sede.distrito);
      if (distCoords) {
        return { lat: distCoords.lat, lng: distCoords.lng, hasExact: false };
      }
    }
    return { lat: -12.046374, lng: -77.042793, hasExact: false };
  };

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

  // Limpiar origen cuando cambie la sede o se abra el modal
  useEffect(() => {
    if (isOpen) {
      setOriginCoords(null);
      setOriginName("");
      setSelectedOriginDistrito("");
      setDistanceKm(null);
      if (originMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(originMarkerRef.current);
        originMarkerRef.current = null;
      }
      if (routeLineRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
    }
  }, [isOpen, sede?.id]);

  // Inicializar o actualizar el mapa Leaflet
  useEffect(() => {
    if (!isOpen || !sede || !mapContainerRef.current) return;

    // Destruir instancia previa si existe
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const dest = getDestCoords();

    const map = L.map(mapContainerRef.current, {
      center: [dest.lat, dest.lng],
      zoom: dest.hasExact ? 16 : 14,
      zoomControl: true,
      scrollWheelZoom: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    // Añadir Pin Destino de la Sede
    const destMarker = L.marker([dest.lat, dest.lng], {
      icon: createSedeIcon()
    }).addTo(map);

    const popupHtml = `
      <div style="font-family: inherit; font-size: 12px; line-height: 1.4; padding: 2px;">
        <strong style="color: #1e293b; font-size: 13px; display: block; margin-bottom: 3px;">${sede.nombre}</strong>
        <span style="color: #64748b; font-size: 11px; display: block;">${sede.direccion || "Sin dirección"}</span>
        <span style="color: #2563eb; font-weight: bold; font-size: 10px; display: block; margin-top: 4px;">
          ${dest.hasExact ? "📍 Ubicación Exacta GPS" : "📍 Ubicación Aproximada (" + (sede.distrito || "") + ")"}
        </span>
      </div>
    `;
    destMarker.bindPopup(popupHtml).openPopup();

    // Evento de clic en mapa para definir punto de partida del postulante
    map.on("click", (e: L.LeafletMouseEvent) => {
      handleSetOrigin(e.latlng.lat, e.latlng.lng, "Punto marcado en el mapa", map);
    });

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

  // Función para establecer el punto de partida (origen)
  const handleSetOrigin = (
    lat: number,
    lng: number,
    label: string,
    currentMap?: L.Map | null
  ) => {
    const map = currentMap || mapInstanceRef.current;
    if (!map) return;

    const dest = getDestCoords();
    setOriginCoords({ lat, lng });
    setOriginName(label);

    const dist = calcularDistanciaKm(lat, lng, dest.lat, dest.lng);
    setDistanceKm(dist);

    // Actualizar o crear marcador de origen
    if (originMarkerRef.current) {
      originMarkerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], {
        icon: createOriginIcon(),
        draggable: true
      }).addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        handleSetOrigin(pos.lat, pos.lng, "Punto marcado en el mapa", map);
      });

      originMarkerRef.current = marker;
    }

    originMarkerRef.current
      .bindPopup(
        `<div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
          <strong style="color: #059669; font-size: 13px; display: block;">Punto de Partida (Postulante)</strong>
          <span style="color: #64748b; font-size: 11px;">${label}</span>
          <span style="color: #10b981; font-weight: bold; font-size: 10px; display: block; margin-top: 3px;">
            ~${formatearDistancia(dist)} hacia la sede
          </span>
        </div>`
      )
      .openPopup();

    // Actualizar o crear línea de ruta directa
    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs([
        [lat, lng],
        [dest.lat, dest.lng]
      ]);
    } else {
      const polyline = L.polyline(
        [
          [lat, lng],
          [dest.lat, dest.lng]
        ],
        {
          color: "#10b981",
          weight: 3.5,
          dashArray: "6, 8",
          opacity: 0.85
        }
      ).addTo(map);
      routeLineRef.current = polyline;
    }

    // Ajustar zoom para que se vean ambos puntos en pantalla
    map.fitBounds(
      [
        [lat, lng],
        [dest.lat, dest.lng]
      ],
      { padding: [50, 50] }
    );
  };

  // Limpiar el origen y volver a centrar en la sede
  const handleClearOrigin = () => {
    if (originMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(originMarkerRef.current);
      originMarkerRef.current = null;
    }
    if (routeLineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    setOriginCoords(null);
    setOriginName("");
    setSelectedOriginDistrito("");
    setDistanceKm(null);

    const dest = getDestCoords();
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([dest.lat, dest.lng], dest.hasExact ? 16 : 14);
    }
  };

  // Seleccionar distrito desde el dropdown rápido
  const handleDistritoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dist = e.target.value;
    setSelectedOriginDistrito(dist);
    if (!dist) {
      handleClearOrigin();
      return;
    }
    const coords = obtenerCentroideDistrito(dist);
    if (coords) {
      handleSetOrigin(coords.lat, coords.lng, `Distrito de ${dist}`);
    }
  };

  if (!isOpen || !sede) return null;

  const dest = getDestCoords();

  // Generar link de Google Maps solo de la Sede
  const googleMapsUrl = dest.hasExact
    ? `https://www.google.com/maps/search/?api=1&query=${dest.lat},${dest.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${sede.direccion || ""}, ${sede.distrito || ""}, Lima, Peru`
      )}`;

  // Generar link de Google Maps en modo Transporte Público (Transit) para ver qué carros tomar
  const googleTransitUrl = originCoords
    ? `https://www.google.com/maps/dir/?api=1&origin=${originCoords.lat},${originCoords.lng}&destination=${dest.lat},${dest.lng}&travelmode=transit`
    : null;

  // Copiar solo la dirección
  const handleCopyAddress = () => {
    const text = `${sede.direccion || ""}, ${sede.distrito || ""}`.trim();
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Copiar formato listo para enviar por WhatsApp al postulante
  // REGLA: SIN CONTACTO EN SEDE (es confidencial de la empresa)
  const handleCopyPostulante = () => {
    const text = [
      `📍 *SEDE:* ${sede.nombre}`,
      sede.clientes?.razon_social ? `🏢 *CLIENTE:* ${sede.clientes.razon_social}` : null,
      `🏙️ *DISTRITO:* ${sede.distrito || "Por confirmar"}`,
      `🗺️ *DIRECCIÓN:* ${sede.direccion || "Por confirmar"}`,
      `📌 *UBICACIÓN GOOGLE MAPS:* ${googleMapsUrl}`,
      googleTransitUrl
        ? `🚌 *CÓMO LLEGAR (RUTAS DE CARROS EN TRANSPORTE PÚBLICO):*\n${googleTransitUrl}`
        : null
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
                {dest.hasExact ? (
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
                title="Copia los datos de la sede formateados para pegar en WhatsApp del candidato (sin contactos internos)"
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

          {/* Grilla Secundaria: Contacto en Sede y Supervisores (Exclusivo para la Empresa) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Contacto Administrativo */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Contacto en Sede (Uso Interno)
                </span>
                <span className="text-[9px] font-semibold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded">
                  Solo Empresa
                </span>
              </div>
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

          {/* Sección de Rutas en Transporte Público / Selector de Origen (Opción A) */}
          <div className="bg-gradient-to-br from-emerald-50/60 to-teal-50/40 border border-emerald-200/90 rounded-2xl p-4 sm:p-4.5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 shrink-0">
                  <Bus className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                    ¿Qué carros puedo tomar? (Transporte Público)
                  </h4>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Haz clic en el mapa donde vive el postulante o selecciona su distrito de partida:
                  </p>
                </div>
              </div>

              {/* Selector Rápido de Distrito de Origen */}
              <div className="w-full sm:w-60">
                <select
                  value={selectedOriginDistrito}
                  onChange={handleDistritoChange}
                  className="w-full text-xs font-bold text-slate-700 bg-white border border-emerald-200 rounded-xl px-3 py-2 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                >
                  <option value="">🏙️ Elegir distrito de partida...</option>
                  {LISTA_DISTRITOS_CANONICOS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Banner de Ruta Activa cuando hay Origen marcado */}
            {originCoords ? (
              <div className="bg-white rounded-xl border border-emerald-200 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800">
                      Desde: <strong className="text-emerald-700">{originName}</strong>
                    </span>
                    <span className="text-slate-400 mx-1.5">➔</span>
                    <span className="font-bold text-slate-800">
                      Hacia: <strong className="text-blue-700">{sede.nombre}</strong>
                    </span>
                    {distanceKm != null && (
                      <span className="ml-2 font-mono font-bold text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                        ~{formatearDistancia(distanceKm)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href={googleTransitUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-200 transition-all active:scale-95 cursor-pointer"
                    title="Abre Google Maps con todas las líneas de transporte público, micros, corredores y metro"
                  >
                    <Bus className="w-3.5 h-3.5" />
                    <span>Ver qué carros tomar</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    type="button"
                    onClick={handleClearOrigin}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Quitar punto de partida"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-emerald-800/80 bg-white/70 px-3 py-2 rounded-xl border border-emerald-100">
                <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  <strong>Tip:</strong> Puedes hacer clic directo sobre el mapa en cualquier avenida o barrio del postulante para colocar el pin verde y trazar las líneas de buses.
                </span>
              </div>
            )}
          </div>

          {/* Visor de Mapa Interactivo con Soporte de Origen (Verde) y Destino (Azul) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Mapa Interactivo (Haz clic para marcar el punto de partida)</span>
              </div>
              {dest.hasExact && (
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  GPS: {Number(dest.lat).toFixed(5)}, {Number(dest.lng).toFixed(5)}
                </span>
              )}
            </div>

            {/* Contenedor Leaflet */}
            <div className="w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-slate-300 shadow-inner relative z-0">
              <div ref={mapContainerRef} className="w-full h-full cursor-crosshair" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            {dest.hasExact
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
