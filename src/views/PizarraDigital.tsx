import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../utils/authContext";
import {
  LayoutDashboard,
  Plus,
  UserPlus,
  UserMinus,
  Briefcase,
  MapPin,
  Users,
  CheckCircle2,
  X,
  Check,
  RefreshCw,
  Info,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Search,
  Edit,
  Trash2,
  Clock,
  UserCheck,
  Send,
  Building2,
  FileCheck,
  Filter,
  UserX,
  Sparkles,
  Phone,
  Mail,
  ArrowRight,
  ShieldCheck,
  Tag,
  MessageSquare,
  FileText,
  ExternalLink,
  Compass
} from "lucide-react";
import { RadarVacantesModal } from "../components/pizarra/RadarVacantesModal";
import { SedeCalibrationModal } from "../components/common/SedeCalibrationModal";

export function PizarraDigital() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeVinculos, setActiveVinculos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"pizarra" | "altas_pendientes">("pizarra");

  // Lookups
  const [sedes, setSedes] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [regimenes, setRegimenes] = useState<any[]>([]);
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [tiposTrabajador, setTiposTrabajador] = useState<any[]>([]);
  const [modalidadesContrato, setModalidadesContrato] = useState<any[]>([]);
  const [sistemasPension, setSistemasPension] = useState<any[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);

  // Modals state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailRequest, setSelectedDetailRequest] = useState<any | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);

  // Candidates Modal State (Per Vacancy)
  const [isCandidatosModalOpen, setIsCandidatosModalOpen] = useState(false);
  const [selectedRequestForCandidatos, setSelectedRequestForCandidatos] = useState<any | null>(null);
  const [candidatoFilterStatus, setCandidatoFilterStatus] = useState<string>("todos");
  const [showAddCandidatoForm, setShowAddCandidatoForm] = useState(false);

  // Official Alta Modal State (For RRHH / Admin)
  const [isAltaModalOpen, setIsAltaModalOpen] = useState(false);
  const [selectedCandidatoForAlta, setSelectedCandidatoForAlta] = useState<any | null>(null);
  const [selectedRequestForAlta, setSelectedRequestForAlta] = useState<any | null>(null);

  // Radar de Vacantes & Calibración de Sedes
  const [isRadarModalOpen, setIsRadarModalOpen] = useState(false);
  const [calibratingSede, setCalibratingSede] = useState<any | null>(null);

  // System Feedback Modal State (Replaces native alerts)
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
    confirmText?: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
    confirmText: "Entendido"
  });

  const showSystemMessage = (
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string,
    confirmText: string = "Entendido",
    onConfirm?: () => void
  ) => {
    setFeedbackModal({
      isOpen: true,
      type,
      title,
      message,
      confirmText,
      onConfirm
    });
  };

  // Confirmation Modal State (Replaces native confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirmar",
    cancelText: "Cancelar",
    isDestructive: false,
    onConfirm: () => {}
  });

  const showConfirmDialog = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; isDestructive?: boolean }
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText: options?.confirmText || "Confirmar",
      cancelText: options?.cancelText || "Cancelar",
      isDestructive: options?.isDestructive ?? false,
      onConfirm
    });
  };

  // Send to RRHH Modal State (Replaces prompt for date/notes)
  const [sendRRHHModal, setSendRRHHModal] = useState<{
    isOpen: boolean;
    candidato: any | null;
    fechaIngreso: string;
    notas: string;
  }>({
    isOpen: false,
    candidato: null,
    fechaIngreso: "",
    notas: ""
  });

  // Discard Candidate Modal State (Replaces prompt/confirm for discard)
  const [discardModal, setDiscardModal] = useState<{
    isOpen: boolean;
    candidato: any | null;
    tipo: "No se presento" | "Descartado";
    motivo: string;
  }>({
    isOpen: false,
    candidato: null,
    tipo: "No se presento",
    motivo: ""
  });

  // Cese Worker Modal State (Replaces prompt for worker removal)
  const [ceseModal, setCeseModal] = useState<{
    isOpen: boolean;
    vinculo: any | null;
    request: any | null;
    motivo: string;
  }>({
    isOpen: false,
    vinculo: null,
    request: null,
    motivo: "Deserción / Retiro voluntario"
  });

  // Location / Map Modal State
  const [locationModal, setLocationModal] = useState<{
    isOpen: boolean;
    sede: any | null;
    cliente: any | null;
    request: any | null;
  }>({
    isOpen: false,
    sede: null,
    cliente: null,
    request: null
  });

  const handleOpenLocationModal = (req: any) => {
    const matchedSede = sedes.find(s => s.id === req.sede_id) || req.sedes;
    const matchedCliente = clientes.find(c => c.id === (matchedSede?.cliente_id || req.sedes?.cliente_id)) || req.sedes?.clientes;
    setLocationModal({
      isOpen: true,
      sede: matchedSede,
      cliente: matchedCliente,
      request: req
    });
  };

  // Autocomplete search states for Request Modal
  const [cargoSearchQuery, setCargoSearchQuery] = useState("");
  const [showCargoDropdown, setShowCargoDropdown] = useState(false);
  const [clienteSearchQuery, setClienteSearchQuery] = useState("");
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  // Forms
  const [requestForm, setRequestForm] = useState<Record<string, any>>({});
  const [newCandidatoForm, setNewCandidatoForm] = useState<Record<string, any>>({
    nombres: "",
    apellidos: "",
    tipo_documento_id: "",
    numero_documento: "",
    sexo: "Masculino",
    fecha_nacimiento: "",
    telefono: "",
    correo: "",
    direccion: "",
    fuente_reclutamiento: "Directo",
    notas_reclutamiento: ""
  });
  const [altaForm, setAltaForm] = useState<Record<string, any>>({});

  // Current user role
  const { role } = useAuth();
  const currentRole = role || localStorage.getItem("bax_role") || "admin";
  const isRRHHOrAdmin = (currentRole === "admin" || currentRole === "rrhh") && currentRole !== "gerencia";
  const canWrite = currentRole !== "gerencia";

  const loadLookups = async () => {
    try {
      const [s, c, p, r, d, cl, emp, tt, mc, sp, b, usRel] = await Promise.all([
        supabase.from("sedes").select("*, clientes(id, razon_social, empresa_interna_id)").eq("activo", true),
        supabase.from("cargos").select("*").eq("activo", true),
        supabase.from("personas").select("id, nombres, apellidos, numero_documento"),
        supabase.from("regimenes_laborales").select("id, nombre"),
        supabase.from("tipos_documento").select("id, nombre, codigo"),
        supabase.from("clientes").select("*").eq("activo", true).order("razon_social", { ascending: true }),
        supabase.from("empresas_internas").select("id, razon_social, ruc").eq("activo", true),
        supabase.from("tipos_trabajador").select("id, nombre"),
        supabase.from("modalidades_contrato").select("id, nombre"),
        supabase.from("sistemas_pension").select("id, nombre, tipo"),
        supabase.from("bancos").select("id, nombre"),
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
      const relations = usRel?.data || [];
      const mergedSedes = (s.data || []).map((sede: any) => ({
        ...sede,
        usuario_sedes: relations.filter((rel: any) => rel.sede_id === sede.id)
      }));
      setSedes(mergedSedes);
      setCargos(c.data || []);
      setPersonas(p.data || []);
      setRegimenes(r.data || []);
      setDocumentTypes(d.data || []);
      setClientes(cl.data || []);
      setEmpresas(emp.data || []);
      setTiposTrabajador(tt.data || []);
      setModalidadesContrato(mc.data || []);
      setSistemasPension(sp.data || []);
      setBancos(b.data || []);
    } catch (e) {
      console.error("Error loading lookups for recruitment board:", e);
    }
  };

  const loadSolicitudes = async () => {
    setLoading(true);
    setError(null);
    try {
      const [solRes, vincRes] = await Promise.all([
        supabase
          .from("solicitudes_personal")
          .select(`
            *,
            sedes (
              id,
              nombre,
              direccion,
              distrito,
              contacto_nombre,
              contacto_telefono,
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
          .from("vinculos_laborales")
          .select(`
            *,
            personas (id, nombres, apellidos, numero_documento)
          `)
      ]);

      if (solRes.error) throw solRes.error;
      if (vincRes.error) throw vincRes.error;

      setData(solRes.data || []);
      setActiveVinculos(vincRes.data || []);

      // Load candidates from the dedicated candidatos table
      try {
        const { data: candData, error: candError } = await supabase
          .from("candidatos")
          .select(`
            *,
            tipos_documento (id, codigo, nombre),
            cargos (id, nombre),
            sedes (id, nombre, cliente_id, clientes (id, razon_social, empresa_interna_id)),
            solicitudes_personal (
              id,
              sede_id,
              cargo_id,
              turno,
              plazas_solicitadas,
              plazas_cubiertas,
              estado,
              sedes (id, nombre, cliente_id, clientes (id, razon_social, empresa_interna_id)),
              cargos (id, nombre)
            )
          `)
          .order("creado_en", { ascending: false });

        if (!candError && candData) {
          setCandidatos(candData);
        }
      } catch (cErr) {
        console.warn("Tabla candidatos no lista aún:", cErr);
      }
    } catch (e: any) {
      setError(e.message || "Error al cargar la pizarra digital.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLookups();
    loadSolicitudes();
  }, []);

  // Candidates waiting for official RRHH approval
  const pendingAltas = candidatos.filter(c => c.estado === "Pendiente de Alta");

  // Open Create Vacancy Modal
  const handleOpenRequest = () => {
    setRequestForm({
      cliente_id: "",
      sede_id: "",
      cargo_id: "",
      turno: "Rotativo",
      genero_requerido: "Indistinto",
      plazas_solicitadas: 1,
      plazas_cubiertas: 0,
      estado: "Pendiente",
      motivo_vacante: "Incremento de personal",
      fecha_solicitud: new Date().toISOString().split("T")[0]
    });
    setCargoSearchQuery("");
    setShowCargoDropdown(false);
    setClienteSearchQuery("");
    setShowClienteDropdown(false);
    setEditingRequestId(null);
    setIsRequestModalOpen(true);
  };

  // Open Edit Vacancy Modal
  const handleOpenEditRequest = (req: any) => {
    const matchedSede = sedes.find(s => s.id === req.sede_id);
    const cliId = matchedSede ? matchedSede.cliente_id : "";

    setRequestForm({
      cliente_id: cliId,
      sede_id: req.sede_id,
      cargo_id: req.cargo_id,
      turno: req.turno,
      genero_requerido: req.genero_requerido || "Indistinto",
      plazas_solicitadas: req.plazas_solicitadas,
      plazas_cubiertas: req.plazas_cubiertas || 0,
      estado: req.estado || "Pendiente",
      motivo_vacante: req.motivo_vacante || "",
      fecha_solicitud: req.fecha_solicitud || new Date().toISOString().split("T")[0]
    });

    const matchedClient = clientes.find(c => c.id === cliId);
    setClienteSearchQuery(matchedClient ? matchedClient.razon_social : "");
    setShowClienteDropdown(false);

    const matchedCargo = cargos.find(c => c.id === req.cargo_id);
    setCargoSearchQuery(matchedCargo ? matchedCargo.nombre : "");
    setShowCargoDropdown(false);

    setEditingRequestId(req.id);
    setIsRequestModalOpen(true);
  };

  // Save Vacancy Request (Insert or Update)
  const handleSaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.cliente_id) {
      showSystemMessage("warning", "Cliente Requerido", "Por favor, seleccione un Cliente para la vacante.");
      return;
    }
    if (!requestForm.sede_id) {
      showSystemMessage("warning", "Sede Requerida", "Por favor, seleccione una Sede / Centro de Trabajo.");
      return;
    }
    if (!requestForm.cargo_id) {
      showSystemMessage("warning", "Cargo Requerido", "Por favor, seleccione un Cargo Requerido.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { cliente_id, ...insertData } = requestForm;

      if (editingRequestId) {
        const { error: dbErr } = await supabase
          .from("solicitudes_personal")
          .update(insertData)
          .eq("id", editingRequestId);
        if (dbErr) throw dbErr;
      } else {
        const { error: dbErr } = await supabase
          .from("solicitudes_personal")
          .insert([insertData]);
        if (dbErr) throw dbErr;
      }

      setIsRequestModalOpen(false);
      setEditingRequestId(null);
      showSystemMessage(
        "success",
        editingRequestId ? "Vacante Actualizada" : "Vacante Publicada",
        editingRequestId ? "La solicitud de vacante ha sido actualizada con éxito." : "La nueva vacante ha sido registrada en la pizarra digital."
      );
      loadSolicitudes();
    } catch (err: any) {
      console.error("Error saving vacancy request:", err);
      showSystemMessage("error", "Error al Guardar", err.message || "Error al guardar solicitud de vacante.");
    } finally {
      setLoading(false);
    }
  };

  // Delete Vacancy Request
  const handleDeleteRequest = (id: number) => {
    showConfirmDialog(
      "¿Eliminar Solicitud de Vacante?",
      "Esta acción no se puede deshacer y desvinculará a los colaboradores asociados a esta vacante en la pizarra.",
      async () => {
        setLoading(true);
        try {
          const { error: dbErr } = await supabase
            .from("solicitudes_personal")
            .delete()
            .eq("id", id);

          if (dbErr) throw dbErr;
          showSystemMessage("success", "Vacante Eliminada", "La solicitud fue eliminada correctamente de la pizarra.");
          loadSolicitudes();
        } catch (err: any) {
          console.error("Error deleting vacancy request:", err);
          showSystemMessage("error", "Error al Eliminar", err.message || "No se pudo eliminar la solicitud.");
        } finally {
          setLoading(false);
        }
      },
      { confirmText: "Sí, Eliminar", isDestructive: true }
    );
  };

  // ==========================================
  // CANDIDATES MANAGEMENT (RECLUTAMIENTO)
  // ==========================================

  // Manejar selección de vacante desde el Radar de Vacantes
  const handleSelectVacanteFromRadar = (
    vacante: any,
    candidateLocation?: { direccion: string; distrito?: string }
  ) => {
    setSelectedRequestForCandidatos(vacante);
    setCandidatoFilterStatus("todos");
    setShowAddCandidatoForm(true);
    const firstDoc = documentTypes[0]?.id || 1;
    setNewCandidatoForm({
      nombres: "",
      apellidos: "",
      tipo_documento_id: firstDoc,
      numero_documento: "",
      sexo: "Masculino",
      fecha_nacimiento: "",
      telefono: "",
      correo: "",
      direccion: candidateLocation?.direccion || "",
      fuente_reclutamiento: "Radar de Ubicación",
      notas_reclutamiento: candidateLocation?.distrito
        ? `Ubicado por cercanía a distrito: ${candidateLocation.distrito}`
        : ""
    });
    setIsCandidatosModalOpen(true);
    setIsRadarModalOpen(false);
  };

  // Manejar actualización de coordenadas de sede tras calibración
  const handleSedeUpdated = (updatedSede: any) => {
    setSedes(prev => prev.map(s => (s.id === updatedSede.id ? { ...s, ...updatedSede } : s)));
    setData(prev =>
      prev.map(req => {
        if (req.sede_id === updatedSede.id) {
          return {
            ...req,
            sedes: {
              ...req.sedes,
              ...updatedSede
            }
          };
        }
        return req;
      })
    );

    // Sincronizar locationModal si está abierto para refrescar el mapa al instante
    setLocationModal(prev => {
      if (prev.isOpen && (prev.sede?.id === updatedSede.id || prev.request?.sede_id === updatedSede.id)) {
        return {
          ...prev,
          sede: {
            ...prev.sede,
            ...updatedSede
          }
        };
      }
      return prev;
    });

    showSystemMessage(
      "success",
      "Sede Calibrada",
      `La ubicación de la sede "${updatedSede.nombre}" se actualizó correctamente en el sistema.`
    );
  };

  const handleOpenCandidatosModal = (req: any) => {
    setSelectedRequestForCandidatos(req);
    setCandidatoFilterStatus("todos");
    setShowAddCandidatoForm(false);
    setNewCandidatoForm({
      nombres: "",
      apellidos: "",
      tipo_documento_id: documentTypes[0]?.id || 1,
      numero_documento: "",
      sexo: "Masculino",
      fecha_nacimiento: "",
      telefono: "",
      correo: "",
      direccion: "",
      fuente_reclutamiento: "Directo",
      notas_reclutamiento: ""
    });
    setIsCandidatosModalOpen(true);
  };

  // Save new candidate into 'candidatos'
  const handleSaveCandidato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestForCandidatos) return;
    if (!newCandidatoForm.nombres?.trim() || !newCandidatoForm.apellidos?.trim() || !newCandidatoForm.numero_documento?.trim()) {
      showSystemMessage("warning", "Campos Requeridos", "Por favor completa los nombres, apellidos y número de documento del postulante.");
      return;
    }

    setLoading(true);
    try {
      const firstDoc = documentTypes[0]?.id || 1;
      const payload = {
        solicitud_id: selectedRequestForCandidatos.id,
        cargo_postula_id: selectedRequestForCandidatos.cargo_id,
        sede_interes_id: selectedRequestForCandidatos.sede_id,
        tipo_documento_id: newCandidatoForm.tipo_documento_id ? parseInt(newCandidatoForm.tipo_documento_id) : firstDoc,
        numero_documento: newCandidatoForm.numero_documento.trim(),
        nombres: newCandidatoForm.nombres.trim(),
        apellidos: newCandidatoForm.apellidos.trim(),
        sexo: newCandidatoForm.sexo || "Masculino",
        fecha_nacimiento: newCandidatoForm.fecha_nacimiento || null,
        telefono: newCandidatoForm.telefono?.trim() || null,
        correo: newCandidatoForm.correo?.trim() || null,
        direccion: newCandidatoForm.direccion?.trim() || null,
        fuente_reclutamiento: newCandidatoForm.fuente_reclutamiento || "Directo",
        notas_reclutamiento: newCandidatoForm.notas_reclutamiento?.trim() || null,
        estado: "Postulante"
      };

      const { error: insErr } = await supabase.from("candidatos").insert([payload]);
      if (insErr) throw insErr;

      setShowAddCandidatoForm(false);
      setNewCandidatoForm({
        nombres: "",
        apellidos: "",
        tipo_documento_id: firstDoc,
        numero_documento: "",
        sexo: "Masculino",
        fecha_nacimiento: "",
        telefono: "",
        correo: "",
        direccion: "",
        fuente_reclutamiento: "Directo",
        notas_reclutamiento: ""
      });
      showSystemMessage(
        "success",
        "¡Postulante Registrado!",
        "El candidato fue registrado con éxito en la vacante. Ahora puedes gestionar su evaluación o enviarlo a RRHH cuando asista."
      );
      await loadSolicitudes();
    } catch (err: any) {
      console.error("Error saving candidate:", err);
      showSystemMessage("error", "Error al Registrar Candidato", err.message || "No se pudo registrar el postulante.");
    } finally {
      setLoading(false);
    }
  };

  // Recruiter action: Open Send to RRHH dialog
  const handleOpenSendRRHH = (cand: any) => {
    setSendRRHHModal({
      isOpen: true,
      candidato: cand,
      fechaIngreso: cand.fecha_posible_ingreso || new Date().toISOString().split("T")[0],
      notas: cand.notas_reclutamiento || "Candidato seleccionado y confirmado para ingreso"
    });
  };

  // Recruiter action: Confirm attendance / Send to RRHH for Contract
  const handleConfirmSendRRHH = async (e: React.FormEvent) => {
    e.preventDefault();
    const cand = sendRRHHModal.candidato;
    if (!cand) return;

    if (!sendRRHHModal.fechaIngreso) {
      showSystemMessage("warning", "Fecha Requerida", "Por favor ingresa la fecha confirmada o tentativa de ingreso laboral.");
      return;
    }

    setLoading(true);
    try {
      const { error: updErr } = await supabase
        .from("candidatos")
        .update({
          estado: "Pendiente de Alta",
          fecha_posible_ingreso: sendRRHHModal.fechaIngreso,
          notas_reclutamiento: sendRRHHModal.notas || "Candidato seleccionado y confirmado"
        })
        .eq("id", cand.id);

      if (updErr) throw updErr;

      setSendRRHHModal({ isOpen: false, candidato: null, fechaIngreso: "", notas: "" });
      showSystemMessage(
        "success",
        "¡Pase a RRHH Confirmado!",
        `El candidato ${cand.apellidos}, ${cand.nombres} fue enviado exitosamente a la Bandeja de RRHH para la formalización de contrato.`
      );
      await loadSolicitudes();
    } catch (err: any) {
      showSystemMessage("error", "Error al Enviar a RRHH", err.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  // Recruiter action: Open Discard dialog
  const handleOpenDiscard = (cand: any) => {
    setDiscardModal({
      isOpen: true,
      candidato: cand,
      tipo: "No se presento",
      motivo: "No se presentó a la fecha pactada / Desistió del puesto"
    });
  };

  // Recruiter action: Discard or mark as didn't show up
  const handleConfirmDiscard = async (e: React.FormEvent) => {
    e.preventDefault();
    const cand = discardModal.candidato;
    if (!cand) return;

    const finalMotivo = discardModal.motivo.trim() || (discardModal.tipo === "No se presento" ? "No se presentó a laborar" : "Descartado en proceso");

    setLoading(true);
    try {
      const { error: updErr } = await supabase
        .from("candidatos")
        .update({
          estado: discardModal.tipo,
          motivo_descarte: finalMotivo
        })
        .eq("id", cand.id);

      if (updErr) throw updErr;

      setDiscardModal({ isOpen: false, candidato: null, tipo: "No se presento", motivo: "" });
      showSystemMessage(
        "info",
        "Candidato Actualizado",
        `El candidato quedó registrado como '${discardModal.tipo}'. Las Fichas de Personal no fueron afectadas.`
      );
      await loadSolicitudes();
    } catch (err: any) {
      showSystemMessage("error", "Error al Descartar", err.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  // Change candidate state (Postulante -> En Evaluacion -> Aprobado)
  const handleCambiarEstadoCandidato = async (candId: number, nuevoEstado: string) => {
    setLoading(true);
    try {
      const { error: updErr } = await supabase
        .from("candidatos")
        .update({ estado: nuevoEstado })
        .eq("id", candId);
      if (updErr) throw updErr;
      await loadSolicitudes();
    } catch (err: any) {
      showSystemMessage("error", "Error al Actualizar Estado", err.message || "No se pudo actualizar el estado.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // OFFICIAL ONBOARDING & CONTRACT (RRHH)
  // ==========================================

  const handleOpenAltaModal = (cand: any, req?: any) => {
    setSelectedCandidatoForAlta(cand);
    const targetRequest = req || cand.solicitudes_personal || data.find(s => s.id === cand.solicitud_id);
    setSelectedRequestForAlta(targetRequest || null);

    const targetEmpresaId = targetRequest?.sedes?.clientes?.empresa_interna_id || empresas[0]?.id || "";

    setAltaForm({
      empresa_interna_id: targetEmpresaId,
      sede_id: targetRequest?.sede_id || cand.sede_interes_id || "",
      cargo_id: targetRequest?.cargo_id || cand.cargo_postula_id || "",
      sueldo_basico: 1130.00,
      bono: 0.00,
      asignacion_familiar: false,
      regimen_laboral_id: regimenes[0]?.id || 1,
      tipo_trabajador_id: tiposTrabajador[0]?.id || 1,
      modalidad_contrato_id: modalidadesContrato[0]?.id || 1,
      fecha_ingreso: cand.fecha_posible_ingreso || new Date().toISOString().split("T")[0],
      fecha_fin: "",
      sistema_pension_id: sistemasPension[0]?.id || 1,
      banco_sueldo_id: "",
      cuenta_sueldo: ""
    });

    setIsAltaModalOpen(true);
  };

  // Submit official contract by RRHH (Creates persona + vinculo + contrato + updates candidate)
  const handleSaveAltaOficial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidatoForAlta) return;

    if (!altaForm.empresa_interna_id || !altaForm.sede_id || !altaForm.cargo_id) {
      showSystemMessage("warning", "Datos Requeridos", "Por favor complete los datos obligatorios de Empresa, Sede y Cargo.");
      return;
    }

    setLoading(true);
    try {
      // 1. Check if persona already exists by DNI (for former workers re-entering)
      const docNum = selectedCandidatoForAlta.numero_documento.trim();
      const { data: existingPers } = await supabase
        .from("personas")
        .select("id")
        .eq("numero_documento", docNum)
        .maybeSingle();

      let finalPersonaId: number;

      if (existingPers) {
        finalPersonaId = existingPers.id;
        // Optionally update contact fields in persona
        await supabase
          .from("personas")
          .update({
            telefono: selectedCandidatoForAlta.telefono || undefined,
            correo: selectedCandidatoForAlta.correo || undefined,
            sistema_pension_id: altaForm.sistema_pension_id ? parseInt(altaForm.sistema_pension_id) : undefined
          })
          .eq("id", finalPersonaId);
      } else {
        // Create new persona
        const { data: newPers, error: pErr } = await supabase
          .from("personas")
          .insert([{
            tipo_documento_id: selectedCandidatoForAlta.tipo_documento_id || 1,
            numero_documento: docNum,
            nombres: selectedCandidatoForAlta.nombres.trim(),
            apellidos: selectedCandidatoForAlta.apellidos.trim(),
            sexo: selectedCandidatoForAlta.sexo || "Masculino",
            fecha_nacimiento: selectedCandidatoForAlta.fecha_nacimiento || null,
            telefono: selectedCandidatoForAlta.telefono?.trim() || null,
            correo: selectedCandidatoForAlta.correo?.trim() || null,
            direccion: selectedCandidatoForAlta.direccion?.trim() || null,
            sistema_pension_id: altaForm.sistema_pension_id ? parseInt(altaForm.sistema_pension_id) : (sistemasPension[0]?.id || 1),
            banco_sueldo_id: altaForm.banco_sueldo_id ? parseInt(altaForm.banco_sueldo_id) : null,
            cuenta_sueldo: altaForm.cuenta_sueldo?.trim() || null
          }])
          .select("id")
          .single();

        if (pErr) throw pErr;
        finalPersonaId = newPers.id;
      }

      // 2. Create active Vínculo Laboral
      const startDate = altaForm.fecha_ingreso || new Date().toISOString().split("T")[0];
      const { data: newVinc, error: vErr } = await supabase
        .from("vinculos_laborales")
        .insert([{
          persona_id: finalPersonaId,
          empresa_interna_id: parseInt(altaForm.empresa_interna_id),
          sede_id: parseInt(altaForm.sede_id),
          cargo_id: parseInt(altaForm.cargo_id),
          tipo_trabajador_id: parseInt(altaForm.tipo_trabajador_id) || (tiposTrabajador[0]?.id || 1),
          regimen_laboral_id: parseInt(altaForm.regimen_laboral_id) || (regimenes[0]?.id || 1),
          sueldo_basico: parseFloat(altaForm.sueldo_basico) || 1130.00,
          bono: parseFloat(altaForm.bono) || 0.00,
          asignacion_familiar: !!altaForm.asignacion_familiar,
          fecha_ingreso: startDate,
          fecha_primer_contrato: startDate,
          estado: "Activo",
          solicitud_id: selectedRequestForAlta?.id || selectedCandidatoForAlta.solicitud_id || null
        }])
        .select("id")
        .single();

      if (vErr) throw vErr;

      // 3. Create Vigente Contract
      const { error: cErr } = await supabase
        .from("contratos")
        .insert([{
          vinculo_laboral_id: newVinc.id,
          modalidad_contrato_id: parseInt(altaForm.modalidad_contrato_id) || (modalidadesContrato[0]?.id || 1),
          fecha_inicio: startDate,
          fecha_fin: altaForm.fecha_fin || null,
          estado: "Vigente"
        }]);

      if (cErr) throw cErr;

      // 4. Update Candidato record to 'Contratado'
      await supabase
        .from("candidatos")
        .update({
          estado: "Contratado",
          persona_id: finalPersonaId
        })
        .eq("id", selectedCandidatoForAlta.id);

      // 5. Update Solicitud plazas cubiertas if associated
      const targetReqId = selectedRequestForAlta?.id || selectedCandidatoForAlta.solicitud_id;
      if (targetReqId) {
        const reqObj = data.find(s => s.id === targetReqId);
        if (reqObj) {
          const newCovered = (reqObj.plazas_cubiertas || 0) + 1;
          const newEstado = newCovered >= reqObj.plazas_solicitadas ? "Completado" : "Parcial";
          await supabase
            .from("solicitudes_personal")
            .update({
              plazas_cubiertas: newCovered,
              estado: newEstado
            })
            .eq("id", targetReqId);
        }
      }

      setIsAltaModalOpen(false);
      setIsCandidatosModalOpen(false);
      showSystemMessage(
        "success",
        "¡Alta Oficial Exitosa!",
        `El colaborador ${selectedCandidatoForAlta.apellidos}, ${selectedCandidatoForAlta.nombres} ha sido dado de alta exitosamente en Planilla Activa y Fichas de Personal.`
      );
      await loadSolicitudes();
    } catch (err: any) {
      console.error("Error en alta oficial:", err);
      showSystemMessage("error", "Error en Alta Laboral", err.message || "No se pudo completar el alta en planilla.");
    } finally {
      setLoading(false);
    }
  };

  // Open Cese worker dialog
  const handleOpenCeseModal = (vinculo: any, request: any) => {
    setCeseModal({
      isOpen: true,
      vinculo,
      request,
      motivo: "Deserción / Retiro voluntario"
    });
  };

  // Confirm worker removal / cese
  const handleConfirmCeseWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    const { vinculo, request, motivo } = ceseModal;
    if (!vinculo || !request) return;

    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      // 1. Update vinculo_laboral to Inactivo
      const { error: vinculoErr } = await supabase
        .from("vinculos_laborales")
        .update({
          estado: "Inactivo",
          fecha_cese: today,
          motivo_cese: motivo.trim() || "Deserción / Retiro temprano"
        })
        .eq("id", vinculo.id);

      if (vinculoErr) throw vinculoErr;

      // 2. Decrement plazas_cubiertas and update status
      const newCovered = Math.max(0, request.plazas_cubiertas - 1);
      const newEstado = newCovered === 0 ? "Pendiente" : "Parcial";

      const { error: reqErr } = await supabase
        .from("solicitudes_personal")
        .update({
          plazas_cubiertas: newCovered,
          estado: newEstado
        })
        .eq("id", request.id);

      if (reqErr) throw reqErr;

      setCeseModal({ isOpen: false, vinculo: null, request: null, motivo: "Deserción / Retiro voluntario" });
      showSystemMessage(
        "success",
        "Cese Laboral Registrado",
        "El cese fue registrado exitosamente y la plaza ha quedado libre en la pizarra digital."
      );
      loadSolicitudes();
    } catch (err: any) {
      showSystemMessage("error", "Error al Cesar Colaborador", err.message || "No se pudo registrar el cese.");
    } finally {
      setLoading(false);
    }
  };

  // Quick Seed Demo Vacancies
  const [seeding, setSeeding] = useState(false);
  const handleSeedVacancies = async () => {
    setSeeding(true);
    try {
      const { data: activeSedes } = await supabase.from("sedes").select("id").limit(2);
      const { data: activeCargos } = await supabase.from("cargos").select("id").limit(2);

      if (!activeSedes || activeSedes.length === 0 || !activeCargos || activeCargos.length === 0) {
        showSystemMessage("warning", "Configuración Requerida", "Primero debes registrar Sedes y Cargos en el sistema.");
        return;
      }

      await supabase.from("solicitudes_personal").insert([
        {
          sede_id: activeSedes[0].id,
          cargo_id: activeCargos[0].id,
          turno: "Día",
          genero_requerido: "Indistinto",
          plazas_solicitadas: 5,
          plazas_cubiertas: 2,
          estado: "Parcial",
          motivo_vacante: "Campaña de Invierno",
          fecha_solicitud: new Date().toISOString().split("T")[0]
        },
        ...(activeSedes[1] && activeCargos[1] ? [{
          sede_id: activeSedes[1].id,
          cargo_id: activeCargos[1].id,
          turno: "Rotativo",
          genero_requerido: "Masculino",
          plazas_solicitadas: 2,
          plazas_cubiertas: 0,
          estado: "Pendiente",
          motivo_vacante: "Reemplazo por renuncia",
          fecha_solicitud: new Date().toISOString().split("T")[0]
        }] : [])
      ]);

      showSystemMessage("success", "Pizarra Demo Precargada", "Se precargaron las vacantes de prueba exitosamente.");
      loadSolicitudes();
    } catch (err: any) {
      showSystemMessage("error", "Error al Precargar Vacantes", err.message || "Ocurrió un error.");
    } finally {
      setSeeding(false);
    }
  };

  // Filter lists
  const filteredData = data.filter((s) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    const sedeName = s.sedes?.nombre?.toLowerCase() || "";
    const cargoName = s.cargos?.nombre?.toLowerCase() || "";
    const clientName = s.sedes?.clientes?.razon_social?.toLowerCase() || "";
    return sedeName.includes(q) || cargoName.includes(q) || clientName.includes(q);
  });

  const filteredPendingAltas = pendingAltas.filter((c) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    const fullName = `${c.apellidos} ${c.nombres}`.toLowerCase();
    const dni = c.numero_documento?.toLowerCase() || "";
    const cargo = c.cargos?.nombre?.toLowerCase() || c.solicitudes_personal?.cargos?.nombre?.toLowerCase() || "";
    const sede = c.sedes?.nombre?.toLowerCase() || c.solicitudes_personal?.sedes?.nombre?.toLowerCase() || "";
    return fullName.includes(q) || dni.includes(q) || cargo.includes(q) || sede.includes(q);
  });

  // Filter cargos for autocomplete
  const filteredCargos = cargos.filter((c) => {
    const q = cargoSearchQuery.toLowerCase();
    if (!q) return true;
    return c.nombre.toLowerCase().includes(q);
  });

  // Filter clients for autocomplete
  const filteredClientes = clientes.filter((c) => {
    const q = clienteSearchQuery.toLowerCase();
    if (!q) return true;
    return c.razon_social.toLowerCase().includes(q) || (c.ruc && c.ruc.toLowerCase().includes(q));
  });

  // Reactive live details of the selected request
  const liveDetailRequest = selectedDetailRequest
    ? data.find((r) => r.id === selectedDetailRequest.id)
    : null;

  // Candidates for selected request modal
  const candidatesForModal = selectedRequestForCandidatos
    ? candidatos.filter(c => {
        if (c.solicitud_id !== selectedRequestForCandidatos.id) return false;
        if (candidatoFilterStatus === "todos") return true;
        if (candidatoFilterStatus === "proceso") return c.estado === "Postulante" || c.estado === "En Evaluacion" || c.estado === "Aprobado";
        if (candidatoFilterStatus === "altas") return c.estado === "Pendiente de Alta";
        if (candidatoFilterStatus === "contratados") return c.estado === "Contratado";
        if (candidatoFilterStatus === "descartados") return c.estado === "Descartado" || c.estado === "No se presento";
        return true;
      })
    : [];

  return (
    <div className="flex flex-col h-full space-y-5 overflow-y-auto pr-1">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1 flex-shrink-0 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Recursos Humanos / Reclutamiento & Onboarding
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-8 h-8 text-blue-600" />
            Pizarra Digital de Personal
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Flujo en 2 etapas: Reclutamiento capta postulantes sin contaminar la nómina, y RRHH formaliza los contratos y altas laborales.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          {data.length === 0 && !loading && (
            <button
              onClick={handleSeedVacancies}
              disabled={seeding}
              className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${seeding ? "animate-spin" : ""}`} />
              Precargar Pizarra Demo
            </button>
          )}

          <button
            onClick={loadSolicitudes}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-2.5 rounded-lg text-xs font-semibold hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
            title="Recargar datos de la pizarra"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </button>

          {/* Botón Destacado: Radar de Vacantes por Postulante */}
          <button
            onClick={() => setIsRadarModalOpen(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all cursor-pointer"
            title="Buscar vacantes cercanas a la ubicación del postulante"
          >
            <Compass className="w-4 h-4 text-blue-200 animate-pulse" />
            <span>Radar de Vacantes</span>
            <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider">
              GPS
            </span>
          </button>

          {(currentRole === "admin" || currentRole === "supervisor" || currentRole === "rrhh") && currentRole !== "gerencia" && (
            <button
              onClick={handleOpenRequest}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Nueva Vacante
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab("pizarra")}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "pizarra"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Pizarra de Vacantes
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-mono">
            {data.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("altas_pendientes")}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer relative ${
            activeTab === "altas_pendientes"
              ? "border-amber-600 text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          Bandeja de Altas Pendientes (RRHH)
          {pendingAltas.length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500 text-white font-black animate-pulse font-mono">
              {pendingAltas.length}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500 font-mono">
              0
            </span>
          )}
        </button>
      </div>

      {/* Search and filter toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === "pizarra" ? "Buscar por Sede, Cliente o Cargo..." : "Buscar postulante por Nombre, DNI, Cargo o Sede..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 font-medium text-slate-700"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 font-medium">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      {/* TAB 1: Pizarra de Vacantes */}
      {activeTab === "pizarra" && (
        <>
          {loading && data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-semibold text-slate-600">Sincronizando pizarra de reclutamiento...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 py-16 text-center space-y-4">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100 max-w-max mx-auto">
                <LayoutDashboard className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No hay vacantes activas en la pizarra</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">Verifica tus filtros o solicita personal para agregar vacantes.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[400px]">
              <div className="flex-1 overflow-auto max-h-[60vh] relative">
                <table className="w-full text-left border-collapse min-w-[950px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4 sticky top-0 bg-slate-100/95 backdrop-blur-sm z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">ID</th>
                      <th className="px-6 py-4 sticky top-0 bg-slate-100/95 backdrop-blur-sm z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Fecha</th>
                      <th className="px-6 py-4 sticky top-0 bg-slate-100/95 backdrop-blur-sm z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Cliente / Sede</th>
                      <th className="px-6 py-4 sticky top-0 bg-slate-100/95 backdrop-blur-sm z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Cargo Requerido</th>
                      <th className="px-6 py-4 sticky top-0 bg-slate-100/95 backdrop-blur-sm z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Turno</th>
                      <th className="px-6 py-4 sticky top-0 bg-slate-100/95 backdrop-blur-sm z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)] text-center">Plazas Cubiertas</th>
                      <th className="px-6 py-4 sticky top-0 bg-slate-100/95 backdrop-blur-sm z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)] text-center">Candidatos / Proceso</th>
                      <th className="px-6 py-4 sticky top-0 bg-slate-100/95 backdrop-blur-sm z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)] text-center">Estado</th>
                      <th className="px-6 py-4 sticky top-0 bg-slate-100/95 backdrop-blur-sm z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)] text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.map((req, index) => {
                      const isCompleted = req.estado === "Completado";
                      const pct = Math.min(100, Math.floor((req.plazas_cubiertas / req.plazas_solicitadas) * 100));
                      
                      const reqCandidatos = candidatos.filter(c => c.solicitud_id === req.id);
                      const reqPendingAltas = reqCandidatos.filter(c => c.estado === "Pendiente de Alta");
                      const isNearBottom = filteredData.length > 2 && index >= filteredData.length - 2;

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-slate-600 font-semibold">
                            #{req.id}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-500 font-mono">
                            {new Date(req.fecha_solicitud).toLocaleDateString("es-PE")}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800 text-sm">
                              {req.sedes?.clientes?.razon_social || "No asignado"}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleOpenLocationModal(req)}
                                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-300 px-2 py-0.5 rounded-md font-medium transition-all group/loc cursor-pointer"
                                title="Ver dirección y mapa satelital de la sede"
                              >
                                <MapPin className="w-3.5 h-3.5 text-blue-500 group-hover/loc:scale-110 transition-transform" />
                                <span className="font-semibold text-slate-700 group-hover/loc:text-blue-700 truncate max-w-[200px]">
                                  {req.sedes?.nombre || "Sede Desconocida"}
                                </span>
                                <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover/loc:text-blue-600 opacity-70" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-800 font-bold">
                            {req.cargos?.nombre || "Cargo Desconocido"}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold">
                            <div className="relative group/turno inline-block">
                              <div
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200/80 transition-all cursor-help"
                                title={req.motivo_vacante ? `Motivo: ${req.motivo_vacante}` : "Sin motivo registrado"}
                              >
                                <Clock className="w-3 h-3 text-slate-400 group-hover/turno:text-blue-500 transition-colors" />
                                <span>{req.turno}</span>
                                {req.motivo_vacante && (
                                  <MessageSquare className="w-2.5 h-2.5 text-blue-500 opacity-80" />
                                )}
                              </div>

                              {/* Rich Popover on Hover showing Motivo (Smart dynamic positioning) */}
                              <div
                                className={`absolute left-0 ${
                                  isNearBottom ? "bottom-full mb-2" : "top-full mt-1.5"
                                } hidden group-hover/turno:flex flex-col w-72 p-3 bg-slate-900/95 text-white text-xs rounded-xl shadow-2xl border border-slate-800 backdrop-blur-md z-50 animate-fade-in pointer-events-none`}
                              >
                                <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  <span className="flex items-center gap-1 text-blue-400">
                                    <MessageSquare className="w-3 h-3" /> Motivo del Requerimiento
                                  </span>
                                  <span>#{req.id}</span>
                                </div>

                                <div className="text-slate-200 text-xs font-normal leading-relaxed whitespace-pre-wrap bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60 mb-2">
                                  {req.motivo_vacante ? (
                                    <span>&ldquo;{req.motivo_vacante}&rdquo;</span>
                                  ) : (
                                    <span className="italic text-slate-400">Sin motivo registrado al crear la vacante.</span>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                                  <div>
                                    <span className="text-slate-500">Género:</span>{" "}
                                    <span className="text-slate-300 font-semibold">{req.genero_requerido || "Indistinto"}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Plazas:</span>{" "}
                                    <span className="text-slate-300 font-semibold">{req.plazas_solicitadas} vacante(s)</span>
                                  </div>
                                </div>

                                {/* Arrow */}
                                {isNearBottom ? (
                                  <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-slate-900/95" />
                                ) : (
                                  <div className="absolute bottom-full left-4 -mb-1 border-4 border-transparent border-b-slate-900/95" />
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center justify-center space-y-1">
                              <span className={`text-xs font-bold ${isCompleted ? "text-emerald-600" : "text-slate-700"}`}>
                                {req.plazas_cubiertas} de {req.plazas_solicitadas}
                              </span>
                              <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${isCompleted ? "bg-emerald-500" : "bg-blue-500"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => handleOpenCandidatosModal(req)}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer"
                                title="Ver y gestionar postulantes"
                              >
                                <Users className="w-3 h-3 text-slate-500" />
                                {reqCandidatos.length} postulante(s)
                              </button>
                              {reqPendingAltas.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                                  <Clock className="w-2.5 h-2.5 text-amber-600" />
                                  {reqPendingAltas.length} por validar RRHH
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              isCompleted ? "bg-emerald-100 text-emerald-800" :
                              req.estado === "Parcial" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800 animate-pulse"
                            }`}>
                              {req.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Manage Candidates Button (Compact +) */}
                              <button
                                onClick={() => handleOpenCandidatosModal(req)}
                                className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 rounded-lg transition-all cursor-pointer shadow-xs flex items-center justify-center group/btn"
                                title={`Gestionar Postulantes y Reclutamiento (${reqCandidatos.length} candidatos) · Añadir (+)`}
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5] transition-transform group-hover/btn:scale-110" />
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedDetailRequest(req);
                                  setIsDetailModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Ver Historial de Ingresos y Deserciones"
                              >
                                Historial
                              </button>

                              {currentRole === "admin" && (
                                <>
                                  <button
                                    onClick={() => handleOpenEditRequest(req)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Editar Solicitud"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRequest(req.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Eliminar Solicitud"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: Bandeja de Altas Pendientes (RRHH) */}
      {activeTab === "altas_pendientes" && (
        <div className="space-y-4">
          <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Bandeja de Formalización de Contratos & Planilla (Exclusivo RRHH)
                </h3>
                <p className="text-xs text-slate-500">
                  Candidatos enviados por el equipo de Reclutamiento que asistieron o fueron aprobados. Solo RRHH formaliza el ingreso a planilla y genera el contrato.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
                {pendingAltas.length} expediente(s) en espera
              </span>
            </div>
          </div>

          {filteredPendingAltas.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 py-16 text-center space-y-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 max-w-max mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">¡Al día! No hay altas laborales pendientes</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Cuando las reclutadoras confirmen la asistencia de un candidato, aparecerá automáticamente en esta bandeja para la formalización del contrato.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Postulante Seleccionado</th>
                      <th className="px-6 py-4">Vacante Destino</th>
                      <th className="px-6 py-4">Fuente Captación</th>
                      <th className="px-6 py-4">Fecha Tentativa Ingreso</th>
                      <th className="px-6 py-4">Notas Reclutamiento</th>
                      <th className="px-6 py-4 text-right">Acción RRHH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredPendingAltas.map((cand) => {
                      const req = cand.solicitudes_personal;
                      return (
                        <tr key={cand.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 text-sm">{cand.apellidos}, {cand.nombres}</div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                              <span>DNI: {cand.numero_documento}</span>
                              {cand.telefono && (
                                <span className="flex items-center gap-0.5 text-slate-500">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {cand.telefono}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">{req?.cargos?.nombre || cand.cargos?.nombre || "Cargo Solicitado"}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span>{req?.sedes?.clientes?.razon_social || "Cliente"}</span>
                              <span>&bull;</span>
                              <span className="font-semibold text-slate-700">{req?.sedes?.nombre || cand.sedes?.nombre || "Sede"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                              <Tag className="w-3 h-3" />
                              {cand.fuente_reclutamiento || "Directo"}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-slate-800">
                            {cand.fecha_posible_ingreso ? new Date(cand.fecha_posible_ingreso + "T12:00:00").toLocaleDateString("es-PE") : "-"}
                          </td>
                          <td className="px-6 py-4 text-slate-600 italic max-w-xs">
                            "{cand.notas_reclutamiento || "Sin observaciones específicas"}"
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isRRHHOrAdmin ? (
                                <button
                                  onClick={() => handleOpenAltaModal(cand, req)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-100 cursor-pointer"
                                >
                                  <FileCheck className="w-4 h-4" />
                                  Completar Alta y Contrato
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">
                                  {currentRole === "gerencia" ? "Modo Lectura" : "Requiere rol RRHH"}
                                </span>
                              )}

                              {isRRHHOrAdmin && (
                                <button
                                  onClick={() => handleOpenDiscard(cand)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Rechazar / Descartar candidato"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: GESTIÓN DE CANDIDATOS POR VACANTE (RECLUTAMIENTO) */}
      {/* ==================================================== */}
      {isCandidatosModalOpen && selectedRequestForCandidatos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in p-3">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-slide-in border border-slate-100 flex flex-col">
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Proceso de Reclutamiento & Selección
                </span>
                <h3 className="font-heading text-lg font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  {selectedRequestForCandidatos.cargos?.nombre} &bull; {selectedRequestForCandidatos.sedes?.nombre}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cliente: <strong>{selectedRequestForCandidatos.sedes?.clientes?.razon_social}</strong> &bull; Plazas: {selectedRequestForCandidatos.plazas_cubiertas} de {selectedRequestForCandidatos.plazas_solicitadas} cubiertas
                </p>
              </div>

              <div className="flex items-center gap-2">
                {canWrite && (
                  <button
                    onClick={() => setShowAddCandidatoForm(!showAddCandidatoForm)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      showAddCandidatoForm
                        ? "bg-slate-100 text-slate-700"
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100"
                    }`}
                  >
                    {showAddCandidatoForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 stroke-[3]" />}
                    {showAddCandidatoForm ? "Ocultar Formulario" : "+ Registrar Postulante"}
                  </button>
                )}
                <button
                  onClick={() => setIsCandidatosModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-form: Add New Candidate */}
            {showAddCandidatoForm && (
              <form onSubmit={handleSaveCandidato} className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 mt-4 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    Nuevo Postulante para esta Vacante
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Solo se guardará en la tabla de candidatos (no afectará la nómina de personal)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombres *</label>
                    <input
                      type="text"
                      required
                      value={newCandidatoForm.nombres}
                      onChange={(e) => setNewCandidatoForm({ ...newCandidatoForm, nombres: e.target.value })}
                      placeholder="Ej. Juan Carlos"
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Apellidos *</label>
                    <input
                      type="text"
                      required
                      value={newCandidatoForm.apellidos}
                      onChange={(e) => setNewCandidatoForm({ ...newCandidatoForm, apellidos: e.target.value })}
                      placeholder="Ej. Perez Ramos"
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">N° Documento (DNI) *</label>
                    <input
                      type="text"
                      required
                      value={newCandidatoForm.numero_documento}
                      onChange={(e) => setNewCandidatoForm({ ...newCandidatoForm, numero_documento: e.target.value })}
                      placeholder="8 dígitos"
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sexo</label>
                    <select
                      value={newCandidatoForm.sexo}
                      onChange={(e) => setNewCandidatoForm({ ...newCandidatoForm, sexo: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                    >
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fec. Nacimiento</label>
                    <input
                      type="date"
                      value={newCandidatoForm.fecha_nacimiento}
                      onChange={(e) => setNewCandidatoForm({ ...newCandidatoForm, fecha_nacimiento: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fuente de Reclutamiento</label>
                    <select
                      value={newCandidatoForm.fuente_reclutamiento}
                      onChange={(e) => setNewCandidatoForm({ ...newCandidatoForm, fuente_reclutamiento: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none font-semibold text-blue-700"
                    >
                      <option value="Computrabajo">Computrabajo</option>
                      <option value="Bumeran">Bumeran</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Facebook">Facebook / Redes</option>
                      <option value="Referido">Referido</option>
                      <option value="Bolsa Municipal">Bolsa Municipal</option>
                      <option value="Directo">Directo / Puerta</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Teléfono / WhatsApp</label>
                    <input
                      type="text"
                      value={newCandidatoForm.telefono}
                      onChange={(e) => setNewCandidatoForm({ ...newCandidatoForm, telefono: e.target.value })}
                      placeholder="Ej. 987654321"
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={newCandidatoForm.correo}
                      onChange={(e) => setNewCandidatoForm({ ...newCandidatoForm, correo: e.target.value })}
                      placeholder="correo@ejemplo.com"
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Notas / Perfil</label>
                    <input
                      type="text"
                      value={newCandidatoForm.notas_reclutamiento}
                      onChange={(e) => setNewCandidatoForm({ ...newCandidatoForm, notas_reclutamiento: e.target.value })}
                      placeholder="Ej. Experiencia en plantas, vive cerca..."
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCandidatoForm(false)}
                    className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-100 cursor-pointer"
                  >
                    Guardar Postulante
                  </button>
                </div>
              </form>
            )}

            {/* Filters Bar inside modal */}
            <div className="flex items-center gap-1.5 my-4 overflow-x-auto pb-1">
              {[
                { id: "todos", label: "Todos los Postulantes" },
                { id: "proceso", label: "En Proceso / Evaluación" },
                { id: "altas", label: "🟡 Pendientes de Alta" },
                { id: "contratados", label: "🟢 Contratados" },
                { id: "descartados", label: "Descartados / No asistieron" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCandidatoFilterStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    candidatoFilterStatus === tab.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Candidates List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[250px]">
              {candidatesForModal.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <Users className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No hay postulantes con el filtro seleccionado</p>
                  <p className="text-[11px] text-slate-400">Presiona "+ Registrar Postulante" para agregar candidatos a esta vacante.</p>
                </div>
              ) : (
                candidatesForModal.map(cand => {
                  const isPendingAlta = cand.estado === "Pendiente de Alta";
                  const isHired = cand.estado === "Contratado";
                  const isDiscarded = cand.estado === "Descartado" || cand.estado === "No se presento";

                  return (
                    <div
                      key={cand.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isHired ? "bg-emerald-50/40 border-emerald-200" :
                        isPendingAlta ? "bg-amber-50/50 border-amber-300 ring-2 ring-amber-100" :
                        isDiscarded ? "bg-slate-50/60 border-slate-200 opacity-70" :
                        "bg-white border-slate-200 hover:border-blue-200 shadow-xs"
                      }`}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-sm">
                            {cand.apellidos}, {cand.nombres}
                          </span>
                          
                          {/* State badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                            isHired ? "bg-emerald-100 text-emerald-800" :
                            isPendingAlta ? "bg-amber-100 text-amber-900 animate-pulse" :
                            cand.estado === "Aprobado" ? "bg-blue-100 text-blue-800" :
                            cand.estado === "En Evaluacion" ? "bg-indigo-100 text-indigo-800" :
                            isDiscarded ? "bg-red-100 text-red-800" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            {cand.estado}
                          </span>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            <Tag className="w-2.5 h-2.5" />
                            {cand.fuente_reclutamiento || "Directo"}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                          <span>DNI: <strong className="text-slate-700">{cand.numero_documento}</strong></span>
                          {cand.telefono && <span>Tel: <strong className="text-slate-700">{cand.telefono}</strong></span>}
                          {cand.correo && <span>Correo: <strong className="text-slate-700">{cand.correo}</strong></span>}
                        </div>

                        {cand.notas_reclutamiento && (
                          <div className="text-xs text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-200/60 italic mt-1">
                            Notas: "{cand.notas_reclutamiento}"
                          </div>
                        )}

                        {cand.motivo_descarte && (
                          <div className="text-xs text-red-700 bg-red-50 p-2 rounded-lg border border-red-100 mt-1">
                            Motivo descarte: "{cand.motivo_descarte}"
                          </div>
                        )}
                      </div>

                      {/* Candidate Actions */}
                      <div className="flex items-center gap-1.5 flex-wrap self-end md:self-center">
                        {!isHired && !isDiscarded && canWrite && (
                          <>
                            {/* Step 1 for Recruiters: Send to RRHH */}
                            {!isPendingAlta && (
                              <button
                                onClick={() => handleOpenSendRRHH(cand)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                                title="Candidato asistió / Confirmar para pase a RRHH"
                              >
                                <Send className="w-3.5 h-3.5" />
                                Confirmar Asistencia (Pase a RRHH)
                              </button>
                            )}

                            {/* Direct button for RRHH / Admin */}
                            {isRRHHOrAdmin && (
                              <button
                                onClick={() => handleOpenAltaModal(cand, selectedRequestForCandidatos)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-100 cursor-pointer"
                                title="Formalizar Contrato y Alta en Planilla"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Alta RRHH
                              </button>
                            )}

                            {/* Dropdown status changer */}
                            <select
                              value={cand.estado}
                              onChange={(e) => handleCambiarEstadoCandidato(cand.id, e.target.value)}
                              className="text-[11px] font-semibold border border-slate-200 rounded-lg p-1.5 bg-white text-slate-700 cursor-pointer"
                            >
                              <option value="Postulante">Postulante</option>
                              <option value="En Evaluacion">En Evaluación</option>
                              <option value="Aprobado">Aprobado</option>
                            </select>

                            <button
                              onClick={() => handleOpenDiscard(cand)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition-colors cursor-pointer"
                              title="Descartar o marcar como no asistió"
                            >
                              Descartar
                            </button>
                          </>
                        )}

                        {!isHired && !isDiscarded && !canWrite && (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            cand.estado === "Aprobado" ? "bg-emerald-100 text-emerald-800" :
                            cand.estado === "En Evaluacion" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {cand.estado}
                          </span>
                        )}

                        {isHired && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black text-emerald-800 bg-emerald-100/80 rounded-lg border border-emerald-200">
                            <Check className="w-4 h-4 stroke-[3]" />
                            En Planilla Activa
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 pt-4 mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCandidatosModalOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: FORMALIZACIÓN CONTRACTUAL & ALTA RRHH */}
      {/* ==================================================== */}
      {isAltaModalOpen && selectedCandidatoForAlta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in p-3">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-in border border-slate-100 flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-black text-slate-900">
                    Formalización de Contrato & Alta Laboral (RRHH)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Define las condiciones legales oficiales. Al aprobar, se creará el colaborador en Planilla Activa y se generará su contrato vigente.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAltaModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Candidate & Request Preview Card */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Colaborador Seleccionado</span>
                  <span className="text-base font-black text-slate-900">
                    {selectedCandidatoForAlta.apellidos}, {selectedCandidatoForAlta.nombres}
                  </span>
                  <span className="text-xs text-slate-500 font-mono ml-2">DNI: {selectedCandidatoForAlta.numero_documento}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  Fuente: {selectedCandidatoForAlta.fuente_reclutamiento || "Directo"}
                </span>
              </div>

              {selectedRequestForAlta && (
                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t border-slate-200/60">
                  <span>Puesto: <strong>{selectedRequestForAlta.cargos?.nombre}</strong></span>
                  <span>&bull;</span>
                  <span>Sede: <strong>{selectedRequestForAlta.sedes?.nombre}</strong></span>
                  <span>&bull;</span>
                  <span>Cliente: <strong>{selectedRequestForAlta.sedes?.clientes?.razon_social}</strong></span>
                </div>
              )}
            </div>

            {/* Official HR Contract Form */}
            <form onSubmit={handleSaveAltaOficial} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Empresa Facturadora *
                  </label>
                  <select
                    required
                    value={altaForm.empresa_interna_id}
                    onChange={(e) => setAltaForm({ ...altaForm, empresa_interna_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-100 cursor-pointer"
                  >
                    <option value="">Seleccione Empresa...</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.razon_social}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Régimen Laboral *
                  </label>
                  <select
                    required
                    value={altaForm.regimen_laboral_id}
                    onChange={(e) => setAltaForm({ ...altaForm, regimen_laboral_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {regimenes.map(r => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Sueldo Básico (S/.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={altaForm.sueldo_basico}
                    onChange={(e) => setAltaForm({ ...altaForm, sueldo_basico: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Bono Adicional (S/.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={altaForm.bono}
                    onChange={(e) => setAltaForm({ ...altaForm, bono: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Modalidad Contrato *
                  </label>
                  <select
                    required
                    value={altaForm.modalidad_contrato_id}
                    onChange={(e) => setAltaForm({ ...altaForm, modalidad_contrato_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {modalidadesContrato.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Fecha de Ingreso / Inicio Contrato *
                  </label>
                  <input
                    type="date"
                    required
                    value={altaForm.fecha_ingreso}
                    onChange={(e) => setAltaForm({ ...altaForm, fecha_ingreso: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Fecha Fin de Contrato (Opcional)
                  </label>
                  <input
                    type="date"
                    value={altaForm.fecha_fin}
                    onChange={(e) => setAltaForm({ ...altaForm, fecha_fin: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="asignacion_familiar"
                  checked={altaForm.asignacion_familiar}
                  onChange={(e) => setAltaForm({ ...altaForm, asignacion_familiar: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
                <label htmlFor="asignacion_familiar" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Aplica Asignación Familiar (Ley N° 25129)
                </label>
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAltaModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black hover:bg-emerald-700 shadow-md shadow-emerald-100 flex items-center gap-1.5 cursor-pointer"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Aprobar y Dar de Alta en Planilla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CREAR / EDITAR SOLICITUD DE PERSONAL */}
      {/* ==================================================== */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in p-3">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 animate-slide-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                {editingRequestId ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                {editingRequestId ? "Editar Solicitud" : "Solicitar Personal"}
              </h3>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRequest} className="space-y-4">
              <div className="relative">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cliente *</label>
                <input
                  type="text"
                  required
                  placeholder="Buscar cliente..."
                  value={clienteSearchQuery}
                  onChange={(e) => {
                    setClienteSearchQuery(e.target.value);
                    setShowClienteDropdown(true);
                    setRequestForm((prev) => ({ ...prev, cliente_id: "", sede_id: "" }));
                  }}
                  onFocus={() => setShowClienteDropdown(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowClienteDropdown(false);
                      const selected = clientes.find((c) => c.id === requestForm.cliente_id);
                      if (selected) {
                        setClienteSearchQuery(selected.razon_social);
                      } else {
                        setClienteSearchQuery("");
                      }
                    }, 200);
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-white"
                />
                {showClienteDropdown && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100 font-sans">
                    {filteredClientes.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 italic text-center font-medium">No se encontraron clientes</div>
                    ) : (
                      filteredClientes.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => {
                            setRequestForm((prev) => ({ ...prev, cliente_id: c.id, sede_id: "" }));
                            setClienteSearchQuery(c.razon_social);
                            setShowClienteDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-slate-50 transition-colors ${
                            requestForm.cliente_id === c.id ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700"
                          }`}
                        >
                          {c.razon_social} {c.ruc ? `- RUC: ${c.ruc}` : ""}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sede / Centro Trabajo *</label>
                <select
                  required
                  value={requestForm.sede_id || ""}
                  disabled={!requestForm.cliente_id}
                  onChange={(e) => setRequestForm({ ...requestForm, sede_id: e.target.value ? parseInt(e.target.value) : "" })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
                >
                  <option value="">
                    {requestForm.cliente_id ? "Seleccione Sede..." : "Primero seleccione un Cliente"}
                  </option>
                  {sedes
                    .filter((s) => s.cliente_id === requestForm.cliente_id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))
                  }
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cargo Requerido *</label>
                  <input
                    type="text"
                    required
                    placeholder="Buscar cargo..."
                    value={cargoSearchQuery}
                    onChange={(e) => {
                      setCargoSearchQuery(e.target.value);
                      setShowCargoDropdown(true);
                      setRequestForm((prev) => ({ ...prev, cargo_id: "" }));
                    }}
                    onFocus={() => setShowCargoDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowCargoDropdown(false);
                        const selected = cargos.find((c) => c.id === requestForm.cargo_id);
                        if (selected) {
                          setCargoSearchQuery(selected.nombre);
                        } else {
                          setCargoSearchQuery("");
                        }
                      }, 200);
                    }}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-white"
                  />
                  {showCargoDropdown && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100 font-sans">
                      {filteredCargos.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 italic text-center font-medium">No se encontraron cargos</div>
                      ) : (
                        filteredCargos.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={() => {
                              setRequestForm((prev) => ({ ...prev, cargo_id: c.id }));
                              setCargoSearchQuery(c.nombre);
                              setShowCargoDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-slate-50 transition-colors ${
                              requestForm.cargo_id === c.id ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700"
                            }`}
                          >
                            {c.nombre}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Turno</label>
                  <select
                    value={requestForm.turno || "Rotativo"}
                    onChange={(e) => setRequestForm({ ...requestForm, turno: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    <option value="Día">Día (Fijo)</option>
                    <option value="Noche">Noche (Fijo)</option>
                    <option value="Rotativo">Rotativo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Género Requerido</label>
                  <select
                    value={requestForm.genero_requerido || "Indistinto"}
                    onChange={(e) => setRequestForm({ ...requestForm, genero_requerido: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="Indistinto">Indistinto</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Mixto">Mixto</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Plazas Requeridas</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={requestForm.plazas_solicitadas || 1}
                    onChange={(e) => setRequestForm({ ...requestForm, plazas_solicitadas: parseInt(e.target.value) || 1 })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Motivo / Requerimientos Especiales</label>
                <textarea
                  rows={2}
                  required
                  value={requestForm.motivo_vacante || ""}
                  onChange={(e) => setRequestForm({ ...requestForm, motivo_vacante: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none"
                  placeholder="Ej. Reemplazo de operario de vacaciones..."
                />
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CONFIRMAR ASISTENCIA & ENVIAR A RRHH */}
      {/* ==================================================== */}
      {sendRRHHModal.isOpen && sendRRHHModal.candidato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs animate-fade-in p-3">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-100 animate-slide-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-black text-slate-900">
                    Confirmar Asistencia (Pase a RRHH)
                  </h3>
                  <p className="text-xs text-slate-500">
                    El postulante pasará a la bandeja de RRHH para formalizar su contrato.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSendRRHHModal({ isOpen: false, candidato: null, fechaIngreso: "", notas: "" })}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Candidate summary */}
            <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3 mb-4 space-y-1 text-xs">
              <div className="font-bold text-slate-900 text-sm">
                {sendRRHHModal.candidato.apellidos}, {sendRRHHModal.candidato.nombres}
              </div>
              <div className="text-slate-500 flex items-center gap-3 font-mono">
                <span>DNI: <strong className="text-slate-700">{sendRRHHModal.candidato.numero_documento}</strong></span>
                {sendRRHHModal.candidato.telefono && (
                  <span>Tel: <strong className="text-slate-700">{sendRRHHModal.candidato.telefono}</strong></span>
                )}
              </div>
            </div>

            <form onSubmit={handleConfirmSendRRHH} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Fecha Confirmada / Tentativa de Ingreso *
                </label>
                <input
                  type="date"
                  required
                  value={sendRRHHModal.fechaIngreso}
                  onChange={(e) => setSendRRHHModal({ ...sendRRHHModal, fechaIngreso: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Observaciones / Notas para RRHH (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={sendRRHHModal.notas}
                  onChange={(e) => setSendRRHHModal({ ...sendRRHHModal, notas: e.target.value })}
                  placeholder="Ej. Asistió a la entrevista preliminar, listo para firma de contrato..."
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setSendRRHHModal({ isOpen: false, candidato: null, fechaIngreso: "", notas: "" })}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Confirmar y Enviar a RRHH
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: DESCARTAR POSTULANTE / NO SE PRESENTÓ */}
      {/* ==================================================== */}
      {discardModal.isOpen && discardModal.candidato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs animate-fade-in p-3">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 animate-slide-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-black text-slate-900">
                    Descartar Postulante
                  </h3>
                  <p className="text-xs text-slate-500">
                    Registra el motivo por el cual no se concretó la contratación.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDiscardModal({ isOpen: false, candidato: null, tipo: "No se presento", motivo: "" })}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 mb-4 text-xs">
              <span className="font-bold text-slate-900 block text-sm">
                {discardModal.candidato.apellidos}, {discardModal.candidato.nombres}
              </span>
              <span className="text-slate-500 font-mono">DNI: {discardModal.candidato.numero_documento}</span>
            </div>

            <form onSubmit={handleConfirmDiscard} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  Tipo de Descarte *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscardModal({ ...discardModal, tipo: "No se presento" })}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      discardModal.tipo === "No se presento"
                        ? "bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-100"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    🟡 No se presentó
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscardModal({ ...discardModal, tipo: "Descartado" })}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      discardModal.tipo === "Descartado"
                        ? "bg-red-50 border-red-300 text-red-900 ring-2 ring-red-100"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    🔴 Descartado
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Motivo / Observación
                </label>
                <textarea
                  rows={2}
                  required
                  value={discardModal.motivo}
                  onChange={(e) => setDiscardModal({ ...discardModal, motivo: e.target.value })}
                  placeholder="Ej. Desistió de la vacante / No cumple perfil requerido..."
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDiscardModal({ isOpen: false, candidato: null, tipo: "No se presento", motivo: "" })}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md shadow-red-100 flex items-center gap-1.5 cursor-pointer"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                  Guardar Descarte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: REGISTRAR CESE / DESERCIÓN DE COLABORADOR */}
      {/* ==================================================== */}
      {ceseModal.isOpen && ceseModal.vinculo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs animate-fade-in p-3">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 animate-slide-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                  <UserMinus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-black text-slate-900">
                    Registrar Cese de Colaborador
                  </h3>
                  <p className="text-xs text-slate-500">
                    Esta acción liberará la vacante correspondiente en la pizarra.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCeseModal({ isOpen: false, vinculo: null, request: null, motivo: "Deserción / Retiro voluntario" })}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 mb-4 text-xs">
              <span className="font-bold text-slate-900 block text-sm">
                {ceseModal.vinculo.personas?.apellidos}, {ceseModal.vinculo.personas?.nombres}
              </span>
              <span className="text-slate-500 font-mono">DNI: {ceseModal.vinculo.personas?.numero_documento}</span>
            </div>

            <form onSubmit={handleConfirmCeseWorker} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Motivo del Cese *
                </label>
                <input
                  type="text"
                  required
                  value={ceseModal.motivo}
                  onChange={(e) => setCeseModal({ ...ceseModal, motivo: e.target.value })}
                  placeholder="Ej. Deserción laboral / Renuncia voluntaria"
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setCeseModal({ isOpen: false, vinculo: null, request: null, motivo: "Deserción / Retiro voluntario" })}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md shadow-red-100 flex items-center gap-1.5 cursor-pointer"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                  Confirmar Cese
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: HISTORIAL Y DETALLE DE LA VACANTE */}
      {/* ==================================================== */}
      {isDetailModalOpen && liveDetailRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs animate-fade-in p-3">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-100 animate-slide-in flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Historial & Colaboradores de Vacante
                </span>
                <h3 className="font-heading text-lg font-black text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  {liveDetailRequest.cargos?.nombre} &bull; {liveDetailRequest.sedes?.nombre}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cliente: <strong>{liveDetailRequest.sedes?.clientes?.razon_social}</strong> &bull; Cubiertas: {liveDetailRequest.plazas_cubiertas} de {liveDetailRequest.plazas_solicitadas}
                </p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Motivo & Metadata Banner */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 mb-4 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                Motivo / Requerimientos Especiales:
              </div>
              <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200/60 leading-relaxed font-normal">
                {liveDetailRequest.motivo_vacante || (
                  <span className="italic text-slate-400">Sin motivo registrado al crear la vacante.</span>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1 font-medium">
                <span>Turno: <strong className="text-slate-700">{liveDetailRequest.turno}</strong></span>
                <span>Género Requerido: <strong className="text-slate-700">{liveDetailRequest.genero_requerido || "Indistinto"}</strong></span>
                <span>Fecha Solicitud: <strong className="text-slate-700">{new Date(liveDetailRequest.fecha_solicitud).toLocaleDateString("es-PE")}</strong></span>
              </div>
            </div>

            {/* Active workers currently in this request */}
            <div className="space-y-4 flex-1">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  Colaboradores Activos Asignados ({activeVinculos.filter(v => v.solicitud_id === liveDetailRequest.id && v.estado === "Activo").length})
                </h4>

                {activeVinculos.filter(v => v.solicitud_id === liveDetailRequest.id && v.estado === "Activo").length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                    No hay colaboradores activos formalizados para esta vacante aún.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {activeVinculos
                      .filter(v => v.solicitud_id === liveDetailRequest.id && v.estado === "Activo")
                      .map(v => (
                        <div key={v.id} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900 text-sm">{v.personas?.apellidos}, {v.personas?.nombres}</div>
                            <div className="text-xs text-slate-500 font-mono flex items-center gap-3">
                              <span>DNI: {v.personas?.numero_documento}</span>
                              <span>Ingreso: {v.fecha_ingreso ? new Date(v.fecha_ingreso + "T12:00:00").toLocaleDateString("es-PE") : "-"}</span>
                            </div>
                          </div>
                          {isRRHHOrAdmin && (
                            <button
                              onClick={() => handleOpenCeseModal(v, liveDetailRequest)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
                              title="Registrar cese y liberar cupo"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              Registrar Cese
                            </button>
                          )}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

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
                onClick={() => setLocationModal({ isOpen: false, sede: null, cliente: null, request: null })}
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
                const matchedSedeObj = sedes.find(s => s.id === (locationModal.sede?.id || locationModal.request?.sede_id)) || locationModal.sede;
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
                {(() => {
                  const matchedSedeObj = sedes.find(s => s.id === (locationModal.sede?.id || locationModal.request?.sede_id)) || locationModal.sede;
                  const hasCoords = matchedSedeObj?.latitud != null && matchedSedeObj?.longitud != null && !isNaN(Number(matchedSedeObj.latitud)) && Number(matchedSedeObj.latitud) !== 0;
                  const mapQuery = hasCoords
                    ? `${matchedSedeObj.latitud},${matchedSedeObj.longitud}`
                    : `${matchedSedeObj?.direccion || matchedSedeObj?.nombre || ""}, ${matchedSedeObj?.distrito || ""} Perú`;

                  return (
                    <iframe
                      title="Mapa de Sede"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      marginHeight={0}
                      marginWidth={0}
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                      className="w-full h-full"
                    />
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setLocationModal({ isOpen: false, sede: null, cliente: null, request: null })}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const matchedSede = sedes.find(s => s.id === (locationModal.sede?.id || locationModal.request?.sede_id)) || locationModal.sede;
                    setCalibratingSede(matchedSede);
                  }}
                  className="inline-flex items-center gap-1.5 py-2.5 px-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs transition-colors cursor-pointer border border-indigo-200 shadow-2xs"
                  title="Calibrar el pin exacto de esta sede en el mapa"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Calibrar Ubicación
                </button>

                {(() => {
                  const matchedSedeObj = sedes.find(s => s.id === (locationModal.sede?.id || locationModal.request?.sede_id)) || locationModal.sede;
                  const hasCoords = matchedSedeObj?.latitud != null && matchedSedeObj?.longitud != null && !isNaN(Number(matchedSedeObj.latitud)) && Number(matchedSedeObj.latitud) !== 0;
                  const searchQuery = hasCoords
                    ? `${matchedSedeObj.latitud},${matchedSedeObj.longitud}`
                    : `${matchedSedeObj?.direccion || matchedSedeObj?.nombre || ""}, ${matchedSedeObj?.distrito || ""} Perú`;

                  return (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl font-bold text-xs shadow-md shadow-blue-200 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir en Google Maps
                    </a>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* SYSTEM CONFIRMATION MODAL */}
      {/* ==================================================== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-fade-in p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-7 w-full max-w-md border border-slate-100 text-center transform animate-slide-in relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${
              confirmModal.isDestructive ? "bg-gradient-to-r from-red-500 to-rose-600" : "bg-gradient-to-r from-blue-500 to-indigo-500"
            }`} />

            <div className="mt-2 mb-4 flex justify-center">
              {confirmModal.isDestructive ? (
                <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center ring-8 ring-red-50/50 shadow-inner">
                  <Trash2 className="w-8 h-8 stroke-[2.5]" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center ring-8 ring-blue-50/50 shadow-inner">
                  <AlertCircle className="w-8 h-8 stroke-[2.5]" />
                </div>
              )}
            </div>

            <h3 className="font-heading text-lg font-black text-slate-900 mb-2">
              {confirmModal.title}
            </h3>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                {confirmModal.cancelText || "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  if (action) action();
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all cursor-pointer ${
                  confirmModal.isDestructive
                    ? "bg-red-600 hover:bg-red-700 shadow-red-200"
                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                }`}
              >
                {confirmModal.confirmText || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* SYSTEM FEEDBACK MODAL (SUCCESS, ERROR, WARNING, INFO) */}
      {/* ==================================================== */}
      {feedbackModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-fade-in p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-7 w-full max-w-md border border-slate-100 text-center transform animate-slide-in relative overflow-hidden">
            {/* Top decorative accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${
              feedbackModal.type === "success" ? "bg-gradient-to-r from-emerald-500 to-teal-500" :
              feedbackModal.type === "error" ? "bg-gradient-to-r from-red-500 to-rose-600" :
              feedbackModal.type === "warning" ? "bg-gradient-to-r from-amber-500 to-orange-500" :
              "bg-gradient-to-r from-blue-500 to-indigo-500"
            }`} />

            <div className="mt-2 mb-4 flex justify-center">
              {feedbackModal.type === "success" && (
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center ring-8 ring-emerald-50/50 shadow-inner">
                  <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
                </div>
              )}
              {feedbackModal.type === "error" && (
                <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center ring-8 ring-red-50/50 shadow-inner">
                  <AlertCircle className="w-9 h-9 stroke-[2.5]" />
                </div>
              )}
              {feedbackModal.type === "warning" && (
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center ring-8 ring-amber-50/50 shadow-inner">
                  <AlertTriangle className="w-9 h-9 stroke-[2.5]" />
                </div>
              )}
              {feedbackModal.type === "info" && (
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center ring-8 ring-blue-50/50 shadow-inner">
                  <Info className="w-9 h-9 stroke-[2.5]" />
                </div>
              )}
            </div>

            <h3 className="font-heading text-lg font-black text-slate-900 mb-2">
              {feedbackModal.title}
            </h3>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {feedbackModal.message}
            </p>

            <button
              type="button"
              autoFocus
              onClick={() => {
                const cb = feedbackModal.onConfirm;
                setFeedbackModal(prev => ({ ...prev, isOpen: false }));
                if (cb) cb();
              }}
              className={`w-full py-2.5 px-5 rounded-xl font-bold text-sm text-white shadow-lg transition-all cursor-pointer ${
                feedbackModal.type === "success" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" :
                feedbackModal.type === "error" ? "bg-red-600 hover:bg-red-700 shadow-red-200" :
                feedbackModal.type === "warning" ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200" :
                "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
              }`}
            >
              {feedbackModal.confirmText || "Entendido"}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* RADAR DE VACANTES (GEOMATCHING POR POSTULANTE) */}
      {/* ==================================================== */}
      <RadarVacantesModal
        isOpen={isRadarModalOpen}
        onClose={() => setIsRadarModalOpen(false)}
        vacantes={data}
        sedes={sedes}
        cargos={cargos}
        clientes={clientes}
        onSelectVacanteForPostulante={handleSelectVacanteFromRadar}
        onCalibrateSede={(sede) => setCalibratingSede(sede)}
      />

      {/* ==================================================== */}
      {/* CALIBRADOR RÁPIDO DE SEDE */}
      {/* ==================================================== */}
      {calibratingSede && (
        <SedeCalibrationModal
          isOpen={!!calibratingSede}
          onClose={() => setCalibratingSede(null)}
          sede={calibratingSede}
          onSedeUpdated={handleSedeUpdated}
        />
      )}

    </div>
  );
}
