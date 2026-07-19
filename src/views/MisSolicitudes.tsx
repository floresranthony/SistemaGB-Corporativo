import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../utils/authContext";
import {
  ClipboardList,
  Search,
  Plus,
  Trash2,
  ShoppingCart,
  User,
  Users,
  Building,
  Send,
  Info,
  AlertCircle,
  RefreshCw,
  Check,
  X,
  FileText,
  Calendar,
  Truck,
  ShieldAlert,
  Eye,
  ArrowLeft,
  Filter
} from "lucide-react";

interface CartItem {
  id: string; // local temporary UI ID
  producto: any; // full product details
  productoTallaId?: number; // variant ID (optional)
  tallaValor?: string; // variant name (e.g. "M", "S", or "Estándar")
  vinculoLaboralId?: number; // associated worker vínculo
  personaNombre?: string; // worker display name
  cantidad: number;
  observacion?: string; // item specific notes (marca, color, aroma)
}

interface Requerimiento {
  id: number;
  codigo: string;
  sede_id: number;
  usuario_solicitante_id: number;
  usuario_aprobador_id: number | null;
  tipo_solicitud: "Materiales_y_EPP" | "Uniformes_Almacen";
  afecta_stock: boolean;
  estado: string;
  apoyo_extraordinario: boolean;
  fecha_solicitud: string;
  fecha_aprobacion: string | null;
  fecha_envio: string | null;
  fecha_entrega: string | null;
  motivo_rechazo: string | null;
  notas_entrega_incompleta: string | null;
  sedes?: {
    id: number;
    nombre: string;
    contacto_telefono: string;
    presupuesto: string;
    clientes?: {
      id: number;
      razon_social: string;
    };
  };
  usuarios?: {
    id: number;
    nombres: string;
    apellidos: string;
  };
}

interface MisSolicitudesProps {
  defaultTab?: "Materiales_y_EPP" | "Uniformes_Almacen";
  lockTab?: boolean;
}

