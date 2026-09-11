import React, { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  X,
  MapPin,
  Search,
  Crosshair,
  Sliders,
  Briefcase,
  Clock,
  Building2,
  ExternalLink,
  UserPlus,
  Navigation,
  Compass,
  AlertCircle,
  CheckCircle2,
  Filter,
  Users,
  Footprints,
  ChevronRight,
  ChevronDown,
  Edit3
} from "lucide-react";
import {
  Coordenadas,
  DICCIONARIO_DISTRITOS_PERU,
  LISTA_DISTRITOS_CANONICOS,
  normalizarTexto,
  calcularDistanciaKm,
  formatearDistancia,
  generarEnlaceRutaGoogleMaps,
  obtenerCentroideDistrito,
  obtenerCoordenadasSede
} from "../../utils/geoUtils";

interface RadarVacantesModalProps {
  isOpen: boolean;
  onClose: () => void;
  vacantes: any[];
  sedes: any[];
  cargos: any[];
  clientes?: any[];
  onSelectVacanteForPostulante: (vacante: any, candidateLocation?: { direccion: string; distrito?: string }) => void;
  onCalibrateSede?: (sede: any) => void;
}

// Iconos personalizados para Leaflet con HTML y estilos embebidos seguros
const createPostulanteIcon = () => {
  return L.divIcon({
    className: "custom-postulante-pin",
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
      ">
        <div style="
          position: absolute;
          width: 40px;
          height: 40px;
          background: rgba(37, 99, 235, 0.25);
          border-radius: 50%;
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #1e40af, #3b82f6);
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 6px 16px rgba(30, 64, 175, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg style="transform: rotate(45deg); width: 18px; height: 18px; color: #ffffff;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44]
  });
};

const createSedePinIcon = (isWalkable: boolean, plazasLibres: number) => {
  const bgColor = isWalkable
    ? "linear-gradient(135deg, #059669, #10b981)"
    : "linear-gradient(135deg, #0284c7, #38bdf8)";
  const shadowColor = isWalkable ? "rgba(5, 150, 105, 0.4)" : "rgba(2, 132, 199, 0.4)";

  return L.divIcon({
    className: "custom-sede-bubble",
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 36px;
        height: 36px;
        padding: 0 6px;
        background: ${bgColor};
        border: 2.5px solid #ffffff;
        border-radius: 18px;
        box-shadow: 0 4px 12px ${shadowColor};
        color: #ffffff;
        font-family: ui-sans-serif, system-ui, sans-serif;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
        transition: transform 0.2s ease;
      ">
        <svg style="width: 14px; height: 14px; margin-right: 3px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span>${plazasLibres} vac.</span>
      </div>
    `,
    iconSize: [42, 36],
    iconAnchor: [21, 18],
    popupAnchor: [0, -20]
  });
};

export function RadarVacantesModal({
  isOpen,
  onClose,
  vacantes,
  sedes,
  cargos,
  clientes = [],
  onSelectVacanteForPostulante,
  onCalibrateSede
}: RadarVacantesModalProps) {
  // Estados de entrada (Por defecto: Distrito + Referencia)
  const [inputMode, setInputMode] = useState<"distrito" | "mapa">("distrito");
  const [distritoInput, setDistritoInput] = useState<string>("Los Olivos");
  const [distritoSeleccionado, setDistritoSeleccionado] = useState<string>("Los Olivos");
  const [referenciaInput, setReferenciaInput] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Coordenadas del postulante (inicializa con Los Olivos o Lima Centro)
  const [postulanteCoords, setPostulanteCoords] = useState<Coordenadas | null>(() => {
    return obtenerCentroideDistrito("Los Olivos") || { lat: -12.046374, lng: -77.042793 };
  });
  const [ubicacionNombre, setUbicacionNombre] = useState<string>("Distrito de Los Olivos, Lima/Perú");

  // Filtros de búsqueda
  const [radioKm, setRadioKm] = useState<number>(5); // 5km por defecto
  const [selectedCargoId, setSelectedCargoId] = useState<string>("todos");
  const [selectedTurno, setSelectedTurno] = useState<string>("todos");
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  // Referencias para el mapa Leaflet
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const postulanteMarkerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const sedeMarkersRef = useRef<L.Marker[]>([]);

  // Cerrar el dropdown del buscador de distrito al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lista de distritos filtrados según lo que escribe el usuario en vivo (Búsqueda inteligente sin tildes)
  const distritosFiltrados = useMemo(() => {
    if (!distritoInput.trim()) return LISTA_DISTRITOS_CANONICOS;
    const q = normalizarTexto(distritoInput);
    return LISTA_DISTRITOS_CANONICOS.filter(d => normalizarTexto(d).includes(q));
  }, [distritoInput]);

  // Filtrar vacantes activas y calcular distancias respecto al postulante
  const matchingVacantes = useMemo(() => {
    if (!postulanteCoords) return [];

    return vacantes
      .map(vac => {
        // Encontrar sede correspondiente
        const matchedSede = sedes.find(s => s.id === vac.sede_id) || vac.sedes;
        const sedeCoords = obtenerCoordenadasSede(matchedSede);
        
        // Encontrar cliente correspondiente de forma robusta
        const clienteId = matchedSede?.cliente_id || vac.cliente_id || vac.sedes?.cliente_id;
        const matchedCliente = clientes?.find(cl => cl.id === clienteId) || matchedSede?.clientes || vac.sedes?.clientes;
        const clienteNombre = matchedCliente?.razon_social || matchedCliente?.nombre || "";
        
        const distanciaKm = calcularDistanciaKm(
          postulanteCoords.lat,
          postulanteCoords.lng,
          sedeCoords.lat,
          sedeCoords.lng
        );

        const plazasSolicitadas = Number(vac.plazas_solicitadas || 1);
        const plazasCubiertas = Number(vac.plazas_cubiertas || 0);
        const plazasLibres = Math.max(0, plazasSolicitadas - plazasCubiertas);

        return {
          ...vac,
          matchedSede,
          matchedCliente,
          clienteNombre,
          sedeCoords,
          distanciaKm,
          plazasLibres,
          isWalkable: distanciaKm <= 2.5
        };
      })
      .filter(item => {
        // Solo solicitudes abiertas con plazas pendientes
        if (item.estado === "Cancelada" || item.estado === "Completada" || item.plazasLibres <= 0) {
          return false;
        }

        // Filtro por Radio (si no es 0 / sin límite)
        if (radioKm > 0 && item.distanciaKm > radioKm) {
          return false;
        }

        // Filtro por Cargo
        if (selectedCargoId !== "todos" && String(item.cargo_id) !== String(selectedCargoId)) {
          return false;
        }

        // Filtro por Turno
        if (selectedTurno !== "todos" && item.turno !== selectedTurno) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.distanciaKm - b.distanciaKm);
  }, [vacantes, sedes, clientes, postulanteCoords, radioKm, selectedCargoId, selectedTurno]);

  // Inicializar o actualizar el mapa Leaflet
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = postulanteCoords ? postulanteCoords.lat : -11.961389;
      const initialLng = postulanteCoords ? postulanteCoords.lng : -77.070556;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 13,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(map);

      // Clic en mapa para reposicionar postulante
      map.on("click", (e: L.LeafletMouseEvent) => {
        setPostulanteCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        setUbicacionNombre(`Punto fijado en mapa (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`);
      });

      mapInstanceRef.current = map;
    }

    // Forzar actualización de tamaño tras render de modal
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);

    return () => {
      // Limpiar mapa al desmontar modal
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        postulanteMarkerRef.current = null;
        radiusCircleRef.current = null;
        sedeMarkersRef.current = [];
      }
    };
  }, [isOpen]);

  // Actualizar marcadores y círculo de radio en el mapa cuando cambien las coordenadas o vacantes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !postulanteCoords) return;

    // 1. Marcador del postulante
    if (!postulanteMarkerRef.current) {
      postulanteMarkerRef.current = L.marker([postulanteCoords.lat, postulanteCoords.lng], {
        icon: createPostulanteIcon(),
        draggable: true,
        zIndexOffset: 1000
      }).addTo(map);

      postulanteMarkerRef.current.on("dragend", () => {
        const pos = postulanteMarkerRef.current!.getLatLng();
        setPostulanteCoords({ lat: pos.lat, lng: pos.lng });
        setUbicacionNombre(`Ubicación ajustada manualmente`);
      });
    } else {
      postulanteMarkerRef.current.setLatLng([postulanteCoords.lat, postulanteCoords.lng]);
    }

    // 2. Círculo de cobertura (radio en km)
    if (radiusCircleRef.current) {
      map.removeLayer(radiusCircleRef.current);
      radiusCircleRef.current = null;
    }

    if (radioKm > 0) {
      radiusCircleRef.current = L.circle([postulanteCoords.lat, postulanteCoords.lng], {
        radius: radioKm * 1000,
        color: "#2563eb",
        weight: 1.5,
        fillColor: "#3b82f6",
        fillOpacity: 0.12,
        dashArray: "4, 6"
      }).addTo(map);
    }

    // 3. Marcadores de Sedes con Vacantes
    sedeMarkersRef.current.forEach(m => map.removeLayer(m));
    sedeMarkersRef.current = [];

    matchingVacantes.forEach(item => {
      const marker = L.marker([item.sedeCoords.lat, item.sedeCoords.lng], {
        icon: createSedePinIcon(item.isWalkable, item.plazasLibres)
      }).addTo(map);

      const popupHtml = `
        <div style="font-family: sans-serif; min-width: 200px; padding: 4px;">
          ${item.clienteNombre ? `<div style="font-size: 10px; font-weight: 800; color: #2563eb; text-transform: uppercase; margin-bottom: 2px;">${item.clienteNombre}</div>` : ''}
          <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #0f172a;">${item.matchedSede?.nombre || "Sede"}</h4>
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b;"><strong>${item.cargos?.nombre || "Vacante"}</strong> - ${item.turno}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            <span style="font-size: 11px; font-weight: bold; color: #059669;">${formatearDistancia(item.distanciaKm)}</span>
            <span style="font-size: 11px; font-weight: bold; color: #2563eb;">${item.plazasLibres} plazas libres</span>
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml);
      sedeMarkersRef.current.push(marker);
    });

    // Centrar vista en el postulante
    map.setView([postulanteCoords.lat, postulanteCoords.lng], radioKm <= 3 ? 14 : radioKm <= 10 ? 13 : 11, {
      animate: true
    });
  }, [postulanteCoords, radioKm, matchingVacantes]);

  // Manejar selección de distrito desde el buscador inteligente
  const handleSelectDistrito = (dist: string) => {
    setDistritoSeleccionado(dist);
    setDistritoInput(dist);
    setIsDropdownOpen(false);
    if (!dist) return;

    const coords = obtenerCentroideDistrito(dist);
    if (coords) {
      setPostulanteCoords(coords);
      const label = referenciaInput.trim()
        ? `${referenciaInput.trim()} (${dist})`
        : `Distrito de ${dist}, Lima/Perú`;
      setUbicacionNombre(label);
      setGeocodeError(null);
    }
  };

  // Acción: Postular directamente a la vacante
  const handlePostularVacante = (vacante: any) => {
    const ref = referenciaInput.trim();
    const dist = distritoSeleccionado.trim();
    const finalDir = ref && dist ? `${ref}, ${dist}` : ref || dist || "Ubicación según radar";
    
    onSelectVacanteForPostulante(vacante, {
      direccion: finalDir,
      distrito: dist || vacante.matchedSede?.distrito
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col border border-slate-100 overflow-hidden transform animate-slide-in">
        
        {/* ==================================================== */}
        {/* HEADER */}
        {/* ==================================================== */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white flex items-center justify-between flex-shrink-0 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-blue-500/10 blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-2xl shadow-inner flex items-center justify-center">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight font-heading">
                  Radar de Vacantes Cercanas
                </h2>
                <span className="bg-blue-500/30 text-blue-200 border border-blue-400/40 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Geomatching
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Ubica el distrito y referencia del postulante y obtén al instante las mejores vacantes ordenadas por cercanía.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ==================================================== */}
        {/* CONTROLES DE ENTRADA Y FILTROS */}
        {/* ==================================================== */}
        <div 
          className="bg-slate-50 border-b border-slate-200/80 p-4 space-y-3 flex-shrink-0 relative"
          style={{ zIndex: 100 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end relative" style={{ zIndex: 40 }}>
            
            {/* 1. Selector de Distrito con Autocompletado + Referencia */}
            <div className="lg:col-span-6 space-y-2 relative" style={{ zIndex: 50 }}>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Ubicación del Postulante:</span>
                <div className="inline-flex bg-slate-200/70 p-0.5 rounded-lg ml-auto">
                  <button
                    type="button"
                    onClick={() => setInputMode("distrito")}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      inputMode === "distrito" ? "bg-white text-blue-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Distrito + Referencia
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("mapa")}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      inputMode === "mapa" ? "bg-white text-blue-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Clic en Mapa
                  </button>
                </div>
              </div>

              {inputMode === "distrito" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative" style={{ zIndex: 50 }}>
                  
                  {/* Buscador inteligente de Distrito con Autocompletado */}
                  <div className="relative" ref={dropdownRef} style={{ zIndex: 60 }}>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={distritoInput}
                        onChange={(e) => {
                          setDistritoInput(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        placeholder="Escribe o busca distrito (ej. Surco, Los Olivos)..."
                        className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-2xs"
                      />
                      {distritoInput ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDistritoInput("");
                            setDistritoSeleccionado("");
                            setIsDropdownOpen(true);
                          }}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <ChevronDown className="absolute right-2.5 top-2.5 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                      )}
                    </div>

                    {/* Menú flotante de distritos filtrados */}
                    {isDropdownOpen && (
                      <div 
                        className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-100"
                        style={{ zIndex: 99999 }}
                      >
                        <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-100 flex items-center justify-between">
                          <span>Distritos ({distritosFiltrados.length})</span>
                          <span className="text-slate-400 lowercase font-normal">selecciona uno</span>
                        </div>
                        {distritosFiltrados.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400 font-medium">
                            No se encontró ningún distrito coincidente.
                          </div>
                        ) : (
                          distritosFiltrados.map((dist) => (
                            <button
                              key={dist}
                              type="button"
                              onClick={() => handleSelectDistrito(dist)}
                              className={`w-full text-left px-3.5 py-2.5 text-xs font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer flex items-center justify-between ${
                                distritoSeleccionado === dist
                                  ? "bg-blue-50/90 text-blue-700 font-bold"
                                  : "text-slate-700"
                              }`}
                            >
                              <span>{dist}</span>
                              {distritoSeleccionado === dist && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Input de Referencia o Calle */}
                  <input
                    type="text"
                    value={referenciaInput}
                    onChange={(e) => {
                      setReferenciaInput(e.target.value);
                      if (distritoSeleccionado) {
                        const label = e.target.value.trim()
                          ? `${e.target.value.trim()} (${distritoSeleccionado})`
                          : `Distrito de ${distritoSeleccionado}, Lima/Perú`;
                        setUbicacionNombre(label);
                      }
                    }}
                    placeholder="Referencia (ej. Palacio de la Juventud / Estación Angamos)"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-2xs"
                  />
                </div>
              ) : (
                <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-800 font-medium flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>Haz clic en cualquier punto del mapa inferior o arrastra el pin azul para ubicar la casa del postulante.</span>
                </div>
              )}
            </div>

            {/* 2. Selector de Radio en Kilómetros */}
            <div className="lg:col-span-3 space-y-1.5 relative" style={{ zIndex: 10 }}>
              <label className="text-xs font-bold text-slate-600 block flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                Radio de Cobertura:
              </label>
              <div className="grid grid-cols-5 gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                {[2, 5, 10, 15, 0].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadioKm(r)}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      radioKm === r
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {r === 0 ? "Todo" : `${r}km`}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Filtros adicionales de Cargo / Turno */}
            <div className="lg:col-span-3 space-y-1.5 relative" style={{ zIndex: 10 }}>
              <label className="text-xs font-bold text-slate-600 block flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                Filtrar por Cargo:
              </label>
              <select
                value={selectedCargoId}
                onChange={(e) => setSelectedCargoId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-2xs cursor-pointer"
              >
                <option value="todos">Todos los puestos ({vacantes.length})</option>
                {cargos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Feedback de Ubicación actual del radar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs relative" style={{ zIndex: 10 }}>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-bold text-slate-400">Punto de Referencia:</span>
              <span className="font-semibold text-slate-800 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-1.5 max-w-md truncate">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                {ubicacionNombre}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg text-[11px]">
                {matchingVacantes.length} vacantes encontradas {radioKm > 0 ? `a ≤ ${radioKm} km` : ""}
              </span>
            </div>
          </div>

          {geocodeError && (
            <div className="p-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{geocodeError}</span>
            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* BODY: SPLIT VIEW (MAPA + LISTA DE RESULTADOS) */}
        {/* ==================================================== */}
        <div 
          className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[380px] overflow-hidden relative"
          style={{ zIndex: 1 }}
        >
          
          {/* MAPA INTERACTIVO (LEAFLET / OSM) */}
          <div 
            className="lg:col-span-6 border-b lg:border-b-0 lg:border-r border-slate-200 relative bg-slate-100 min-h-[260px] lg:min-h-full"
            style={{ zIndex: 1 }}
          >
            <div ref={mapContainerRef} className="w-full h-full min-h-[260px]" />
            
            {/* Leyenda flotante sobre el mapa */}
            <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs p-2.5 rounded-2xl border border-slate-200/80 shadow-lg text-[11px] font-semibold text-slate-700 space-y-1 pointer-events-none">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-600 border border-white shadow-2xs"></div>
                <span>Domicilio del Postulante</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-600 border border-white shadow-2xs"></div>
                <span>Sede Caminable (&le; 2.5 km)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-sky-500 border border-white shadow-2xs"></div>
                <span>Sede en Radio de Transporte</span>
              </div>
            </div>
          </div>

          {/* LISTA DE VACANTES ORDENADAS POR PROXIMIDAD */}
          <div className="lg:col-span-6 flex flex-col bg-slate-50/50 overflow-hidden">
            <div className="p-3 bg-white border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Vacantes Ordenadas por Distancia
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                De más cercana a más lejana
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {matchingVacantes.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-3 bg-white rounded-2xl border border-dashed border-slate-200">
                  <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl max-w-max mx-auto border border-slate-100">
                    <Compass className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">No hay vacantes en este radio</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Prueba aumentando el radio a 10 km, 15 km o selecciona "Todo" para ver todas las sedes activas de la empresa.
                  </p>
                  <button
                    type="button"
                    onClick={() => setRadioKm(15)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Ampliar a 15 km
                  </button>
                </div>
              ) : (
                matchingVacantes.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`bg-white rounded-2xl p-4 border transition-all hover:shadow-md ${
                      item.isWalkable
                        ? "border-emerald-200/80 hover:border-emerald-400"
                        : "border-slate-200/80 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-extrabold ${
                              item.isWalkable
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            <Navigation className="w-3 h-3" />
                            {formatearDistancia(item.distanciaKm)}
                          </span>

                          {item.isWalkable && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100/70 text-emerald-800 rounded-md text-[10px] font-black uppercase tracking-wider">
                              <Footprints className="w-3 h-3" />
                              Caminable
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[11px] font-bold">
                            🔥 {item.plazasLibres} plazas libres
                          </span>
                        </div>

                        {/* Puesto / Cargo */}
                        <h3 className="text-base font-extrabold text-slate-900 pt-0.5 leading-snug">
                          {item.cargos?.nombre || "Cargo no especificado"}
                        </h3>

                        {/* Cliente y Sede Destacados */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                          {/* Cliente Badge */}
                          <div className="inline-flex items-center gap-1.5 font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/80 shadow-2xs">
                            <Building2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="truncate max-w-[220px]" title={item.clienteNombre || "Cliente no especificado"}>
                              {item.clienteNombre || "Cliente no especificado"}
                            </span>
                          </div>

                          {/* Sede */}
                          <div className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100/90 px-2.5 py-1 rounded-lg border border-slate-200/70">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Sede:</span>
                            <span className="text-slate-900 font-bold">{item.matchedSede?.nombre || "Sede"}</span>
                          </div>
                        </div>

                        {/* Dirección */}
                        <p className="text-[11px] text-slate-500 flex items-start gap-1.5 pt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                          <span className="truncate max-w-md">{item.matchedSede?.direccion || "Sin dirección exacta"}, {item.matchedSede?.distrito || ""}</span>
                        </p>
                      </div>

                      <div className="text-right space-y-1 flex-shrink-0">
                        <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold border border-slate-200/50">
                          Turno: {item.turno || "Rotativo"}
                        </span>
                      </div>
                    </div>

                    {/* Acciones para la vacante */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <a
                          href={generarEnlaceRutaGoogleMaps(
                            postulanteCoords.lat,
                            postulanteCoords.lng,
                            item.sedeCoords.lat,
                            item.sedeCoords.lng,
                            item.matchedSede?.nombre
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver Ruta
                        </a>

                        {onCalibrateSede && (
                          <button
                            type="button"
                            onClick={() => onCalibrateSede(item.matchedSede)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer ml-2"
                            title="Ajustar ubicación de esta sede si está desfasada"
                          >
                            <Edit3 className="w-3 h-3" />
                            Calibrar Sede
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePostularVacante(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-200 transition-all cursor-pointer active:scale-95"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Postular a esta Sede
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* ==================================================== */}
        {/* FOOTER */}
        {/* ==================================================== */}
        <div className="px-6 py-3 bg-slate-100/90 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Cálculo matemático inmediato por cercanía geográfica (Haversine).</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer border border-slate-200"
          >
            Cerrar Radar
          </button>
        </div>

      </div>
    </div>
  );
}
