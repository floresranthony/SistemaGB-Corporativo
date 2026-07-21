import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { 
  Calendar, 
  Search, 
  Plus, 
  Trash2, 
  Clock, 
  Check, 
  X, 
  RefreshCw, 
  AlertCircle, 
  Printer, 
  Building, 
  User, 
  Filter, 
  ArrowUpDown,
  Download,
  Info,
  CalendarDays
} from "lucide-react";

export function ControlVacaciones() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data lists
  const [personas, setPersonas] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [regimenes, setRegimenes] = useState<any[]>([]);
  
  // Selection / Modal state
  const [selectedPersona, setSelectedPersona] = useState<any | null>(null);
  const [activeVinculo, setActiveVinculo] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vacationForm, setVacationForm] = useState({
    fecha_inicio: "",
    fecha_fin: "",
    notas: ""
  });
  
  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos"); // todos, critico, proximo, normal
  const [filterSede, setFilterSede] = useState("todas");
  const [filterEmpresa, setFilterEmpresa] = useState("todas");
  const [filterRegimen, setFilterRegimen] = useState("todos");
  const [filterCliente, setFilterCliente] = useState("todos");
  const [filterVinculoEstado, setFilterVinculoEstado] = useState("Activo"); // Activo, Todos, Inactivo
  
  // Printing state
  const [printingRequest, setPrintingRequest] = useState(false);

  // Load everything
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch lookups
      const [sedesRes, empresasRes, regRes] = await Promise.all([
        supabase.from("sedes").select("id, nombre, cliente_id, clientes(id, razon_social, empresa_interna_id)").eq("activo", true),
        supabase.from("empresas_internas").select("id, razon_social").eq("activo", true),
        supabase.from("regimenes_laborales").select("id, nombre, dias_vacaciones")
      ]);
      
      setSedes(sedesRes.data || []);
      setEmpresas(empresasRes.data || []);
      setRegimenes(regRes.data || []);

      // 2. Fetch personas with vinculos and vacations
      const { data: resData, error: dbError } = await supabase
        .from("personas")
        .select(`
          id,
          nombres,
          apellidos,
          numero_documento,
          correo,
          fecha_ingreso,
          vinculos_laborales (
            id,
            estado,
            empresa_interna_id,
            sede_id,
            cargo_id,
            regimen_laboral_id,
            creado_en,
            regimenes_laborales (id, nombre, dias_vacaciones),
            cargos (id, nombre),
            empresas_internas (id, razon_social),
            sedes (id, nombre, cliente_id, clientes (id, razon_social)),
            contratos (
              id,
              fecha_inicio,
              estado
            ),
            vacaciones_historico (
              id,
              fecha_inicio,
              fecha_fin,
              dias_calendario,
              notas,
              creado_en
            )
          )
        `)
        .order("apellidos", { ascending: true });

      if (dbError) throw dbError;
      setPersonas(resData || []);
    } catch (err: any) {
      console.error("Error loading vacations data:", err);
      setError(err.message || "Error al cargar la información vacacional.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper: Get fallback entry date based on first contract
  const getFechaIngresoFallback = (vinculosList: any[], person: any): string | null => {
    if (person?.fecha_ingreso) return person.fecha_ingreso;
    const dates = vinculosList
      .flatMap((v: any) => v.contratos || [])
      .map((c: any) => c.fecha_inicio)
      .filter(Boolean);
    if (dates.length === 0) return null;
    dates.sort();
    return dates[0];
  };

  // Helper: Format date
  const formatDMY = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Helper: Calculate individual vacations metrics
  const getVacationMetrics = (person: any, v: any) => {
    if (!person || !v) return { years: 0, earned: 0, taken: 0, balance: 0, periodos: 0, status: "normal", startDateStr: "", isFromContract: false, daysPerYear: 30 };

    // Para el cálculo continuo de vacaciones, se debe usar la fecha de ingreso inicial de la relación laboral
    const startDateStr = person.fecha_ingreso || getFechaIngresoFallback(person.vinculos_laborales || [], person) || v.creado_en;
    const isFromContract = false;

    const startDate = new Date(startDateStr);
    const today = new Date();
    
    // Years of service
    const diffTime = today.getTime() - startDate.getTime();
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    const years = Math.max(0, parseFloat(diffYears.toFixed(2)));

    // Days earned according to regime
    const daysPerYear = v.regimenes_laborales?.dias_vacaciones || 30;
    const earned = Math.floor(years * daysPerYear);

    // Days taken
    const taken = v.vacaciones_historico?.reduce((sum: number, vac: any) => sum + (vac.dias_calendario || 0), 0) ?? 0;

    // Balance
    const balance = Math.max(0, earned - taken);
    const periodos = parseFloat((balance / daysPerYear).toFixed(2));

    // Status: critical if >= 2 periods, proximo if >= 2 periods - 10 days
    const limit = daysPerYear * 2;
    let status = "normal";
    if (balance >= limit) {
      status = "critico";
    } else if (balance >= limit - 10) {
      status = "proximo";
    }

    return { years, earned, taken, balance, periodos, status, daysPerYear, startDateStr, isFromContract };
  };

  const uniqueClientes = React.useMemo(() => {
    const map = new Map<number, string>();
    sedes.forEach(s => {
      if (s.clientes) {
        if (filterEmpresa === "todas" || String(s.clientes.empresa_interna_id) === filterEmpresa) {
          map.set(s.clientes.id, s.clientes.razon_social);
        }
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sedes, filterEmpresa]);

  const filteredSedesForDropdown = React.useMemo(() => {
    return sedes.filter(s => {
      if (filterEmpresa !== "todas" && s.clientes && String(s.clientes.empresa_interna_id) !== filterEmpresa) {
        return false;
      }
      if (filterCliente !== "todos" && String(s.cliente_id) !== filterCliente) {
        return false;
      }
      return true;
    });
  }, [sedes, filterEmpresa, filterCliente]);

  // Process and compute rows with active job link
  const processedRows = React.useMemo(() => {
    return personas.flatMap(p => {
      const links = p.vinculos_laborales || [];
      
      // If filtering by specific link state
      const filteredLinks = links.filter((l: any) => {
        if (filterVinculoEstado === "Todos") return true;
        return l.estado === filterVinculoEstado;
      });

      return filteredLinks.map((v: any) => {
        const metrics = getVacationMetrics(p, v);
        return {
          persona: p,
          vinculo: v,
          metrics
        };
      });
    });
  }, [personas, filterVinculoEstado]);

  // Apply filters
  const filteredRows = React.useMemo(() => {
    return processedRows.filter(row => {
      // 1. Text Search (Nombres, Apellidos, DNI)
      const q = searchQuery.toLowerCase();
      if (q) {
        const fullName = `${row.persona.nombres} ${row.persona.apellidos}`.toLowerCase();
        const dni = row.persona.numero_documento.toLowerCase();
        const cargo = (row.vinculo.cargos?.nombre || "").toLowerCase();
        if (!fullName.includes(q) && !dni.includes(q) && !cargo.includes(q)) return false;
      }

      // 2. Alert Status
      if (filterStatus !== "todos") {
        if (row.metrics.status !== filterStatus) return false;
      }

      // 3. Sede
      if (filterSede !== "todas") {
        if (row.vinculo.sede_id?.toString() !== filterSede) return false;
      }

      // 4. Empresa
      if (filterEmpresa !== "todas") {
        if (row.vinculo.empresa_interna_id?.toString() !== filterEmpresa) return false;
      }

      // 5. Régimen Laboral
      if (filterRegimen !== "todos") {
        if (row.vinculo.regimenes_laborales?.nombre !== filterRegimen) return false;
      }

      // 6. Cliente
      if (filterCliente !== "todos") {
        if (!row.vinculo.sedes || String(row.vinculo.sedes.cliente_id) !== filterCliente) return false;
      }

      return true;
    });
  }, [processedRows, searchQuery, filterStatus, filterSede, filterEmpresa, filterRegimen, filterCliente]);

  // General KPIs based on ACTIVE status rows
  const stats = React.useMemo(() => {
    const activeRows = processedRows.filter(r => r.vinculo.estado === "Activo");
    const total = activeRows.length;
    const criticos = activeRows.filter(r => r.metrics.status === "critico").length;
    const proximos = activeRows.filter(r => r.metrics.status === "proximo").length;
    const totalGozados = activeRows.reduce((acc, curr) => acc + curr.metrics.taken, 0);

    return { total, criticos, proximos, totalGozados };
  }, [processedRows]);

  // Open detail panel / modal
  const handleOpenDetails = (row: any) => {
    setSelectedPersona(row.persona);
    setActiveVinculo(row.vinculo);
    setVacationForm({
      fecha_inicio: new Date().toISOString().split("T")[0],
      fecha_fin: "",
      notas: ""
    });
    setIsModalOpen(true);
  };

  // Register Vacation Goce
  const handleSaveVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacationForm.fecha_inicio || !vacationForm.fecha_fin) {
      alert("Por favor completa las fechas de inicio y fin.");
      return;
    }

    const start = new Date(vacationForm.fecha_inicio);
    const end = new Date(vacationForm.fecha_fin);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays <= 0) {
      alert("La fecha de fin debe ser posterior o igual a la de inicio.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        vinculo_laboral_id: activeVinculo.id,
        fecha_inicio: vacationForm.fecha_inicio,
        fecha_fin: vacationForm.fecha_fin,
        dias_calendario: diffDays,
        notas: vacationForm.notas
      };

      const { error: insertError } = await supabase
        .from("vacaciones_historico")
        .insert([payload]);

      if (insertError) throw insertError;

      // Close modal or reload
      alert("Descanso vacacional registrado con éxito.");
      await loadData();
      
      // Update selected states to reflect changes in details panel
      const updatedPersona = personas.find(p => p.id === selectedPersona.id);
      if (updatedPersona) {
        const updatedVinculo = updatedPersona.vinculos_laborales.find((v: any) => v.id === activeVinculo.id);
        setSelectedPersona(updatedPersona);
        setActiveVinculo(updatedVinculo);
      }
      
      setVacationForm({
        fecha_inicio: new Date().toISOString().split("T")[0],
        fecha_fin: "",
        notas: ""
      });

    } catch (err: any) {
      console.error("Error inserting vacation:", err);
      alert("Error al registrar vacaciones: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Vacation Goce
  const handleDeleteVacation = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este descanso vacacional? Los días se sumarán de vuelta al saldo del colaborador.")) {
      return;
    }

    setLoading(true);
    try {
      const { error: dbErr } = await supabase
        .from("vacaciones_historico")
        .delete()
        .eq("id", id);

      if (dbErr) throw dbErr;

      alert("Registro de vacaciones eliminado.");
      await loadData();

      // Update selected states
      const updatedPersona = personas.find(p => p.id === selectedPersona.id);
      if (updatedPersona) {
        const updatedVinculo = updatedPersona.vinculos_laborales.find((v: any) => v.id === activeVinculo.id);
        setSelectedPersona(updatedPersona);
        setActiveVinculo(updatedVinculo);
      }

    } catch (e: any) {
      console.error("Error deleting vacation:", e);
      alert("Error al eliminar vacaciones: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintRequest = () => {
    setPrintingRequest(true);
    setTimeout(() => {
      setPrintingRequest(false);
      window.print();
    }, 1200);
  };

  // Calculate metrics for selected person's active vinculo
  const selectedMetrics = activeVinculo ? getVacationMetrics(selectedPersona, activeVinculo) : null;

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 flex-shrink-0 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Recursos Humanos / Control Interno
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-8 h-8 text-emerald-600" />
            Control de Vacaciones
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Monitorea el balance de descansos físicos del personal y previene contingencias legales por acumulación excesiva de periodos vacacionales.
          </p>
        </div>
        
        <button
          onClick={loadData}
          disabled={loading}
          className="self-start md:self-auto inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Recargar Datos
        </button>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <User className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Monitoreados Activos</span>
            <span className="text-2xl font-black text-slate-800">{stats.total}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-red-50 text-red-650 rounded-xl">
            <AlertCircle className="w-6 h-6 text-red-600 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Estado Crítico (2+ Per.)</span>
            <span className="text-2xl font-black text-red-600">{stats.criticos}</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-55 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Próximos a 2 Periodos</span>
            <span className="text-2xl font-black text-amber-650 text-amber-600">{stats.proximos}</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Días Gozados (Suma Activos)</span>
            <span className="text-2xl font-black text-blue-650 text-blue-600">{stats.totalGozados} d</span>
          </div>
        </div>

      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Nombre, Apellidos, DNI o Cargo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-100 focus:outline-none bg-white font-medium text-slate-700"
            />
          </div>
          
          {/* Main quick filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setFilterVinculoEstado("Activo")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer ${
                  filterVinculoEstado === "Activo"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 bg-transparent"
                }`}
              >
                Activos
              </button>
              <button
                onClick={() => setFilterVinculoEstado("Todos")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer ${
                  filterVinculoEstado === "Todos"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 bg-transparent"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterVinculoEstado("Inactivo")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer ${
                  filterVinculoEstado === "Inactivo"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 bg-transparent"
                }`}
              >
                Cesados
              </button>
            </div>
          </div>
        </div>

        {/* Dropdowns filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
          
          {/* Filter Empresa */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filtrar por Empresa</label>
            <select
              value={filterEmpresa}
              onChange={(e) => {
                const nextEmp = e.target.value;
                setFilterEmpresa(nextEmp);
                if (nextEmp !== "todas") {
                  const belongs = sedes.some(s => s.clientes && String(s.clientes.id) === filterCliente && String(s.clientes.empresa_interna_id) === nextEmp);
                  if (!belongs) {
                    setFilterCliente("todos");
                  }
                  const SedeBelongs = sedes.some(s => String(s.id) === filterSede && s.clientes && String(s.clientes.empresa_interna_id) === nextEmp);
                  if (!SedeBelongs) {
                    setFilterSede("todas");
                  }
                }
              }}
              className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="todas">Todas las Empresas</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.razon_social}</option>
              ))}
            </select>
          </div>

          {/* Filter Cliente */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filtrar por Cliente</label>
            <select
              value={filterCliente}
              onChange={(e) => {
                const nextCli = e.target.value;
                setFilterCliente(nextCli);
                if (nextCli !== "todos") {
                  const belongs = sedes.some(s => String(s.id) === filterSede && String(s.cliente_id) === nextCli);
                  if (!belongs) {
                    setFilterSede("todas");
                  }
                }
              }}
              className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos los Clientes</option>
              {uniqueClientes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Filter Sede */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filtrar por Sede</label>
            <select
              value={filterSede}
              onChange={(e) => setFilterSede(e.target.value)}
              className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="todas">Todas las Sedes</option>
              {filteredSedesForDropdown.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>

          {/* Filter Régimen */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Régimen Laboral</label>
            <select
              value={filterRegimen}
              onChange={(e) => setFilterRegimen(e.target.value)}
              className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos los Regímenes</option>
              {regimenes.map(r => (
                <option key={r.id} value={r.nombre}>{r.nombre}</option>
              ))}
            </select>
          </div>

          {/* Filter Status Alert */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estado de Alerta</label>
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-600 focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos los Estados</option>
                <option value="critico">🚨 Crítico (2+ periodos)</option>
                <option value="proximo">⚠️ Próximo a 2 periodos</option>
                <option value="normal">✅ Óptimo / Normal</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col flex-1 min-h-[400px]">
        <div className="overflow-x-auto overflow-y-auto flex-1 relative">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                <th className="px-6 py-4 bg-slate-50">Colaborador</th>
                <th className="px-6 py-4 bg-slate-50">Empresa / Puesto</th>
                <th className="px-6 py-4 bg-slate-50">Ingreso / Régimen</th>
                <th className="px-6 py-4 text-center bg-slate-50">Años Serv.</th>
                <th className="px-6 py-4 text-center bg-slate-100">Ganados</th>
                <th className="px-6 py-4 text-center bg-slate-100">Gozados</th>
                <th className="px-6 py-4 text-center bg-slate-100">Pendientes</th>
                <th className="px-6 py-4 bg-slate-50">Alerta Legal</th>
                <th className="px-6 py-4 text-right print:hidden bg-slate-50">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading && personas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                      <p className="text-slate-450 text-xs">Cargando saldos vacacionales...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Calendar className="w-10 h-10 mx-auto text-slate-350" />
                      <p className="font-semibold text-slate-700 text-xs">No se encontraron resultados</p>
                      <p className="text-[11px] text-slate-400">Prueba ajustando los filtros de búsqueda o el tipo de alerta legal.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const p = row.persona;
                  const v = row.vinculo;
                  const m = row.metrics;
                  
                  return (
                    <tr key={`${p.id}-${v.id}`} className="hover:bg-slate-50/30 transition-colors">
                      {/* Person detail */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{p.apellidos}, {p.nombres}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">DNI: {p.numero_documento}</div>
                      </td>
                      
                      {/* Job detail */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{v.cargos?.nombre || "Sin Puesto"}</div>
                        <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-2 mt-0.5">
                          <span>{v.empresas_internas?.razon_social || "Grupo Bax"}</span>
                          <span className="text-slate-200">|</span>
                          <span className="font-bold text-slate-500">{v.sedes?.nombre || "N/A"}</span>
                        </div>
                      </td>

                      {/* Regimen */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="font-mono">{formatDMY(m.startDateStr)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{v.regimenes_laborales?.nombre || "General (30d)"}</div>
                      </td>

                      {/* Years of service */}
                      <td className="px-6 py-4 text-center font-semibold font-mono">
                        {m.years} a.
                      </td>

                      {/* Ganados */}
                      <td className="px-6 py-4 text-center font-bold bg-slate-50/20 font-mono">
                        {m.earned} d
                      </td>

                      {/* Gozados */}
                      <td className="px-6 py-4 text-center font-bold text-blue-600 bg-slate-50/20 font-mono">
                        {m.taken} d
                      </td>

                      {/* Pendientes */}
                      <td className="px-6 py-4 text-center font-black text-slate-900 bg-slate-50/20 font-mono">
                        {m.balance} d
                      </td>

                      {/* Alert State Badge */}
                      <td className="px-6 py-4">
                        {m.status === "critico" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-red-50 text-red-750 border border-red-200 text-red-700 animate-pulse">
                            <AlertCircle className="w-3 h-3" />
                            CRÍTICO (2+ Per)
                          </span>
                        )}
                        {m.status === "proximo" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-500" />
                            PRÓXIMO LIMITE
                          </span>
                        )}
                        {m.status === "normal" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <Check className="w-3 h-3 text-emerald-500" />
                            ÓPTIMO
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right print:hidden">
                        <button
                          onClick={() => handleOpenDetails(row)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                        >
                          Ver Historial
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Count footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-55 bg-slate-50/30 text-xs text-slate-450 font-semibold flex items-center justify-between">
          <span>Mostrando {filteredRows.length} de {processedRows.length} registros laborales.</span>
        </div>
      </div>

      {/* Selected Person Details Modal (Drawer) */}
      {isModalOpen && selectedPersona && activeVinculo && selectedMetrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-slide-in border border-slate-100 flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-extrabold text-slate-800">
                    Saldos y Descansos: {selectedPersona.apellidos}, {selectedPersona.nombres}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {activeVinculo.cargos?.nombre || "Sin puesto"} &bull; {activeVinculo.sedes?.nombre || "Sin sede"} &bull; DNI: {selectedPersona.numero_documento}
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-655 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
              
              {/* Metrics side (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                <div className={`p-4 rounded-xl border space-y-4 ${
                  selectedMetrics.status === "critico" ? "bg-red-50/20 border-red-200" : "bg-slate-50/20 border-slate-150"
                }`}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Cálculo Vacacional ({activeVinculo.regimenes_laborales?.nombre || "General"})
                  </div>
                  
                  {selectedMetrics.status === "critico" && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-[11px] flex gap-1.5 items-start">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>Acumulación Crítica:</strong> Registra {selectedMetrics.balance} días pendientes. Requiere goce vacacional urgente.
                      </div>
                    </div>
                  )}

                  {!selectedMetrics.isFromContract && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-[10px] flex gap-1.5 items-start">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <div>
                        <strong>Sin Contrato Registrado:</strong> Las vacaciones se acumulan desde la Fecha de Ingreso ({formatDMY(selectedMetrics.startDateStr)}).
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-650">
                      <span>Inicio Acumulación:</span>
                      <span className="font-mono text-slate-900">{formatDMY(selectedMetrics.startDateStr)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-slate-650">
                      <span>Origen Fecha:</span>
                      <span className={`font-semibold ${selectedMetrics.isFromContract ? "text-emerald-600" : "text-amber-600"}`}>
                        {selectedMetrics.isFromContract ? "Contrato Vigente" : "Fecha de Ingreso"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-slate-650">
                      <span>Años de Servicio:</span>
                      <span className="font-mono text-slate-900">{selectedMetrics.years} años</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-slate-650">
                      <span>Días Anuales:</span>
                      <span className="font-mono text-slate-900">{selectedMetrics.daysPerYear} d/año</span>
                    </div>
                    
                    <div className="border-t border-slate-100 my-2 pt-2 space-y-2">
                      <div className="flex justify-between text-xs font-semibold text-slate-650">
                        <span>Días Ganados:</span>
                        <span className="font-mono text-slate-950">{selectedMetrics.earned} días</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-slate-650">
                        <span>Días Gozados:</span>
                        <span className="font-mono text-blue-600 font-bold">{selectedMetrics.taken} días</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-100 text-slate-900">
                        <span>Saldo Pendiente:</span>
                        <span className={`font-mono ${selectedMetrics.status === "critico" ? "text-red-700 font-black" : "text-emerald-700"}`}>
                          {selectedMetrics.balance} días
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handlePrintRequest}
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir Formato Solicitud
                  </button>
                </div>

                {/* Registrar Vacaciones Form */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/70 space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                    <Plus className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    Registrar Descanso Físico
                  </h4>
                  <form onSubmit={handleSaveVacation} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha Inicio</label>
                      <input
                        type="date"
                        required
                        value={vacationForm.fecha_inicio}
                        onChange={(e) => setVacationForm({ ...vacationForm, fecha_inicio: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha Fin (Inclusive)</label>
                      <input
                        type="date"
                        required
                        value={vacationForm.fecha_fin}
                        onChange={(e) => setVacationForm({ ...vacationForm, fecha_fin: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Notas / Observaciones</label>
                      <textarea
                        rows={2}
                        value={vacationForm.notes || vacationForm.notas}
                        onChange={(e) => setVacationForm({ ...vacationForm, notas: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
                        placeholder="Ej. Goce correspondiente al periodo 2024-2025..."
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      Registrar Periodo
                    </button>
                  </form>
                </div>
              </div>

              {/* History list side (8 cols) */}
              <div className="lg:col-span-8 flex flex-col h-full min-h-[300px]">
                <div className="bg-slate-50/40 rounded-xl border border-slate-150 overflow-hidden flex flex-col h-full max-h-[480px]">
                  <div className="p-3.5 border-b border-slate-200/60 bg-white">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Historial de Descansos Registrados</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-150 bg-white">
                    {(!activeVinculo.vacaciones_historico || activeVinculo.vacaciones_historico.length === 0) ? (
                      <div className="text-center py-20 text-slate-400 space-y-2">
                        <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-medium">No se registran periodos vacacionales gozados para este puesto.</p>
                      </div>
                    ) : (
                      activeVinculo.vacaciones_historico.map((vac: any) => (
                        <div key={vac.id} className="p-4 flex items-center justify-between hover:bg-slate-50/40 transition-colors">
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-slate-800">
                              {new Date(vac.fecha_inicio).toLocaleDateString("es-PE")} ➔ {new Date(vac.fecha_fin).toLocaleDateString("es-PE")}
                            </div>
                            {vac.notas && (
                              <p className="text-[10px] text-slate-500 font-medium">{vac.notas}</p>
                            )}
                            <div className="text-[9px] text-slate-400 font-mono">
                              Registrado: {new Date(vac.creado_en || new Date()).toLocaleDateString("es-PE")}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3.5">
                            <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-lg">
                              {vac.dias_calendario} días
                            </span>
                            <button
                              onClick={() => handleDeleteVacation(vac.id)}
                              disabled={loading}
                              className="p-1.5 text-slate-400 hover:text-red-655 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="Eliminar descanso vacacional"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Printable Request Sheet */}
      {selectedPersona && activeVinculo && selectedMetrics && (
        <div className="hidden print:block bg-white p-8 border border-slate-350 rounded-lg text-xs space-y-8 max-w-2xl mx-auto">
          <div className="text-center border-b pb-4">
            <h1 className="text-lg font-bold">SOLICITUD DE DESCANSO VACACIONAL</h1>
            <p className="text-slate-500 font-mono mt-1">Recursos Humanos / Control de Personal - Grupo Bax</p>
          </div>
          
          <div className="space-y-4">
            <p className="leading-relaxed">
              Por medio del presente documento, yo <strong>{selectedPersona.apellidos}, {selectedPersona.nombres}</strong>, identificado con documento de identidad N° <strong>{selectedPersona.numero_documento}</strong>, en mi condición de colaborador en el puesto de <strong>{activeVinculo.cargos?.nombre}</strong> para la empresa <strong>{activeVinculo.empresas_internas?.razon_social}</strong> en la sede <strong>{activeVinculo.sedes?.nombre}</strong>, solicito formalmente el goce de mi descanso físico vacacional según el siguiente detalle:
            </p>
            
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
              <div><strong>Fecha de Inicio:</strong> ________________________</div>
              <div><strong>Fecha de Finalización:</strong> ________________________</div>
              <div><strong>Total de Días Solicitados:</strong> _______ días calendario</div>
              <div><strong>Periodo Adquirido Correspondiente:</strong> ________________________</div>
            </div>

            <div className="pt-4 space-y-2 text-justify">
              <h3 className="font-bold uppercase text-[10px] tracking-wider text-slate-700">Declaración Jurada y Conformidad:</h3>
              <p className="text-[10px] text-slate-550 leading-relaxed text-slate-500">
                El suscrito declara que las fechas arriba solicitadas han sido coordinadas y consensuadas previamente con su jefatura inmediata, garantizando la no afectación de las operaciones del área. Asimismo, se conviene que los días gozados se deducirán directamente del saldo vacacional acumulado a la fecha.
              </p>
            </div>
          </div>

          <div className="pt-28 grid grid-cols-2 gap-12 text-center">
            <div className="border-t border-slate-400 pt-2">
              Firma del Colaborador
              <div className="text-[9px] text-slate-400 font-mono mt-1">DNI: {selectedPersona.numero_documento}</div>
            </div>
            <div className="border-t border-slate-400 pt-2">
              V°B° Jefe Directo / Recursos Humanos
              <div className="text-[9px] text-slate-400 font-mono mt-1">Aprobado por</div>
            </div>
          </div>

          <div className="pt-10 border-t border-dashed border-slate-300 text-[9px] text-slate-400 flex justify-between">
            <span>Fecha de emisión: {new Date().toLocaleDateString("es-PE")} {new Date().toLocaleTimeString("es-PE", {hour: '2-digit', minute:'2-digit'})}</span>
            <span>Documento generado por Antigravity HR System</span>
          </div>
        </div>
      )}

    </div>
  );
}
