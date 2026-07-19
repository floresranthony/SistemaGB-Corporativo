import React, { useState, useEffect } from "react";
import { supabase, getOrCreateUserForRole } from "../utils/supabase";
import { 
  Shirt, 
  Search, 
  RefreshCw, 
  Plus, 
  Minus, 
  Check, 
  X, 
  DollarSign,
  AlertCircle,
  HelpCircle
} from "lucide-react";

export function InventarioUniformes() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // Lookups
  const [categorias, setCategorias] = useState<any[]>([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  
  // Form Values
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [selectedVariantId, setSelectedVariantId] = useState<number | "">("");
  const [adjustType, setAdjustType] = useState<"Ingreso" | "Salida">("Ingreso");
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>("");

  const loadLookups = async () => {
    try {
      const { data: catData } = await supabase.from("categorias_producto").select("*").eq("activo", true).order("nombre");
      setCategorias(catData || []);
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  };

  const loadInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: invData, error: dbError } = await supabase
        .from("productos")
        .select(`
          *,
          categorias_producto (id, nombre),
          unidades_medida (id, codigo),
          producto_tallas (
            id,
            talla_id,
            stock_actual,
            tallas (id, valor)
          )
        `)
        .eq("activo", true)
        .order("nombre", { ascending: true });

      if (dbError) throw dbError;
      setData(invData || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar el inventario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLookups();
    loadInventory();
  }, []);

  // Open adjustment modal (pre-filled if clicked from product row)
  const handleOpenAdjust = (prodId?: number, variantId?: number) => {
    setModalError(null);
    setSelectedProductId(prodId || "");
    setSelectedVariantId(variantId || "");
    setAdjustType("Ingreso");
    setAdjustQuantity(0);
    setAdjustReason("");
    setIsModalOpen(true);
  };

  // On Product select change in modal
  const handleProductChange = (pid: number) => {
    setSelectedProductId(pid);
    const prod = data.find(p => p.id === pid);
    const firstVariant = prod?.producto_tallas?.[0]?.id || "";
    setSelectedVariantId(firstVariant);
  };

  // Submit manual adjustment
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedVariantId || adjustQuantity <= 0 || !adjustReason.trim()) {
      setModalError("Por favor complete todos los campos obligatorios.");
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      // 1. Get current role and resolve user ID in a self-healing way
      const role = localStorage.getItem("bax_role") || "admin";
      const userId = await getOrCreateUserForRole(role);

      // 2. Fetch current stock of this variant
      const { data: variant, error: varErr } = await supabase
        .from("producto_tallas")
        .select("stock_actual")
        .eq("id", selectedVariantId)
        .single();

      if (varErr) throw varErr;

      const currentStock = variant.stock_actual;
      const newStock = adjustType === "Ingreso" 
        ? currentStock + adjustQuantity 
        : currentStock - adjustQuantity;

      if (newStock < 0) {
        throw new Error(`Stock insuficiente. No se puede realizar una salida de ${adjustQuantity} unidades porque el stock actual es de ${currentStock} unidades.`);
      }

      // 3. Update stock in Supabase
      const { error: updErr } = await supabase
        .from("producto_tallas")
        .update({ stock_actual: newStock })
        .eq("id", selectedVariantId);

      if (updErr) throw updErr;

      // 4. Register audit movement
      const { error: audErr } = await supabase
        .from("auditoria_stock")
        .insert([{
          producto_talla_id: selectedVariantId,
          usuario_id: userId,
          tipo_movimiento: adjustType,
          cantidad: adjustQuantity,
          stock_previo: currentStock,
          stock_nuevo: newStock,
          motivo: adjustReason
        }]);

      if (audErr) throw audErr;

      setIsModalOpen(false);
      loadInventory();
      alert("¡Ajuste de inventario realizado con éxito!");
    } catch (err: any) {
      console.error("Error adjusting stock:", err);
      setModalError(err.message || "Error al realizar el ajuste de inventario.");
    } finally {
      setModalLoading(false);
    }
  };

  // Filter products
  const filteredData = data.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    const matchesCat = !filterCategory || String(p.categoria_id) === filterCategory;
    return matchesSearch && matchesCat;
  });

  // Calculate stats
  const stats = React.useMemo(() => {
    let totalItems = 0;
    let lowStockCount = 0;
    let criticalStockCount = 0;

    data.forEach(p => {
      p.producto_tallas?.forEach((pt: any) => {
        totalItems += pt.stock_actual;
        if (pt.stock_actual === 0) {
          criticalStockCount++;
        } else if (pt.stock_actual <= 5) {
          lowStockCount++;
        }
      });
    });

    return { totalItems, lowStockCount, criticalStockCount };
  }, [data]);

  // Find variants for currently selected product in modal
  const modalVariants = React.useMemo(() => {
    if (!selectedProductId) return [];
    const prod = data.find(p => p.id === selectedProductId);
    return prod?.producto_tallas || [];
  }, [selectedProductId, data]);

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 flex-shrink-0 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Almacén / Control Físico
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Shirt className="w-8 h-8 text-blue-600" />
            Inventario de Uniformes
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Monitorea el nivel de existencias físicas de prendas de vestir y realiza ajustes de inventario auditados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleOpenAdjust()}
            disabled={data.length === 0}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
          >
            Ajustar Stock Manual
          </button>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Shirt className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Prendas Totales en Stock</span>
            <span className="text-2xl font-black text-slate-900">{stats.totalItems}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Variantes con Stock Bajo (≤5)</span>
            <span className="text-2xl font-black text-slate-900 text-amber-600">{stats.lowStockCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Variantes Sin Stock (0)</span>
            <span className="text-2xl font-black text-slate-900 text-red-600">{stats.criticalStockCount}</span>
          </div>
        </div>
      </div>

      {/* Filter and Table Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[400px]">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-5 border-b border-slate-100 gap-4 bg-slate-50/10">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por SKU o Nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none text-slate-600"
            >
              <option value="">Todas las Categorías</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table representation */}
        <div className="flex-1 overflow-x-auto">
          {loading && filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Cargando inventario físico...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100">
                <Shirt className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No hay productos en inventario</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">Verifica tus filtros o inicializa tu catálogo.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">SKU</th>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4">Stock de Variantes (Talla - Cantidad)</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/40 transition-colors align-top">
                      <td className="px-6 py-4 font-mono text-xs text-slate-600 font-semibold pt-5">
                        {p.sku}
                      </td>
                      <td className="px-6 py-4 pt-5">
                        <div className="text-sm font-semibold text-slate-800">{p.nombre}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">Precio Unitario: S/. {parseFloat(p.precio_unitario).toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 pt-5">
                        {p.categorias_producto?.nombre || "General"}
                      </td>
                      <td className="px-6 py-4 pt-4">
                        <div className="flex flex-wrap gap-2.5">
                          {p.producto_tallas && p.producto_tallas.length > 0 ? (
                            p.producto_tallas.map((pt: any) => {
                              const isCritical = pt.stock_actual === 0;
                              const isLow = pt.stock_actual > 0 && pt.stock_actual <= 5;
                              return (
                                <div 
                                  key={pt.id} 
                                  className={`inline-flex flex-col border rounded-xl p-2 min-w-[90px] text-center shadow-sm transition-all ${
                                    isCritical ? "bg-red-50 border-red-200 text-red-700 font-bold" :
                                    isLow ? "bg-amber-50 border-amber-200 text-amber-700 font-semibold" :
                                    "bg-white border-slate-200 text-slate-700"
                                  }`}
                                >
                                  <span className="text-[10px] uppercase font-bold text-slate-400">Talla {pt.tallas?.valor || "E"}</span>
                                  <span className="text-base font-black tracking-tight mt-0.5">{pt.stock_actual}</span>
                                  <button
                                    onClick={() => handleOpenAdjust(p.id, pt.id)}
                                    className="text-[9px] mt-1.5 text-blue-600 hover:text-blue-700 hover:underline font-bold"
                                    title="Ajustar stock de esta talla"
                                  >
                                    Ajustar
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                              <HelpCircle className="w-4 h-4 text-amber-500" />
                              <span>Sin tallas configuradas</span>
                              <button 
                                onClick={() => handleOpenAdjust(p.id)}
                                className="text-xs text-blue-600 font-bold hover:underline ml-1"
                              >
                                Configurar Ajuste
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center pt-5">
                        <button
                          onClick={() => handleOpenAdjust(p.id)}
                          className="px-2.5 py-1.5 border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 text-xs font-semibold rounded-lg shadow-sm transition-all"
                        >
                          Ajuste Rápido
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Manual Adjustment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-slide-in border border-slate-100 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                <Shirt className="w-5 h-5 text-blue-600" />
                Ajuste Manual de Inventario
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              {modalError && (
                <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-lg text-xs font-semibold flex items-start gap-1.5">
                  <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Producto a Ajustar</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(parseInt(e.target.value))}
                  disabled={!!selectedProductId && modalVariants.length > 0} // lock product if opened from grid variant
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                >
                  <option value="">Seleccione un producto...</option>
                  {data.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} - {p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Talla / Variante</label>
                <select
                  required
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(parseInt(e.target.value))}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                >
                  <option value="">Seleccione una variante...</option>
                  {modalVariants.map((mv: any) => (
                    <option key={mv.id} value={mv.id}>Talla {mv.tallas?.valor || "Estándar"} (Stock actual: {mv.stock_actual})</option>
                  ))}
                </select>
              </div>

              {/* Movement Type */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Tipo de Movimiento</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustType("Ingreso")}
                    className={`px-4 py-2.5 rounded-lg text-sm font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      adjustType === "Ingreso" 
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    Ingreso (Compra/Devolución)
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setAdjustType("Salida")}
                    className={`px-4 py-2.5 rounded-lg text-sm font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      adjustType === "Salida" 
                        ? "bg-red-50 border-red-300 text-red-700 shadow-sm"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Minus className="w-4 h-4 stroke-[3]" />
                    Salida (Merma/Ajuste)
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cantidad a Ajustar</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Ej. 10"
                  value={adjustQuantity || ""}
                  onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-bold"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Motivo / Sustento de Ajuste</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ajuste inicial de inventario físico"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md active:scale-95 transition-all flex items-center gap-2"
                >
                  {modalLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                  Procesar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
