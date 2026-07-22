import React, { useState, useEffect } from "react";
import { supabase, getOrCreateUserForRole } from "../utils/supabase";
import {
  CheckSquare,
  Search,
  Check,
  X,
  AlertCircle,
  Clock,
  User,
  Building,
  RefreshCw,
  Edit,
  Eye,
  FileText,
  HelpCircle
} from "lucide-react";

export function BandejaAprobaciones() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // List of requisitions
  const [requerimientos, setRequerimientos] = useState<any[]>([]);
  const [selectedReq, setSelectedReq] = useState<any | null>(null);

  // Detail edits state (mapping detail.id -> modified values)
  // Store: { [detailId]: { cantidad_aprobada: number, producto_talla_id: number, motivo_modificacion: string } }
  const [edits, setEdits] = useState<Record<number, any>>({});

  // Rejection modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Active user role
  const role = localStorage.getItem("bax_role") || "admin";

  useEffect(() => {
    loadRequisitions();
  }, [role]);

  const loadRequisitions = async () => {
    setLoading(true);
    setError(null);
    try {
      // Query pending requisitions
      let query = supabase
        .from("requerimientos")
        .select(`
          *,
          sedes (id, nombre, clientes (razon_social)),
          usuario_solicitante:usuarios!requerimientos_usuario_solicitante_id_fkey (id, username, nombres, apellidos)
        `)
        .eq("estado", "Pendiente Aprobacion")
        .order("fecha_solicitud", { ascending: false });

      const { data, error: dbErr } = await query;
      if (dbErr) throw dbErr;

      // Client-side role filters
      let filtered = data || [];
      if (role === "logistica") {
        filtered = filtered.filter(r => r.tipo_solicitud === "Materiales_y_EPP");
      } else if (role === "almacen") {
        filtered = filtered.filter(r => r.tipo_solicitud === "Uniformes_Almacen");
      }

      setRequerimientos(filtered);
    } catch (err: any) {
      console.error("Error loading requisitions:", err);
      setError("Error al cargar la bandeja de aprobaciones.");
    } finally {
      setLoading(false);
    }
  };

  // Open detail panel and load details + product options
  const handleViewDetails = async (req: any) => {
    setError(null);
    setSuccessMsg(null);
    try {
      // Fetch details with product variants
      const { data: detailsData, error: detErr } = await supabase
        .from("requerimiento_detalles")
        .select(`
          *,
          productos (
            id,
            nombre,
            sku,
            es_uniforme,
            unidades_medida (nombre, codigo),
            producto_tallas (
              id,
              talla_id,
              stock_actual,
              tallas (valor)
            )
          ),
          vinculos_laborales (
            id,
            personas (nombres, apellidos, numero_documento)
          )
        `)
        .eq("requerimiento_id", req.id);

      if (detErr) throw detErr;

      const populatedReq = { ...req, detalles: detailsData || [] };
      setSelectedReq(populatedReq);

      // Initialize edits state with original values
      const initialEdits: Record<number, any> = {};
      populatedReq.detalles.forEach((det: any) => {
        initialEdits[det.id] = {
          cantidad_aprobada: det.cantidad_solicitada,
          producto_talla_id: det.producto_talla_id || "",
          motivo_modificacion: det.motivo_modificacion || ""
        };
      });
      setEdits(initialEdits);
    } catch (err: any) {
      console.error("Error loading requisition details:", err);
      setError("Error al obtener los detalles del requerimiento.");
    }
  };

  const handleEditChange = (detailId: number, field: string, value: any) => {
    setEdits(prev => ({
      ...prev,
      [detailId]: {
        ...prev[detailId],
        [field]: value
      }
    }));
  };

  // Check if a line item is altered from the original
  const isLineAltered = (det: any) => {
    const edit = edits[det.id];
    if (!edit) return false;
    const qtyAltered = edit.cantidad_aprobada !== det.cantidad_solicitada;
    const sizeAltered = det.producto_talla_id ? edit.producto_talla_id !== det.producto_talla_id : false;
    return qtyAltered || sizeAltered;
  };

  // Process Approval
  const handleApprove = async () => {
    if (!selectedReq) return;

    // Validate that all altered lines have a modification reason
    let validationFailed = false;
    selectedReq.detalles.forEach((det: any) => {
      const edit = edits[det.id];
      if (isLineAltered(det) && (!edit?.motivo_modificacion || !edit.motivo_modificacion.trim())) {
        validationFailed = true;
      }
    });

    if (validationFailed) {
      alert("Por favor ingrese un Motivo de Modificación para todas las filas cuyas cantidades o tallas hayan sido editadas.");
      return;
    }

    setSubmittingDecision(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // 1. Resolve active approver user ID
      const approverUserId = await getOrCreateUserForRole(role);

      // 2. Loop details to update approval values and optionally deduct stock
      for (const det of selectedReq.detalles) {
        const edit = edits[det.id];
        const approvedQty = edit.cantidad_aprobada;
        const approvedTallaId = edit.producto_talla_id || null;
        const reason = isLineAltered(det) ? edit.motivo_modificacion : null;

        // Update detail row
        const { error: detUpdErr } = await supabase
          .from("requerimiento_detalles")
          .update({
            cantidad_aprobada: approvedQty,
            producto_talla_id: approvedTallaId,
            motivo_modificacion: reason
          })
          .eq("id", det.id);

        if (detUpdErr) throw detUpdErr;

        // A. If affects stock (Uniformes_Almacen), deduct from inventory and insert audit log
        if (selectedReq.afecta_stock && approvedTallaId && approvedQty > 0) {
          // Fetch current stock
          const { data: ptData, error: ptGetErr } = await supabase
            .from("producto_tallas")
            .select("stock_actual")
            .eq("id", approvedTallaId)
            .single();

          if (ptGetErr) throw ptGetErr;

          const currentStock = ptData.stock_actual;
          const newStock = Math.max(0, currentStock - approvedQty);

          // Update stock
          const { error: ptUpdErr } = await supabase
            .from("producto_tallas")
            .update({ stock_actual: newStock })
            .eq("id", approvedTallaId);

          if (ptUpdErr) throw ptUpdErr;

          // Register in auditoria_stock
          const { error: audErr } = await supabase
            .from("auditoria_stock")
            .insert({
              producto_talla_id: approvedTallaId,
              usuario_id: approverUserId,
              tipo_movimiento: "Salida",
              cantidad: approvedQty,
              stock_previo: currentStock,
              stock_nuevo: newStock,
              motivo: `Aprobación de Requerimiento ${selectedReq.codigo}`,
              requerimiento_id: selectedReq.id
            });

          if (audErr) throw audErr;
        }
      }

      const { error: headErr } = await supabase
        .from("requerimientos")
        .update({
          estado: "Aprobado",
          usuario_aprobador_id: approverUserId,
          fecha_aprobacion: new Date().toISOString()
        })
        .eq("id", selectedReq.id);

      if (headErr) throw headErr;

      await supabase
        .from("notificaciones")
        .insert({
          usuario_id: selectedReq.usuario_solicitante_id,
          titulo: "Requerimiento Aprobado",
          mensaje: `Tu requerimiento ${selectedReq.codigo} fue aprobado por logística/almacén.`,
          tipo: "estado_requerimiento",
          link: "/requerimientos/solicitudes"
        });

      setSuccessMsg(`El requerimiento ${selectedReq.codigo} fue APROBADO con éxito.`);
      setSelectedReq(null);
      loadRequisitions();
    } catch (err: any) {
      console.error("Error approving request:", err);
      setError(err.message || "Error al registrar la aprobación.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Process Rejection
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || !rejectReason.trim()) return;

    setSubmittingDecision(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const approverUserId = await getOrCreateUserForRole(role);

      const { error: headErr } = await supabase
        .from("requerimientos")
        .update({
          estado: "Rechazado",
          motivo_rechazo: rejectReason,
          usuario_aprobador_id: approverUserId,
          fecha_aprobacion: new Date().toISOString()
        })
        .eq("id", selectedReq.id);

      if (headErr) throw headErr;

      await supabase
        .from("notificaciones")
        .insert({
          usuario_id: selectedReq.usuario_solicitante_id,
          titulo: "Requerimiento Rechazado",
          mensaje: `Tu requerimiento ${selectedReq.codigo} fue rechazado. Motivo: ${rejectReason}`,
          tipo: "estado_requerimiento",
          link: "/requerimientos/solicitudes"
        });

      setSuccessMsg(`El requerimiento ${selectedReq.codigo} fue RECHAZADO.`);
      setIsRejectModalOpen(false);
      setRejectReason("");
      setSelectedReq(null);
      loadRequisitions();
    } catch (err: any) {
      console.error("Error rejecting request:", err);
      setError(err.message || "Error al registrar el rechazo.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  const isAuthorizedRole = role === "admin" || role === "logistica" || role === "almacen";

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between flex-shrink-0 gap-4 mb-2">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Requerimientos / Autorizaciones
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CheckSquare className="w-8 h-8 text-blue-600" />
            Bandeja de Aprobaciones
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Modifica, aprueba o rechaza solicitudes de tu área. Las deducciones de stock e historial de auditoría se computan automáticamente.
          </p>
        </div>
      </div>

      {/* Role Banner / Warning */}
      {!isAuthorizedRole ? (
        <div className="bg-amber-50 border border-amber-100 text-amber-800 p-4 rounded-2xl text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Acceso en Modo Lectura:</span> Tu rol actual (<span className="capitalize font-black">{role}</span>) no está autorizado para aprobar requerimientos. Puedes visualizar las solicitudes pero las acciones de aprobación estarán bloqueadas. Cambia a <strong>Logística</strong>, <strong>Almacén</strong> o <strong>Administrador</strong> en la barra superior para procesar.
          </div>
        </div>
      ) : (
        <div className="bg-blue-50/50 border border-blue-100/50 text-blue-800 p-4 rounded-2xl text-xs flex items-center gap-2.5">
          <Clock className="w-4.5 h-4.5 text-blue-500" />
          <span>
            Bandeja filtrada automáticamente para el rol <span className="capitalize font-black">{role}</span>. Mostrando solicitudes de tipo: {role === "logistica" ? "Materiales y EPP" : role === "almacen" ? "Uniformes de Almacén" : "Todos los Módulos"}.
          </span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Side: Pending list */}
        <div className={`${selectedReq ? "xl:col-span-5" : "xl:col-span-12"} bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden`}>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Solicitudes Pendientes ({requerimientos.length})
            </h3>
            <button 
              onClick={loadRequisitions} 
              disabled={loading}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded"
              title="Refrescar lista"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            {loading && requerimientos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
                <span className="text-xs font-medium">Buscando solicitudes...</span>
              </div>
            ) : requerimientos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <CheckSquare className="w-10 h-10 text-slate-200 mb-2" />
                <p className="text-xs font-bold text-slate-700">No hay pendientes</p>
                <p className="text-[11px] text-slate-400 mt-0.5">¡Buen trabajo! No tienes requerimientos por aprobar en esta cola.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Sede</th>
                    <th className="px-4 py-3">Solicitante</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requerimientos.map((req) => {
                    const isSelected = selectedReq?.id === req.id;
                    return (
                      <tr 
                        key={req.id} 
                        className={`hover:bg-slate-50/40 transition-colors ${isSelected ? "bg-blue-50/30 font-medium" : ""}`}
                      >
                        <td className="px-4 py-4 font-mono font-bold text-slate-700">
                          {req.codigo}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-slate-800 block font-semibold">{req.sedes?.nombre}</span>
                          <span className="text-[10px] text-slate-400 block">{req.sedes?.clientes?.razon_social}</span>
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {req.usuario_solicitante?.nombres} {req.usuario_solicitante?.apellidos}
                        </td>
                        <td className="px-4 py-4">
                          {req.tipo_solicitud === "Uniformes_Almacen" ? (
                            <span className="inline-flex px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[9px] uppercase">
                              Uniformes
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-bold text-[9px] uppercase">
                              Materiales/EPP
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleViewDetails(req)}
                            className="inline-flex items-center gap-1 bg-slate-100 hover:bg-blue-600 hover:text-white px-2.5 py-1.5 rounded-lg text-slate-600 font-bold transition-all text-[11px]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Procesar
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

        {/* Right Side: Requisition Details & Action Panel */}
        {selectedReq && (
          <div className="xl:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Procesando Solicitud</span>
                <h3 className="font-heading text-base font-bold text-slate-800">
                  {selectedReq.codigo}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-150 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Requisition Info Header */}
            <div className="p-5 bg-slate-50/10 border-b border-slate-100 text-xs grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 block uppercase font-semibold text-[10px]">Sede Destino:</span>
                <span className="font-bold text-slate-800 mt-0.5 block">{selectedReq.sedes?.nombre}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase font-semibold text-[10px]">Solicitante:</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {selectedReq.usuario_solicitante?.nombres} {selectedReq.usuario_solicitante?.apellidos} (<span className="font-mono text-slate-500">{selectedReq.usuario_solicitante?.username}</span>)
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="p-5 flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-3 py-2">Artículo</th>
                    <th className="px-3 py-2">Asignación</th>
                    <th className="px-3 py-2 text-center">Talla</th>
                    <th className="px-3 py-2 text-center">Solicitado</th>
                    <th className="px-3 py-2 text-center w-20">Aprobar</th>
                    <th className="px-3 py-2">Motivo de Modificación (Obligatorio si cambia)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedReq.detalles?.map((det: any) => {
                    const isAltered = isLineAltered(det);
                    const edit = edits[det.id] || {};
                    const hasVariants = det.productos?.producto_tallas?.length > 0;

                    return (
                      <tr key={det.id} className={`hover:bg-slate-50/20 ${isAltered ? "bg-amber-50/20" : ""}`}>
                        <td className="px-3 py-3">
                          <span className="font-bold text-slate-800 block">{det.productos?.nombre}</span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-100/80 px-1 rounded font-normal">SKU: {det.productos?.sku}</span>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded uppercase border border-indigo-100">
                              U.M.: {det.productos?.unidades_medida?.nombre || "Unidad"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {det.vinculos_laborales?.personas ? (
                            <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-medium">
                              <User className="w-3 h-3 text-slate-400" />
                              {det.vinculos_laborales.personas.nombres} {det.vinculos_laborales.personas.apellidos}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">General</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-bold">
                          {hasVariants ? (
                            <select
                              disabled={!isAuthorizedRole}
                              value={edit.producto_talla_id}
                              onChange={(e) => handleEditChange(det.id, "producto_talla_id", Number(e.target.value))}
                              className="p-1 border border-slate-200 rounded text-[11px] font-bold bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {det.productos.producto_tallas.map((v: any) => (
                                <option key={v.id} value={v.id}>
                                  Talla {v.tallas?.valor || "E"} (Stock: {v.stock_actual})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-slate-500 text-sm">
                          {det.cantidad_solicitada}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={det.cantidad_solicitada}
                            disabled={!isAuthorizedRole}
                            value={edit.cantidad_aprobada}
                            onChange={(e) => handleEditChange(det.id, "cantidad_aprobada", parseInt(e.target.value) || 0)}
                            className="w-16 p-1.5 border border-slate-200 rounded text-center font-bold text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            placeholder={isAltered ? "Escriba motivo..." : "Sin cambios"}
                            disabled={!isAltered || !isAuthorizedRole}
                            value={edit.motivo_modificacion}
                            onChange={(e) => handleEditChange(det.id, "motivo_modificacion", e.target.value)}
                            className={`w-full p-1.5 border rounded text-xs focus:outline-none transition-all ${
                              isAltered 
                                ? "border-amber-300 bg-white placeholder-slate-400 font-medium ring-2 ring-amber-100" 
                                : "border-slate-100 bg-slate-50 placeholder-slate-300 cursor-not-allowed"
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Decision panel actions */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-[11px] text-slate-400 font-medium">
                * Las cantidades aprobadas no pueden exceder las solicitadas.
              </span>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={submittingDecision || !isAuthorizedRole}
                  onClick={() => setIsRejectModalOpen(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 font-bold px-4 py-2 rounded-lg text-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  <X className="w-4 h-4 stroke-[3]" />
                  Rechazar Requerimiento
                </button>
                <button
                  type="button"
                  disabled={submittingDecision || !isAuthorizedRole}
                  onClick={handleApprove}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {submittingDecision ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[3]" />
                  )}
                  Aprobar Requerimiento
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rejection Cause Modal Dialog */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in text-xs">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-heading text-sm font-bold text-slate-800 flex items-center gap-2">
                <X className="w-5 h-5 text-red-600" />
                Rechazar Solicitud {selectedReq?.codigo}
              </h3>
              <button 
                onClick={() => setIsRejectModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Motivo / Sustento del Rechazo (Obligatorio)
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describa el motivo por el cual no se autoriza esta solicitud..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-100 bg-white"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition-all text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision || !rejectReason.trim()}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 shadow-md active:scale-95 transition-all text-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {submittingDecision ? <RefreshCw className="w-4.5 h-4.5 animate-spin" /> : <X className="w-4.5 h-4.5 stroke-[3]" />}
                  Confirmar Rechazo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
