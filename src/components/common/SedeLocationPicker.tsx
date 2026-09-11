import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Search,
  Crosshair,
  Clipboard,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  RotateCcw
} from "lucide-react";
import {
  Coordenadas,
  geocodificarDireccion,
  obtenerCentroideDistrito,
  parsearCoordenadasGoogleMaps
} from "../../utils/geoUtils";

interface SedeLocationPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  direccion?: string;
  distrito?: string;
  onCoordinatesChange: (coords: { lat: number | null; lng: number | null }) => void;
  readOnly?: boolean;
}

// Icono personalizado SVG para el pin de la Sede
const createSedeIcon = () => {
  return L.divIcon({
    className: "custom-sede-pin",
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
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        cursor: grab;
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

export function SedeLocationPicker({
  initialLat,
  initialLng,
  direccion = "",
  distrito = "",
  onCoordinatesChange,
  readOnly = false
}: SedeLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [coords, setCoords] = useState<Coordenadas | null>(() => {
    if (initialLat != null && initialLng != null && !isNaN(initialLat) && !isNaN(initialLng) && initialLat !== 0) {
      return { lat: initialLat, lng: initialLng };
    }
    return null;
  });

  const [pasteInput, setPasteInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Inicializar o centrar mapa
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Coordenadas iniciales por defecto: Lima Centro o coords pasadas o distrito
    let defaultLat = -12.046374;
    let defaultLng = -77.042793;
    let initialZoom = 13;

    if (coords) {
      defaultLat = coords.lat;
      defaultLng = coords.lng;
      initialZoom = 16;
    } else if (distrito) {
      const distCoords = obtenerCentroideDistrito(distrito);
      if (distCoords) {
        defaultLat = distCoords.lat;
        defaultLng = distCoords.lng;
        initialZoom = 14;
      }
    }

    // Crear mapa si no existe
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(map);

      // Evento de clic en mapa para posicionar el pin
      if (!readOnly) {
        map.on("click", (e: L.LeafletMouseEvent) => {
          updateMarkerPosition(e.latlng.lat, e.latlng.lng);
        });
      }

      mapInstanceRef.current = map;
    }

    // Colocar o actualizar marcador
    if (coords) {
      if (!markerRef.current) {
        const marker = L.marker([coords.lat, coords.lng], {
          icon: createSedeIcon(),
          draggable: !readOnly
        }).addTo(mapInstanceRef.current);

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          updateMarkerPosition(pos.lat, pos.lng);
        });

        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng([coords.lat, coords.lng]);
      }
      mapInstanceRef.current.setView([coords.lat, coords.lng], mapInstanceRef.current.getZoom());
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Actualizar posición del marcador y notificar al padre
  const updateMarkerPosition = (lat: number, lng: number, zoomTo: boolean = false) => {
    const roundedLat = Math.round(lat * 1000000) / 1000000;
    const roundedLng = Math.round(lng * 1000000) / 1000000;
    const newCoords = { lat: roundedLat, lng: roundedLng };
    
    setCoords(newCoords);
    onCoordinatesChange(newCoords);
    setSearchMsg({ text: "Ubicación fijada con precisión en el mapa.", type: "success" });

    if (mapInstanceRef.current) {
      if (!markerRef.current) {
        const marker = L.marker([roundedLat, roundedLng], {
          icon: createSedeIcon(),
          draggable: !readOnly
        }).addTo(mapInstanceRef.current);

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          updateMarkerPosition(pos.lat, pos.lng);
        });

        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng([roundedLat, roundedLng]);
      }

      if (zoomTo) {
        mapInstanceRef.current.setView([roundedLat, roundedLng], 16, { animate: true });
      }
    }
  };

  // Autodetectar por la dirección y distrito escritos
  const handleAutodetectar = async () => {
    const searchTarget = [direccion, distrito].filter(Boolean).join(", ");
    if (!searchTarget) {
      setSearchMsg({ text: "Ingresa primero una dirección o distrito para buscar.", type: "error" });
      return;
    }

    setIsSearching(true);
    setSearchMsg(null);

    try {
      const results = await geocodificarDireccion(searchTarget, distrito);
      if (results.length > 0) {
        const best = results[0];
        updateMarkerPosition(best.lat, best.lng, true);
        setSearchMsg({
          text: `Sede ubicada cerca de: ${best.displayName.substring(0, 60)}... Puedes arrastrar el pin si deseas calibrarlo.`,
          type: "success"
        });
      } else {
        // Fallback a distrito
        const distCoords = obtenerCentroideDistrito(distrito);
        if (distCoords) {
          updateMarkerPosition(distCoords.lat, distCoords.lng, true);
          setSearchMsg({
            text: `No se halló la calle exacta, pero se centró en el distrito de ${distrito}. Mueve el pin al punto exacto.`,
            type: "info"
          });
        } else {
          setSearchMsg({ text: "No se encontraron coordenadas para esta dirección. Haz clic en el mapa para fijarla.", type: "error" });
        }
      }
    } catch (e) {
      setSearchMsg({ text: "Error en la geocodificación. Fija el pin manualmente haciendo clic en el mapa.", type: "error" });
    } finally {
      setIsSearching(false);
    }
  };

  // Procesar enlace o texto de Google Maps pegado
  const handlePasteGoogleMaps = () => {
    if (!pasteInput.trim()) return;

    const parsed = parsearCoordenadasGoogleMaps(pasteInput);
    if (parsed) {
      updateMarkerPosition(parsed.lat, parsed.lng, true);
      setSearchMsg({ text: "Coordenadas extraídas exitosamente desde Google Maps.", type: "success" });
      setPasteInput("");
    } else {
      setSearchMsg({
        text: "Formato no reconocido. Pega un enlace de Google Maps (ej. https://maps.app.goo.gl/... o https://google.com/maps/@-12.09,-77.03) o números como '-12.0977, -77.0344'.",
        type: "error"
      });
    }
  };

  // Limpiar coordenadas
  const handleLimpiar = () => {
    setCoords(null);
    onCoordinatesChange({ lat: null, lng: null });
    if (markerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    setSearchMsg(null);
  };

  return (
    <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Geolocalización y Coordenadas Exactas
          </span>
        </div>

        {coords ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[11px] font-bold font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={handleLimpiar}
                className="text-[11px] text-slate-400 hover:text-red-500 font-semibold underline cursor-pointer"
                title="Quitar coordenadas"
              >
                Quitar
              </button>
            )}
          </div>
        ) : (
          <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
            Sin calibrar (se usará distrito)
          </span>
        )}
      </div>

      {/* Barra de herramientas para calibración rápida */}
      {!readOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Opción 1: Autodetectar por texto */}
          <button
            type="button"
            onClick={handleAutodetectar}
            disabled={isSearching}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-blue-50/80 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold shadow-2xs hover:border-blue-300 transition-all cursor-pointer disabled:opacity-50"
          >
            <Search className={`w-3.5 h-3.5 ${isSearching ? "animate-spin" : ""}`} />
            {isSearching ? "Buscando en mapa..." : "Autodetectar por Dirección"}
          </button>

          {/* Opción 2: Pegar enlace o coords de Google Maps */}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handlePasteGoogleMaps();
                }
              }}
              placeholder="Pegar link o coords de Google Maps..."
              className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handlePasteGoogleMaps}
              className="p-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Cargar coordenadas de Google Maps"
            >
              <Clipboard className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mensaje de retroalimentación */}
      {searchMsg && (
        <div
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
            searchMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : searchMsg.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}
        >
          {searchMsg.type === "success" ? (
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          <span>{searchMsg.text}</span>
        </div>
      )}

      {/* Contenedor del Mapa Leaflet */}
      <div className="relative w-full h-52 sm:h-56 rounded-xl overflow-hidden border border-slate-300/80 shadow-inner bg-slate-100 z-0">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Guía flotante sobre el mapa */}
        {!readOnly && (
          <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs text-[10px] font-semibold text-slate-600 flex items-center gap-1.5 pointer-events-none">
            <Crosshair className="w-3 h-3 text-blue-600" />
            <span>Haz clic en el mapa o arrastra el pin para ubicar la entrada exacta</span>
          </div>
        )}
      </div>

      {coords && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span className="font-medium">
            Ubicación calibrada para cálculo en el radar de postulantes.
          </span>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold"
          >
            <span>Ver en Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
