import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { useAuth } from "../utils/authContext";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Building2,
  MapPin,
  Briefcase,
  Filter,
  RefreshCw,
  Search,
  ArrowUpRight,
  Share2,
  Target,
  Award,
  Percent,
  ChevronRight,
  Calendar,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  PhoneCall,
  Check,
  ArrowRight,
  Layers,
  BarChart3,
  X,
  Phone
} from "lucide-react";

export function DashboardPizarra() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const currentRole = role || localStorage.getItem("bax_role") || "admin";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Raw Data from Supabase
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);

  // Filter States
  const [filterCliente, setFilterCliente] = useState<string>("todos");
  const [filterSede, setFilterSede] = useState<string>("todos");
  const [filterCargo, setFilterCargo] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterPeriodo, setFilterPeriodo] = useState<string>("todo");
  const [searchTableQuery, setSearchTableQuery] = useState<string>("");

  // Location / Map Modal State
  const [locationModal, setLocationModal] = useState<{
    isOpen: boolean;
    sede: any | null;
    cliente: any | null;
  }>({
    isOpen: false,
    sede: null,
    cliente: null
  });

  const handleOpenLocationModal = (sedeObj: any, clienteObj?: any) => {
    const matchedSede = sedes.find(s => s.id === (sedeObj?.id || sedeObj?.sede_id)) || sedeObj;
    const matchedCliente = clienteObj || clientes.find(c => c.id === (matchedSede?.cliente_id || sedeObj?.cliente_id)) || matchedSede?.clientes;
    setLocationModal({
      isOpen: true,
      sede: matchedSede,
      cliente: matchedCliente
    });
  };

  // Load All Recruitment Data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [solRes, candRes, cliRes, sedRes, carRes, usRel] = await Promise.all([
        supabase
          .from("solicitudes_personal")
          .select(`
            *,
            sedes (
              id,
              nombre,
              direccion,
              distrito,
              cliente_id,
              clientes (
                id,
                razon_social,
                empresa_interna_id
              )
            ),
            cargos (id, nombre)
          `)
          .order("fecha_solicitud", { ascending: false }),
        supabase
          .from("candidatos")
          .select(`
            *,
            tipos_documento (id, codigo, nombre),
            cargos (id, nombre),
            sedes (id, nombre, cliente_id, clientes (id, razon_social)),
            solicitudes_personal (id, plazas_solicitadas, plazas_cubiertas, estado, fecha_solicitud)
          `)
          .order("creado_en", { ascending: false }),
        supabase.from("clientes").select("*").eq("activo", true).order("razon_social", { ascending: true }),
        supabase.from("sedes").select("*").eq("activo", true).order("nombre", { ascending: true }),
        supabase.from("cargos").select("*").eq("activo", true).order("nombre", { ascending: true }),
        supabase.from("usuario_sedes").select(`
          sede_id,
          usuarios (
            id,
            nombres,
            apellidos,
            username
          )
        `)
      ]);

      if (solRes.error) throw solRes.error;
      if (cliRes.error) throw cliRes.error;
      if (sedRes.error) throw sedRes.error;
      if (carRes.error) throw carRes.error;

      const relations = usRel?.data || [];
      const mergedSedes = (sedRes.data || []).map((sede: any) => ({
        ...sede,
        usuario_sedes: relations.filter((rel: any) => rel.sede_id === sede.id)
      }));

      setSolicitudes(solRes.data || []);
      setCandidatos(candRes.data || []);
      setClientes(cliRes.data || []);
      setSedes(mergedSedes);
      setCargos(carRes.data || []);
    } catch (err: any) {
      console.error("Error loading recruitment dashboard data:", err);
      setError(err.message || "Error al cargar los datos del dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter sedes dropdown based on selected client
  const availableSedes = useMemo(() => {
    if (filterCliente === "todos") return sedes;
    return sedes.filter((s) => s.cliente_id === parseInt(filterCliente));
  }, [filterCliente, sedes]);

  // Reset Sede filter when client changes if sede is not in that client
  useEffect(() => {
    if (filterCliente !== "todos" && filterSede !== "todos") {
      const exists = availableSedes.some((s) => s.id === parseInt(filterSede));
      if (!exists) setFilterSede("todos");
    }
  }, [filterCliente, availableSedes, filterSede]);

  // Helper: Filter by date period
  const filterByDate = (dateStr?: string) => {
    if (!dateStr || filterPeriodo === "todo") return true;
    const reqDate = new Date(dateStr);
    const now = new Date();

    if (filterPeriodo === "este_mes") {
      return (
        reqDate.getFullYear() === now.getFullYear() &&
        reqDate.getMonth() === now.getMonth()
      );
    }
    if (filterPeriodo === "ultimos_30_dias") {
      const diffMs = now.getTime() - reqDate.getTime();
      return diffMs <= 30 * 24 * 60 * 60 * 1000;
    }
    if (filterPeriodo === "ultimos_90_dias") {
      const diffMs = now.getTime() - reqDate.getTime();
      return diffMs <= 90 * 24 * 60 * 60 * 1000;
    }
    return true;
  };

  // Filtered Solicitudes
  const filteredSolicitudes = useMemo(() => {
    return solicitudes.filter((sol) => {
      // Cliente filter
      if (filterCliente !== "todos") {
        const cliId = sol.sedes?.cliente_id || sol.sedes?.clientes?.id;
        if (cliId !== parseInt(filterCliente)) return false;
      }
      // Sede filter
      if (filterSede !== "todos" && sol.sede_id !== parseInt(filterSede)) {
        return false;
      }
      // Cargo filter
      if (filterCargo !== "todos" && sol.cargo_id !== parseInt(filterCargo)) {
        return false;
      }
      // Estado filter
      if (filterEstado === "abiertas") {
        if ((sol.plazas_cubiertas || 0) >= (sol.plazas_solicitadas || 1) || sol.estado === "Completado" || sol.estado === "Cancelada") {
          return false;
        }
      } else if (filterEstado === "completadas") {
        if ((sol.plazas_cubiertas || 0) < (sol.plazas_solicitadas || 1) && sol.estado !== "Completado") {
          return false;
        }
      } else if (filterEstado !== "todos") {
        if (sol.estado !== filterEstado) return false;
      }
      // Periodo filter
      if (!filterByDate(sol.fecha_solicitud || sol.creado_en)) {
        return false;
      }
      return true;
    });
  }, [solicitudes, filterCliente, filterSede, filterCargo, filterEstado, filterPeriodo]);

  const filteredSolicitudIds = useMemo(() => {
    return new Set(filteredSolicitudes.map((s) => s.id));
  }, [filteredSolicitudes]);

  // Filtered Candidatos (matching filtered solicitudes or scope)
  const filteredCandidatos = useMemo(() => {
    return candidatos.filter((cand) => {
      // If linked to a vacancy, check if vacancy is in filtered set
      if (cand.solicitud_id && !filteredSolicitudIds.has(cand.solicitud_id)) {
        return false;
      }
      // If standalone candidate without vacancy link, apply direct filters
      if (!cand.solicitud_id) {
        if (filterCargo !== "todos" && cand.cargo_postula_id !== parseInt(filterCargo)) return false;
        if (filterSede !== "todos" && cand.sede_interes_id !== parseInt(filterSede)) return false;
      }
      // Date filter
      if (!filterByDate(cand.creado_en || cand.fecha_posible_ingreso)) {
        return false;
      }
      return true;
    });
  }, [candidatos, filteredSolicitudIds, filterCargo, filterSede, filterPeriodo]);

  // =========================================================================
  // METRICS COMPUTATION
  // =========================================================================

  // 1. Plazas & Vacantes
  const metrics = useMemo(() => {
    let totalPlazasPedidas = 0;
    let totalPlazasCubiertas = 0;
    let vacantesAbiertas = 0;
    let vacantesCompletadas = 0;
    let vacantesCriticasCount = 0;

    const criticalList: any[] = [];
    const now = new Date().getTime();

    filteredSolicitudes.forEach((sol) => {
      const pedidas = sol.plazas_solicitadas || 0;
      const cubiertas = sol.plazas_cubiertas || 0;
      totalPlazasPedidas += pedidas;
      totalPlazasCubiertas += cubiertas;

      const isClosed = cubiertas >= pedidas || sol.estado === "Completado" || sol.estado === "Cancelada";

      if (isClosed) {
        vacantesCompletadas++;
      } else {
        vacantesAbiertas++;
        // Calculate days open
        const solDate = new Date(sol.fecha_solicitud || sol.creado_en).getTime();
        const daysOpen = Math.max(0, Math.floor((now - solDate) / (1000 * 60 * 60 * 24)));
        
        // Count assigned active candidates
        const candCount = candidatos.filter(
          (c) => c.solicitud_id === sol.id && c.estado !== "Descartado" && c.estado !== "No se presento"
        ).length;

        const isCritica = daysOpen >= 7 || candCount === 0;

        if (isCritica) {
          vacantesCriticasCount++;
          criticalList.push({
            ...sol,
            daysOpen,
            candCount,
            plazasRestantes: Math.max(0, pedidas - cubiertas)
          });
        }
      }
    });

    const porcentajeCobertura = totalPlazasPedidas > 0 
      ? Math.min(100, Math.round((totalPlazasCubiertas / totalPlazasPedidas) * 100)) 
      : 0;

    // 2. Candidate Funnel Breakdown
    let countPostulantes = 0;
    let countEvaluacion = 0;
    let countAprobados = 0;
    let countPendienteAlta = 0;
    let countContratados = 0;
    let countDescartados = 0;
    let countNoSePresento = 0;

    filteredCandidatos.forEach((c) => {
      switch (c.estado) {
        case "Postulante":
          countPostulantes++;
          break;
        case "En Evaluacion":
          countEvaluacion++;
          break;
        case "Aprobado":
          countAprobados++;
          break;
        case "Pendiente de Alta":
          countPendienteAlta++;
          break;
        case "Contratado":
          countContratados++;
          break;
        case "Descartado":
          countDescartados++;
          break;
        case "No se presento":
          countNoSePresento++;
          break;
        default:
          countPostulantes++;
          break;
      }
    });

    const totalCandidatos = filteredCandidatos.length;
    const totalEnProceso = countPostulantes + countEvaluacion + countAprobados + countPendienteAlta;
    const ratioPostulantePorPlaza = (totalPlazasPedidas - totalPlazasCubiertas) > 0
      ? (totalEnProceso / (totalPlazasPedidas - totalPlazasCubiertas)).toFixed(1)
      : "0";

    const tasaEfectividad = totalCandidatos > 0
      ? Math.round((countContratados / totalCandidatos) * 100)
      : 0;

    const tasaDesercion = (countContratados + countNoSePresento + countPendienteAlta) > 0
      ? Math.round((countNoSePresento / (countContratados + countNoSePresento + countPendienteAlta)) * 100)
      : 0;

    return {
      totalPlazasPedidas,
      totalPlazasCubiertas,
      plazasRestantes: Math.max(0, totalPlazasPedidas - totalPlazasCubiertas),
      porcentajeCobertura,
      vacantesAbiertas,
      vacantesCompletadas,
      vacantesCriticasCount,
      criticalList: criticalList.sort((a, b) => b.daysOpen - a.daysOpen),
      totalCandidatos,
      totalEnProceso,
      ratioPostulantePorPlaza,
      countPostulantes,
      countEvaluacion,
      countAprobados,
      countPendienteAlta,
      countContratados,
      countDescartados,
      countNoSePresento,
      tasaEfectividad,
      tasaDesercion
    };
  }, [filteredSolicitudes, filteredCandidatos, candidatos]);

  // 3. Breakdown by Cargo
  const demandByCargo = useMemo(() => {
    const map: Record<string, { nombre: string; solicitadas: number; cubiertas: number; postulantes: number }> = {};

    filteredSolicitudes.forEach((s) => {
      const cargoName = s.cargos?.nombre || "Sin Cargo";
      if (!map[cargoName]) {
        map[cargoName] = { nombre: cargoName, solicitadas: 0, cubiertas: 0, postulantes: 0 };
      }
      map[cargoName].solicitadas += s.plazas_solicitadas || 0;
      map[cargoName].cubiertas += s.plazas_cubiertas || 0;
    });

    filteredCandidatos.forEach((c) => {
      const cargoName = c.cargos?.nombre || c.solicitudes_personal?.cargos?.nombre;
      if (cargoName && map[cargoName]) {
        map[cargoName].postulantes++;
      }
    });

    return Object.values(map).sort((a, b) => b.solicitadas - a.solicitadas);
  }, [filteredSolicitudes, filteredCandidatos]);

  // 4. Breakdown by Turno
  const breakdownTurno = useMemo(() => {
    const map: Record<string, number> = { "Día": 0, "Noche": 0, "Rotativo": 0, "Otro": 0 };
    filteredSolicitudes.forEach((s) => {
      const t = s.turno || "Rotativo";
      const pedidas = s.plazas_solicitadas || 0;
      if (map[t] !== undefined) {
        map[t] += pedidas;
      } else {
        map["Otro"] += pedidas;
      }
    });
    return map;
  }, [filteredSolicitudes]);

  // 5. Breakdown by Fuentes de Reclutamiento
  const breakdownFuentes = useMemo(() => {
    const map: Record<string, { total: number; contratados: number }> = {};
    filteredCandidatos.forEach((c) => {
      const f = c.fuente_reclutamiento || "Directo";
      if (!map[f]) map[f] = { total: 0, contratados: 0 };
      map[f].total++;
      if (c.estado === "Contratado") {
        map[f].contratados++;
      }
    });

    return Object.entries(map)
      .map(([fuente, val]) => ({
        fuente,
        total: val.total,
        contratados: val.contratados,
        tasa: val.total > 0 ? Math.round((val.contratados / val.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredCandidatos]);

  // 6. Table Search and Filtering for Requerimientos
  const tableData = useMemo(() => {
    const q = searchTableQuery.toLowerCase().trim();
    return filteredSolicitudes.filter((s) => {
      if (!q) return true;
      const clienteName = s.sedes?.clientes?.razon_social?.toLowerCase() || "";
      const sedeName = s.sedes?.nombre?.toLowerCase() || "";
      const cargoName = s.cargos?.nombre?.toLowerCase() || "";
      const turno = s.turno?.toLowerCase() || "";
      const estado = s.estado?.toLowerCase() || "";
      return (
        clienteName.includes(q) ||
        sedeName.includes(q) ||
        cargoName.includes(q) ||
        turno.includes(q) ||
        estado.includes(q)
      );
    });
  }, [filteredSolicitudes, searchTableQuery]);

  const handleGoToPizarra = () => {
    navigate("/rrhh/pizarra");
  };

  return (
    <div className="flex flex-col h-full space-y-5 overflow-y-auto pr-1 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between flex-shrink-0 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Pizarra Digital / Analítica de Reclutamiento
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
              <Sparkles className="w-3 h-3 text-blue-500" />
              Métricas en Tiempo Real
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            Dashboard de Reclutamiento y Requerimientos
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Monitoreo en tiempo real del cumplimiento de vacantes, avance del pipeline de selección, ingresos laborales y alertas operativas.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-50 active:scale-95 transition-all shadow-sm cursor-pointer"
            title="Actualizar métricas"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>

          <button
            onClick={handleGoToPizarra}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" />
            Ir a Pizarra de Vacantes
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter className="w-4 h-4 text-blue-600" />
            Filtros de Análisis
          </div>
          {(filterCliente !== "todos" || filterSede !== "todos" || filterCargo !== "todos" || filterEstado !== "todos" || filterPeriodo !== "todo") && (
            <button
              onClick={() => {
                setFilterCliente("todos");
                setFilterSede("todos");
                setFilterCargo("todos");
                setFilterEstado("todos");
                setFilterPeriodo("todo");
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline"
            >
              Restablecer Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Cliente Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Cliente / Cuenta</label>
            <select
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            >
              <option value="todos">Todos los Clientes ({clientes.length})</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razon_social}
                </option>
              ))}
            </select>
          </div>

          {/* Sede Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Sede / Operación</label>
            <select
              value={filterSede}
              onChange={(e) => setFilterSede(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            >
              <option value="todos">Todas las Sedes ({availableSedes.length})</option>
              {availableSedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Cargo Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Cargo Requerido</label>
            <select
              value={filterCargo}
              onChange={(e) => setFilterCargo(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            >
              <option value="todos">Todos los Cargos ({cargos.length})</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Estado Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Estado de Requerimiento</label>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            >
              <option value="todos">Todos los Estados</option>
              <option value="abiertas">🔥 Activas / Abiertas (Pendientes & Parciales)</option>
              <option value="completadas">✅ Completadas / Cubiertas</option>
              <option value="Pendiente">Solo Pendientes</option>
              <option value="Parcial">Solo Parciales</option>
            </select>
          </div>

          {/* Periodo Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Periodo Temporal</label>
            <select
              value={filterPeriodo}
              onChange={(e) => setFilterPeriodo(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            >
              <option value="todo">Histórico Completo</option>
              <option value="este_mes">Este Mes</option>
              <option value="ultimos_30_dias">Últimos 30 Días</option>
              <option value="ultimos_90_dias">Últimos 90 Días</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Plazas Solicitadas vs Cubiertas */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Demanda de Plazas</span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {metrics.totalPlazasCubiertas}
              </span>
              <span className="text-sm font-bold text-slate-400">
                de {metrics.totalPlazasPedidas} solicitadas
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  metrics.porcentajeCobertura >= 80
                    ? "bg-emerald-500"
                    : metrics.porcentajeCobertura >= 40
                    ? "bg-amber-500"
                    : "bg-blue-600"
                }`}
                style={{ width: `${metrics.porcentajeCobertura}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 font-semibold">
              <span>{metrics.porcentajeCobertura}% cubierto</span>
              <span className="text-amber-600 font-bold">{metrics.plazasRestantes} por cubrir</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Vacantes Abiertas & Urgentes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vacantes Activas</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight">
                {metrics.vacantesAbiertas}
              </span>
              <span className="text-xs font-bold text-slate-400">requerimientos</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px]">
              {metrics.vacantesCriticasCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-extrabold bg-red-50 text-red-700 border border-red-200">
                  <AlertTriangle className="w-3 h-3" />
                  {metrics.vacantesCriticasCount} críticas (&gt;7d o sin postulantes)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="w-3 h-3" />
                  Todas atendidas en plazo
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              {metrics.vacantesCompletadas} vacantes ya cerradas con éxito
            </div>
          </div>
        </div>

        {/* KPI 3: Postulantes en Proceso Activo */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pipeline Activo</span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-indigo-600 tracking-tight">
                {metrics.totalEnProceso}
              </span>
              <span className="text-xs font-bold text-slate-400">en evaluación</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 font-semibold bg-indigo-50/60 px-2.5 py-1.5 rounded-lg border border-indigo-100">
              <span>Ratio Cobertura:</span>
              <span className="font-extrabold text-indigo-700">{metrics.ratioPostulantePorPlaza} cand. / plaza</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              Total histórico: {metrics.totalCandidatos} postulantes captados
            </div>
          </div>
        </div>

        {/* KPI 4: Ingresos Formalizados (Altas) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ingresos Efectivos</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
                {metrics.countContratados}
              </span>
              <span className="text-xs font-bold text-slate-400">altas oficiales</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 font-semibold bg-emerald-50/60 px-2.5 py-1.5 rounded-lg border border-emerald-100">
              <span>Efectividad de Conversión:</span>
              <span className="font-extrabold text-emerald-700">{metrics.tasaEfectividad}%</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              {metrics.countPendienteAlta} listos en bandeja de RRHH
            </div>
          </div>
        </div>

        {/* KPI 5: Tasa de Deserción / No Asistencia */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deserción / No Asistió</span>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
              <UserX className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight">
                {metrics.countNoSePresento}
              </span>
              <span className="text-xs font-bold text-slate-400">no asistieron</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 font-semibold bg-rose-50/60 px-2.5 py-1.5 rounded-lg border border-rose-100">
              <span>Tasa de Inasistencia:</span>
              <span className="font-extrabold text-rose-700">{metrics.tasaDesercion}%</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              {metrics.countDescartados} descartados en entrevista/perfil
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: EMBUDO DE SELECCIÓN (FUNNEL) & MONITOR DE VACANTES CRÍTICAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recruitment Funnel (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Embudo de Selección y Reclutamiento</h2>
                  <p className="text-xs text-slate-500">Flujo paso a paso de los candidatos desde captación hasta ingreso en planilla.</p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                {metrics.totalCandidatos} Candidatos Totales
              </span>
            </div>

            {/* Funnel Steps */}
            <div className="space-y-2.5 mt-2">
              {/* Step 1: Postulantes */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 relative overflow-hidden">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-black">1</span>
                    Postulantes Registrados (Captación Inicial)
                  </span>
                  <span className="font-extrabold text-slate-900 font-mono text-sm">{metrics.countPostulantes}</span>
                </div>
                <div className="w-full bg-slate-200/60 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-500 h-full rounded-full transition-all"
                    style={{ width: `${metrics.totalCandidatos > 0 ? (metrics.countPostulantes / metrics.totalCandidatos) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Step 2: En Evaluacion */}
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 relative overflow-hidden">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="font-bold text-blue-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-black">2</span>
                    En Evaluación / Entrevista
                  </span>
                  <span className="font-extrabold text-blue-700 font-mono text-sm">{metrics.countEvaluacion}</span>
                </div>
                <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all"
                    style={{ width: `${metrics.totalCandidatos > 0 ? (metrics.countEvaluacion / metrics.totalCandidatos) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Step 3: Aprobados */}
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 relative overflow-hidden">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="font-bold text-indigo-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center text-[10px] font-black">3</span>
                    Aprobados / Aptos para Inicio
                  </span>
                  <span className="font-extrabold text-indigo-700 font-mono text-sm">{metrics.countAprobados}</span>
                </div>
                <div className="w-full bg-indigo-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${metrics.totalCandidatos > 0 ? (metrics.countAprobados / metrics.totalCandidatos) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Step 4: Pendientes de Alta */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 relative overflow-hidden">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="font-bold text-amber-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-[10px] font-black">4</span>
                    Pendientes de Alta (Pase a Bandeja RRHH)
                  </span>
                  <span className="font-extrabold text-amber-700 font-mono text-sm">{metrics.countPendienteAlta}</span>
                </div>
                <div className="w-full bg-amber-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{ width: `${metrics.totalCandidatos > 0 ? (metrics.countPendienteAlta / metrics.totalCandidatos) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Step 5: Ingresos Contratados */}
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 relative overflow-hidden">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="font-bold text-emerald-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-[10px] font-black">5</span>
                    Ingresos Formalizados (Contratados en Planilla)
                  </span>
                  <span className="font-extrabold text-emerald-700 font-mono text-sm">{metrics.countContratados}</span>
                </div>
                <div className="w-full bg-emerald-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${metrics.totalCandidatos > 0 ? (metrics.countContratados / metrics.totalCandidatos) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Funnel Footnote: Descarte vs Inasistencia */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                Descartados en perfil: <strong className="text-slate-700">{metrics.countDescartados}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                No se presentó: <strong className="text-rose-700">{metrics.countNoSePresento}</strong>
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">
              Conversión Global: <strong className="text-emerald-600">{metrics.tasaEfectividad}%</strong>
            </span>
          </div>
        </div>

        {/* Critical Vacancies Monitor (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Monitor de Vacantes Críticas</h2>
                  <p className="text-xs text-slate-500">Requerimientos con más de 7 días o sin candidatos asignados.</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {metrics.criticalList.length} en alerta
              </span>
            </div>

            {/* List of critical items */}
            {metrics.criticalList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">¡Excelente trabajo!</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  No hay requerimientos críticos pendientes. Todas las vacantes activas cuentan con postulantes o tienen menos de 7 días.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {metrics.criticalList.slice(0, 5).map((crit) => (
                  <div
                    key={crit.id}
                    className="p-3 bg-red-50/40 rounded-xl border border-red-100 hover:border-red-200 transition-all flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900 truncate">
                          {crit.sedes?.clientes?.razon_social || "Cliente"}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                          {crit.sedes?.nombre || "Sede"}
                        </span>
                      </div>
                      <p className="text-xs font-extrabold text-blue-700 truncate">
                        {crit.cargos?.nombre || "Cargo no especificado"}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1 font-semibold text-amber-700">
                          <Target className="w-3 h-3" />
                          Faltan: {crit.plazasRestantes} de {crit.plazas_solicitadas}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-red-600">
                          <Clock className="w-3 h-3" />
                          {crit.daysOpen} días abierta
                        </span>
                        {crit.candCount === 0 && (
                          <span className="px-1.5 py-0.2 rounded font-extrabold bg-red-600 text-white text-[9px]">
                            0 postulantes
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={handleGoToPizarra}
                      className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-xs cursor-pointer flex-shrink-0 transition-all"
                      title="Ir a gestionar esta vacante en la pizarra"
                    >
                      Postular
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Prioridad para el equipo de Reclutamiento</span>
            <button
              onClick={handleGoToPizarra}
              className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Ver todas en Pizarra <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: DESGLOSE POR CARGO, TURNO Y FUENTES DE RECLUTAMIENTO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Demanda por Cargo */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                Demanda por Cargo
              </h3>
              <span className="text-xs text-slate-400 font-semibold">{demandByCargo.length} cargos</span>
            </div>

            {demandByCargo.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No hay requerimientos en este filtro.</p>
            ) : (
              <div className="space-y-3 mt-3 max-h-[220px] overflow-y-auto pr-1">
                {demandByCargo.slice(0, 5).map((item, idx) => {
                  const pct = metrics.totalPlazasPedidas > 0 ? Math.round((item.solicitadas / metrics.totalPlazasPedidas) * 100) : 0;
                  return (
                    <div key={idx} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-700">
                        <span className="truncate max-w-[170px]" title={item.nombre}>{item.nombre}</span>
                        <span className="font-mono text-slate-900 font-bold">{item.cubiertas}/{item.solicitadas} pl. ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Distribución por Turno */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Distribución por Turno
              </h3>
              <span className="text-xs text-slate-400 font-semibold">Total: {metrics.totalPlazasPedidas} pl.</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-blue-700 block">Día</span>
                <span className="text-xl font-black text-blue-900">{breakdownTurno["Día"] || 0}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">plazas</span>
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-purple-700 block">Noche</span>
                <span className="text-xl font-black text-purple-900">{breakdownTurno["Noche"] || 0}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">plazas</span>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-amber-700 block">Rotativo</span>
                <span className="text-xl font-black text-amber-900">{breakdownTurno["Rotativo"] || 0}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">plazas</span>
              </div>
            </div>

            <div className="mt-4 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 flex items-center justify-between">
              <span>Mayor demanda operativa:</span>
              <strong className="text-slate-800">
                {Object.entries(breakdownTurno).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || "Día"}
              </strong>
            </div>
          </div>
        </div>

        {/* Efectividad por Fuente de Reclutamiento */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-600" />
                Fuentes de Reclutamiento
              </h3>
              <span className="text-xs text-slate-400 font-semibold">{breakdownFuentes.length} canales</span>
            </div>

            {breakdownFuentes.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No hay datos de canales en este filtro.</p>
            ) : (
              <div className="space-y-2.5 mt-2 max-h-[220px] overflow-y-auto pr-1">
                {breakdownFuentes.map((f, i) => (
                  <div key={i} className="p-2 bg-slate-50 rounded-lg border border-slate-200/70 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-800">{f.fuente}</span>
                      <span className="text-[10px] text-slate-400 block">{f.total} postulantes captados</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-emerald-700 block">{f.contratados} contratados</span>
                      <span className="text-[10px] font-bold text-slate-500">{f.tasa}% éxito</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: TABLA DETALLADA DE AVANCE DE REQUERIMIENTOS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Table Header & Search */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Avance Detallado de Requerimientos y Cobertura
            </h2>
            <p className="text-xs text-slate-500">Listado consolidado de solicitudes de personal con estado del pipeline en vivo.</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por Cliente, Sede o Cargo..."
              value={searchTableQuery}
              onChange={(e) => setSearchTableQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 font-medium text-slate-700"
            />
          </div>
        </div>

        {/* Table Content */}
        {tableData.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <LayoutDashboard className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No se encontraron requerimientos con los filtros aplicados.</p>
            <p className="text-xs text-slate-400">Intenta cambiar los filtros superiores o el término de búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Cliente / Cuenta</th>
                  <th className="py-3 px-4">Sede / Centro de Trabajo</th>
                  <th className="py-3 px-4">Cargo & Turno</th>
                  <th className="py-3 px-4 text-center">Plazas</th>
                  <th className="py-3 px-4">Avance de Cobertura</th>
                  <th className="py-3 px-4 text-center">Pipeline Activo</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {tableData.map((sol) => {
                  const pedidas = sol.plazas_solicitadas || 0;
                  const cubiertas = sol.plazas_cubiertas || 0;
                  const pct = pedidas > 0 ? Math.min(100, Math.round((cubiertas / pedidas) * 100)) : 0;
                  const isCompleted = cubiertas >= pedidas && pedidas > 0;

                  // Active candidates for this vacancy
                  const activeCandCount = candidatos.filter(
                    (c) => c.solicitud_id === sol.id && c.estado !== "Descartado" && c.estado !== "No se presento"
                  ).length;

                  return (
                    <tr key={sol.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-400">
                        #{sol.id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {sol.sedes?.clientes?.razon_social || "Cliente no especificado"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          F. Solicitud: {sol.fecha_solicitud || "-"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleOpenLocationModal(sol.sedes, sol.sedes?.clientes)}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-700 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-300 px-2 py-1 rounded-lg font-semibold transition-all group/loc cursor-pointer text-left"
                          title="Ver dirección y mapa satelital de la sede"
                        >
                          <MapPin className="w-3.5 h-3.5 text-blue-500 group-hover/loc:scale-110 transition-transform flex-shrink-0" />
                          <span className="truncate max-w-[170px]">{sol.sedes?.nombre || "Sede Principal"}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover/loc:text-blue-600 opacity-70 flex-shrink-0" />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-blue-700">
                          {sol.cargos?.nombre || "Cargo no definido"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Turno: <span className="font-semibold text-slate-700">{sol.turno || "Rotativo"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="font-black text-slate-900 text-sm">{cubiertas}</span>
                        <span className="text-slate-400 text-xs"> / {pedidas}</span>
                      </td>
                      <td className="py-3 px-4 min-w-[160px]">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className={isCompleted ? "text-emerald-700" : "text-slate-700"}>{pct}%</span>
                          <span className="text-slate-400 text-[10px]">
                            {isCompleted ? "Completo" : `Faltan ${Math.max(0, pedidas - cubiertas)}`}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isCompleted
                                ? "bg-emerald-500"
                                : pct >= 50
                                ? "bg-amber-500"
                                : "bg-blue-600"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                            activeCandCount > 0
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Users className="w-3 h-3" />
                          {activeCandCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3 stroke-[3]" />
                            Cubierta
                          </span>
                        ) : cubiertas > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                            Parcial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={handleGoToPizarra}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          Ver Pizarra
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* SEDE LOCATION & MAP MODAL                           */}
      {/* ==================================================== */}
      {locationModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-fade-in p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-7 w-full max-w-2xl border border-slate-100 transform animate-slide-in relative overflow-hidden max-h-[90vh] flex flex-col">
            {/* Top decorative accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center ring-4 ring-blue-50/50 shadow-inner">
                  <MapPin className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    Ubicación y Centro de Trabajo
                  </span>
                  <h3 className="font-heading text-lg font-black text-slate-900 leading-tight">
                    {locationModal.sede?.nombre || "Sede / Operación"}
                  </h3>
                  <p className="text-xs font-semibold text-blue-700">
                    {locationModal.cliente?.razon_social || locationModal.sede?.clientes?.razon_social || "Cliente no especificado"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocationModal({ isOpen: false, sede: null, cliente: null })}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Dirección Registrada
                  </span>
                  <p className="text-xs font-bold text-slate-800 flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <span>{locationModal.sede?.direccion || "Sin dirección registrada en Estructura Comercial"}</span>
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Distrito / Ciudad
                  </span>
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span>{locationModal.sede?.distrito || "No especificado"}</span>
                  </p>
                </div>
              </div>

              {(() => {
                const matchedSedeObj = sedes.find(s => s.id === (locationModal.sede?.id || locationModal.sede?.sede_id)) || locationModal.sede;
                const supervisors = matchedSedeObj?.usuario_sedes?.map((us: any) => us.usuarios).filter(Boolean) || [];

                return (
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-slate-600 font-semibold">Supervisor(a) de Sede:</span>
                      {supervisors.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {supervisors.map((sup: any, idx: number) => (
                            <span key={sup.id || idx} className="font-bold text-slate-800 bg-white px-2.5 py-0.5 rounded-lg border border-blue-200 shadow-2xs">
                              {sup.nombres ? `${sup.nombres} ${sup.apellidos || ""}`.trim() : (sup.username || "Supervisor")}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-semibold text-slate-400 italic">Sin supervisor asignado en Estructura Comercial</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Map Iframe Embed */}
              <div className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 relative">
                <iframe
                  title="Mapa de Sede"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(
                    `${locationModal.sede?.direccion || locationModal.sede?.nombre || ""}, ${locationModal.sede?.distrito || ""} Perú`
                  )}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setLocationModal({ isOpen: false, sede: null, cliente: null })}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${locationModal.sede?.direccion || locationModal.sede?.nombre || ""}, ${locationModal.sede?.distrito || ""} Perú`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl font-bold text-xs shadow-md shadow-blue-200 transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir en Google Maps
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