export function MisSolicitudes({ defaultTab, lockTab = false }: MisSolicitudesProps = {}) {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // View state: 'list' | 'create' | 'detail' | 'mark_incomplete' | 'complete'
  const [viewState, setViewState] = useState<'list' | 'create' | 'detail' | 'mark_incomplete' | 'complete'>('list');

  // --- TAB STATE ---
  const [activeTab, setActiveTab] = useState<"Materiales_y_EPP" | "Uniformes_Almacen">(
    defaultTab || "Materiales_y_EPP"
  );

  // --- LIST STATE ---
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [supervisorFilter, setSupervisorFilter] = useState("all");
  const [supervisoresList, setSupervisoresList] = useState<{ id: number; nombres: string; apellidos: string }[]>([]);
  
  // --- DETAIL / ACTION STATE ---
  const [selectedReq, setSelectedReq] = useState<Requerimiento | null>(null);
  const [reqDetails, setReqDetails] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Requisition Approval Edits
  const [edits, setEdits] = useState<Record<number, { cantidad_aprobada: number; motivo_modificacion: string }>>({});
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Incomplete delivery state
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<number, number>>({});
  const [deliveryNote, setDeliveryNote] = useState("");

  // --- CREATE STATE ---
  const [sedes, setSedes] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [vinculos, setVinculos] = useState<any[]>([]);

  // Form Fields
  const [selectedSedeId, setSelectedSedeId] = useState<number | "">("");
  const [isExtraordinarySupport, setIsExtraordinarySupport] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Individual item fields
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [selectedVariantId, setSelectedVariantId] = useState<number | "">("");
  const [selectedVinculoId, setSelectedVinculoId] = useState<number | " text-slate-700">("");
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemObservation, setItemObservation] = useState("");
  const [isAssignToPerson, setIsAssignToPerson] = useState(false);
  const [cameFromDetail, setCameFromDetail] = useState(false);

  // --- CUSTOM SYSTEM ALERTS / CONFIRM MODALS ---
  const [systemAlert, setSystemAlert] = useState<{
    show: boolean;
    title: string;
    message: string;
    isConfirm: boolean;
    onAccept?: () => void;
    onCancel?: () => void;
  }>({
    show: false,
    title: "",
    message: "",
    isConfirm: false
  });

  const alert = (message: string, title: string = "Mensaje del Sistema") => {
    setSystemAlert({
      show: true,
      title,
      message,
      isConfirm: false
    });
  };

  const showConfirm = (message: string, onAccept: () => void, title: string = "Confirmación de Acción") => {
    setSystemAlert({
      show: true,
      title,
      message,
      isConfirm: true,
      onAccept: () => {
        setSystemAlert(prev => ({ ...prev, show: false }));
        onAccept();
      },
      onCancel: () => {
        setSystemAlert(prev => ({ ...prev, show: false }));
      }
    });
  };

  // Bulk mode fields
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkProductId, setBulkProductId] = useState<number | "">("");
  const [bulkQuantity, setBulkQuantity] = useState<number>(1);
  const [bulkObservation, setBulkObservation] = useState("");
  const [bulkWorkers, setBulkWorkers] = useState<any[]>([]);

  // Enforce role-based Tab permissions
  useEffect(() => {
    if (!lockTab) {
      if (role === "rrhh" || role === "almacen") {
        setActiveTab("Uniformes_Almacen");
      }
    }
  }, [role, lockTab]);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Load appropriate data based on viewState
  useEffect(() => {
    if (viewState === "create") {
      loadCreationLookups();
    } else if (viewState === "list") {
      loadRequerimientosList();
    }
  }, [viewState, role, user, activeTab]);

  // Reload Sedes whenever extraordinary support checkbox changes
  useEffect(() => {
    if (viewState === "create" && user) {
      loadSedes(isExtraordinarySupport);
    }
  }, [isExtraordinarySupport, viewState, user]);

  // Load workers when Sede changes in creation form
  useEffect(() => {
    if (selectedSedeId) {
      loadWorkersForSede(Number(selectedSedeId));
      setCart([]);
    } else {
      setVinculos([]);
      setCart([]);
    }
  }, [selectedSedeId]);

  // Autocomplete variant size when worker is selected (if uniform)
  useEffect(() => {
    if (!selectedProductId || !selectedVinculoId) return;

    const prod = productos.find(p => p.id === Number(selectedProductId));
    const vin = vinculos.find(v => v.id === Number(selectedVinculoId));

    if (!prod || !vin || !prod.es_uniforme) return;

    const categoryName = prod.categorias_producto?.nombre?.toLowerCase() || "";
    const productName = prod.nombre.toLowerCase();
    
    let defaultTallaValor = "";
    if (categoryName.includes("polo") || productName.includes("polo") || categoryName.includes("camisa") || productName.includes("camisa") || categoryName.includes("casaca") || productName.includes("casaca")) {
      defaultTallaValor = vin.personas?.talla_polo || "";
    } else if (categoryName.includes("pantalon") || productName.includes("pantalon") || categoryName.includes("jeans") || productName.includes("jeans")) {
      defaultTallaValor = vin.personas?.talla_pantalon || "";
    } else if (categoryName.includes("calzado") || productName.includes("calzado") || categoryName.includes("zapato") || productName.includes("zapato") || categoryName.includes("bota") || productName.includes("bota")) {
      defaultTallaValor = vin.personas?.talla_calzado || "";
    }

    if (defaultTallaValor && prod.producto_tallas) {
      const match = prod.producto_tallas.find(
        (pt: any) => pt.tallas?.valor?.toLowerCase() === defaultTallaValor.toLowerCase()
      );
      if (match) {
        setSelectedVariantId(match.id);
      }
    }
  }, [selectedProductId, selectedVinculoId, productos, vinculos]);

  // Bulk Product selection map workers
  useEffect(() => {
    if (!bulkProductId) {
      setBulkWorkers([]);
      return;
    }

    const prod = productos.find(p => p.id === Number(bulkProductId));
    if (!prod) return;

    const categoryName = prod.categorias_producto?.nombre?.toLowerCase() || "";
    const productName = prod.nombre.toLowerCase();

    const mapped = vinculos.map(v => {
      let defaultTallaValor = "";
      if (categoryName.includes("polo") || productName.includes("polo") || categoryName.includes("camisa") || productName.includes("camisa") || categoryName.includes("casaca") || productName.includes("casaca")) {
        defaultTallaValor = v.personas?.talla_polo || "";
      } else if (categoryName.includes("pantalon") || productName.includes("pantalon") || categoryName.includes("jeans") || productName.includes("jeans")) {
        defaultTallaValor = v.personas?.talla_pantalon || "";
      } else if (categoryName.includes("calzado") || productName.includes("calzado") || categoryName.includes("zapato") || productName.includes("zapato") || categoryName.includes("bota") || productName.includes("bota")) {
        defaultTallaValor = v.personas?.talla_calzado || "";
      }

      let matchedVariantId = "";
      if (prod.es_uniforme && prod.producto_tallas) {
        const match = prod.producto_tallas.find(
          (pt: any) => pt.tallas?.valor?.toLowerCase() === defaultTallaValor.toLowerCase()
        );
        matchedVariantId = match?.id || prod.producto_tallas[0]?.id || "";
      } else if (prod.producto_tallas && prod.producto_tallas.length > 0) {
        matchedVariantId = prod.producto_tallas[0].id;
      }

      return {
        vinculoId: v.id,
        nombreCompleto: `${v.personas?.nombres} ${v.personas?.apellidos}`,
        dni: v.personas?.numero_documento,
        cargo: v.cargos?.nombre || "Sin Cargo",
        selectedVariantId: matchedVariantId,
        checked: true
      };
    });

    setBulkWorkers(mapped);
  }, [bulkProductId, vinculos, productos]);

  // Load supervisors list if role is administrative
  useEffect(() => {
    if (role === "admin" || role === "logistica" || role === "almacen") {
      fetchSupervisores();
    }
  }, [role]);

  // --- DATABASE FUNCTIONS ---

  const fetchSupervisores = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from("usuarios")
        .select(`
          id,
          nombres,
          apellidos,
          roles (codigo)
        `)
        .eq("activo", true);

      if (fetchErr) throw fetchErr;

      const filtered = data
        ?.filter((u: any) => u.roles?.codigo === "supervisor" || u.roles?.codigo === "rrhh")
        ?.map((u: any) => ({
          id: u.id,
          nombres: u.nombres,
          apellidos: u.apellidos
        })) || [];

      setSupervisoresList(filtered);
    } catch (err) {
      console.error("Error loading supervisors for filter:", err);
    }
  };

  const loadRequerimientosList = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("requerimientos")
        .select(`
          *,
          sedes (
            id,
            nombre,
            contacto_telefono,
            presupuesto,
            clientes (id, razon_social)
          ),
          usuarios:usuario_solicitante_id (
            id,
            nombres,
            apellidos
          )
        `)
        .order("fecha_solicitud", { ascending: false });

      if (role === "supervisor" || role === "rrhh") {
        query = query.eq("usuario_solicitante_id", user.id);
      }
      
      if (role === "logistica" || role === "almacen") {
        query = query.neq("estado", "Borrador");
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setRequerimientos(data || []);
    } catch (err: any) {
      console.error("Error loading requirements:", err);
      setError("Error al cargar la lista de requerimientos.");
    } finally {
      setLoading(false);
    }
  };

  const loadCreationLookups = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: prodData, error: prodErr } = await supabase
        .from("productos")
        .select(`
          *,
          producto_tallas (
            id,
            talla_id,
            stock_actual,
            tallas (id, valor)
          ),
          categorias_producto (nombre)
        `)
        .eq("activo", true)
        .order("nombre");
      
      if (prodErr) throw prodErr;
      setProductos(prodData || []);

      await loadSedes(isExtraordinarySupport);
    } catch (err: any) {
      console.error("Error loading lookups:", err);
      setError("Error al precargar configuraciones de creación.");
    } finally {
      setLoading(false);
    }
  };

  const loadSedes = async (allSedes: boolean) => {
    if (!user) return;
    try {
      let sedesQuery = supabase
        .from("sedes")
        .select(`
          id,
          nombre,
          contacto_telefono,
          clientes (id, razon_social)
        `)
        .eq("activo", true)
        .order("nombre");

      if (!allSedes && role === "supervisor") {
        const { data: relationData } = await supabase
          .from("usuario_sedes")
          .select("sede_id")
          .eq("usuario_id", user.id);

        const assignedIds = relationData?.map(r => r.sede_id) || [];
        
        if (assignedIds.length > 0) {
          sedesQuery = sedesQuery.in("id", assignedIds);
        } else {
          setSedes([]);
          return;
        }
      }

      const { data: sedeData } = await sedesQuery;
      setSedes(sedeData || []);
    } catch (err) {
      console.error("Error loading sedes:", err);
    }
  };

  const loadWorkersForSede = async (sedeId: number) => {
    try {
      const { data: vData } = await supabase
        .from("vinculos_laborales")
        .select(`
          id,
          persona_id,
          personas (
            id,
            nombres,
            apellidos,
            numero_documento,
            talla_polo,
            talla_pantalon,
            talla_calzado
          ),
          cargos (nombre)
        `)
        .eq("sede_id", sedeId)
        .eq("estado", "Activo");
      
      setVinculos(vData || []);
    } catch (err) {
      console.error("Error loading workers for sede:", err);
    }
  };

  const fetchRequestDetails = async (reqId: number) => {
    const { data, error: detailErr } = await supabase
      .from("requerimiento_detalles")
      .select(`
        id,
        cantidad_solicitada,
        cantidad_aprobada,
        cantidad_entregada,
        observacion,
        motivo_modificacion,
        producto_id,
        producto_talla_id,
        productos (
          id,
          nombre,
          sku,
          precio_unitario,
          es_uniforme,
          unidades_medida (
            nombre,
            codigo
          )
        ),
        producto_tallas (
          id,
          stock_actual,
          tallas(valor)
        ),
        vinculos_laborales (id, personas(nombres, apellidos))
      `)
      .eq("requerimiento_id", reqId);

    if (detailErr) throw detailErr;
    return data || [];
  };

  const refreshSelectedRequirement = async (reqId: number) => {
    try {
      const { data, error } = await supabase
        .from("requerimientos")
        .select(`
          *,
          sedes (
            id,
            nombre,
            contacto_telefono,
            presupuesto,
            clientes (id, razon_social)
          ),
          usuarios:usuario_solicitante_id (
            id,
            nombres,
            apellidos
          )
        `)
        .eq("id", reqId)
        .single();
      if (!error && data) {
        setSelectedReq(data);
        const details = await fetchRequestDetails(reqId);
        setReqDetails(details);
      }
    } catch (err) {
      console.error("Error refreshing detail view:", err);
    }
  };

  const handleOpenDetails = async (req: Requerimiento) => {
    setCameFromDetail(true);
    setSelectedReq(req);
    setModalLoading(true);
    setViewState("detail");
    try {
      const details = await fetchRequestDetails(req.id);
      setReqDetails(details);

      const initialEdits: Record<number, any> = {};
      details.forEach((det: any) => {
        initialEdits[det.id] = {
          cantidad_aprobada: det.cantidad_aprobada !== undefined ? det.cantidad_aprobada : det.cantidad_solicitada,
          motivo_modificacion: det.motivo_modificacion || ""
        };
      });
      setEdits(initialEdits);
    } catch (err) {
      console.error("Error loading details:", err);
      alert("Error al cargar los detalles del requerimiento.");
      setViewState("list");
    } finally {
      setModalLoading(false);
    }
  };

  // --- ACTIONS ---

  const handleDetailQtyEdit = (detailId: number, value: number, maxVal: number) => {
    const qty = Math.max(0, value);
    setEdits(prev => ({
      ...prev,
      [detailId]: {
        ...prev[detailId],
        cantidad_aprobada: qty
      }
    }));
  };

  const handleDetailReasonEdit = (detailId: number, reason: string) => {
    setEdits(prev => ({
      ...prev,
      [detailId]: {
        ...prev[detailId],
        motivo_modificacion: reason
      }
    }));
  };

  const isLineAltered = (det: any) => {
    const edit = edits[det.id];
    if (!edit) return false;
    return edit.cantidad_aprobada !== det.cantidad_solicitada;
  };

  const handleApproveRequisition = async () => {
    if (!selectedReq || !user) return;

    let validationFailed = false;
    reqDetails.forEach((det) => {
      const edit = edits[det.id];
      if (isLineAltered(det) && (!edit?.motivo_modificacion || !edit.motivo_modificacion.trim())) {
        validationFailed = true;
      }
    });

    if (validationFailed) {
      alert("Por favor, ingrese un Motivo de Modificación para todas las filas cuyas cantidades aprobadas difieran de las solicitadas.");
      return;
    }

    showConfirm(
      `¿Confirmas la aprobación del requerimiento ${selectedReq.codigo}?`,
      async () => {
        setSubmittingAction(true);
        setError(null);
        try {
          for (const det of reqDetails) {
            const edit = edits[det.id];
            const approvedQty = edit.cantidad_aprobada;
            const reason = isLineAltered(det) ? edit.motivo_modificacion : null;

            const { error: detUpdErr } = await supabase
              .from("requerimiento_detalles")
              .update({
                cantidad_aprobada: approvedQty,
                motivo_modificacion: reason
              })
              .eq("id", det.id);

            if (detUpdErr) throw detUpdErr;

            if (selectedReq.afecta_stock && det.producto_talla_id && approvedQty > 0) {
              const { data: ptData, error: ptGetErr } = await supabase
                .from("producto_tallas")
                .select("stock_actual")
                .eq("id", det.producto_talla_id)
                .single();

              if (ptGetErr) throw ptGetErr;

              const currentStock = ptData.stock_actual;
              const newStock = Math.max(0, currentStock - approvedQty);

              const { error: ptUpdErr } = await supabase
                .from("producto_tallas")
                .update({ stock_actual: newStock })
                .eq("id", det.producto_talla_id);

              if (ptUpdErr) throw ptUpdErr;

              const { error: audErr } = await supabase
                .from("auditoria_stock")
                .insert({
                  producto_talla_id: det.producto_talla_id,
                  usuario_id: user.id,
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
              usuario_aprobador_id: user.id,
              fecha_aprobacion: new Date().toISOString()
            })
            .eq("id", selectedReq.id);

          if (headErr) throw headErr;

          // Notify Supervisor
          await supabase
            .from("notificaciones")
            .insert({
              usuario_id: selectedReq.usuario_solicitante_id,
              titulo: "Requerimiento Aprobado",
              mensaje: `Tu requerimiento ${selectedReq.codigo} ha sido aprobado.`,
              tipo: "estado_requerimiento",
              link: "/requerimientos/solicitudes"
            });

          alert(`Requerimiento ${selectedReq.codigo} aprobado con éxito.`);
          setViewState("list");
        } catch (err: any) {
          console.error("Error approving request:", err);
          alert("Ocurrió un error al procesar la aprobación: " + (err.message || err));
        } finally {
          setSubmittingAction(false);
        }
      }
    );
  };

  const handleRejectRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || !user || !rejectReason.trim()) return;

    setSubmittingAction(true);
    try {
      const { error: headErr } = await supabase
        .from("requerimientos")
        .update({
          estado: "Rechazado",
          motivo_rechazo: rejectReason.trim(),
          usuario_aprobador_id: user.id,
          fecha_aprobacion: new Date().toISOString()
        })
        .eq("id", selectedReq.id);

      if (headErr) throw headErr;

      alert(`El requerimiento ${selectedReq.codigo} fue rechazado.`);
      setIsRejectModalOpen(false);
      setRejectReason("");
      setViewState("list");
    } catch (err: any) {
      console.error("Error rejecting request:", err);
      alert("Error al procesar el rechazo: " + (err.message || err));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSendRequest = async (reqId: number) => {
    showConfirm(
      "¿Deseas despachar / enviar este requerimiento a su destino?",
      async () => {
        setLoading(true);
        try {
          const { data: reqData } = await supabase
            .from("requerimientos")
            .select("codigo, usuario_solicitante_id")
            .eq("id", reqId)
            .single();

          const { error: err } = await supabase
            .from("requerimientos")
            .update({
              estado: "Enviado",
              fecha_envio: new Date().toISOString()
            })
            .eq("id", reqId);

          if (err) throw err;

          if (reqData) {
            await supabase
              .from("notificaciones")
              .insert({
                usuario_id: reqData.usuario_solicitante_id,
                titulo: "Requerimiento Enviado",
                mensaje: `Tu requerimiento ${reqData.codigo} ha sido despachado / enviado.`,
                tipo: "estado_requerimiento",
                link: "/requerimientos/solicitudes"
              });
          }

          alert("Requerimiento marcado como ENVIADO / EN TRÁNSITO.");
          loadRequerimientosList();
          if (selectedReq && selectedReq.id === reqId) {
            await refreshSelectedRequirement(reqId);
          }
        } catch (err: any) {
          console.error("Error sending request:", err);
          alert("Error al despachar el requerimiento.");
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleMarkFullyDelivered = async (reqId: number) => {
    showConfirm(
      "¿Confirmas la entrega completa de este requerimiento? Se marcarán todos los artículos como entregados al 100%.",
      async () => {
        setLoading(true);
        try {
          const { data: reqData } = await supabase
            .from("requerimientos")
            .select("codigo, usuario_solicitante_id")
            .eq("id", reqId)
            .single();

          const details = await fetchRequestDetails(reqId);
          
          for (const det of details) {
            const { error: detErr } = await supabase
              .from("requerimiento_detalles")
              .update({ cantidad_entregada: det.cantidad_aprobada })
              .eq("id", det.id);

            if (detErr) throw detErr;
          }

          const { error: headErr } = await supabase
            .from("requerimientos")
            .update({
              estado: "Entregado",
              fecha_entrega: new Date().toISOString(),
              notas_entrega_incompleta: null
            })
            .eq("id", reqId);

          if (headErr) throw headErr;

          if (reqData) {
            await supabase
              .from("notificaciones")
              .insert({
                usuario_id: reqData.usuario_solicitante_id,
                titulo: "Requerimiento Entregado",
                mensaje: `Tu requerimiento ${reqData.codigo} ha sido entregado por completo.`,
                tipo: "estado_requerimiento",
                link: "/requerimientos/solicitudes"
              });
          }

          alert("Requerimiento entregado por completo.");
          loadRequerimientosList();
          if (selectedReq && selectedReq.id === reqId) {
            await refreshSelectedRequirement(reqId);
          }
        } catch (err: any) {
          console.error("Error completing delivery:", err);
          alert("Error al registrar la entrega completa.");
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleOpenMarkIncomplete = async (req: Requerimiento) => {
    setSelectedReq(req);
    setLoading(true);
    setViewState("mark_incomplete");
    try {
      const details = await fetchRequestDetails(req.id);
      setReqDetails(details);
      
      const initialQtys: Record<number, number> = {};
      details.forEach((det: any) => {
        initialQtys[det.id] = det.cantidad_aprobada;
      });
      setDeliveryQuantities(initialQtys);
      setDeliveryNote("");
    } catch (err) {
      console.error("Error loading delivery checklist:", err);
      alert("Error al cargar la lista de artículos.");
      setViewState("list");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMarkIncomplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    let isPartial = false;
    reqDetails.forEach(det => {
      const delivered = deliveryQuantities[det.id] || 0;
      if (delivered < det.cantidad_aprobada) {
        isPartial = true;
      }
    });

    if (!isPartial) {
      alert("Para registrar una entrega INCOMPLETA, al menos un artículo debe ser entregado con una cantidad menor a la aprobada. Si todo se entregó completo, cancela y usa la opción 'Recibido' en la tabla.");
      return;
    }

    if (!deliveryNote.trim()) {
      alert("Por favor, ingresa una nota explicando el motivo de la entrega incompleta (ej: tallas faltantes, quiebre de stock).");
      return;
    }

    setSubmittingAction(true);
    try {
      for (const det of reqDetails) {
        const qty = deliveryQuantities[det.id] !== undefined ? deliveryQuantities[det.id] : det.cantidad_aprobada;
        const { error: detErr } = await supabase
          .from("requerimiento_detalles")
          .update({ cantidad_entregada: qty })
          .eq("id", det.id);

        if (detErr) throw detErr;
      }

      const { error: headErr } = await supabase
        .from("requerimientos")
        .update({
          estado: "Entregado Incompleto",
          notas_entrega_incompleta: deliveryNote.trim(),
          fecha_entrega: new Date().toISOString()
        })
        .eq("id", selectedReq.id);

      if (headErr) throw headErr;

      await supabase
        .from("notificaciones")
        .insert({
          usuario_id: selectedReq.usuario_solicitante_id,
          titulo: "Entrega Incompleta",
          mensaje: `Tu requerimiento ${selectedReq.codigo} ha sido entregado de forma incompleta.`,
          tipo: "estado_requerimiento",
          link: "/requerimientos/solicitudes"
        });

      alert("Pedido marcado como Entregado Incompleto con éxito.");
      if (cameFromDetail && selectedReq) {
        await refreshSelectedRequirement(selectedReq.id);
        setViewState("detail");
      } else {
        setViewState("list");
      }
    } catch (err: any) {
      console.error("Error submitting incomplete delivery:", err);
      alert("Error al registrar: " + (err.message || err));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleOpenCompleteDelivery = async (req: Requerimiento) => {
    setSelectedReq(req);
    setLoading(true);
    setViewState("complete");
    try {
      const details = await fetchRequestDetails(req.id);
      setReqDetails(details);

      const initialQtys: Record<number, number> = {};
      details.forEach((det: any) => {
        const remaining = det.cantidad_aprobada - (det.cantidad_entregada || 0);
        initialQtys[det.id] = remaining > 0 ? remaining : 0;
      });
      setDeliveryQuantities(initialQtys);
    } catch (err) {
      console.error("Error loading delivery list:", err);
      alert("Error al cargar la lista.");
      setViewState("list");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCompleteDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    setSubmittingAction(true);
    try {
      let allDelivered = true;

      for (const det of reqDetails) {
        const deliveredNow = deliveryQuantities[det.id] || 0;
        const totalDelivered = (det.cantidad_entregada || 0) + deliveredNow;

        const { error: detErr } = await supabase
          .from("requerimiento_detalles")
          .update({ cantidad_entregada: totalDelivered })
          .eq("id", det.id);

        if (detErr) throw detErr;

        if (totalDelivered < det.cantidad_aprobada) {
          allDelivered = false;
        }
      }

      const nextStatus = allDelivered ? "Entregado" : "Entregado Incompleto";
      const { error: headErr } = await supabase
        .from("requerimientos")
        .update({
          estado: nextStatus,
          fecha_entrega: new Date().toISOString(),
          notas_entrega_incompleta: nextStatus === "Entregado" ? null : selectedReq.notas_entrega_incompleta
        })
        .eq("id", selectedReq.id);

      if (headErr) throw headErr;

      await supabase
        .from("notificaciones")
        .insert({
          usuario_id: selectedReq.usuario_solicitante_id,
          titulo: nextStatus === "Entregado" ? "Requerimiento Entregado" : "Entrega Incompleta",
          mensaje: nextStatus === "Entregado" 
            ? `Tu requerimiento ${selectedReq.codigo} ha sido entregado por completo.` 
            : `Tu requerimiento ${selectedReq.codigo} ha sido entregado de forma incompleta.`,
          tipo: "estado_requerimiento",
          link: "/requerimientos/solicitudes"
        });

      alert(allDelivered ? "Entrega completada al 100%." : "Entrega parcial registrada.");
      if (cameFromDetail && selectedReq) {
        await refreshSelectedRequirement(selectedReq.id);
        setViewState("detail");
      } else {
        setViewState("list");
      }
    } catch (err: any) {
      console.error("Error committing remaining delivery:", err);
      alert("Error al registrar: " + (err.message || err));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSendDraft = async (reqId: number) => {
    showConfirm(
      "¿Deseas enviar este borrador a logística para su aprobación?",
      async () => {
        setLoading(true);
        try {
          const { data: reqData } = await supabase
            .from("requerimientos")
            .select("codigo, tipo_solicitud")
            .eq("id", reqId)
            .single();

          const { error: updateErr } = await supabase
            .from("requerimientos")
            .update({ estado: "Pendiente Aprobacion" })
            .eq("id", reqId);

          if (updateErr) throw updateErr;

          if (reqData) {
            await supabase
              .from("notificaciones")
              .insert({
                rol_destinatario: reqData.tipo_solicitud === "Materiales_y_EPP" ? "logistica" : "almacen",
                titulo: "Nuevo Requerimiento",
                mensaje: `El borrador ${reqData.codigo} ha sido enviado para aprobación.`,
                tipo: "nuevo_requerimiento",
                link: "/requerimientos/solicitudes"
              });
          }

          alert("Requerimiento enviado a logística con éxito.");
          setViewState("list");
        } catch (err) {
          console.error("Error sending draft:", err);
          alert("No se pudo enviar el borrador.");
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleDeleteDraft = async (reqId: number) => {
    showConfirm(
      "¿Estás seguro de que deseas eliminar permanentemente este borrador?",
      async () => {
        setLoading(true);
        try {
          await supabase.from("requerimiento_detalles").delete().eq("requerimiento_id", reqId);
          const { error: deleteErr } = await supabase.from("requerimientos").delete().eq("id", reqId);

          if (deleteErr) throw deleteErr;

          alert("Borrador eliminado.");
          setViewState("list");
        } catch (err) {
          console.error("Error deleting draft:", err);
          alert("No se pudo eliminar el borrador.");
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleProductChange = (pid: number) => {
    setSelectedProductId(pid);
    const prod = productos.find(p => p.id === pid);
    if (prod) {
      if (prod.es_uniforme) {
        setIsAssignToPerson(true);
        setSelectedVariantId(prod.producto_tallas?.[0]?.id || "");
      } else {
        setIsAssignToPerson(false);
        setSelectedVariantId(prod.producto_tallas?.[0]?.id || "");
      }
    } else {
      setSelectedVariantId("");
    }
    setSelectedVinculoId("");
    setItemObservation("");
  };

  const handleAddItemToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSedeId) {
      alert("Por favor seleccione una sede primero.");
      return;
    }
    if (!selectedProductId) return;

    const prod = productos.find(p => p.id === Number(selectedProductId));
    if (!prod) return;

    let variantObj: any = null;
    let variantId: number | undefined = undefined;
    let tallaVal: string | undefined = undefined;

    if (prod.es_uniforme || (prod.producto_tallas && prod.producto_tallas.length > 0)) {
      if (!selectedVariantId) {
        alert("Por favor seleccione una talla / variante.");
        return;
      }
      variantObj = prod.producto_tallas.find((pt: any) => pt.id === Number(selectedVariantId));
      variantId = variantObj?.id;
      tallaVal = variantObj?.tallas?.valor || "Única";
    }

    let workerId: number | undefined = undefined;
    let workerName: string | undefined = undefined;

    if (isAssignToPerson) {
      if (!selectedVinculoId) {
        alert("Por favor seleccione un colaborador para la asignación.");
        return;
      }
      const workerObj = vinculos.find(v => v.id === Number(selectedVinculoId));
      workerId = workerObj?.id;
      workerName = `${workerObj?.personas?.nombres} ${workerObj?.personas?.apellidos}`;
    }

    if (itemQuantity <= 0) {
      alert("La cantidad debe ser mayor a 0.");
      return;
    }

    const newItem: CartItem = {
      id: Math.random().toString(36).substr(2, 9),
      producto: prod,
      productoTallaId: variantId,
      tallaValor: tallaVal,
      vinculoLaboralId: workerId,
      personaNombre: workerName,
      cantidad: itemQuantity,
      observacion: itemObservation.trim() || undefined
    };

    setCart(prev => [...prev, newItem]);

    setSelectedProductId("");
    setSelectedVariantId("");
    setSelectedVinculoId("");
    setItemQuantity(1);
    setItemObservation("");
    setIsAssignToPerson(false);
  };

  const handleAddBulkToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSedeId) {
      alert("Seleccione una sede primero.");
      return;
    }
    if (!bulkProductId) return;

    const prod = productos.find(p => p.id === Number(bulkProductId));
    if (!prod) return;

    const selectedWorkers = bulkWorkers.filter(bw => bw.checked && bw.selectedVariantId);
    if (selectedWorkers.length === 0) {
      alert("Seleccione al menos un colaborador de la lista.");
      return;
    }

    if (bulkQuantity <= 0) {
      alert("La cantidad debe ser mayor a 0.");
      return;
    }

    const newItems: CartItem[] = selectedWorkers.map(w => {
      const variantObj = prod.producto_tallas?.find((pt: any) => pt.id === Number(w.selectedVariantId));
      return {
        id: Math.random().toString(36).substr(2, 9),
        producto: prod,
        productoTallaId: Number(w.selectedVariantId),
        tallaValor: variantObj?.tallas?.valor || "Única",
        vinculoLaboralId: w.vinculoId,
        personaNombre: w.nombreCompleto,
        cantidad: bulkQuantity,
        observacion: bulkObservation.trim() || undefined
      };
    });

    setCart(prev => [...prev, ...newItems]);

    setBulkProductId("");
    setBulkQuantity(1);
    setBulkWorkers([]);
    setBulkObservation("");
    setIsBulkMode(false);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveRequest = async (isDraft: boolean) => {
    if (cart.length === 0) return;
    if (!selectedSedeId) return;
    if (!user) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomId = Math.floor(100 + Math.random() * 900);
      const code = `REQ-${dateStr}-${randomId}-${activeTab === "Materiales_y_EPP" ? "EPP" : "UNI"}`;

      const finalState = isDraft ? "Borrador" : "Pendiente Aprobacion";
      const affectsStock = activeTab === "Uniformes_Almacen" || cart.some(item => item.producto.es_uniforme);

      const { data: reqHead, error: headErr } = await supabase
        .from("requerimientos")
        .insert({
          codigo: code,
          sede_id: Number(selectedSedeId),
          usuario_solicitante_id: user.id,
          tipo_solicitud: activeTab,
          afecta_stock: affectsStock,
          estado: finalState,
          apoyo_extraordinario: isExtraordinarySupport
        })
        .select("id")
        .single();

      if (headErr) throw headErr;

      const detailsToInsert = cart.map(item => ({
        requerimiento_id: reqHead.id,
        producto_id: item.producto.id,
        producto_talla_id: item.productoTallaId || null,
        vinculo_laboral_id: item.vinculoLaboralId || null,
        cantidad_solicitada: item.cantidad,
        cantidad_aprobada: item.cantidad,
        observacion: item.observacion || null
      }));

      const { error: detErr } = await supabase
        .from("requerimiento_detalles")
        .insert(detailsToInsert);

      if (detErr) throw detErr;

      if (!isDraft) {
        await supabase
          .from("notificaciones")
          .insert({
            rol_destinatario: activeTab === "Materiales_y_EPP" ? "logistica" : "almacen",
            titulo: "Nuevo Requerimiento",
            mensaje: `Se ha creado el requerimiento ${code} pendiente de aprobación.`,
            tipo: "nuevo_requerimiento",
            link: "/requerimientos/solicitudes"
          });
      }

      setCart([]);
      setSelectedSedeId("");
      setIsExtraordinarySupport(false);
      
      const successText = isDraft
        ? `Borrador guardado con éxito: ${code}`
        : `Solicitud enviada a logística con éxito: ${code}`;
      
      alert(successText);
      setViewState("list");
    } catch (err: any) {
      console.error("Error saving request:", err);
      setError(err.message || "Ocurrió un error al guardar el requerimiento.");
    } finally {
      setLoading(false);
    }
  };

  // Open Aislado document window, write standard inline HTML, run html2pdf, download & close
  const handleDownloadPDF = () => {
    if (!selectedReq) return;

    setPdfLoading(true);

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Por favor, permite las ventanas emergentes (popups) en tu navegador para poder generar el Vale de Salida.");
      setPdfLoading(false);
      return;
    }

    const docName = `VALE-${selectedReq.codigo}`;

    // Standard HTML page string with exact A4 screen pixel aspect ratio (794px width x 1122px height)
    // Zero Tailwind stylesheet hooks prevents color space parsing oklch failures.
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${docName}</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: #f1f5f9;
            }
            #print-vale-salida {
              background-color: white;
              width: 794px;
              height: 1122px;
              margin: 20px auto;
              padding: 40px;
              box-sizing: border-box;
              box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            }
            @media print {
              body {
                background-color: white;
                padding: 0;
              }
              #print-vale-salida {
                box-shadow: none;
                width: 100%;
                padding: 0;
                margin: 0;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="background-color: #0f172a; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10000; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); font-family: system-ui, -apple-system, sans-serif; color: white; width: 100%; box-sizing: border-box;">
            <div style="display: flex; flex-direction: column; text-align: left;">
              <span style="font-weight: 800; font-size: 13px; letter-spacing: 0.3px;">Previsualización de Vale de Salida</span>
              <span style="font-size: 10px; color: #94a3b8; font-weight: 600; margin-top: 2px;">N° Requerimiento: ${selectedReq.codigo}</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button onclick="imprimirVale()" style="background-color: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; font-family: system-ui, sans-serif; display: flex; align-items: center; gap: 4px; transition: all 0.15s; text-transform: uppercase; letter-spacing: 0.3px;">
                🖨️ Imprimir Vale
              </button>
              <button onclick="descargarPDF()" style="background-color: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; font-family: system-ui, sans-serif; display: flex; align-items: center; gap: 4px; transition: all 0.15s; text-transform: uppercase; letter-spacing: 0.3px;">
                📥 Descargar PDF
              </button>
            </div>
          </div>

          <div id="print-vale-salida">
            <div style="border: 2px solid black; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; height: 100%; color: black; box-sizing: border-box; background-color: white;">
              <div>
                <!-- Header Table -->
                <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-bottom: 15px;">
                  <tbody>
                    <tr>
                      <td style="width: 25%; border: 1px solid black; padding: 8px; text-align: center; vertical-align: middle;">
                        <img src="/logo.png" alt="Logo" style="max-height: 48px; max-width: 120px; display: block; margin: 0 auto;" />
                      </td>
                      <td style="width: 50%; border: 1px solid black; padding: 8px; text-align: center; vertical-align: middle;">
                        <div style="color: #dc2626; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">REQUERIMIENTO DE MATERIALES</div>
                        <div style="color: black; font-weight: bold; font-size: 9px; text-transform: uppercase; margin-top: 2px; text-align: center;">SISTEMA INTEGRADO DE GESTIÓN</div>
                      </td>
                      <td style="width: 25%; border: 1px solid black; padding: 8px; font-size: 10px; font-weight: bold; vertical-align: middle; color: black;">
                        <div style="border-bottom: 1px solid black; padding-bottom: 4px;">Código: RG-24-SIG-GB</div>
                        <div style="border-bottom: 1px solid black; padding-top: 4px; padding-bottom: 4px;">Versión: 00</div>
                        <div style="padding-top: 4px; color: #dc2626; font-weight: 900;">N°: ${selectedReq.codigo}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- General Metadata Table -->
                <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-bottom: 15px; font-size: 11px; font-weight: bold; color: black;">
                  <tbody>
                    <tr>
                      <td style="border: 1px solid black; padding: 8px; width: 66.6%; text-transform: uppercase;">
                        SEDE O UNIDAD: ${selectedReq.sedes?.nombre} - ${selectedReq.sedes?.clientes?.razon_social}
                      </td>
                      <td style="border: 1px solid black; padding: 8px; width: 33.3%; text-transform: uppercase;">
                        TELEFONO: 
                      </td>
                    </tr>
                    <tr>
                      <td style="border: 1px solid black; padding: 8px; width: 66.6%; text-transform: uppercase;">
                        SOLICITANTE: ${solicitanteName}
                      </td>
                      <td style="border: 1px solid black; padding: 8px; width: 33.3%; text-transform: uppercase;">
                        FECHA DE SOLICITUD: ${formattedDate}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- Warning banner text -->
                <div style="text-align: center; font-weight: bold; font-style: italic; font-size: 11px; margin: 12px 0; color: black; text-transform: uppercase; letter-spacing: 0.5px;">
                  Por favor, solicite con anticipacion su requerimiento para evitar contratiempos.
                </div>

                <!-- Items List -->
                <table style="width: 100%; border-collapse: collapse; border: 1px solid black; font-size: 11px; color: black;">
                  <thead>
                    <tr style="border: 1px solid black; background-color: #f1f5f9; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">
                      <th style="border: 1px solid black; padding: 6px; width: 8%;">ITEM</th>
                      <th style="border: 1px solid black; padding: 6px; width: 12%;">COD</th>
                      <th style="border: 1px solid black; padding: 6px; width: 45%;">PRODUCTO</th>
                      <th style="border: 1px solid black; padding: 6px; width: 12%;">UNIDAD</th>
                      <th style="border: 1px solid black; padding: 6px; width: 10%;">CANTIDAD</th>
                      <th style="border: 1px solid black; padding: 6px; width: 23%;">OBSERVACIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${reqDetails.map((det, idx) => {
                      const unitName = det.productos?.unidades_medida?.nombre || "Unidad";
                      return `
                        <tr>
                          <td style="border: 1px solid black; padding: 6px; text-align: center;">${idx + 1}</td>
                          <td style="border: 1px solid black; padding: 6px; text-align: center; font-family: monospace; font-size: 9px;">${det.productos?.sku || "—"}</td>
                          <td style="border: 1px solid black; padding: 6px; font-weight: bold; text-transform: uppercase;">
                            ${det.productos?.nombre} ${det.producto_tallas?.tallas?.valor ? `(TALLA ${det.producto_tallas.tallas.valor})` : ""}
                          </td>
                          <td style="border: 1px solid black; padding: 6px; text-align: center; text-transform: uppercase;">${unitName}</td>
                          <td style="border: 1px solid black; padding: 6px; text-align: center; font-weight: 900;">${det.cantidad_aprobada !== undefined ? det.cantidad_aprobada : det.cantidad_solicitada}</td>
                          <td style="border: 1px solid black; padding: 6px; font-style: italic; font-size: 10px;">${det.motivo_modificacion || det.observacion || "—"}</td>
                        </tr>
                      `;
                    }).join("")}
                  </tbody>
                </table>
              </div>

              <!-- Signatures Box -->
              <div style="margin-top: auto;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: center; margin-top: 48px; margin-bottom: 8px;">
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
                    <div style="width: 75%; border-bottom: 1px solid black; margin-bottom: 4px;"></div>
                    <div style="font-size: 9px; font-weight: bold; color: black; text-transform: uppercase; letter-spacing: 0.5px;">FIRMA DE SUPERVISOR SOLICITANTE</div>
                    <div style="font-size: 9px; color: #64748b; font-weight: 500; text-transform: uppercase; margin-top: 2px;">${solicitanteName}</div>
                  </div>
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
                    <div style="width: 75%; border-bottom: 1px solid black; margin-bottom: 4px;"></div>
                    <div style="font-size: 9px; font-weight: bold; color: black; text-transform: uppercase; letter-spacing: 0.5px;">FIRMA DE JEFE DE OPERACIONES</div>
                    <div style="font-size: 9px; color: #64748b; font-weight: 500; text-transform: uppercase; margin-top: 2px;">JEFE DE OPERACIONES</div>
                  </div>
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
                    <div style="width: 75%; border-bottom: 1px solid black; margin-bottom: 4px;"></div>
                    <div style="font-size: 9px; font-weight: bold; color: black; text-transform: uppercase; letter-spacing: 0.5px;">FIRMA DE ASISTENTE DE LOGÍSTICA</div>
                    <div style="font-size: 9px; color: #64748b; font-weight: 500; text-transform: uppercase; margin-top: 2px;">ASISTENTE DE LOGÍSTICA</div>
                  </div>
                </div>

                <!-- Footer control FP-05-SIG-GB -->
                <div style="text-align: right; font-size: 8px; font-weight: bold; color: #94a3b8; font-family: monospace; margin-top: 16px;">
                  FP-05-SIG-GB
                </div>
              </div>
            </div>
          </div>

          <script>
            function descargarPDF() {
              const element = document.getElementById("print-vale-salida");
              const opt = {
                margin:       0,
                filename:     "${docName}.pdf",
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 1.5, logging: false },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
              };
              html2pdf().from(element).set(opt).save();
            }

            function imprimirVale() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      setPdfLoading(false);
    }, 2000);
  };

  // --- RENDERING ---

  const filteredRequerimientos = requerimientos.filter(req => {
    if (req.tipo_solicitud !== activeTab) return false;
    
    // 1. Code Match
    const codeMatch = req.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 2. Status Match
    const statusMatch = statusFilter === "all" || req.estado === statusFilter;
    
    // 3. Supervisor Match (only matches user_solicitante_id if filter is selected)
    const supervisorMatch = supervisorFilter === "all" || String(req.usuario_solicitante_id) === supervisorFilter;

    // 4. Date Range Match (lexicographical string checks on YYYY-MM-DD format)
    let dateMatch = true;
    const reqDateStr = req.fecha_solicitud.slice(0, 10);
    if (startDate && reqDateStr < startDate) dateMatch = false;
    if (endDate && reqDateStr > endDate) dateMatch = false;

    return codeMatch && statusMatch && supervisorMatch && dateMatch;
  });

  const activeProduct = productos.find(p => p.id === Number(selectedProductId));
  const activeProductVariants = activeProduct?.producto_tallas || [];

  const isApproverRole = role === "admin" || 
    (role === "logistica" && activeTab === "Materiales_y_EPP") || 
    ((role === "almacen" || role === "logistica") && activeTab === "Uniformes_Almacen");

  // LIST VIEW RENDER
  const renderListView = () => {
    return (
      <div className="flex flex-col h-full space-y-4">
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Requerimientos / Solicitudes
            </span>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <ClipboardList className="w-8 h-8 text-blue-600" />
              {lockTab 
                ? (activeTab === "Materiales_y_EPP" ? "Requerimientos de Materiales" : "Requerimientos de Uniformes y EPP") 
                : "Gestión de Requerimientos"}
            </h1>
          </div>
          {role !== "almacen" && (
            <button
              onClick={() => {
                setCart([]);
                setSelectedProductId("");
                setSelectedSedeId("");
                setBulkProductId("");
                setIsExtraordinarySupport(false);
                setViewState("create");
              }}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              Nuevo Requerimiento
            </button>
          )}
        </div>

        {lockTab ? null : (role !== "rrhh" && role !== "almacen" ? (
          <div className="flex border-b border-slate-200 gap-1 pt-2">
            <button
              onClick={() => {
                setActiveTab("Materiales_y_EPP");
                setStatusFilter("all");
                setSearchTerm("");
                setStartDate("");
                setEndDate("");
                setSupervisorFilter("all");
              }}
              className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 rounded-t-lg -mb-px flex items-center gap-2 ${activeTab === "Materiales_y_EPP" ? "border-blue-600 text-blue-600 bg-blue-50/20" : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"}`}
            >
              <FileText className="w-4 h-4" />
              Materiales
            </button>
            <button
              onClick={() => {
                setActiveTab("Uniformes_Almacen");
                setStatusFilter("all");
                setSearchTerm("");
                setStartDate("");
                setEndDate("");
                setSupervisorFilter("all");
              }}
              className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 rounded-t-lg -mb-px flex items-center gap-2 ${activeTab === "Uniformes_Almacen" ? "border-blue-600 text-blue-600 bg-blue-50/20" : "border-transparent text-slate-400 hover:text-slate-650 hover:bg-slate-50/50"}`}
            >
              <Users className="w-4 h-4" />
              Uniformes y EPP
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-2 text-xs text-slate-600 font-medium font-sans">
            <Info className="w-4.5 h-4.5 text-blue-500" />
            <span>
              Módulo de requerimientos locked: <strong>Uniformes y EPP</strong> (Restricción por rol de {role === "rrhh" ? "Recursos Humanos" : "Almacén"}).
            </span>
          </div>
        ))}

        {/* Premium Filters Section (Visual Card matching the mock-up layout) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 shrink-0 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-800 font-extrabold text-xs uppercase tracking-wider">
              <Filter className="w-4 h-4 text-blue-600" />
              Filtros
            </div>
            {(searchTerm || startDate || endDate || statusFilter !== "all" || supervisorFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStartDate("");
                  setEndDate("");
                  setStatusFilter("all");
                  setSupervisorFilter("all");
                }}
                className="text-xs font-bold text-red-650 hover:underline flex items-center gap-1"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Código */}
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Buscar por Código</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="Buscar código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50/20 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            {/* 2. Fecha Desde */}
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/20 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* 3. Fecha Hasta */}
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/20 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* 4. Estado */}
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estado</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/20 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-700"
              >
                <option value="all">Todos los Estados</option>
                <option value="Borrador">Borrador</option>
                <option value="Pendiente Aprobacion">Pendiente Aprobación</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Enviado">Enviado</option>
                <option value="Entregado Incompleto">Entregado Incompleto</option>
                <option value="Entregado">Entregado</option>
                <option value="Rechazado">Rechazado</option>
              </select>
            </div>

            {/* 5. Supervisor / Solicitante (Only visible to admin, logistica, almacen roles) */}
            {(role === "admin" || role === "logistica" || role === "almacen") ? (
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Supervisor / Solicitante</label>
                <select
                  value={supervisorFilter}
                  onChange={(e) => setSupervisorFilter(e.target.value)}
                  className="block w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/20 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-700"
                >
                  <option value="all">Todos los Supervisores</option>
                  {supervisoresList.map(sup => (
                    <option key={sup.id} value={sup.id}>
                      {sup.nombres} {sup.apellidos}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="hidden lg:block opacity-0 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Table container */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden flex-1 min-h-[450px]">
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50/30 shrink-0">
            <span className="text-xs font-bold text-slate-700">Listado de Requerimientos</span>
            <button
              onClick={loadRequerimientosList}
              disabled={loading}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto min-h-[300px]">
            {loading ? (
              <div className="flex h-full items-center justify-center p-12">
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="text-xs font-semibold text-slate-550">Cargando requerimientos...</span>
                </div>
              </div>
            ) : filteredRequerimientos.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-400 py-12 flex-col gap-2">
                <ClipboardList className="w-8 h-8 opacity-40" />
                <span className="text-xs font-medium">No se encontraron requerimientos registrados en este panel.</span>
              </div>
            ) : (
              <table className="w-full text-left min-w-[900px] border-collapse">
                <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/10">
                    <th className="px-6 py-4">Código</th>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Solicitante</th>
                    <th className="px-6 py-4">Sede / Unidad</th>
                    <th className="px-6 py-4 text-center">Apoyo Ext.</th>
                    <th className="px-6 py-4 text-center">Estado</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredRequerimientos.map((req) => {
                    const statusColors: Record<string, string> = {
                      Borrador: "bg-slate-100 text-slate-700",
                      "Pendiente Aprobacion": "bg-amber-100 text-amber-800",
                      Aprobado: "bg-blue-100 text-blue-800",
                      Enviado: "bg-purple-150 text-purple-800",
                      Entregado: "bg-emerald-100 text-emerald-800",
                      "Entregado Incompleto": "bg-fuchsia-100 text-fuchsia-800",
                      Rechazado: "bg-red-100 text-red-800",
                    };

                    const solicitanteName = req.usuarios 
                      ? `${req.usuarios.nombres} ${req.usuarios.apellidos}`
                      : "Sistema";

                    const rawDate = new Date(req.fecha_solicitud);
                    const formattedDate = !isNaN(rawDate.getTime()) 
                      ? rawDate.toLocaleDateString("es-PE", { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : "—";

                    const canSend = req.estado === "Aprobado" && (role === "admin" || role === "logistica" || role === "almacen");
                    const canReceive = req.estado === "Enviado" && (role === "admin" || role === "logistica" || role === "almacen" || (user && req.usuario_solicitante_id === user.id));
                    const canComplete = req.estado === "Entregado Incompleto" && (role === "admin" || (user && req.usuario_solicitante_id === user.id));

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 font-mono">
                          {req.codigo}
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-medium">
                          {formattedDate}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700">
                          {solicitanteName}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {req.sedes?.nombre} 
                          <span className="text-[10px] text-slate-400 block">{req.sedes?.clientes?.razon_social}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {req.apoyo_extraordinario ? (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded font-extrabold text-[9px] uppercase">Sí</span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[req.estado] || "bg-slate-100 text-slate-800"}`}>
                              {req.estado === "Pendiente Aprobacion" ? "Pendiente Aprobación" : req.estado}
                            </span>
                            {req.estado === "Entregado Incompleto" && req.notas_entrega_incompleta && (
                              <span className="text-[9px] text-purple-700 font-bold block max-w-[150px] truncate italic" title={req.notas_entrega_incompleta}>
                                Falta: {req.notas_entrega_incompleta}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canSend && (
                              <button
                                onClick={() => handleSendRequest(req.id)}
                                className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-bold py-1 px-2.5 rounded text-[11px] transition-all"
                              >
                                <Send className="w-3 h-3" />
                                Enviar
                              </button>
                            )}
                            {canReceive && (
                              <>
                                <button
                                  onClick={() => handleMarkFullyDelivered(req.id)}
                                  className="inline-flex items-center gap-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold py-1 px-2.5 rounded text-[11px] transition-all"
                                >
                                  <Check className="w-3 h-3" />
                                  Recibido
                                </button>
                                <button
                                  onClick={() => {
                                    setCameFromDetail(false);
                                    handleOpenMarkIncomplete(req);
                                  }}
                                  className="inline-flex items-center gap-0.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 font-bold py-1 px-2.5 rounded text-[11px] transition-all"
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  Incompleto
                                </button>
                              </>
                            )}
                            {canComplete && (
                              <button
                                onClick={() => {
                                  setCameFromDetail(false);
                                  handleOpenCompleteDelivery(req);
                                }}
                                className="inline-flex items-center gap-0.5 bg-emerald-50 border border-emerald-255 text-emerald-700 hover:bg-emerald-100 font-bold py-1 px-2.5 rounded text-[11px] transition-all animate-pulse"
                              >
                                <Check className="w-3 h-3" />
                                Completar
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenDetails(req)}
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 font-bold py-1 px-2 hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver Detalles
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

          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between text-xs text-slate-500 font-medium shrink-0">
            <span>Mostrando {filteredRequerimientos.length} de {requerimientos.length} requerimientos</span>
          </div>
        </div>
      </div>
    );
  };

  // FULL SCREEN DETAIL RENDER
  const renderDetailView = () => {
    if (!selectedReq) return null;

    const timeline = [
      { name: "Borrador", completed: true, date: selectedReq.fecha_solicitud },
      { name: "Enviado a logística", completed: selectedReq.estado !== "Borrador", date: selectedReq.fecha_solicitud },
      { name: "Aprobado", completed: !!selectedReq.fecha_aprobacion && selectedReq.estado !== "Rechazado", date: selectedReq.fecha_aprobacion },
      { name: "Enviado", completed: !!selectedReq.fecha_envio, date: selectedReq.fecha_envio },
      { name: "Entregado", completed: selectedReq.estado === "Entregado" || selectedReq.estado === "Entregado Incompleto", date: selectedReq.fecha_entrega, stateText: selectedReq.estado === "Entregado Incompleto" ? "Incompleto" : "Completo" }
    ];

    const canApprove = selectedReq.estado === "Pendiente Aprobacion" && isApproverRole;
    const canSend = selectedReq.estado === "Aprobado" && (role === "admin" || role === "logistica" || role === "almacen");
    const canReceive = selectedReq.estado === "Enviado" && (role === "admin" || role === "logistica" || role === "almacen" || (user && selectedReq.usuario_solicitante_id === user.id));
    const canComplete = selectedReq.estado === "Entregado Incompleto" && (role === "admin" || (user && selectedReq.usuario_solicitante_id === user.id));
    
    // Check if role is authorized to see pricing and budgets
    const canSeePrices = role === "admin" || role === "logistica" || role === "almacen";

    // Calculate total approved cost (qty_approved * price)
    const totalCost = reqDetails.reduce((sum, det) => {
      const qty = det.cantidad_aprobada !== undefined ? det.cantidad_aprobada : det.cantidad_solicitada;
      const price = parseFloat(det.productos?.precio_unitario) || 0;
      return sum + (qty * price);
    }, 0);

    return (
      <div className="flex flex-col h-full space-y-4 animate-fade-in overflow-y-auto pr-1">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-150 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setViewState("list");
                setSelectedReq(null);
              }}
              className="p-2 border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-all shadow-sm"
              title="Volver al Listado"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="font-heading text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Requerimiento {selectedReq.codigo}
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${selectedReq.estado === "Borrador" ? "bg-slate-100 text-slate-700" : selectedReq.estado === "Pendiente Aprobacion" ? "bg-amber-100 text-amber-800" : selectedReq.estado === "Aprobado" ? "bg-blue-100 text-blue-800" : selectedReq.estado === "Enviado" ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"}`}>
                  {selectedReq.estado}
                </span>
              </h2>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono">
                Tipo: {selectedReq.tipo_solicitud === "Uniformes_Almacen" ? "Uniformes y EPP" : "Materiales"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {/* Vale de Salida direct PDF download button */}
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="inline-flex items-center gap-1.5 border border-blue-600 hover:bg-blue-50 bg-white text-blue-600 font-bold py-2 px-4 rounded-lg text-xs shadow-sm transition-colors disabled:opacity-55 animate-pulse"
            >
              {pdfLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <FileText className="w-4 h-4 text-blue-600" />
              )}
              {pdfLoading ? "Generando..." : "Vale de Salida"}
            </button>

            {canApprove && (
              <>
                <button
                  onClick={() => setIsRejectModalOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-xs shadow-sm transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  Rechazar Requerimiento
                </button>
                <button
                  onClick={handleApproveRequisition}
                  disabled={submittingAction}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-xs shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submittingAction ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Aprobar Requerimiento
                </button>
              </>
            )}

            {canSend && (
              <button
                onClick={() => handleSendRequest(selectedReq.id)}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-xs shadow-sm transition-all cursor-pointer font-bold"
              >
                <Send className="w-4 h-4" />
                Enviar / Despachar
              </button>
            )}

            {canReceive && (
              <>
                <button
                  onClick={() => handleMarkFullyDelivered(selectedReq.id)}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs shadow-sm transition-all cursor-pointer font-bold"
                >
                  <Check className="w-4 h-4" />
                  Recibido (Completo)
                </button>
                <button
                  onClick={() => {
                    setCameFromDetail(true);
                    handleOpenMarkIncomplete(selectedReq);
                  }}
                  className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg text-xs shadow-sm transition-all cursor-pointer font-bold"
                >
                  <AlertCircle className="w-4 h-4" />
                  Entrega Incompleta
                </button>
              </>
            )}

            {canComplete && (
              <button
                onClick={() => {
                  setCameFromDetail(true);
                  handleOpenCompleteDelivery(selectedReq);
                }}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-xs shadow-sm transition-all cursor-pointer font-bold animate-pulse"
              >
                <Check className="w-4 h-4" />
                Completar Entrega
              </button>
            )}

            {selectedReq.estado === "Borrador" && user && selectedReq.usuario_solicitante_id === user.id && (
              <>
                <button
                  onClick={() => handleDeleteDraft(selectedReq.id)}
                  className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 font-bold py-2 px-4 rounded-lg text-xs shadow-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar Borrador
                </button>
                <button
                  onClick={() => handleSendDraft(selectedReq.id)}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-xs shadow-sm transition-all"
                >
                  <Send className="w-4 h-4" />
                  Enviar a Logística
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
                Información General
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold mb-1 uppercase tracking-wide text-[9px]">Unidad / Cliente</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {selectedReq.sedes?.nombre} - {selectedReq.sedes?.clientes?.razon_social}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold mb-1 uppercase tracking-wide text-[9px]">Supervisor Solicitante</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {selectedReq.usuarios ? `${selectedReq.usuarios.nombres} ${selectedReq.usuarios.apellidos}` : "Sistema"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold mb-1 uppercase tracking-wide text-[9px]">Lugar de Entrega</span>
                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded mt-0.5">
                    ● Envío a Unidad Operativa (Por Defecto)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold mb-1 uppercase tracking-wide text-[9px]">Apoyo Extraordinario</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedReq.apoyo_extraordinario ? "Sí (Otra Unidad)" : "No"}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
                Items Solicitados
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3">Asignación Colaborador</th>
                      <th className="px-4 py-3 text-center">Talla</th>
                      <th className="px-4 py-3 text-center">Cant. Solicitada</th>
                      <th className="px-4 py-3 text-center">Cant. Aprobada</th>
                      {canSeePrices && <th className="px-4 py-3 text-center">Costo (Aprobado)</th>}
                      <th className="px-4 py-3">Observación / Motivo Mod.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {modalLoading ? (
                      <tr>
                        <td colSpan={canSeePrices ? 7 : 6} className="text-center p-8 text-slate-400">
                          Cargando artículos...
                        </td>
                      </tr>
                    ) : reqDetails.length === 0 ? (
                      <tr>
                        <td colSpan={canSeePrices ? 7 : 6} className="text-center p-8 text-slate-455 italic">
                          No hay artículos registrados.
                        </td>
                      </tr>
                    ) : (
                      reqDetails.map((det) => {
                        const productName = det.productos?.nombre || "Producto";
                        const sku = det.productos?.sku || "—";
                        const workerName = det.vinculos_laborales?.personas
                          ? `${det.vinculos_laborales.personas.nombres} ${det.vinculos_laborales.personas.apellidos}`
                          : null;
                        const size = det.producto_tallas?.tallas?.valor || "—";

                        const currentApproved = edits[det.id]?.cantidad_aprobada || 0;
                        const currentReason = edits[det.id]?.motivo_modificacion || "";

                        return (
                          <tr key={det.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-800 block">{productName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{sku}</span>
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {workerName ? (
                                <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                                  <User className="w-3 h-3 text-slate-400" />
                                  {workerName}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium italic">General</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-700">
                              {size}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">
                              {det.cantidad_solicitada}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {canApprove ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={currentApproved}
                                  onChange={(e) => handleDetailQtyEdit(det.id, parseInt(e.target.value) || 0, det.cantidad_solicitada)}
                                  className="w-16 p-1 border border-slate-200 rounded text-center font-black focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              ) : (
                                <span className="font-black text-slate-900 text-sm">
                                  {det.cantidad_aprobada !== undefined ? det.cantidad_aprobada : det.cantidad_solicitada}
                                </span>
                              )}
                            </td>
                            {canSeePrices && (
                              <td className="px-4 py-3 text-center font-mono text-slate-500">
                                <span className="block text-[10px]">P.U. S/ {(parseFloat(det.productos?.precio_unitario) || 0).toFixed(2)}</span>
                                <span className="font-bold text-slate-800">S/ {(currentApproved * (parseFloat(det.productos?.precio_unitario) || 0)).toFixed(2)}</span>
                              </td>
                            )}
                            <td className="px-4 py-3">
                              {det.observacion && (
                                <div className="text-[10px] text-slate-500 font-medium block">
                                  <strong>Obs:</strong> {det.observacion}
                                </div>
                              )}
                              {canApprove && isLineAltered(det) ? (
                                <input
                                  type="text"
                                  required
                                  placeholder="Ingresar motivo del cambio..."
                                  value={currentReason}
                                  onChange={(e) => handleDetailReasonEdit(det.id, e.target.value)}
                                  className="w-full mt-1 p-1 text-[11px] border border-red-250 bg-red-50/10 rounded focus:outline-none"
                                />
                              ) : (
                                <span className="text-slate-400 italic font-medium text-[11px]">
                                  {det.motivo_modificacion || "—"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Cost and Budget Info row (Hidden from unauthorized supervisors/rrhh roles) */}
              {canSeePrices && (
                <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-slate-400 uppercase tracking-widest block text-[9px] font-bold">Presupuesto de la Unidad</span>
                    <span className="text-slate-650 font-extrabold text-sm">
                      {selectedReq.sedes?.presupuesto 
                        ? `S/ ${parseFloat(selectedReq.sedes.presupuesto).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
                        : "S/ 0.00"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 uppercase tracking-widest block text-[9px] font-bold">Costo Total (Aprobado)</span>
                    <span className="text-emerald-600 text-lg font-black font-mono">
                      S/ {totalCost.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Progreso del Pedido
                </h3>
                <span className="font-mono text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {selectedReq.codigo}
                </span>
              </div>

              <div className="relative pl-6 border-l border-slate-200 ml-3 py-1 space-y-6">
                {timeline.map((step, idx) => {
                  const hasDate = step.date;
                  const formattedStepDate = hasDate 
                    ? new Date(step.date).toLocaleString("es-PE", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : "";

                  return (
                    <div key={idx} className="relative">
                      <span className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-all ${step.completed ? "border-blue-600" : "border-slate-200"}`}>
                        {step.completed && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />}
                      </span>

                      <div>
                        <span className={`text-xs font-bold block ${step.completed ? "text-slate-800" : "text-slate-400"}`}>
                          {step.name} {step.stateText ? `(${step.stateText})` : ""}
                        </span>
                        {step.completed && formattedStepDate && (
                          <span className="text-[10px] text-slate-400 font-medium font-mono block mt-0.5">
                            {formattedStepDate}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCreateView = () => {
    return (
      <div className="flex flex-col h-full space-y-4 overflow-y-auto pr-1">
        <div className="flex items-center justify-between flex-shrink-0 gap-4 mb-2">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Requerimientos / Solicitudes
            </span>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Plus className="w-8 h-8 text-blue-600" />
              Nuevo Requerimiento ({activeTab === "Materiales_y_EPP" ? "Materiales" : "Uniformes y EPP"})
            </h1>
          </div>
          <button
            onClick={() => {
              setViewState("list");
              setCart([]);
              setSelectedSedeId("");
              setIsExtraordinarySupport(false);
            }}
            className="inline-flex items-center gap-1.5 text-slate-600 border border-slate-255 bg-white hover:bg-slate-50 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al Listado
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building className="w-4.5 h-4.5 text-blue-600" />
                1. Configurar Sede Destino
              </h3>
              
              {role === "supervisor" && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="supportCheck"
                    checked={isExtraordinarySupport}
                    onChange={(e) => {
                      setIsExtraordinarySupport(e.target.checked);
                      setSelectedSedeId("");
                    }}
                    className="rounded text-blue-600 focus:ring-blue-100 border-slate-300"
                  />
                  <label htmlFor="supportCheck" className="text-xs font-bold text-rose-700 cursor-pointer uppercase tracking-wide">
                    Solicitar para otra unidad (Apoyo Extraordinario)
                  </label>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Sede Operativa / Cliente</label>
                <select
                  value={selectedSedeId}
                  onChange={(e) => setSelectedSedeId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full p-2.5 border border-slate-250 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 font-medium"
                >
                  <option value="">Seleccione una sede...</option>
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} ({s.clientes?.razon_social})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSedeId && (
                <div className="bg-blue-50 border border-blue-100 text-blue-800 p-3 rounded-lg text-xs flex items-start gap-1.5 font-medium animate-fade-in">
                  <Info className="w-4.5 h-4.5 text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    Sede operativa seleccionada. Puedes asignar productos a {vinculos.length} colaboradores activos en esta sede.
                  </span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingCart className="w-4.5 h-4.5 text-blue-600" />
                  2. Cargar Productos
                </h3>
                
                {selectedSedeId && activeTab === "Uniformes_Almacen" && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkMode(!isBulkMode);
                      setSelectedProductId("");
                      setBulkProductId("");
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 underline flex items-center gap-1"
                  >
                    {isBulkMode ? "Cambiar a Asignación Individual" : "Cambiar a Dotación Masiva"}
                  </button>
                )}
              </div>

              {!selectedSedeId ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <Building className="w-8 h-8 mx-auto mb-2 text-slate-350" />
                  Por favor, configura una Sede Destino primero.
                </div>
              ) : !isBulkMode ? (
                <form onSubmit={handleAddItemToCart} className="space-y-4 animate-fade-in">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Producto / Artículo</label>
                    <select
                      required
                      value={selectedProductId}
                      onChange={(e) => handleProductChange(Number(e.target.value))}
                      className="w-full p-2.5 border border-slate-250 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 font-medium"
                    >
                      <option value="">Seleccione un producto...</option>
                      {productos
                        .filter(p => (activeTab === "Uniformes_Almacen" ? p.es_uniforme : true))
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {p.es_uniforme ? "(Prenda/Tallas)" : "(Insumo/EPP)"}
                          </option>
                        ))}
                    </select>
                  </div>

                  {selectedProductId && activeProduct && (activeProduct.es_uniforme || activeProductVariants.length > 0) && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Talla / Variante</label>
                      <select
                        required
                        value={selectedVariantId}
                        onChange={(e) => setSelectedVariantId(Number(e.target.value))}
                        className="w-full p-2.5 border border-slate-250 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 font-bold"
                      >
                        <option value="">Seleccione una variante...</option>
                        {activeProductVariants.map((mv: any) => (
                          <option key={mv.id} value={mv.id}>
                            Talla {mv.tallas?.valor || "E"} (Stock local: {mv.stock_actual})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedProductId && activeProduct && !activeProduct.es_uniforme && (
                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="checkbox"
                        id="assignCheck"
                        checked={isAssignToPerson}
                        onChange={(e) => {
                          setIsAssignToPerson(e.target.checked);
                          setSelectedVinculoId("");
                        }}
                        className="rounded text-blue-600 focus:ring-blue-100 border-slate-300"
                      />
                      <label htmlFor="assignCheck" className="text-xs font-semibold text-slate-600 cursor-pointer">
                        ¿Asignar a un colaborador específico?
                      </label>
                    </div>
                  )}

                  {selectedProductId && isAssignToPerson && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asignar a:</label>
                      <select
                        required={isAssignToPerson}
                        value={selectedVinculoId}
                        onChange={(e) => setSelectedVinculoId(Number(e.target.value))}
                        className="w-full p-2.5 border border-slate-250 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 font-medium"
                      >
                        <option value="">Seleccione al colaborador...</option>
                        {vinculos.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.personas?.apellidos}, {v.personas?.nombres} ({v.cargos?.nombre})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cantidad</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                        className="w-full p-2 border border-slate-255 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 font-black text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Especificar Observación (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Marca, color, aroma..."
                        value={itemObservation}
                        onChange={(e) => setItemObservation(e.target.value)}
                        className="w-full p-2 border border-slate-255 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!selectedProductId}
                    className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    Añadir al Carrito
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAddBulkToCart} className="space-y-4 animate-fade-in">
                  <div className="bg-purple-50 border border-purple-100 text-purple-800 p-3 rounded-lg text-xs flex items-start gap-1.5 font-medium">
                    <Users className="w-5 h-5 text-purple-550 shrink-0 mt-0.5" />
                    <span>
                      <strong>Modo Dotación Masiva:</strong> Asigna la misma prenda a múltiples colaboradores a la vez con sus tallas sugeridas.
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Prenda / Uniforme</label>
                    <select
                      required
                      value={bulkProductId}
                      onChange={(e) => setBulkProductId(e.target.value ? Number(e.target.value) : "")}
                      className="w-full p-2.5 border border-slate-250 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 font-medium"
                    >
                      <option value="">Seleccione una prenda...</option>
                      {productos.filter(p => p.es_uniforme).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cant. c/u</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={bulkQuantity}
                        onChange={(e) => setBulkQuantity(parseInt(e.target.value) || 1)}
                        className="w-full p-2 border border-slate-255 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 font-black text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Observación General (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Marca, color..."
                        value={bulkObservation}
                        onChange={(e) => setBulkObservation(e.target.value)}
                        className="w-full p-2 border border-slate-255 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  {bulkProductId && bulkWorkers.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Seleccionar personal y validar tallas:
                      </label>
                      <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 p-1 space-y-1">
                        {bulkWorkers.map((bw, idx) => {
                          const prodObj = productos.find(p => p.id === Number(bulkProductId));
                          const variants = prodObj?.producto_tallas || [];

                          return (
                            <div key={bw.vinculoId} className="flex items-center justify-between p-2 text-xs hover:bg-slate-50/50">
                              <div className="flex items-center space-x-2.5 max-w-[65%]">
                                <input
                                  type="checkbox"
                                  checked={bw.checked}
                                  onChange={(e) => {
                                    const copy = [...bulkWorkers];
                                    copy[idx].checked = e.target.checked;
                                    setBulkWorkers(copy);
                                  }}
                                  className="rounded text-blue-600 focus:ring-blue-100 border-slate-300"
                                />
                                <div className="truncate">
                                  <span className="font-bold text-slate-800 block truncate">{bw.nombreCompleto}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">{bw.cargo} • DNI: {bw.dni}</span>
                                </div>
                              </div>

                              {bw.checked && (
                                <select
                                  value={bw.selectedVariantId}
                                  onChange={(e) => {
                                    const copy = [...bulkWorkers];
                                    copy[idx].selectedVariantId = Number(e.target.value);
                                    setBulkWorkers(copy);
                                  }}
                                  className="p-1 border border-slate-200 rounded text-[11px] font-bold bg-white focus:outline-none"
                                >
                                  {variants.map((v: any) => (
                                    <option key={v.id} value={v.id}>
                                      Talla {v.tallas?.valor || "E"}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!bulkProductId}
                    className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    Añadir Dotación Masiva
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col min-h-[420px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-slate-700" />
                  <h3 className="font-heading text-lg font-bold text-slate-800">
                    Artículos en Requerimiento
                  </h3>
                </div>
                <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 text-xs rounded-full">
                  {cart.length} Ítems
                </span>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-150 text-red-800 p-4 rounded-lg text-xs font-semibold flex items-start gap-1.5 mb-4 animate-fade-in">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                  <ShoppingCart className="w-12 h-12 text-slate-200 mb-2 stroke-[1.5]" />
                  <p className="text-sm font-semibold">El requerimiento está vacío</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs text-center">
                    Selecciona una sede, añade productos asignados a colaboradores o insumos generales en el panel izquierdo.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                          <th className="px-4 py-2.5">Producto</th>
                          <th className="px-4 py-2.5">Asignación</th>
                          <th className="px-4 py-2.5 text-center">Talla</th>
                          <th className="px-4 py-2.5 text-center">Cant.</th>
                          <th className="px-4 py-2.5">Observación</th>
                          <th className="px-4 py-2.5 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {cart.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-800 block">{item.producto.nombre}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{item.producto.sku}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-medium">
                              {item.personaNombre ? (
                                <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-700 font-medium">
                                  <User className="w-3 h-3 text-slate-400" />
                                  {item.personaNombre}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium italic">General</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-700">
                              {item.tallaValor || "—"}
                            </td>
                            <td className="px-4 py-3 text-center font-black text-slate-800 text-sm">
                              {item.cantidad}
                            </td>
                            <td className="px-4 py-3 text-slate-600 italic max-w-[120px] truncate">
                              {item.observacion || <span className="text-slate-350">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveFromCart(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-655 hover:bg-red-50 rounded transition-all"
                                title="Quitar del carrito"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-slate-100 pt-6 mt-6 flex items-center justify-between gap-4">
                    <div className="text-left text-xs font-semibold">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Categoría</span>
                      <span className="text-blue-600">{activeTab === "Materiales_y_EPP" ? "Materiales" : "Uniformes y EPP"}</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveRequest(true)}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs shadow-sm transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Guardar Borrador
                      </button>
                      <button
                        onClick={() => handleSaveRequest(false)}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-md hover:shadow-lg transition-all active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Enviar a Logística
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // MARK INCOMPLETE DELIVERY VIEW RENDER
  const renderMarkIncompleteView = () => {
    if (!selectedReq) return null;

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 max-w-3xl mx-auto animate-fade-in h-full overflow-y-auto pr-1">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <button
            onClick={() => setViewState("list")}
            className="p-2 border border-slate-255 bg-white hover:bg-slate-50 rounded text-slate-600 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-heading text-lg font-bold text-slate-800">
              Registrar Recepción Incompleta para {selectedReq.codigo}
            </h2>
            <span className="text-xs text-slate-400">
              Indica la cantidad real recibida de cada artículo y el motivo del saldo pendiente.
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmitMarkIncomplete} className="space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-center">Cant. Aprobada</th>
                  <th className="px-4 py-3 text-center w-32">Cant. Recibida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reqDetails.map((det) => {
                  const qtyApproved = det.cantidad_aprobada !== undefined ? det.cantidad_aprobada : det.cantidad_solicitada;
                  const currentVal = deliveryQuantities[det.id] !== undefined ? deliveryQuantities[det.id] : qtyApproved;

                  return (
                    <tr key={det.id}>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800 block">{det.productos?.nombre}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">{det.productos?.sku} {det.producto_tallas?.tallas?.valor ? `• Talla ${det.producto_tallas.tallas.valor}` : ""}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-800">
                        {qtyApproved}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max={qtyApproved}
                          value={currentVal}
                          onChange={(e) => {
                            const val = Math.min(qtyApproved, Math.max(0, parseInt(e.target.value) || 0));
                            setDeliveryQuantities(prev => ({ ...prev, [det.id]: val }));
                          }}
                          className="w-20 p-1.5 border border-slate-200 rounded text-center font-black focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1.5">
              Motivo de la entrega incompleta / Notas de regularización
            </label>
            <textarea
              required
              rows={3}
              placeholder="Ingresa los detalles (ej: Quiebre de stock de polos talla M, se regularizará el próximo viernes)..."
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              className="w-full p-2.5 border border-slate-250 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setViewState("list")}
              className="px-4 py-2 border border-slate-350 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submittingAction}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              {submittingAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Registrar Incompleto
            </button>
          </div>
        </form>
      </div>
    );
  };

  // COMPLETE INCOMPLETE DELIVERY VIEW RENDER
  const renderCompleteDeliveryView = () => {
    if (!selectedReq) return null;

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 max-w-3xl mx-auto animate-fade-in h-full overflow-y-auto pr-1">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <button
            onClick={() => setViewState("list")}
            className="p-2 border border-slate-255 bg-white hover:bg-slate-50 rounded text-slate-600 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-heading text-lg font-bold text-slate-800">
              Completar Entrega del Requerimiento {selectedReq.codigo}
            </h2>
            <span className="text-xs text-slate-400">
              Registra los saldos recibidos. Nota de entrega incompleta previa: <strong>"{selectedReq.notas_entrega_incompleta}"</strong>
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmitCompleteDelivery} className="space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-center">Aprobado</th>
                  <th className="px-4 py-3 text-center">Entregado Previo</th>
                  <th className="px-4 py-3 text-center">Pendiente</th>
                  <th className="px-4 py-3 text-center w-36">Entregar Ahora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reqDetails.map((det) => {
                  const qtyApproved = det.cantidad_aprobada || det.cantidad_solicitada;
                  const qtyDelivered = det.cantidad_entregada || 0;
                  const pending = qtyApproved - qtyDelivered;
                  const currentVal = deliveryQuantities[det.id] !== undefined ? deliveryQuantities[det.id] : pending;

                  return (
                    <tr key={det.id} className={pending <= 0 ? "bg-slate-50/50 text-slate-400" : ""}>
                      <td className="px-4 py-3">
                        <span className="font-bold block">{det.productos?.nombre}</span>
                        <span className="text-[10px] block font-mono">{det.productos?.sku} {det.producto_tallas?.tallas?.valor ? `• Talla ${det.producto_tallas.tallas.valor}` : ""}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold">
                        {qtyApproved}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-550">
                        {qtyDelivered}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-amber-700">
                        {pending}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pending > 0 ? (
                          <input
                            type="number"
                            min="0"
                            max={pending}
                            value={currentVal}
                            onChange={(e) => {
                              const val = Math.min(pending, Math.max(0, parseInt(e.target.value) || 0));
                              setDeliveryQuantities(prev => ({ ...prev, [det.id]: val }));
                            }}
                            className="w-20 p-1.5 border border-slate-200 rounded text-center font-black focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="inline-flex px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-extrabold text-[9px] uppercase">Completo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setViewState("list")}
              className="px-4 py-2 border border-slate-355 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submittingAction}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              {submittingAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Registrar Entrega
            </button>
          </div>
        </form>
      </div>
    );
  };

  const solicitanteName = selectedReq?.usuarios
    ? `${selectedReq.usuarios.nombres} ${selectedReq.usuarios.apellidos}`
    : "Sistema";

  const rawDate = selectedReq ? new Date(selectedReq.fecha_solicitud) : null;
  const formattedDate = rawDate && !isNaN(rawDate.getTime())
    ? rawDate.toLocaleDateString("es-PE", { day: '2-digit', month: '2-digit', year: 'numeric' })
    : "—";

  return (
    <div className="h-full w-full relative">
      {/* 1. Main Interactive Layout (Hidden when printing via browser if triggered) */}
      <div className="h-full w-full print:hidden">
        {viewState === "list" && renderListView()}
        {viewState === "create" && renderCreateView()}
        {viewState === "detail" && renderDetailView()}
        {viewState === "mark_incomplete" && renderMarkIncompleteView()}
        {viewState === "complete" && renderCompleteDeliveryView()}

        {/* Reject Reason input modal */}
        {isRejectModalOpen && selectedReq && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-heading font-bold text-slate-800 text-sm">Rechazar Requerimiento {selectedReq.codigo}</h3>
                <button onClick={() => setIsRejectModalOpen(false)} className="text-slate-400 hover:text-slate-650 font-bold font-sans">✕</button>
              </div>
              <form onSubmit={handleRejectRequisition} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Especificar Motivo de Rechazo</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Escribe el motivo del rechazo del pedido..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRejectModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors"
                  >
                    {submittingAction ? "Rechazando..." : "Confirmar Rechazo"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* System alert / confirm Modal */}
      {systemAlert.show && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-scale-in">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                {systemAlert.isConfirm ? (
                  <div className="p-2 bg-amber-50 rounded-lg text-amber-600 animate-pulse">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <Info className="w-6 h-6" />
                  </div>
                )}
                <h3 className="text-base font-extrabold text-slate-900">{systemAlert.title}</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                {systemAlert.message}
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-2 border-t border-slate-100">
              {systemAlert.isConfirm ? (
                <>
                  <button
                    onClick={systemAlert.onCancel}
                    className="px-4 py-2 border border-slate-250 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={systemAlert.onAccept}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Aceptar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSystemAlert(prev => ({ ...prev, show: false }))}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Aceptar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
