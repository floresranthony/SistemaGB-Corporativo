import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  User, 
  ClipboardList 
} from "lucide-react";

export function AuditoriaStock() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");

  const loadAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auditData, error: dbError } = await supabase
        .from("auditoria_stock")
        .select(`
          *,
          usuarios (id, nombres, apellidos, username),
          producto_tallas (
            id,
            talla_id,
            tallas (id, valor),
            productos (id, sku, nombre)
          )
        `)
        .order("creado_en", { ascending: false });

      if (dbError) throw dbError;
      setData(auditData || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar la auditoría de stock.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  // Filter logs
  const filteredData = data.filter(log => {
    const q = searchQuery.toLowerCase();
    const product = log.producto_tallas?.productos;
    const user = log.usuarios;

    const productName = product ? String(product.nombre).toLowerCase() : "";
    const productSku = product ? String(product.sku).toLowerCase() : "";
    const userName = user ? `${user.nombres} ${user.apellidos}`.toLowerCase() : "";
    const reason = String(log.motivo).toLowerCase();

    const matchesSearch = !q || 
      productName.includes(q) || 
      productSku.includes(q) || 
      userName.includes(q) || 
      reason.includes(q);

    const matchesType = !filterType || log.tipo_movimiento === filterType;

    return matchesSearch && matchesType;
  });

  // Calculate statistics
  const stats = React.useMemo(() => {
    const total = filteredData.length;
    const ingresos = filteredData.filter(log => log.tipo_movimiento === "Ingreso").length;
    const salidas = total - ingresos;
    return { total, ingresos, salidas };
  }, [filteredData]);

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 flex-shrink-0 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Almacén / Auditoría Físico-Legal
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-blue-600" />
            Auditoría de Stock
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Historial inmutable y detallado de todas las transacciones, compras, mermas y entregas que alteran el stock físico.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadAuditLogs}
            className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-100 active:scale-95 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar Bitácora
          </button>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Movimientos Filtrados</span>
            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Ingresos Registrados</span>
            <span className="text-2xl font-black text-slate-900 text-emerald-600">{stats.ingresos}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Salidas Registradas</span>
            <span className="text-2xl font-black text-slate-900 text-red-600">{stats.salidas}</span>
          </div>
        </div>
      </div>

      {/* Filter and Table Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[400px]">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-5 border-b border-slate-100 gap-4 bg-slate-50/10">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por SKU, Producto, Usuario o Motivo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none text-slate-600"
            >
              <option value="">Todos los Movimientos</option>
              <option value="Ingreso">Ingreso (+)</option>
              <option value="Salida">Salida (-)</option>
            </select>
          </div>
        </div>

        {/* Table list */}
        <div className="flex-1 overflow-x-auto">
          {loading && filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Cargando bitácora de auditoría...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No se encontraron movimientos</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">Prueba cambiando los criterios de filtro o genera movimientos en el inventario.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Fecha y Hora</th>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Talla</th>
                  <th className="px-6 py-4 text-center">Tipo</th>
                  <th className="px-6 py-4 text-center">Cantidad</th>
                  <th className="px-6 py-4 text-center">Stock Prev.</th>
                  <th className="px-6 py-4 text-center">Stock Nuev.</th>
                  <th className="px-6 py-4">Usuario Responsable</th>
                  <th className="px-6 py-4">Motivo / Sustento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((log) => {
                  const prod = log.producto_tallas?.productos;
                  const tallaValor = log.producto_tallas?.tallas?.valor || "Única";
                  const dateObj = new Date(log.creado_en);
                  const formattedDate = dateObj.toLocaleDateString("es-PE") + " " + dateObj.toLocaleTimeString("es-PE", { hour: '2-digit', minute: '2-digit' });
                  const userObj = log.usuarios;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/40 transition-colors text-xs">
                      <td className="px-6 py-4 font-mono text-slate-500 whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{prod?.nombre || "Producto Eliminado"}</div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">SKU: {prod?.sku || "N/A"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-1.5 py-0.5 bg-slate-100 text-slate-700 font-bold rounded">
                          {tallaValor}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.tipo_movimiento === "Ingreso" 
                            ? "bg-emerald-100 text-emerald-800" 
                            : "bg-red-100 text-red-800"
                        }`}>
                          {log.tipo_movimiento === "Ingreso" ? (
                            <>
                              <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                              Ingreso
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="w-3 h-3 text-red-600" />
                              Salida
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-800">
                        {log.cantidad}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-slate-500">
                        {log.stock_previo}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-slate-800 font-bold">
                        {log.stock_nuevo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-700">
                          {userObj ? `${userObj.nombres} ${userObj.apellidos}` : "Sistema / Desconocido"}
                        </div>
                        <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">
                          Rol: {userObj?.username || "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate" title={log.motivo}>
                        {log.motivo}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
