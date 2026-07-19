import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../utils/authContext";
import * as XLSX from "xlsx";
import { 
  PieChart, 
  RefreshCw, 
  Search, 
  Calendar, 
  AlertTriangle, 
  Printer, 
  Download, 
  ChevronRight, 
  Boxes, 
  Clock, 
  CheckSquare, 
  Truck, 
  Activity, 
  X, 
  Eye, 
  Info,
  Building,
  User,
  ShoppingBag,
  TrendingUp,
  FileText
} from "lucide-react";

interface ProductHistoryItem {
  reqId: number;
  codigo: string;
  fecha: string;
  sede: string;
  solicitante: string;
  trabajador: string;
  cantSolicitada: number;
  cantAprobada: number;
  cantEntregada: number;
  estado: string;
}

export function DashboardLogistica() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter Type: 'all' | 'Materiales_y_EPP' | 'Uniformes_Almacen'
  const [filterType, setFilterType] = useState<"all" | "Materiales_y_EPP" | "Uniformes_Almacen">("all");

  useEffect(() => {
    if (role === "rrhh" || role === "almacen") {
      setFilterType("Uniformes_Almacen");
    }
  }, [role]);
  
  // Data States
  const [requirements, setRequirements] = useState<any[]>([]);
  
  // Filters
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  
  // Temporal range filter for repeated consumption (anomalies)
  const [anomalyMonths, setAnomalyMonths] = useState<string>("3");
  
  // Selected product for history modal
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string>("");
  
  // Search query inside anomaly detector
  const [searchAnomalyQuery, setSearchAnomalyQuery] = useState("");

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch 12 months of requirements to support the repeat consumption analysis in-memory
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];

      let query = supabase
        .from("requerimientos")
        .select(`
          id,
          codigo,
          tipo_solicitud,
          afecta_stock,
          estado,
          fecha_solicitud,
          fecha_aprobacion,
          fecha_envio,
          fecha_entrega,
          sedes (
            id,
            nombre
          ),
          usuario_solicitante:usuarios!requerimientos_usuario_solicitante_id_fkey (
            id,
            username,
            nombres,
            apellidos
          ),
          requerimiento_detalles (
            id,
            producto_id,
            producto_talla_id,
            cantidad_solicitada,
            cantidad_aprobada,
            cantidad_entregada,
            productos (
              id,
              sku,
              nombre,
              precio_unitario,
              es_uniforme,
              categorias_producto (
                id,
                nombre
              )
            ),
            vinculos_laborales (
              id,
              personas (
                id,
                nombres,
                apellidos,
                numero_documento
              )
            )
          )
        `)
        .gte("fecha_solicitud", `${oneYearAgoStr}T00:00:00Z`);

      if (role === "supervisor") {
        query = query.eq("usuario_solicitante_id", user.id);
      } else if (role === "rrhh" || role === "almacen") {
        query = query.eq("tipo_solicitud", "Uniformes_Almacen");
      }

      const { data, error: dbError } = await query.order("fecha_solicitud", { ascending: false });

      if (dbError) throw dbError;
      setRequirements(data || []);
    } catch (err: any) {
      console.error("Error loading dashboard data:", err);
      setError(err.message || "Error al cargar los datos del panel logístico.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Safe formatting helper to prevent timezone shift issues
  const formatDMY = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const cleanDate = dateStr.split("T")[0];
    const parts = cleanDate.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Client-side filter of requirements based on active date range filters
  const filteredRequirements = useMemo(() => {
    return requirements.filter(req => {
      if (!req.fecha_solicitud) return true;
      const reqDate = req.fecha_solicitud.split("T")[0];
      if (startDate && reqDate < startDate) return false;
      if (endDate && reqDate > endDate) return false;
      
      // Type filter
      if (filterType !== "all" && req.tipo_solicitud !== filterType) return false;
      
      return true;
    });
  }, [requirements, startDate, endDate, filterType]);

  // KPIs derived from the active filtered requirements
  const kpis = useMemo(() => {
    let total = 0;
    let pendientes = 0;
    let aprobados = 0;
    let enviados = 0;
    let entregados = 0;
    let entregadosIncompletos = 0;
    let rechazados = 0;

    filteredRequirements.forEach(req => {
      total++;
      switch (req.estado) {
        case "Pendiente Aprobacion":
          pendientes++;
          break;
        case "Aprobado":
          aprobados++;
          break;
        case "Enviado":
          enviados++;
          break;
        case "Entregado":
          entregados++;
          break;
        case "Entregado Incompleto":
          entregadosIncompletos++;
          break;
        case "Rechazado":
          rechazados++;
          break;
      }
    });

    return { total, pendientes, aprobados, enviados, entregados, entregadosIncompletos, rechazados };
  }, [filteredRequirements]);

  // Aggregate top requested products in the active filtered requirements
  const topProducts = useMemo(() => {
    const prodMap: Record<number, {
      id: number;
      sku: string;
      nombre: string;
      totalRequested: number;
      totalApproved: number;
      totalDelivered: number;
      category: string;
    }> = {};

    filteredRequirements.forEach(req => {
      if (req.estado === "Rechazado") return;

      req.requerimiento_detalles?.forEach((det: any) => {
        const prod = det.productos;
        if (!prod) return;

        if (!prodMap[prod.id]) {
          prodMap[prod.id] = {
            id: prod.id,
            sku: prod.sku || "S/K",
            nombre: prod.nombre,
            totalRequested: 0,
            totalApproved: 0,
            totalDelivered: 0,
            category: prod.categorias_producto?.nombre || "General"
          };
        }

        prodMap[prod.id].totalRequested += det.cantidad_solicitada || 0;
        prodMap[prod.id].totalApproved += det.cantidad_aprobada || 0;
        prodMap[prod.id].totalDelivered += det.cantidad_entregada || 0;
      });
    });

    return Object.values(prodMap)
      .sort((a, b) => b.totalRequested - a.totalRequested)
      .slice(0, 10);
  }, [filteredRequirements]);

  // History list for the selected product modal
  const selectedProductHistory = useMemo((): ProductHistoryItem[] => {
    if (selectedProductId === null) return [];

    const history: ProductHistoryItem[] = [];
    requirements.forEach(req => {
      req.requerimiento_detalles?.forEach((det: any) => {
        if (det.producto_id === selectedProductId) {
          history.push({
            reqId: req.id,
            codigo: req.codigo,
            fecha: req.fecha_solicitud,
            sede: req.sedes?.nombre || "No asignada",
            solicitante: req.usuario_solicitante ? `${req.usuario_solicitante.nombres} ${req.usuario_solicitante.apellidos}` : "-",
            trabajador: det.vinculos_laborales?.personas 
              ? `${det.vinculos_laborales.personas.apellidos}, ${det.vinculos_laborales.personas.nombres}` 
              : "-",
            cantSolicitada: det.cantidad_solicitada,
            cantAprobada: det.cantidad_aprobada,
            cantEntregada: det.cantidad_entregada,
            estado: req.estado
          });
        }
      });
    });

    return history.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [requirements, selectedProductId]);

  // Repeated Consumption anomaly detector
  const consumptionAnomalies = useMemo(() => {
    const today = new Date();
    const limitDate = new Date();
    limitDate.setMonth(today.getMonth() - parseInt(anomalyMonths));

    const workerGroups: Record<string, {
      workerName: string;
      dni: string;
      productSku: string;
      productName: string;
      qty: number;
      count: number;
      dates: string[];
    }> = {};

    const SedeGroups: Record<string, {
      SedeName: string;
      productSku: string;
      productName: string;
      qty: number;
      count: number;
      dates: string[];
    }> = {};

    requirements.forEach(req => {
      const reqDate = new Date(req.fecha_solicitud);
      if (reqDate < limitDate) return;
      if (req.estado === "Rechazado") return;

      req.requerimiento_detalles?.forEach((det: any) => {
        const prod = det.productos;
        if (!prod) return;

        const qty = det.cantidad_solicitada || 0;
        if (qty === 0) return;

        // 1. Group by worker
        const worker = det.vinculos_laborales?.personas;
        if (worker) {
          const workerId = worker.numero_documento;
          const key = `${workerId}_${prod.id}`;
          if (!workerGroups[key]) {
            workerGroups[key] = {
              workerName: `${worker.apellidos}, ${worker.nombres}`,
              dni: workerId,
              productSku: prod.sku || "S/K",
              productName: prod.nombre,
              qty: 0,
              count: 0,
              dates: []
            };
          }
          workerGroups[key].qty += qty;
          workerGroups[key].count += 1;
          workerGroups[key].dates.push(req.fecha_solicitud);
        }

        // 2. Group by Sede
        const Sede = req.sedes;
        if (Sede) {
          const SedeId = Sede.id;
          const key = `${SedeId}_${prod.id}`;
          if (!SedeGroups[key]) {
            SedeGroups[key] = {
              SedeName: Sede.nombre,
              productSku: prod.sku || "S/K",
              productName: prod.nombre,
              qty: 0,
              count: 0,
              dates: []
            };
          }
          SedeGroups[key].qty += qty;
          SedeGroups[key].count += 1;
          SedeGroups[key].dates.push(req.fecha_solicitud);
        }
      });
    });

    const anomalies: any[] = [];

    // Thresholds change based on the evaluation period
    let wCountThreshold = 3; 
    let wQtyThreshold = 4;
    let sCountThreshold = 6;
    let sQtyThreshold = 15;

    if (anomalyMonths === "6") {
      wCountThreshold = 4;
      wQtyThreshold = 6;
      sCountThreshold = 10;
      sQtyThreshold = 30;
    } else if (anomalyMonths === "12") {
      wCountThreshold = 6;
      wQtyThreshold = 10;
      sCountThreshold = 15;
      sQtyThreshold = 50;
    }

    // Filter worker anomalies
    Object.values(workerGroups).forEach(g => {
      if (g.count >= wCountThreshold || g.qty >= wQtyThreshold) {
        const isCritical = g.count >= (wCountThreshold + 2) || g.qty >= (wQtyThreshold * 2);
        anomalies.push({
          id: `worker_${g.dni}_${g.productName}`,
          tipo: "Colaborador",
          entidad: g.workerName,
          detalleEntidad: `DNI: ${g.dni}`,
          producto: `${g.productSku} - ${g.productName}`,
          frecuencia: g.count,
          cantidadTotal: g.qty,
          nivel: isCritical ? "Crítico" : "Inusual",
          explicacion: `Solicitado ${g.count} veces (total: ${g.qty} uds) en los últimos ${anomalyMonths} meses.`
        });
      }
    });

    // Filter Sede anomalies
    Object.values(SedeGroups).forEach(g => {
      if (g.count >= sCountThreshold || g.qty >= sQtyThreshold) {
        const isCritical = g.count >= (sCountThreshold + 4) || g.qty >= (sQtyThreshold * 2);
        anomalies.push({
          id: `sede_${g.SedeName}_${g.productName}`,
          tipo: "Sede",
          entidad: g.SedeName,
          detalleEntidad: "Sede Operativa",
          producto: `${g.productSku} - ${g.productName}`,
          frecuencia: g.count,
          cantidadTotal: g.qty,
          nivel: isCritical ? "Crítico" : "Inusual",
          explicacion: `Sede solicitó ${g.count} veces (total: ${g.qty} uds) en los últimos ${anomalyMonths} meses.`
        });
      }
    });

    return anomalies.sort((a, b) => b.cantidadTotal - a.cantidadTotal);
  }, [requirements, anomalyMonths]);

  // Filtered anomalies based on search bar
  const filteredAnomalies = useMemo(() => {
    return consumptionAnomalies.filter(anom => {
      const q = searchAnomalyQuery.toLowerCase();
      if (!q) return true;
      return (
        anom.entidad.toLowerCase().includes(q) ||
        anom.producto.toLowerCase().includes(q) ||
        anom.tipo.toLowerCase().includes(q)
      );
    });
  }, [consumptionAnomalies, searchAnomalyQuery]);

  const maxProductQty = useMemo(() => {
    return Math.max(...topProducts.map(p => p.totalRequested), 1);
  }, [topProducts]);

  const cleanFilters = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    setStartDate(d.toISOString().split("T")[0]);
    setEndDate(new Date().toISOString().split("T")[0]);
  };

  const handleExportToExcel = () => {
    try {
      // Sheet 1: Top Products
      const sheet1Data = topProducts.map((p, idx) => ({
        "Ranking": idx + 1,
        "SKU": p.sku,
        "Producto": p.nombre,
        "Categoría": p.category,
        "Cantidad Solicitada": p.totalRequested,
        "Cantidad Aprobada": p.totalApproved,
        "Cantidad Entregada": p.totalDelivered
      }));

      // Sheet 2: Requisitions Ledger
      const sheet2Data: any[] = [];
      filteredRequirements.forEach(req => {
        req.requerimiento_detalles?.forEach((det: any) => {
          sheet2Data.push({
            "Código Requerimiento": req.codigo,
            "Fecha Solicitud": req.fecha_solicitud ? req.fecha_solicitud.split("T")[0] : "-",
            "Tipo Solicitud": req.tipo_solicitud === "Materiales_y_EPP" ? "Materiales" : "Uniformes y EPP",
            "Afecta Stock": req.afecta_stock ? "Sí" : "No",
            "Estado": req.estado,
            "Sede": req.sedes?.nombre || "-",
            "Solicitante": req.usuario_solicitante ? `${req.usuario_solicitante.nombres} ${req.usuario_solicitante.apellidos}` : "-",
            "SKU Producto": det.productos?.sku || "-",
            "Producto": det.productos?.nombre || "-",
            "Cantidad Solicitada": det.cantidad_solicitada,
            "Cantidad Aprobada": det.cantidad_aprobada,
            "Cantidad Entregada": det.cantidad_entregada,
            "Trabajador Asignado": det.vinculos_laborales?.personas 
              ? `${det.vinculos_laborales.personas.apellidos}, ${det.vinculos_laborales.personas.nombres}` 
              : "-"
          });
        });
      });

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
      const ws2 = XLSX.utils.json_to_sheet(sheet2Data);

      XLSX.utils.book_append_sheet(wb, ws1, "Top Productos");
      XLSX.utils.book_append_sheet(wb, ws2, "Bandeja Solicitudes");

      XLSX.writeFile(wb, `Reporte_Logistico_Bax_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (err: any) {
      console.error("Error exporting to Excel:", err);
      alert("Error al exportar a Excel: " + err.message);
    }
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto pr-1 print-container">
      {/* Dynamic inline styles for printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide sidebar, topbar, buttons, and input filter sections */
          aside, nav, header, .no-print, button, input, select {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            overflow: visible !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .print-card {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            break-inside: avoid;
            margin-bottom: 16px !important;
            border-radius: 12px !important;
            padding: 16px !important;
            background: white !important;
          }
          .print-grid {
            grid-template-cols: repeat(3, 1fr) !important;
            display: grid !important;
            gap: 12px !important;
          }
          .print-container {
            overflow: visible !important;
            height: auto !important;
          }
          .print-title {
            margin-bottom: 24px !important;
          }
        }
      `}} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between flex-shrink-0 gap-4 print-title">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
            {role === "supervisor" ? "Mis Requerimientos" : 
             role === "rrhh" ? "Recursos Humanos" : 
             role === "almacen" ? "Almacén" : "Logística e Inventario"}
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <PieChart className="w-8 h-8 text-blue-600 animate-pulse" />
            {role === "supervisor" ? "Mis Pedidos y Solicitudes" : 
             role === "rrhh" ? "Pedidos de Uniformes" : 
             role === "almacen" ? "Estadísticas de Uniformes" : "Resumen Logístico"}
          </h1>
          <p className="text-xs text-slate-500 max-w-xl">
            {role === "supervisor" ? "Seguimiento en tiempo real de tus pedidos de materiales, EPP y uniformes asignados." : 
             role === "rrhh" ? "Estadísticas e historial de requerimientos de prendas y EPP para personal." : 
             role === "almacen" ? "Seguimiento de pedidos de prendas y calzados asignados al personal." : 
             "Control de requerimientos de EPP, materiales de oficina e historial de entregas operativas."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button 
            onClick={loadDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Sincronizar
          </button>
          
          <button 
            onClick={handleExportToExcel}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm cursor-pointer border border-emerald-700"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>

          <button 
            onClick={triggerPrint}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm cursor-pointer border border-blue-700"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Reporte (PDF)
          </button>
        </div>
      </div>

      {/* Date Filters Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Rango de Solicitud:</span>
          </div>
          <div className="flex items-center space-x-2">
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-slate-400 text-xs font-medium">al</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={cleanFilters}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Últimos 30 días
          </button>
        </div>

        {role !== "rrhh" && role !== "almacen" && (
          <div className="flex bg-slate-100 p-1 rounded-lg gap-1 border border-slate-200 self-start md:self-auto shrink-0 font-sans">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                filterType === "all"
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType("Materiales_y_EPP")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                filterType === "Materiales_y_EPP"
                  ? "bg-white text-slate-850 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Materiales
            </button>
            <button
              onClick={() => setFilterType("Uniformes_Almacen")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                filterType === "Uniformes_Almacen"
                  ? "bg-white text-slate-850 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Uniformes y EPP
            </button>
          </div>
        )}

        {(role === "rrhh" || role === "almacen") && (
          <div className="flex bg-blue-50/50 border border-blue-150 px-3 py-1.5 rounded-lg text-[10px] text-blue-800 font-bold items-center gap-1.5 shrink-0 self-start md:self-auto font-sans">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>EXCLUSIVO: {role === "rrhh" ? "RECURSOS HUMANOS" : "ALMACÉN"} (SOLO UNIFORMES Y EPP)</span>
          </div>
        )}
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5 print-grid">
        {/* Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between print-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Pedidos</span>
            <Boxes className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 leading-none">{kpis.total}</span>
          </div>
        </div>

        {/* Pendientes */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between print-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pendientes</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-amber-600 leading-none">{kpis.pendientes}</span>
          </div>
        </div>

        {/* Aprobados */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between print-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Aprobados</span>
            <CheckSquare className="w-4 h-4 text-sky-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-sky-600 leading-none">{kpis.aprobados}</span>
          </div>
        </div>

        {/* Enviados */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between print-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">En Camino</span>
            <Truck className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-indigo-600 leading-none">{kpis.enviados}</span>
          </div>
        </div>

        {/* Entregados */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between print-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Entregados</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-emerald-600 leading-none">{kpis.entregados}</span>
          </div>
        </div>

        {/* Entregados Incompletos */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between print-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Incompletos</span>
            <AlertTriangle className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-purple-600 leading-none">{kpis.entregadosIncompletos}</span>
          </div>
        </div>

        {/* Rechazados */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between print-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Rechazados</span>
            <X className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-red-600 leading-none">{kpis.rechazados}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Charts and Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Top Products Requested (Bar Chart) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col space-y-4 print-card">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4.5 h-4.5 text-blue-600" />
              <h3 className="font-heading text-xs font-bold text-slate-800 uppercase tracking-wider">
                Top 10 Productos Más Solicitados
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">En el rango filtrado</span>
          </div>

          <div className="flex-1 space-y-3.5">
            {topProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-medium">
                No hay productos solicitados en este rango de fechas.
              </div>
            ) : (
              topProducts.map((p, index) => {
                const percentage = (p.totalRequested / maxProductQty) * 100;
                return (
                  <div key={p.id} className="flex flex-col space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="w-5 h-5 flex items-center justify-center bg-slate-100 text-[10px] font-extrabold text-slate-600 rounded-full flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="font-semibold text-slate-700 truncate max-w-[220px]" title={p.nombre}>
                          {p.nombre}
                        </span>
                        <span className="text-[9px] font-mono text-slate-450 bg-slate-50 border border-slate-150 px-1 py-0.2 rounded shrink-0">
                          {p.sku}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-3 flex-shrink-0 ml-2">
                        <span className="font-medium text-[10px] text-slate-400">{p.category}</span>
                        <span className="font-black text-slate-800 w-12 text-right">{p.totalRequested} uds</span>
                        <button 
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setSelectedProductName(p.nombre);
                          }}
                          className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors no-print cursor-pointer"
                          title="Ver Historial"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex items-center">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-700" 
                        style={{ width: `${percentage}%` }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Consumption Anomaly Detector */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col space-y-4 print-card">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
              <h3 className="font-heading text-xs font-bold text-slate-800 uppercase tracking-wider">
                Consumo Inusual Detectado
              </h3>
            </div>
            
            <div className="flex items-center space-x-1.5 no-print">
              <span className="text-[10px] text-slate-450 font-bold uppercase">Evaluar:</span>
              <select 
                value={anomalyMonths}
                onChange={(e) => setAnomalyMonths(e.target.value)}
                className="text-[10px] font-bold border border-slate-200 rounded px-1.5 py-0.8 bg-slate-50 text-slate-700 focus:outline-none"
              >
                <option value="3">Últimos 3 Meses</option>
                <option value="6">Últimos 6 Meses</option>
                <option value="12">Últimos 12 Meses</option>
              </select>
            </div>
          </div>

          {/* Search bar for anomalies */}
          <div className="relative no-print">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por Colaborador, Sede o Producto..."
              value={searchAnomalyQuery}
              onChange={(e) => setSearchAnomalyQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[420px] scrollbar-thin">
            {filteredAnomalies.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs font-medium">
                No se han detectado alertas de consumo inusual para el período y criterios seleccionados.
              </div>
            ) : (
              filteredAnomalies.map((anom) => (
                <div key={anom.id} className="p-3 bg-slate-50/40 border border-slate-100 rounded-xl flex flex-col space-y-2 text-xs">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                        anom.tipo === "Colaborador" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-teal-50 text-teal-700 border border-teal-100"
                      }`}>
                        {anom.tipo}
                      </span>
                      <span className="font-bold text-slate-800 truncate max-w-[150px]" title={anom.entidad}>
                        {anom.entidad}
                      </span>
                    </div>

                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      anom.nivel === "Crítico" 
                        ? "bg-red-50 text-red-700 border-red-100" 
                        : "bg-amber-50 text-amber-700 border-amber-100"
                    }`}>
                      {anom.nivel}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-500 font-medium">
                    {anom.tipo === "Colaborador" ? (
                      <span className="flex items-center gap-1"><User className="w-3 h-3 text-slate-400" /> {anom.detalleEntidad}</span>
                    ) : (
                      <span className="flex items-center gap-1"><Building className="w-3 h-3 text-slate-400" /> {anom.detalleEntidad}</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1 bg-white/40 px-2.5 py-1.5 rounded-lg border border-slate-150/30">
                    <span className="font-semibold text-slate-655 truncate max-w-[200px]" title={anom.producto}>
                      {anom.producto}
                    </span>
                    <span className="font-black text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded">
                      {anom.cantidadTotal} uds
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-snug pl-1.5 border-l-2 border-slate-200">
                    {anom.explicacion}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Requisitions Detail / General Ledger */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 print-card">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4.5 h-4.5 text-blue-600" />
            <h3 className="font-heading text-xs font-bold text-slate-800 uppercase tracking-wider">
              Bandeja y Bitácora General de Pedidos
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase">Rango Filtrado: {filteredRequirements.length}</span>
        </div>

        <div className="overflow-x-auto">
          {filteredRequirements.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              No hay solicitudes registradas en este período.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50/50 text-[9px] font-bold text-slate-450 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Código</th>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5">Sede</th>
                  <th className="px-4 py-2.5">Solicitante</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5 text-right">Items</th>
                  <th className="px-4 py-2.5 text-right">Cant. Solicitada</th>
                  <th className="px-4 py-2.5 text-right">Cant. Entregada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequirements.map(req => {
                  const qtySolicitada = req.requerimiento_detalles?.reduce((sum: number, det: any) => sum + (det.cantidad_solicitada || 0), 0) || 0;
                  const qtyEntregada = req.requerimiento_detalles?.reduce((sum: number, det: any) => sum + (det.cantidad_entregada || 0), 0) || 0;
                  const itemsCount = req.requerimiento_detalles?.length || 0;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.8 font-bold text-slate-900">{req.codigo}</td>
                      <td className="px-4 py-2.8 text-slate-500">{formatDMY(req.fecha_solicitud)}</td>
                      <td className="px-4 py-2.8 text-slate-750 font-medium">{req.sedes?.nombre || "-"}</td>
                      <td className="px-4 py-2.8 text-slate-500">
                        {req.usuario_solicitante ? `${req.usuario_solicitante.nombres} ${req.usuario_solicitante.apellidos}` : "-"}
                      </td>
                      <td className="px-4 py-2.8 text-slate-600">
                        {req.tipo_solicitud === "Materiales_y_EPP" ? "Materiales" : "Uniformes y EPP"}
                      </td>
                      <td className="px-4 py-2.8">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block border ${
                          req.estado === "Entregado" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          req.estado === "Pendiente Aprobacion" ? "bg-amber-50 text-amber-700 border-amber-100" :
                          req.estado === "Aprobado" ? "bg-sky-50 text-sky-700 border-sky-100" :
                          req.estado === "Enviado" ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                          req.estado === "Entregado Incompleto" ? "bg-purple-50 text-purple-700 border-purple-100" :
                          req.estado === "Rechazado" ? "bg-red-50 text-red-700 border-red-100" : "bg-slate-50 text-slate-700"
                        }`}>
                          {req.estado}
                        </span>
                      </td>
                      <td className="px-4 py-2.8 text-right font-medium text-slate-600">{itemsCount}</td>
                      <td className="px-4 py-2.8 text-right font-semibold text-slate-700">{qtySolicitada}</td>
                      <td className="px-4 py-2.8 text-right font-black text-emerald-600">{qtyEntregada}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* History Modal for Selected Product */}
      {selectedProductId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 no-print">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-xl border border-slate-100 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-shrink-0">
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  Historial de Requerimientos
                </span>
                <h3 className="font-heading text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                  {selectedProductName}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setSelectedProductId(null);
                  setSelectedProductName("");
                }}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4">
              {selectedProductHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No hay historial de solicitudes para este producto.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-150 bg-slate-50/50 text-[9px] font-bold text-slate-450 uppercase tracking-wider">
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Código Req.</th>
                      <th className="px-3 py-2">Sede</th>
                      <th className="px-3 py-2">Solicitante</th>
                      <th className="px-3 py-2">Trabajador Asignado</th>
                      <th className="px-3 py-2 text-right">Cant. Solicitada</th>
                      <th className="px-3 py-2 text-right">Cant. Aprobada</th>
                      <th className="px-3 py-2 text-right">Cant. Entregada</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedProductHistory.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-3 py-2 text-slate-500">{formatDMY(item.fecha)}</td>
                        <td className="px-3 py-2 font-bold text-slate-800">{item.codigo}</td>
                        <td className="px-3 py-2 text-slate-700 font-medium">{item.sede}</td>
                        <td className="px-3 py-2 text-slate-550">{item.solicitante}</td>
                        <td className="px-3 py-2 text-slate-700 font-semibold">{item.trabajador}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-600">{item.cantSolicitada}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-750">{item.cantAprobada}</td>
                        <td className="px-3 py-2 text-right font-black text-emerald-600">{item.cantEntregada}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                            item.estado === "Entregado" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            item.estado === "Pendiente Aprobacion" ? "bg-amber-50 text-amber-700 border-amber-100" :
                            item.estado === "Aprobado" ? "bg-sky-50 text-sky-700 border-sky-100" :
                            item.estado === "Enviado" ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                            item.estado === "Entregado Incompleto" ? "bg-purple-50 text-purple-700 border-purple-100" :
                            item.estado === "Rechazado" ? "bg-red-50 text-red-700 border-red-100" : "bg-slate-50 text-slate-700"
                          }`}>
                            {item.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 pt-3 flex justify-end flex-shrink-0">
              <button 
                onClick={() => {
                  setSelectedProductId(null);
                  setSelectedProductName("");
                }}
                className="bg-slate-150 hover:bg-slate-200 text-slate-750 text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
