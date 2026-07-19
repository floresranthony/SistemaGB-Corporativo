import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import {
  Truck,
  Search,
  Check,
  X,
  FileText,
  AlertCircle,
  Printer,
  ChevronRight,
  Info,
  RefreshCw,
  ShoppingBag,
  User,
  ArrowRight
} from "lucide-react";

export function DespachosEntregas() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // List of requisitions in transit / approved
  const [requerimientos, setRequerimientos] = useState<any[]>([]);

  // Selected Requisition for actions
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  
  // Modals state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isDeliverModalOpen, setIsDeliverModalOpen] = useState(false);

  // Delivery Form State
  // Map detailId -> quantity delivered in this session
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<number, number>>({});
  const [notesIncomplete, setNotesIncomplete] = useState("");
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  useEffect(() => {
    loadRequisitions();
  }, []);

  const loadRequisitions = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch approved, in transit, or partially delivered requests
      const { data, error: dbErr } = await supabase
        .from("requerimientos")
        .select(`
          *,
          sedes (
            id,
            nombre,
            direccion,
            contacto_nombre,
            contacto_telefono,
            clientes (razon_social)
          ),
          usuario_solicitante:usuarios!requerimientos_usuario_solicitante_id_fkey (nombres, apellidos, username)
        `)
        .in("estado", ["Aprobado", "Enviado", "Entregado Incompleto"])
        .order("fecha_aprobacion", { ascending: false });

      if (dbErr) throw dbErr;
      setRequerimientos(data || []);
    } catch (err: any) {
      console.error("Error loading requisitions for dispatch:", err);
      setError("Error al cargar la bandeja de despachos.");
    } finally {
      setLoading(false);
    }
  };

  // Open the printable delivery slip modal
  const handleOpenPrintSlip = async (req: any) => {
    try {
      setLoading(true);
      const { data: detailsData, error: detErr } = await supabase
        .from("requerimiento_detalles")
        .select(`
          *,
          productos (nombre, sku, es_uniforme),
          producto_tallas (tallas (valor)),
          vinculos_laborales (personas (nombres, apellidos, numero_documento))
        `)
        .eq("requerimiento_id", req.id);

      if (detErr) throw detErr;

      setSelectedReq({ ...req, detalles: detailsData || [] });
      setIsPrintModalOpen(true);
    } catch (err: any) {
      alert("Error al cargar detalles para el vale: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Open delivery checkout modal
  const handleOpenDeliverCheckout = async (req: any) => {
    try {
      setLoading(true);
      const { data: detailsData, error: detErr } = await supabase
        .from("requerimiento_detalles")
        .select(`
          *,
          productos (nombre, sku, es_uniforme),
          producto_tallas (tallas (valor)),
          vinculos_laborales (personas (nombres, apellidos))
        `)
        .eq("requerimiento_id", req.id);

      if (detErr) throw detErr;

      const populated = { ...req, detalles: detailsData || [] };
      setSelectedReq(populated);

      // Initialize inputs: 
      // If "Aprobado" or "Enviado" -> default to full quantity approved.
      // If "Entregado Incompleto" -> default to the remaining outstanding balance (cantidad_aprobada - cantidad_entregada)
      const initialQtys: Record<number, number> = {};
      populated.detalles.forEach((det: any) => {
        const remaining = det.cantidad_aprobada - (det.cantidad_entregada || 0);
        initialQtys[det.id] = remaining >= 0 ? remaining : 0;
      });

      setDeliveryQuantities(initialQtys);
      setNotesIncomplete(req.notas_entrega_incompleta || "");
      setIsDeliverModalOpen(true);
    } catch (err: any) {
      alert("Error al abrir confirmación: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (detailId: number, value: number, maxVal: number) => {
    const val = Math.min(maxVal, Math.max(0, value));
    setDeliveryQuantities(prev => ({
      ...prev,
      [detailId]: val
    }));
  };

  // Submit delivery checkout
  const handleSubmitDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    setSubmittingDelivery(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let isPartial = false;
      let someItemDelivered = false;

      // Update each detail row
      for (const det of selectedReq.detalles) {
        const deliveredThisSession = deliveryQuantities[det.id] || 0;
        const totalDelivered = (det.cantidad_entregada || 0) + deliveredThisSession;

        if (deliveredThisSession > 0) {
          someItemDelivered = true;
        }

        if (totalDelivered < det.cantidad_aprobada) {
          isPartial = true;
        }

        // Update database
        const { error: updErr } = await supabase
          .from("requerimiento_detalles")
          .update({ cantidad_entregada: totalDelivered })
          .eq("id", det.id);

        if (updErr) throw updErr;
      }

      // If they click confirm but set all session quantities to 0
      if (!someItemDelivered && selectedReq.estado !== "Entregado Incompleto") {
        throw new Error("Debe registrar al menos 1 unidad entregada para poder procesar.");
      }

      // Determine new header status
      const nextStatus = isPartial ? "Entregado Incompleto" : "Entregado";
      
      if (nextStatus === "Entregado Incompleto" && !notesIncomplete.trim()) {
        throw new Error("Debe ingresar notas detallando el motivo de la entrega incompleta (ej: tallas faltantes en almacén, quiebre de stock).");
      }

      // Update requisition status
      const { error: headErr } = await supabase
        .from("requerimientos")
        .update({
          estado: nextStatus,
          notas_entrega_incompleta: nextStatus === "Entregado Incompleto" ? notesIncomplete : null,
          fecha_entrega: nextStatus === "Entregado" ? new Date().toISOString() : null
        })
        .eq("id", selectedReq.id);

      if (headErr) throw headErr;

      setSuccessMsg(`Entrega registrada con éxito. Pedido marcado como: ${nextStatus === "Entregado" ? "Entregado Completo" : "Entregado Incompleto"}.`);
      setIsDeliverModalOpen(false);
      setSelectedReq(null);
      loadRequisitions();
    } catch (err: any) {
      console.error("Error committing delivery:", err);
      alert(err.message || "Error al registrar la entrega.");
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between flex-shrink-0 gap-4 mb-2">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Almacén / Logística
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-8 h-8 text-blue-600" />
            Despachos y Entregas
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Registra entregas a supervisores y personal de obra. Genera vales de salida oficiales y gestiona entregas parciales y saldos pendientes.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[400px]">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/10">
          <h3 className="text-sm font-bold text-slate-800">
            Pedidos Listos para Entrega o en Tránsito
          </h3>
          <button 
            onClick={loadRequisitions} 
            disabled={loading}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded"
            title="Actualizar tabla"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex-1 overflow-x-auto">
          {loading && requerimientos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Buscando requerimientos para entrega...</p>
            </div>
          ) : requerimientos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 space-y-2">
              <Truck className="w-12 h-12 text-slate-200 stroke-[1.5]" />
              <h3 className="text-sm font-bold text-slate-700">Sin despachos pendientes</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                No hay pedidos aprobados esperando entrega física. Todos los pedidos están completados o rechazados.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Código</th>
                  <th className="px-6 py-4">Sede Operativa</th>
                  <th className="px-6 py-4">Solicitante</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-center">Fecha Aprobación</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requerimientos.map((req) => {
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700 text-sm">
                        {req.codigo}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-800 block text-xs">{req.sedes?.nombre}</span>
                        <span className="text-[10px] text-slate-400 block">{req.sedes?.clientes?.razon_social}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {req.usuario_solicitante?.nombres} {req.usuario_solicitante?.apellidos}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {req.estado === "Aprobado" && (
                          <span className="inline-flex px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-bold text-[9px] uppercase">
                            Aprobado (Listo)
                          </span>
                        )}
                        {req.estado === "Enviado" && (
                          <span className="inline-flex px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-bold text-[9px] uppercase">
                            En Tránsito
                          </span>
                        )}
                        {req.estado === "Entregado Incompleto" && (
                          <span className="inline-flex px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full font-bold text-[9px] uppercase">
                            Entregado Incompleto
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500 font-mono">
                        {req.fecha_aprobacion ? new Date(req.fecha_aprobacion).toLocaleString() : "—"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenPrintSlip(req)}
                            className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg text-slate-700 font-bold transition-all text-[11px]"
                            title="Ver Vale de Salida PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Vale PDF
                          </button>
                          
                          <button
                            onClick={() => handleOpenDeliverCheckout(req)}
                            className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition-all text-[11px] active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Registrar Entrega
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* PRINT SLIP MODAL (VALE DE SALIDA PREVIEW) */}
      {isPrintModalOpen && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 flex flex-col my-8 max-h-[90vh]">
            
            {/* Modal Control Header (Hidden in Print) */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden shrink-0">
              <h3 className="font-heading text-sm font-bold text-slate-800 flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                Vista Previa del Vale de Salida
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs shadow-md transition-all active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Vale
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Box */}
            <div className="flex-1 overflow-y-auto p-8 print:p-0 bg-slate-50 print:bg-white text-slate-800">
              {/* Actual printed paper sheets styling */}
              <div className="mx-auto w-full max-w-3xl bg-white p-8 border border-slate-200 shadow-lg print:border-none print:shadow-none print:p-0 min-h-[297mm] flex flex-col justify-between">
                
                <div className="space-y-6">
                  {/* Document Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <img src="/logo.png" alt="Grupo Bax Logo" className="w-14 h-14 object-contain rounded" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                      <div>
                        <h2 className="font-heading text-lg font-black tracking-tight text-slate-900 leading-none">GRUPO BAX S.A.C.</h2>
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-1 block">Logística e Inventarios</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block border-2 border-slate-800 px-3 py-1 font-mono font-extrabold text-sm text-slate-900">
                        VALE DE SALIDA: {selectedReq.codigo}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-1">Fecha Emisión: {new Date().toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Metadata fields */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-slate-50 border border-slate-250 p-4 rounded-xl text-xs font-medium text-slate-700">
                    <div>
                      <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wider">Cliente / Cuenta:</span>
                      <span className="font-black text-slate-800 mt-0.5 block">{selectedReq.sedes?.clientes?.razon_social}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wider">Sede Operativa:</span>
                      <span className="font-black text-slate-800 mt-0.5 block">{selectedReq.sedes?.nombre}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wider">Dirección Destino:</span>
                      <span className="font-semibold block mt-0.5 text-slate-600 truncate">{selectedReq.sedes?.direccion || "Recojo en Almacén Principal"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wider font-heading">Solicitado por:</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">
                        {selectedReq.usuario_solicitante?.nombres} {selectedReq.usuario_solicitante?.apellidos} (<span className="font-mono">{selectedReq.usuario_solicitante?.username}</span>)
                      </span>
                    </div>
                  </div>

                  {/* Items List Table */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Detalle de Bienes a Entregar</h4>
                    <table className="w-full text-left border-collapse text-xs border border-slate-300">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                          <th className="px-3 py-2 border-r border-slate-300">SKU</th>
                          <th className="px-3 py-2 border-r border-slate-300">Descripción del Artículo</th>
                          <th className="px-3 py-2 border-r border-slate-300">Colaborador Asignado</th>
                          <th className="px-3 py-2 border-r border-slate-300 text-center">Talla</th>
                          <th className="px-3 py-2 border-r border-slate-300 text-center">Aprobado</th>
                          <th className="px-3 py-2 border-r border-slate-300 text-center">Entregado</th>
                          <th className="px-3 py-2 text-center w-24">Firma</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300">
                        {selectedReq.detalles?.map((det: any) => (
                          <tr key={det.id} className="align-middle">
                            <td className="px-3 py-2.5 font-mono border-r border-slate-300 text-[10px] font-bold text-slate-600">{det.productos?.sku}</td>
                            <td className="px-3 py-2.5 border-r border-slate-300 font-bold text-slate-900">{det.productos?.nombre}</td>
                            <td className="px-3 py-2.5 border-r border-slate-300 text-slate-700">
                              {det.vinculos_laborales?.personas ? (
                                `${det.vinculos_laborales.personas.nombres} ${det.vinculos_laborales.personas.apellidos}`
                              ) : (
                                <span className="text-slate-400 italic font-medium">Uso General de Obra</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 border-r border-slate-300 text-center font-bold text-slate-700">
                              {det.producto_tallas?.tallas?.valor || "—"}
                            </td>
                            <td className="px-3 py-2.5 border-r border-slate-300 text-center font-bold text-slate-600 text-xs">{det.cantidad_aprobada}</td>
                            <td className="px-3 py-2.5 border-r border-slate-300 text-center font-black text-slate-900 text-xs">
                              {det.cantidad_entregada || 0}
                            </td>
                            <td className="px-3 py-2.5 border-slate-300"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Comments / Disclaimer */}
                  {selectedReq.notas_entrega_incompleta && (
                    <div className="bg-purple-50/50 border border-purple-100 p-3 rounded-lg text-[10.5px]">
                      <span className="font-bold text-purple-900 uppercase block mb-1">Notas de Entrega Parcial:</span>
                      <p className="text-purple-800 font-medium">{selectedReq.notas_entrega_incompleta}</p>
                    </div>
                  )}
                </div>

                {/* Signatures Panel */}
                <div className="grid grid-cols-2 gap-8 border-t border-slate-300 pt-16 mt-12 shrink-0">
                  <div className="flex flex-col items-center">
                    <div className="w-48 border-b border-slate-800"></div>
                    <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mt-1.5">Entregado Por (Almacén)</span>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">Grupo Bax S.A.C.</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="w-48 border-b border-slate-800"></div>
                    <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mt-1.5">Recibido Conforme</span>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">Sede: {selectedReq.sedes?.nombre}</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM / CHECKOUT DELIVERY MODAL */}
      {isDeliverModalOpen && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in text-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-100 flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Checkout de Despacho</span>
                <h3 className="font-heading text-base font-bold text-slate-800">
                  Confirmar Entrega de Pedido {selectedReq.codigo}
                </h3>
              </div>
              <button 
                onClick={() => setIsDeliverModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDelivery} className="flex-1 flex flex-col justify-between">
              {/* Items checklist */}
              <div className="p-5 space-y-4">
                {selectedReq.estado === "Entregado Incompleto" && (
                  <div className="bg-purple-50 border border-purple-100 text-purple-800 p-3 rounded-lg text-[11px] flex items-start gap-2">
                    <Info className="w-5 h-5 text-purple-500 shrink-0" />
                    <div>
                      <strong>Regularización de Pendientes:</strong> Este requerimiento fue entregado parcialmente. Ingrese las unidades adicionales que está entregando hoy. El saldo pendiente acumulado se calculará de forma dinámica.
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cantidades de Despacho Físico</h4>
                  
                  <div className="border border-slate-100 rounded-xl divide-y divide-slate-100">
                    {selectedReq.detalles?.map((det: any) => {
                      const previouslyDelivered = det.cantidad_entregada || 0;
                      const maxDeliverableNow = det.cantidad_aprobada - previouslyDelivered;
                      const currentSessionQty = deliveryQuantities[det.id] || 0;

                      return (
                        <div key={det.id} className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/10 hover:bg-slate-50/30 transition-colors">
                          <div className="max-w-[65%]">
                            <span className="font-bold text-slate-800 block">{det.productos?.nombre}</span>
                            <span className="text-[10px] text-slate-400 block font-medium">
                              Talla {det.producto_tallas?.tallas?.valor || "—"} • 
                              {det.vinculos_laborales?.personas ? ` Asignado: ${det.vinculos_laborales.personas.nombres} ${det.vinculos_laborales.personas.apellidos}` : " Insumo general"}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                            <div className="text-right text-[10px] text-slate-400">
                              <span className="block font-bold">Aprobado: <span className="text-slate-700">{det.cantidad_aprobada}</span></span>
                              <span className="block">Entregado: <span className="text-slate-700">{previouslyDelivered}</span></span>
                            </div>

                            {maxDeliverableNow <= 0 ? (
                              <span className="inline-flex px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold text-[10px]">
                                Completado
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-500">Entregar:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={maxDeliverableNow}
                                  value={currentSessionQty}
                                  onChange={(e) => handleQtyChange(det.id, parseInt(e.target.value) || 0, maxDeliverableNow)}
                                  className="w-16 p-1 border border-slate-200 rounded font-black text-center text-xs focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-400 font-mono">/ {maxDeliverableNow} máx</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Conditional Notes textarea for Incomplete checkout */}
                {/* We trigger notes required if ANY row will result in total_delivered < approved */}
                {selectedReq.detalles?.some((det: any) => {
                  const previouslyDelivered = det.cantidad_entregada || 0;
                  const currentSessionQty = deliveryQuantities[det.id] || 0;
                  return (previouslyDelivered + currentSessionQty) < det.cantidad_aprobada;
                }) && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="text-[10px] font-bold text-purple-900 uppercase tracking-widest flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-purple-500" />
                      Sustento Obligatorio por Entrega Incompleta
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describa el motivo del faltante (ej: Quiebre de stock de talla M, regularización en 48 horas con nuevo despacho...)"
                      value={notesIncomplete}
                      onChange={(e) => setNotesIncomplete(e.target.value)}
                      className="w-full p-2.5 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-100 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsDeliverModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 text-xs"
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  disabled={submittingDelivery}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg text-xs shadow-md active:scale-95 transition-all disabled:opacity-50"
                >
                  {submittingDelivery ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[3]" />
                  )}
                  Confirmar Despacho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
