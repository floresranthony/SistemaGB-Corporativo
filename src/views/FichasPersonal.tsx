import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import * as XLSX from "xlsx";
import { 
  UserSquare, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Eye, 
  X, 
  Check, 
  Briefcase, 
  Building, 
  MapPin, 
  Calendar, 
  Activity, 
  RefreshCw, 
  PlusCircle, 
  Info,
  TrendingDown,
  FileSpreadsheet,
  Upload,
  FileDown,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  FileText,
  LayoutGrid,
  Table,
  AlertCircle
} from "lucide-react";

type FormViewMode = "list" | "form" | "view" | "import";

export function FichasPersonal() {
  const [viewMode, setViewMode] = useState<FormViewMode>("list");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filters state
  const [filterSede, setFilterSede] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState("");
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");
  const [filterCliente, setFilterCliente] = useState("");
  const [filterVacacionesAlerta, setFilterVacacionesAlerta] = useState("");
  const [filterInconsistencia, setFilterInconsistencia] = useState(false);

  // DB Data
  const [personas, setPersonas] = useState<any[]>([]);
  const [activePersona, setActivePersona] = useState<any | null>(null);
  const [vinculos, setVinculos] = useState<any[]>([]);

  // Lookup data for dropdowns
  const [tiposDoc, setTiposDoc] = useState<any[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);
  const [pensiones, setPensiones] = useState<any[]>([]);
  const [ubigeos, setUbigeos] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [tiposTrab, setTiposTrab] = useState<any[]>([]);
  const [regimenes, setRegimenes] = useState<any[]>([]);

  // Form states (Persona)
  const [personaForm, setPersonaForm] = useState<Record<string, any>>({});
  const [activeFormTab, setActiveFormTab] = useState<"personales" | "financieros" | "tallas" | "puesto">("personales");
  const [ubigeoSearch, setUbigeoSearch] = useState("");
  const [ubigeoResults, setUbigeoResults] = useState<any[]>([]);

  // Autocomplete states for creation form
  const [creationSedeSearchText, setCreationSedeSearchText] = useState("");
  const [showCreationSedeDropdown, setShowCreationSedeDropdown] = useState(false);
  const [creationCargoSearchText, setCreationCargoSearchText] = useState("");
  const [showCreationCargoDropdown, setShowCreationCargoDropdown] = useState(false);

  // Helper to obtain clients for an internal company
  const getClientesForEmpresa = (empresaId: any) => {
    if (!empresaId) return [];
    const empIdNum = parseInt(empresaId);
    const map = new Map<number, string>();
    sedes.forEach(s => {
      if (s.clientes && s.clientes.empresa_interna_id === empIdNum) {
        map.set(s.clientes.id, s.clientes.razon_social);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  };

  const handleUbigeoSearch = async (query: string) => {
    setUbigeoSearch(query);
    if (query.trim().length < 2) {
      setUbigeoResults([]);
      return;
    }
    try {
      const { data: res } = await supabase
        .from("ubigeo_distritos")
        .select("*")
        .or(`distrito.ilike.%${query}%,departamento.ilike.%${query}%,provincia.ilike.%${query}%`)
        .limit(10);
      setUbigeoResults(res || []);
    } catch (e) {
      console.error("Error search ubigeo:", e);
    }
  };

  // Form states (Vinculo)
  const [isVinculoModalOpen, setIsVinculoModalOpen] = useState(false);
  const [vinculoForm, setVinculoForm] = useState<Record<string, any>>({});
  const [editingVinculoId, setEditingVinculoId] = useState<number | null>(null);

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

  const [sedeSearchText, setSedeSearchText] = useState("");
  const [showSedeDropdown, setShowSedeDropdown] = useState(false);
  const [cargoSearchText, setCargoSearchText] = useState("");
  const [showCargoDropdown, setShowCargoDropdown] = useState(false);
  
  // Cese Modal states
  const [isCeseModalOpen, setIsCeseModalOpen] = useState(false);
  const [ceseForm, setCeseForm] = useState({ vinculo_id: null, fecha_cese: "", motivo_cese: "" });

  // Excel/CSV Import state
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState({
    processed: 0,
    total: 0,
    errors: [] as string[],
    warnings: [] as string[],
    successCount: 0
  });
  const [activeErrorRow, setActiveErrorRow] = useState<any | null>(null);

  // Confirm Delete Modal State
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");

  // Excel Import loading overlay states
  const [importSuccess, setImportSuccess] = useState(false);
  const [importStatusText, setImportStatusText] = useState("");

  // Custom states for view modes & contract alerts
  const [filterEstadoContrato, setFilterEstadoContrato] = useState("");
  const [filterFechaVencimiento, setFilterFechaVencimiento] = useState("");
  const [filterCuentaSueldo, setFilterCuentaSueldo] = useState("");
  const [isQuickContratoModalOpen, setIsQuickContratoModalOpen] = useState(false);
  const [quickContratoForm, setQuickContratoForm] = useState<Record<string, any>>({
    vinculo_laboral_id: "",
    modalidad_contrato_id: "",
    fecha_inicio: new Date().toISOString().split("T")[0],
    fecha_fin: "",
    estado: "Vigente",
    archivo_pdf: ""
  });

  // Activos vs Cesados list tab
  const [filterTab, setFilterTab] = useState<"activos" | "cesados">("activos");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Reset page when search filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterSede, filterEmpresa, filterFechaDesde, filterFechaHasta, filterEstadoContrato, filterFechaVencimiento, filterTab, filterCliente, filterVacacionesAlerta, filterInconsistencia, filterCuentaSueldo]);

  // Contract history modal per collaborator
  const [isContractHistoryModalOpen, setIsContractHistoryModalOpen] = useState(false);
  const [selectedPersonaForHistory, setSelectedPersonaForHistory] = useState<any | null>(null);

  const handleDeleteContract = async (contractId: number) => {
    if (!confirm("¿Está seguro de eliminar este contrato? Esta acción no se puede deshacer.")) return;
    try {
      const { error: dbError } = await supabase.from("contratos").delete().eq("id", contractId);
      if (dbError) throw dbError;
      
      // Refresh local data
      loadPersonas();
      
      // Update selected persona details in history modal
      if (selectedPersonaForHistory) {
        // We will fetch the updated persona locally after the refresh
        setSelectedPersonaForHistory((prev: any) => {
          if (!prev) return null;
          // Find the persona in the current local array (which will update reactively)
          return personas.find(p => p.id === prev.id) || prev;
        });
      }
      alert("Contrato eliminado correctamente.");
    } catch (err: any) {
      alert("Error al eliminar contrato: " + err.message);
    }
  };

  // Sync selectedPersonaForHistory after loadPersonas updates the personas array
  useEffect(() => {
    if (selectedPersonaForHistory) {
      const match = personas.find(p => p.id === selectedPersonaForHistory.id);
      if (match) {
        setSelectedPersonaForHistory(match);
      }
    }
  }, [personas]);

  const handleOpenRenewQuick = (c: any) => {
    let nextStartDate = new Date().toISOString().split("T")[0];
    if (c.fecha_fin) {
      const prevEndDate = new Date(c.fecha_fin);
      prevEndDate.setDate(prevEndDate.getDate() + 1);
      nextStartDate = prevEndDate.toISOString().split("T")[0];
    }
    
    setQuickContratoForm({
      vinculo_laboral_id: c.vinculo_laboral_id,
      modalidad_contrato_id: c.modalidad_contrato_id,
      fecha_inicio: nextStartDate,
      fecha_fin: "",
      estado: "Vigente",
      archivo_pdf: ""
    });
    setIsQuickContratoModalOpen(true);
  };

  const loadLookups = async () => {
    try {
      const [td, b, p, u, e, s, c, tt, r, m] = await Promise.all([
        supabase.from("tipos_documento").select("*"),
        supabase.from("bancos").select("*"),
        supabase.from("sistemas_pension").select("*"),
        supabase.from("ubigeo_distritos").select("*").limit(100), // Limit for safety
        supabase.from("empresas_internas").select("*").eq("activo", true),
        supabase.from("sedes").select("*, clientes(id, razon_social, empresa_interna_id)").eq("activo", true),
        supabase.from("cargos").select("*").eq("activo", true),
        supabase.from("tipos_trabajador").select("*"),
        supabase.from("regimenes_laborales").select("*"),
        supabase.from("modalidades_contrato").select("*")
      ]);

      setTiposDoc(td.data || []);
      setBancos(b.data || []);
      setPensiones(p.data || []);
      setUbigeos(u.data || []);
      setEmpresas(e.data || []);
      setSedes(s.data || []);
      setCargos(c.data || []);
      setTiposTrab(tt.data || []);
      setRegimenes(r.data || []);
      setModalidades(m.data || []);
    } catch (err) {
      console.error("Error loading lookups:", err);
    }
  };

  const loadPersonas = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: resData, error: dbError } = await supabase
        .from("personas")
        .select(`
          *,
          tipos_documento (id, codigo, nombre),
          sistemas_pension (id, nombre, tipo),
          ubigeo_distritos (id, departamento, provincia, distrito),
          vinculos_laborales (
            id,
            estado,
            empresa_interna_id,
            sede_id,
            cargo_id,
            regimen_laboral_id,
            sueldo_basico,
            bono,
            asignacion_familiar,
            tipo_trabajador_id,
            lugar_especifico_trabajo,
            regimenes_laborales (id, nombre, dias_vacaciones),
            cargos (id, nombre),
            empresas_internas (id, razon_social),
            excepcion_sede,
            excepcion_aprobada,
            sedes (id, nombre, cliente_id, clientes (id, razon_social, empresa_interna_id)),
            contratos (
              id,
              fecha_inicio,
              fecha_fin,
              estado
            ),
            vacaciones_historico (
              id,
              dias_calendario
            )
          )
        `)
        .order("apellidos", { ascending: true });

      if (dbError) throw dbError;
      setPersonas(resData || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar las fichas de personal.");
    } finally {
      setLoading(false);
    }
  };

  const loadVinculos = async (personaId: number) => {
    try {
      const { data: resData, error: dbError } = await supabase
        .from("vinculos_laborales")
        .select(`
          *,
          empresas_internas (id, razon_social),
          sedes (id, nombre, cliente_id, clientes(id, razon_social)),
          cargos (id, nombre),
          tipos_trabajador (id, nombre),
          regimenes_laborales (id, nombre, dias_vacaciones)
        `)
        .eq("persona_id", personaId)
        .order("estado", { ascending: true }); // Activos first or alphabetically

      if (dbError) throw dbError;
      setVinculos(resData || []);
    } catch (err) {
      console.error("Error loading jobs/links:", err);
    }
  };

  useEffect(() => {
    loadLookups();
    loadPersonas();
  }, []);

  // Handle opening details / multi-job view
  const handleOpenView = async (persona: any) => {
    setActivePersona(persona);
    await loadVinculos(persona.id);
    setViewMode("view");
  };

  const handleOpenAdd = () => {
    const firstEmp = empresas[0];
    const availableClients = firstEmp ? getClientesForEmpresa(firstEmp.id) : [];
    const firstCli = availableClients[0];
    const clientSedes = firstCli ? sedes.filter(s => s.cliente_id === firstCli.id) : [];
    const firstSede = clientSedes[0];

    setPersonaForm({
      sexo: "Masculino",
      tipo_documento_id: tiposDoc[0]?.id || "",
      sistema_pension_id: pensiones[0]?.id || "",
      fecha_ingreso: "",
      fecha_primer_contrato: "",
      
      // Defaults for position/contract
      empresa_interna_id: firstEmp?.id || "",
      cliente_id: firstCli?.id || "",
      sede_id: firstSede?.id || "",
      cargo_id: cargos[0]?.id || "",
      tipo_trabajador_id: tiposTrab[0]?.id || "",
      regimen_laboral_id: regimenes[0]?.id || "",
      sueldo_basico: 1025.00,
      lugar_especifico_trabajo: "",
      asignacion_familiar: false,
      contrato_modalidad_id: modalidades[0]?.id || "",
      contrato_fecha_inicio: new Date().toISOString().split("T")[0],
      contrato_fecha_fin: ""
    });
    setCreationSedeSearchText(firstSede ? firstSede.nombre : "");
    setCreationCargoSearchText(cargos[0] ? cargos[0].nombre : "");
    setUbigeoSearch("");
    setUbigeoResults([]);
    setEditingId(null);
    setActiveFormTab("personales");
    setViewMode("form");
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const handleOpenEdit = (persona: any) => {
    setEditingId(persona.id);
    setPersonaForm({ ...persona });
    
    // Initialize ubigeo description
    const uDesc = persona.ubigeo_distritos 
      ? `${persona.ubigeo_distritos.departamento} - ${persona.ubigeo_distritos.provincia} - ${persona.ubigeo_distritos.distrito}`
      : "";
    setUbigeoSearch(uDesc);
    setUbigeoResults([]);

    setActiveFormTab("personales");
    setViewMode("form");
  };

  const handleSavePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Clean up relation objects and temporary job fields
    const payload = { ...personaForm };
    delete payload.tipos_documento;
    delete payload.sistemas_pension;
    delete payload.ubigeo_distritos;
    delete payload.vinculos_laborales;

    // Delete job/contract fields from persona payload so Supabase doesn't complain
    const jobFields = [
      "empresa_interna_id",
      "cliente_id",
      "sede_id",
      "cargo_id",
      "tipo_trabajador_id",
      "regimen_laboral_id",
      "sueldo_basico",
      "bono",
      "lugar_especifico_trabajo",
      "asignacion_familiar",
      "contrato_modalidad_id",
      "contrato_fecha_inicio",
      "contrato_fecha_fin"
    ];
    jobFields.forEach(f => delete payload[f]);

    try {
      if (editingId) {
        const { error: dbError } = await supabase
          .from("personas")
          .update(payload)
          .eq("id", editingId);
        if (dbError) throw dbError;
        alert("Colaborador actualizado correctamente.");
      } else {
        // Insert and select new ID
        const { data: newPers, error: pErr } = await supabase
          .from("personas")
          .insert([payload])
          .select("id")
          .single();
        if (pErr) throw pErr;

        // If job fields are filled in, insert vinculo
        if (newPers && personaForm.empresa_interna_id && personaForm.sede_id) {
          const vPayload = {
            persona_id: newPers.id,
            empresa_interna_id: parseInt(personaForm.empresa_interna_id),
            sede_id: parseInt(personaForm.sede_id),
            cargo_id: parseInt(personaForm.cargo_id),
            tipo_trabajador_id: parseInt(personaForm.tipo_trabajador_id),
            regimen_laboral_id: parseInt(personaForm.regimen_laboral_id),
            sueldo_basico: parseFloat(personaForm.sueldo_basico) || 1025.00,
            bono: parseFloat(personaForm.bono) || 0.00,
            lugar_especifico_trabajo: personaForm.lugar_especifico_trabajo || "",
            asignacion_familiar: !!personaForm.asignacion_familiar,
            estado: "Activo"
          };

          const { data: newVinc, error: vErr } = await supabase
            .from("vinculos_laborales")
            .insert([vPayload])
            .select("id")
            .single();
          if (vErr) throw vErr;

          // Insert contract if filled
          if (newVinc && personaForm.contrato_modalidad_id && personaForm.contrato_fecha_inicio) {
            const cPayload = {
              vinculo_laboral_id: newVinc.id,
              modalidad_contrato_id: parseInt(personaForm.contrato_modalidad_id),
              fecha_inicio: personaForm.contrato_fecha_inicio,
              fecha_fin: personaForm.contrato_fecha_fin || null,
              estado: "Vigente"
            };

            const { error: cErr } = await supabase
              .from("contratos")
              .insert([cPayload]);
            if (cErr) throw cErr;
          }
        }
        alert("Colaborador registrado correctamente.");
      }
      setViewMode("list");
      loadPersonas();
    } catch (err: any) {
      console.error("Error saving persona:", err);
      setError(err.message || "Error al guardar ficha maestra.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDeleteConfirm = (persona: any) => {
    setDeleteConfirmId(persona.id);
    setDeleteConfirmName(`${persona.nombres} ${persona.apellidos}`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setLoading(true);
    const targetId = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      const { error: dbError } = await supabase.from("personas").delete().eq("id", targetId);
      if (dbError) throw dbError;
      loadPersonas();
    } catch (err: any) {
      setError(err.message || "No se puede eliminar la ficha porque tiene vínculos laborales activos o históricos.");
    } finally {
      setLoading(false);
    }
  };

  const parseExcelDate = (val: any): string | null => {
    if (!val) return null;
    
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      return val.toISOString().split("T")[0];
    }
    
    const num = Number(val);
    if (!isNaN(num) && num > 10000 && num < 100000) {
      const date = new Date((num - 25569) * 86400 * 1000);
      return date.toISOString().split("T")[0];
    }
    
    const str = String(val).trim();
    
    // DD-MM-YYYY or DD/MM/YYYY
    const dmyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
    const matchDmy = str.match(dmyRegex);
    if (matchDmy) {
      const day = parseInt(matchDmy[1], 10);
      const month = parseInt(matchDmy[2], 10) - 1;
      const year = parseInt(matchDmy[3], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    // YYYY-MM-DD or YYYY/MM/DD
    const ymdRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
    const matchYmd = str.match(ymdRegex);
    if (matchYmd) {
      const year = parseInt(matchYmd[1], 10);
      const month = parseInt(matchYmd[2], 10) - 1;
      const day = parseInt(matchYmd[3], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    return null;
  };

  const downloadExcelTemplate = () => {
    const headers = [
      "tipo_documento_codigo", "numero_documento", "nombres", "apellidos", "sexo", "fecha_nacimiento",
      "direccion", "ubigeo_id", "telefono", "correo", "banco_sueldo_nombre", "cuenta_sueldo",
      "banco_cts_nombre", "cuenta_cts", "sistema_pension_nombre", "codigo_cuss_afp",
      "fecha_ultimo_emo", "talla_polo", "talla_pantalon", "talla_calzado",
      "fecha_ingreso", "fecha_primer_contrato",
      "empresa_interna_ruc", "cliente_nombre", "sede_nombre", "cargo_nombre", "tipo_trabajador_nombre",
      "lugar_especifico_trabajo", "regimen_laboral_nombre", "asignacion_familiar", "sueldo_basico", "bono",
      "modalidad_contrato_nombre", "contrato_fecha_inicio", "contrato_fecha_fin"
    ];

    const exampleRow1 = [
      "DNI", "71234567", "Juan Gabriel", "Mendoza Rojas", "Masculino", "20-08-1990",
      "Calle Los Jazmines 456", "150135", "987654321", "juan.mendoza@email.com", "BCP", "191-99887766-0-12",
      "BCP", "191-88776655-0-34", "AFP Integra", "123456-ABC-7",
      "15-02-2026", "M", "32", "41",
      "01-06-2026", "30-05-2026",
      "20601234567", "BCP", "Sede Central San Isidro", "Operario", "Obrero",
      "Almacén Central", "Régimen General", "SI", "1200.00", "150.00",
      "Plazo Fijo", "01-06-2026", "30-11-2026"
    ];

    const exampleRow2 = [
      "DNI", "48765432", "Maria Elena", "Castro Silva", "Femenino", "05-12-1995",
      "Av. Petit Thouars 1200", "", "999888777", "maria.castro@email.com", "", "",
      "", "", "ONP", "",
      "", "", "S", "",
      "", "",
      "20609876543", "Minera Las Bambas", "Sede Mina Apurímac", "Supervisor", "Empleado",
      "Operaciones Apurímac", "Régimen General", "NO", "2500.00", "0.00",
      "Plazo Fijo", "15-06-2026", ""
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow1, exampleRow2]);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Personal");
    XLSX.writeFile(wb, "plantilla_importacion_personal.xlsx");
  };

  const downloadErrorReport = () => {
    const errorRows = importRows.filter(r => !r.isValid || r.warnings.length > 0);
    if (errorRows.length === 0) {
      alert("No hay errores ni advertencias para exportar.");
      return;
    }

    const headers = ["Fila Excel", "DNI", "Colaborador", "Estado", "Errores / Advertencias"];
    const rows = errorRows.map(r => {
      const status = r.isValid ? "Advertencia" : "Error";
      const details = [...r.errors, ...r.warnings].join(" | ");
      return [r.rowNumber, r.dni, r.nombres, status, details];
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Errores de Importacion");
    XLSX.writeFile(wb, "reporte_errores_importacion.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (jsonData.length < 2) {
          alert("El archivo Excel no tiene suficientes filas (debe incluir la cabecera y al menos una fila de datos).");
          return;
        }

        const headers = jsonData[0].map((h: any) => String(h || "").trim().toLowerCase());
        
        // Find and query unique ubigeo_ids present in the file
        const ubigeoIdx = headers.indexOf("ubigeo_id");
        const uniqueExcelUbigeos = new Set<string>();
        if (ubigeoIdx !== -1) {
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === "")) continue;
            const val = row[ubigeoIdx];
            if (val !== undefined && val !== null) {
              let uStr = String(val).trim();
              if (uStr !== "") {
                if (/^\d+$/.test(uStr)) {
                  uStr = uStr.padStart(6, "0");
                }
                uniqueExcelUbigeos.add(uStr);
              }
            }
          }
        }

        const validUbigeoMap = new Map<string, boolean>();
        if (uniqueExcelUbigeos.size > 0) {
          const { data: dbUbigeos, error: dbErr } = await supabase
            .from("ubigeo_distritos")
            .select("id")
            .in("id", Array.from(uniqueExcelUbigeos));
          
          if (!dbErr && dbUbigeos) {
            dbUbigeos.forEach(u => validUbigeoMap.set(u.id, true));
          }
        }

        const parsed: any[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === "")) continue;

          const rowData: Record<string, any> = {};
          headers.forEach((header, idx) => {
            rowData[header] = row[idx];
          });

          const errors: string[] = [];
          const warnings: string[] = [];

          const docCode = String(rowData.tipo_documento_codigo || "").trim();
          const matchedDoc = tiposDoc.find(td => td.codigo.toLowerCase() === docCode.toLowerCase());
          if (!docCode) errors.push("Código de tipo de documento es obligatorio");
          else if (!matchedDoc) errors.push(`Tipo de documento '${docCode}' no encontrado`);

          const numDoc = String(rowData.numero_documento || "").trim();
          if (!numDoc) errors.push("Número de documento es obligatorio");

          const nombres = String(rowData.nombres || "").trim();
          if (!nombres) errors.push("Nombres son obligatorios");
          const apellidos = String(rowData.apellidos || "").trim();
          if (!apellidos) errors.push("Apellidos son obligatorios");

          const sexo = String(rowData.sexo || "").trim();
          if (!sexo) errors.push("Sexo es obligatorio");
          else if (sexo !== "Masculino" && sexo !== "Femenino") errors.push("Sexo debe ser 'Masculino' o 'Femenino'");

          // Date parsing using parseExcelDate
          const rawFechaNac = rowData.fecha_nacimiento;
          const parsedFechaNac = parseExcelDate(rawFechaNac);
          if (!rawFechaNac) errors.push("Fecha de nacimiento es obligatoria");
          else if (!parsedFechaNac) errors.push(`Fecha de nacimiento '${rawFechaNac || ""}' es inválida. Usar formato DD-MM-YYYY`);

          const pensionName = String(rowData.sistema_pension_nombre || "").trim();
          const matchedPension = pensiones.find(p => p.nombre.toLowerCase() === pensionName.toLowerCase());
          if (!pensionName) errors.push("Sistema de pensión es obligatorio");
          else if (!matchedPension) errors.push(`Pensión '${pensionName}' no encontrada`);

          const bancoSueldoName = String(rowData.banco_sueldo_nombre || "").trim();
          let matchedBancoSueldo = null;
          if (bancoSueldoName) {
            matchedBancoSueldo = bancos.find(b => b.nombre.toLowerCase() === bancoSueldoName.toLowerCase());
            if (!matchedBancoSueldo) errors.push(`Banco sueldo '${bancoSueldoName}' no encontrado`);
          }

          const bancoCtsName = String(rowData.banco_cts_nombre || "").trim();
          let matchedBancoCts = null;
          if (bancoCtsName) {
            matchedBancoCts = bancos.find(b => b.nombre.toLowerCase() === bancoCtsName.toLowerCase());
            if (!matchedBancoCts) errors.push(`Banco CTS '${bancoCtsName}' no encontrado`);
          }

          // Entry Dates (Supabase addition) - Now Mandatory
          const rawFechaIngreso = rowData.fecha_ingreso;
          const parsedFechaIngreso = parseExcelDate(rawFechaIngreso);
          if (!rawFechaIngreso) {
            errors.push("Fecha de ingreso laboral es obligatoria");
          } else if (!parsedFechaIngreso) {
            errors.push(`Fecha de ingreso '${rawFechaIngreso || ""}' es inválida. Usar formato DD-MM-YYYY`);
          }

          const rawFechaPrimerContrato = rowData.fecha_primer_contrato;
          const parsedFechaPrimerContrato = parseExcelDate(rawFechaPrimerContrato);
          if (!rawFechaPrimerContrato) {
            errors.push("Fecha de primer contrato es obligatoria");
          } else if (!parsedFechaPrimerContrato) {
            errors.push(`Fecha primer contrato '${rawFechaPrimerContrato || ""}' es inválida. Usar formato DD-MM-YYYY`);
          }

          // Job validations: optional if hasActiveVinculoDb is true (contract updates)
          const empresaRuc = String(rowData.empresa_interna_ruc || "").trim();
          const matchedEmpresa = empresas.find(e => e.ruc === empresaRuc);

          // Determine update mode vs new mode
          const alreadyExists = personas.some(p => p.numero_documento === numDoc);
          const existingPersonRecord = personas.find(p => p.numero_documento === numDoc);
          // Check if there is an active contract specifically for the matched company
          const hasActiveVinculoDb = alreadyExists && existingPersonRecord?.vinculos_laborales?.some(
            (v: any) => v.estado === "Activo" && v.empresa_interna_id === matchedEmpresa?.id
          );

          const hasJobData = !!(
            empresaRuc ||
            String(rowData.cliente_nombre || "").trim() ||
            String(rowData.sede_nombre || "").trim() ||
            String(rowData.cargo_nombre || "").trim() ||
            String(rowData.tipo_trabajador_nombre || "").trim() ||
            String(rowData.regimen_laboral_nombre || "").trim() ||
            String(rowData.modalidad_contrato_nombre || "").trim() ||
            String(rowData.contrato_fecha_inicio || "").trim() ||
            String(rowData.sueldo_basico || "").trim()
          );

          const isUpdateOnly = alreadyExists && !hasJobData;

          if (!isUpdateOnly) {
            if (!empresaRuc && !hasActiveVinculoDb) errors.push("RUC de empresa es obligatorio");
            else if (empresaRuc && !matchedEmpresa) errors.push(`Empresa RUC '${empresaRuc}' no encontrada`);
          }

          const sedeName = String(rowData.sede_nombre || "").trim();
          const clienteName = String(rowData.cliente_nombre || "").trim();
          const matchedSede = sedes.find(s => 
            s.nombre.toLowerCase() === sedeName.toLowerCase() &&
            s.clientes?.razon_social?.toLowerCase() === clienteName.toLowerCase()
          );
          if (!isUpdateOnly) {
            if (!clienteName && !hasActiveVinculoDb) {
              errors.push("Nombre de cliente es obligatorio");
            }
            if (!sedeName && !hasActiveVinculoDb) {
              errors.push("Nombre de sede es obligatorio");
            } else if (sedeName && !matchedSede) {
              if (clienteName) {
                errors.push(`Sede '${sedeName}' para el cliente '${clienteName}' no encontrada`);
              } else {
                errors.push(`Sede '${sedeName}' no encontrada (ingrese también el nombre del cliente para buscarla)`);
              }
            }
          }

          const cargoName = String(rowData.cargo_nombre || "").trim();
          const matchedCargo = cargos.find(c => c.nombre.toLowerCase() === cargoName.toLowerCase());
          if (!isUpdateOnly) {
            if (!cargoName && !hasActiveVinculoDb) errors.push("Nombre de cargo es obligatorio");
            else if (cargoName && !matchedCargo) errors.push(`Cargo '${cargoName}' no encontrado`);
          }

          const tipoTrabName = String(rowData.tipo_trabajador_nombre || "").trim();
          const matchedTipoTrab = tiposTrab.find(tt => tt.nombre.toLowerCase() === tipoTrabName.toLowerCase());
          if (!isUpdateOnly) {
            if (!tipoTrabName && !hasActiveVinculoDb) errors.push("Tipo de trabajador es obligatorio");
            else if (tipoTrabName && !matchedTipoTrab) errors.push(`Tipo de trabajador '${tipoTrabName}' no encontrado`);
          }

          const regimenName = String(rowData.regimen_laboral_nombre || "").trim();
          const matchedRegimen = regimenes.find(r => r.nombre.toLowerCase() === regimenName.toLowerCase());
          if (!isUpdateOnly) {
            if (!regimenName && !hasActiveVinculoDb) errors.push("Régimen es obligatorio");
            else if (regimenName && !matchedRegimen) errors.push(`Régimen '${regimenName}' no encontrado`);
          }

          const modalidadName = String(rowData.modalidad_contrato_nombre || "").trim();
          const matchedModalidad = modalidades.find(m => m.nombre.toLowerCase() === modalidadName.toLowerCase());
          if (!isUpdateOnly) {
            if (!modalidadName && !hasActiveVinculoDb) errors.push("Modalidad de contrato es obligatoria");
            else if (modalidadName && !matchedModalidad) errors.push(`Modalidad '${modalidadName}' no encontrada`);
          }

          const rawFechaInicio = rowData.contrato_fecha_inicio;
          const parsedFechaInicio = parseExcelDate(rawFechaInicio);
          if (!isUpdateOnly) {
            if (!rawFechaInicio) errors.push("Fecha inicio de contrato es obligatoria");
            else if (!parsedFechaInicio) errors.push(`Fecha inicio de contrato '${rawFechaInicio || ""}' es inválida. Usar formato DD-MM-YYYY`);
          }

          const rawFechaFin = rowData.contrato_fecha_fin;
          const parsedFechaFin = parseExcelDate(rawFechaFin);
          if (!isUpdateOnly && rawFechaFin && !parsedFechaFin) {
            errors.push(`Fecha fin de contrato '${rawFechaFin || ""}' es inválida. Usar formato DD-MM-YYYY`);
          }

          const sueldoStr = String(rowData.sueldo_basico || "").trim();
          const sueldoNum = parseFloat(sueldoStr);
          if (!isUpdateOnly) {
            if (!sueldoStr && !hasActiveVinculoDb) errors.push("Sueldo básico es obligatorio");
            else if (sueldoStr && (isNaN(sueldoNum) || sueldoNum < 0)) errors.push("Sueldo básico debe ser un número positivo");
          }

          const bonoStr = rowData.bono !== undefined && rowData.bono !== null ? String(rowData.bono).trim() : "";
          const bonoNum = parseFloat(bonoStr) || 0.00;
          if (!isUpdateOnly && bonoStr && (isNaN(bonoNum) || bonoNum < 0)) {
            errors.push("Bono debe ser un número positivo");
          }

          const asigFamStr = String(rowData.asignacion_familiar || "").trim().toUpperCase();
          const asigFam = asigFamStr === "SI" || asigFamStr === "SÍ" || asigFamStr === "TRUE" || asigFamStr === "YES";

          const rawFechaUltimoEmo = rowData.fecha_ultimo_emo;
          const parsedFechaUltimoEmo = parseExcelDate(rawFechaUltimoEmo);
          if (rawFechaUltimoEmo && !parsedFechaUltimoEmo) {
            errors.push(`Fecha último EMO '${rawFechaUltimoEmo || ""}' es inválida. Usar formato DD-MM-YYYY`);
          }

          // Parse and sanitize ubigeo_id
          let ubigeoId = null;
          const ubigeoIdRaw = rowData.ubigeo_id;
          if (ubigeoIdRaw !== undefined && ubigeoIdRaw !== null) {
            let uStr = String(ubigeoIdRaw).trim();
            if (uStr !== "") {
              if (/^\d+$/.test(uStr)) {
                uStr = uStr.padStart(6, "0");
              }
              ubigeoId = uStr;
            }
          }

          if (ubigeoId) {
            if (!validUbigeoMap.has(ubigeoId)) {
              errors.push(`El ubigeo '${ubigeoId}' no está registrado en el sistema. Regístralo primero en Configuración -> Diccionarios de Datos.`);
            }
          }

          if (alreadyExists && errors.length === 0) {
            if (isUpdateOnly) {
              warnings.push("Persona ya registrada: se actualizarán sus datos personales únicamente (sin cambiar puesto o contrato).");
            } else if (hasActiveVinculoDb) {
              warnings.push("Persona ya registrada: se actualizará su ficha y las fechas del contrato vigente existente.");
            } else {
              warnings.push("Persona ya registrada: se actualizará su ficha y se creará un nuevo contrato.");
            }
          }

          // Payloads construction
          const personaPayload: any = {
            tipo_documento_id: matchedDoc?.id,
            numero_documento: numDoc,
            nombres,
            apellidos,
            sexo,
            fecha_nacimiento: parsedFechaNac,
            direccion: rowData.direccion ? String(rowData.direccion).trim() : null,
            ubigeo_id: ubigeoId,
            telefono: rowData.telefono ? String(rowData.telefono).trim() : null,
            correo: rowData.correo ? String(rowData.correo).trim() : null,
            banco_sueldo_id: matchedBancoSueldo?.id || null,
            cuenta_sueldo: rowData.cuenta_sueldo ? String(rowData.cuenta_sueldo).trim() : null,
            banco_cts_id: matchedBancoCts?.id || null,
            cuenta_cts: rowData.cuenta_cts ? String(rowData.cuenta_cts).trim() : null,
            sistema_pension_id: matchedPension?.id,
            codigo_cuss_afp: rowData.codigo_cuss_afp ? String(rowData.codigo_cuss_afp).trim() : null,
            fecha_ultimo_emo: parsedFechaUltimoEmo,
            talla_polo: rowData.talla_polo ? String(rowData.talla_polo).trim() : null,
            talla_pantalon: rowData.talla_pantalon ? String(rowData.talla_pantalon).trim() : null,
            talla_calzado: rowData.talla_calzado ? String(rowData.talla_calzado).trim() : null
          };

          if (parsedFechaIngreso) {
            personaPayload.fecha_ingreso = parsedFechaIngreso;
          } else if (!alreadyExists && parsedFechaInicio) {
            personaPayload.fecha_ingreso = parsedFechaInicio;
          }

          if (parsedFechaPrimerContrato) {
            personaPayload.fecha_primer_contrato = parsedFechaPrimerContrato;
          } else if (!alreadyExists && parsedFechaInicio) {
            personaPayload.fecha_primer_contrato = parsedFechaInicio;
          }

          const vinculoPayload: any = isUpdateOnly ? null : {
            estado: "Activo"
          };
          if (vinculoPayload) {
            if (matchedEmpresa) vinculoPayload.empresa_interna_id = matchedEmpresa.id;
            if (matchedSede) vinculoPayload.sede_id = matchedSede.id;
            if (matchedCargo) vinculoPayload.cargo_id = matchedCargo.id;
            if (matchedTipoTrab) vinculoPayload.tipo_trabajador_id = matchedTipoTrab.id;
            if (matchedRegimen) vinculoPayload.regimen_laboral_id = matchedRegimen.id;
            if (rowData.lugar_especifico_trabajo) vinculoPayload.lugar_especifico_trabajo = String(rowData.lugar_especifico_trabajo).trim();
            if (rowData.sueldo_basico) vinculoPayload.sueldo_basico = sueldoNum;
            if (rowData.bono !== undefined && rowData.bono !== null) vinculoPayload.bono = bonoNum;
            if (rowData.asignacion_familiar) vinculoPayload.asignacion_familiar = asigFam;
          }

          const contratoPayload: any = isUpdateOnly ? null : {
            estado: "Vigente"
          };
          if (contratoPayload) {
            if (matchedModalidad) contratoPayload.modalidad_contrato_id = matchedModalidad.id;
            if (parsedFechaInicio) contratoPayload.fecha_inicio = parsedFechaInicio;
            if (parsedFechaFin !== undefined) contratoPayload.fecha_fin = parsedFechaFin || null;
          }

          parsed.push({
            rowNumber: i + 1,
            nombres: `${apellidos}, ${nombres}`,
            dni: numDoc,
            empresa: isUpdateOnly ? "(Solo Actualizar)" : (matchedEmpresa?.razon_social || (hasActiveVinculoDb ? "(Sin Cambios)" : empresaRuc)),
            sedeCargo: isUpdateOnly ? "(Solo Actualizar)" : `${matchedSede?.nombre || (hasActiveVinculoDb ? "(Sin Cambios)" : sedeName)} / ${matchedCargo?.nombre || (hasActiveVinculoDb ? "(Sin Cambios)" : cargoName)}`,
            sueldo: isUpdateOnly ? 0 : (rowData.sueldo_basico ? sueldoNum : 0),
            vigencia: isUpdateOnly ? "(No Cambia)" : `${parsedFechaInicio ? parsedFechaInicio.split("-").reverse().join("-") : (hasActiveVinculoDb ? "(Sin Cambios)" : rawFechaInicio)} / ${parsedFechaFin ? parsedFechaFin.split("-").reverse().join("-") : (hasActiveVinculoDb ? "(Sin Cambios)" : (rawFechaFin ? rawFechaFin : "Indet."))}`,
            errors,
            warnings,
            isValid: errors.length === 0,
            isUpdateOnly,
            hasActiveVinculoDb,
            personaPayload,
            vinculoPayload,
            contratoPayload
          });
        }

        setImportRows(parsed);
        setImportStatus({
          processed: 0,
          total: parsed.filter(p => p.isValid).length,
          errors: [],
          successCount: 0
        });
      } catch (err: any) {
        console.error("Error reading Excel:", err);
        alert("Error al leer el archivo Excel. Asegúrate de subir un archivo válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const executeImport = async () => {
    const validRows = importRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert("No hay filas válidas para importar.");
      return;
    }

    setImporting(true);
    setImportSuccess(false);
    setImportStatusText("Iniciando importación masiva...");
    setImportStatus(prev => ({ ...prev, processed: 0, total: validRows.length, successCount: 0, errors: [], warnings: [] }));
    
    let success = 0;
    const errorsList: string[] = [];
    const warningsList: string[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setImportStatusText(`Procesando fila ${i + 1} de ${validRows.length}: ${row.nombres || ""} ${row.apellidos || ""} (DNI: ${row.dni || ""})...`);
      
      const payloadSedeId = row.vinculoPayload?.sede_id;
      const payloadEmpresaId = row.vinculoPayload?.empresa_interna_id;
      
      const matchedSedeObj = sedes.find((s: any) => s.id === payloadSedeId);
      const matchedEmpresaObj = empresas.find((e: any) => e.id === payloadEmpresaId);
      
      const sedeName = matchedSedeObj ? matchedSedeObj.nombre : `ID ${payloadSedeId || 'N/A'}`;
      const clienteName = matchedSedeObj?.clientes ? matchedSedeObj.clientes.razon_social : "No especificado";
      const empresaName = matchedEmpresaObj ? matchedEmpresaObj.razon_social : `ID ${payloadEmpresaId || 'N/A'}`;

      try {
        let personaId: number;

        const { data: existingPers } = await supabase
          .from("personas")
          .select("id")
          .eq("numero_documento", row.dni)
          .maybeSingle();

        if (existingPers) {
          const { error: pErr } = await supabase
            .from("personas")
            .update(row.personaPayload)
            .eq("id", existingPers.id);
          if (pErr) throw new Error(`Error actualizando persona: ${pErr.message}`);
          personaId = existingPers.id;

          if (!row.isUpdateOnly && row.vinculoPayload?.empresa_interna_id) {
            // Find active vinculo specifically for this company
            const { data: activeVinc } = await supabase
              .from("vinculos_laborales")
              .select("id")
              .eq("persona_id", personaId)
              .eq("empresa_interna_id", row.vinculoPayload.empresa_interna_id)
              .eq("estado", "Activo")
              .order("id", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (activeVinc) {
              // Update existing active vinculo parameters
              const vUpdatePayload = { ...row.vinculoPayload };
              delete vUpdatePayload.estado;
              Object.keys(vUpdatePayload).forEach(key => {
                if (vUpdatePayload[key] === undefined) delete vUpdatePayload[key];
              });

              if (Object.keys(vUpdatePayload).length > 0) {
                const resV = await supabase
                  .from("vinculos_laborales")
                  .update(vUpdatePayload)
                  .eq("id", activeVinc.id);
                
                if (resV.error) {
                  if (resV.error.message.includes("no pertenece a la Empresa Interna")) {
                    // Retry with exception flag set
                    const retryPayload = { ...vUpdatePayload, excepcion_sede: true, excepcion_aprobada: false };
                    const retryRes = await supabase
                      .from("vinculos_laborales")
                      .update(retryPayload)
                      .eq("id", activeVinc.id);
                    if (retryRes.error) throw new Error(`Error actualizando vínculo laboral con excepción: ${retryRes.error.message}`);
                    warningsList.push(
                      `Fila ${row.rowNumber} (${row.dni} - Colaborador: ${row.nombres}): Registrado bajo excepción. La sede '${sedeName}' no pertenece a la Empresa '${empresaName}' (Cliente: '${clienteName}') (Pendiente de Aprobación).`
                    );
                  } else {
                    throw new Error(`Error actualizando vínculo laboral: ${resV.error.message}`);
                  }
                }
              }

              // Update or insert Vigente contract
              const { data: vigenteContrato } = await supabase
                .from("contratos")
                .select("id")
                .eq("vinculo_laboral_id", activeVinc.id)
                .eq("estado", "Vigente")
                .order("id", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (vigenteContrato) {
                const cUpdatePayload = { ...row.contratoPayload };
                delete cUpdatePayload.estado;
                Object.keys(cUpdatePayload).forEach(key => {
                  if (cUpdatePayload[key] === undefined) delete cUpdatePayload[key];
                });

                const { error: cErr } = await supabase
                  .from("contratos")
                  .update(cUpdatePayload)
                  .eq("id", vigenteContrato.id);
                if (cErr) throw new Error(`Error actualizando contrato vigente: ${cErr.message}`);
              } else {
                const cPayload = { ...row.contratoPayload, vinculo_laboral_id: activeVinc.id };
                const { error: cErr } = await supabase
                  .from("contratos")
                  .insert([cPayload]);
                if (cErr) throw new Error(`Error creando contrato para vínculo activo: ${cErr.message}`);
              }
            } else {
              // No active vinculo, insert new one and contract
              const vPayload = { ...row.vinculoPayload, persona_id: personaId };
              let vinculoId: number;

              const resV = await supabase
                .from("vinculos_laborales")
                .insert([vPayload])
                .select("id")
                .single();
              
              if (resV.error) {
                if (resV.error.message.includes("no pertenece a la Empresa Interna")) {
                  const retryPayload = { ...vPayload, excepcion_sede: true, excepcion_aprobada: false };
                  const retryRes = await supabase
                    .from("vinculos_laborales")
                    .insert([retryPayload])
                    .select("id")
                    .single();
                  if (retryRes.error) throw new Error(`Error creando vínculo laboral con excepción: ${retryRes.error.message}`);
                  vinculoId = retryRes.data.id;
                  warningsList.push(
                    `Fila ${row.rowNumber} (${row.dni} - Colaborador: ${row.nombres}): Registrado bajo excepción. La sede '${sedeName}' no pertenece a la Empresa '${empresaName}' (Cliente: '${clienteName}') (Pendiente de Aprobación).`
                  );
                } else {
                  throw new Error(`Error creando vínculo laboral: ${resV.error.message}`);
                }
              } else {
                vinculoId = resV.data.id;
              }

              const cPayload = { ...row.contratoPayload, vinculo_laboral_id: vinculoId };
              const { error: cErr } = await supabase
                .from("contratos")
                .insert([cPayload]);
              if (cErr) throw new Error(`Error creando contrato: ${cErr.message}`);
            }
          }
        } else {
          const { data: newPers, error: pErr } = await supabase
            .from("personas")
            .insert([row.personaPayload])
            .select("id")
            .single();
          if (pErr) throw new Error(`Error registrando persona: ${pErr.message}`);
          personaId = newPers.id;

          const vPayload = { ...row.vinculoPayload, persona_id: personaId };
          let vinculoId: number;

          const resV = await supabase
            .from("vinculos_laborales")
            .insert([vPayload])
            .select("id")
            .single();
          
          if (resV.error) {
            if (resV.error.message.includes("no pertenece a la Empresa Interna")) {
              const retryPayload = { ...vPayload, excepcion_sede: true, excepcion_aprobada: false };
              const retryRes = await supabase
                .from("vinculos_laborales")
                .insert([retryPayload])
                .select("id")
                .single();
              if (retryRes.error) throw new Error(`Error creando vínculo laboral con excepción: ${retryRes.error.message}`);
              vinculoId = retryRes.data.id;
              warningsList.push(
                `Fila ${row.rowNumber} (${row.dni} - Colaborador: ${row.nombres}): Registrado bajo excepción. La sede '${sedeName}' no pertenece a la Empresa '${empresaName}' (Cliente: '${clienteName}') (Pendiente de Aprobación).`
              );
            } else {
              throw new Error(`Error creando vínculo laboral: ${resV.error.message}`);
            }
          } else {
            vinculoId = resV.data.id;
          }

          const cPayload = { ...row.contratoPayload, vinculo_laboral_id: vinculoId };
          const { error: cErr } = await supabase
            .from("contratos")
            .insert([cPayload]);
          if (cErr) throw new Error(`Error creando contrato: ${cErr.message}`);
        }

        success++;
      } catch (err: any) {
        console.error(`Error importing row ${row.rowNumber}:`, err);
        
        let errMsg = err.message || String(err);
        
        let typeError = "Error";
        if (errMsg.includes("Error registrando persona:")) {
          typeError = "Error registrando persona";
          errMsg = errMsg.replace("Error registrando persona:", "").trim();
        } else if (errMsg.includes("Error creando vínculo laboral:")) {
          typeError = "Error creando vínculo laboral";
          errMsg = errMsg.replace("Error creando vínculo laboral:", "").trim();
        } else if (errMsg.includes("Error creando contrato:")) {
          typeError = "Error creando contrato";
          errMsg = errMsg.replace("Error creando contrato:", "").trim();
        } else if (errMsg.includes("Error actualizando persona:")) {
          typeError = "Error actualizando persona";
          errMsg = errMsg.replace("Error actualizando persona:", "").trim();
        } else if (errMsg.includes("Error actualizando vínculo laboral:")) {
          typeError = "Error actualizando vínculo laboral";
          errMsg = errMsg.replace("Error actualizando vínculo laboral:", "").trim();
        } else if (errMsg.includes("Error actualizando contrato vigente:")) {
          typeError = "Error actualizando contrato vigente";
          errMsg = errMsg.replace("Error actualizando contrato vigente:", "").trim();
        }
        
        if (errMsg.includes("no pertenece a la Empresa Interna")) {
          errMsg = `La sede seleccionada '${sedeName}' no pertenece a la Empresa Interna '${empresaName}' (Cliente: '${clienteName}')`;
        }
        
        errorsList.push(
          `Fila ${row.rowNumber} (${row.dni} - Colaborador: ${row.nombres}): ${typeError}: ${errMsg} (Empresa: '${empresaName}', Cliente: '${clienteName}', Sede: '${sedeName}')`
        );
      }

      setImportStatus(prev => ({
        ...prev,
        processed: i + 1,
        successCount: success,
        errors: [...errorsList],
        warnings: [...warningsList]
      }));
    }

    setImportSuccess(true);
    loadPersonas();
  };

  const handleDownloadErrorReport = () => {
    if (importStatus.errors.length === 0 && importStatus.warnings.length === 0) return;
    
    const headerText = `REPORTE DE IMPORTACION MASIVA\n`;
    const dateText = `Fecha: ${new Date().toLocaleDateString()} Hora: ${new Date().toLocaleTimeString()}\n`;
    const summaryText = `Total Procesados: ${importStatus.processed}\nExitosos: ${importStatus.successCount}\nFallidos: ${importStatus.errors.length}\nAdvertencias/Excepciones: ${importStatus.warnings.length}\n`;
    const separator = `================================================================================\n`;
    
    let bodyText = "";
    if (importStatus.errors.length > 0) {
      bodyText += `ERRORES (FICHAS QUE FALLARON):\n`;
      bodyText += importStatus.errors.map((err, i) => `${i + 1}. ${err}`).join("\n") + "\n\n";
    }
    if (importStatus.warnings.length > 0) {
      bodyText += `ADVERTENCIAS / EXCEPCIONES REGISTRADAS (REQUERIRÁN APROBACIÓN):\n`;
      bodyText += importStatus.warnings.map((warn, i) => `${i + 1}. ${warn}`).join("\n") + "\n";
    }
    
    const fullText = headerText + dateText + summaryText + separator + bodyText;
    
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte_importacion_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCloseImportOverlay = () => {
    setImporting(false);
    setImportSuccess(false);
    setImportStatusText("");
    setImportRows([]);
    setImportStatus({
      processed: 0,
      total: 0,
      errors: [],
      warnings: [],
      successCount: 0
    });
    setViewMode("list");
  };

  // Job link management
  const handleOpenAddVinculo = () => {
    setEditingVinculoId(null);
    const firstEmpId = empresas[0]?.id || "";
    const availableClients = getClientesForEmpresa(firstEmpId);
    const firstCli = availableClients[0];
    const validSedes = firstCli ? sedes.filter(s => s.cliente_id === firstCli.id) : [];
    const defaultSede = validSedes[0];
    const defaultCargo = cargos[0];
    setVinculoForm({
      persona_id: activePersona.id,
      empresa_interna_id: firstEmpId,
      cliente_id: firstCli?.id || "",
      sede_id: defaultSede?.id || "",
      cargo_id: defaultCargo?.id || "",
      tipo_trabajador_id: tiposTrab[0]?.id || "",
      regimen_laboral_id: regimenes[0]?.id || "",
      sueldo_basico: 1025.00,
      bono: 0.00,
      asignacion_familiar: false,
      estado: "Activo",
      contrato_modalidad_id: modalidades[0]?.id || "",
      contrato_fecha_inicio: new Date().toISOString().split("T")[0],
      contrato_fecha_fin: ""
    });
    setSedeSearchText(defaultSede ? defaultSede.nombre : "");
    setCargoSearchText(defaultCargo ? defaultCargo.nombre : "");
    setShowSedeDropdown(false);
    setShowCargoDropdown(false);
    setIsVinculoModalOpen(true);
  };

  const handleOpenEditVinculo = (v: any) => {
    setEditingVinculoId(v.id);
    setVinculoForm({
      persona_id: v.persona_id,
      empresa_interna_id: v.empresa_interna_id,
      cliente_id: v.sedes?.clientes?.id || v.sedes?.cliente_id || "",
      sede_id: v.sede_id,
      cargo_id: v.cargo_id,
      tipo_trabajador_id: v.tipo_trabajador_id,
      regimen_laboral_id: v.regimen_laboral_id,
      sueldo_basico: v.sueldo_basico,
      bono: v.bono || 0.00,
      lugar_especifico_trabajo: v.lugar_especifico_trabajo || "",
      asignacion_familiar: v.asignacion_familiar || false,
      estado: v.estado
    });
    setSedeSearchText(v.sedes?.nombre || "");
    setCargoSearchText(v.cargos?.nombre || "");
    setShowSedeDropdown(false);
    setShowCargoDropdown(false);
    setIsVinculoModalOpen(true);
  };

  const handleSaveVinculo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const targetEmpresaId = parseInt(vinculoForm.empresa_interna_id);
    const isDupCheckNeeded = !editingVinculoId || (editingVinculoId && vinculoForm.empresa_interna_id !== vinculos.find(v => v.id === editingVinculoId)?.empresa_interna_id);
    
    if (isDupCheckNeeded) {
      const hasDuplicate = vinculos.some(
        v => v.id !== editingVinculoId && v.estado === "Activo" && v.empresa_interna_id === targetEmpresaId
      );
      if (hasDuplicate) {
        alert("El colaborador ya tiene un puesto ACTIVO registrado en esta empresa interna. Para asignarle un nuevo puesto en esta misma empresa, primero debes Cesar el puesto actual.");
        return;
      }
    }

    try {
      const vinculoPayload = { ...vinculoForm };
      const contractModalidadId = vinculoPayload.contrato_modalidad_id;
      const contractFechaInicio = vinculoPayload.contrato_fecha_inicio;
      const contractFechaFin = vinculoPayload.contrato_fecha_fin;
      
      delete vinculoPayload.contrato_modalidad_id;
      delete vinculoPayload.contrato_fecha_inicio;
      delete vinculoPayload.contrato_fecha_fin;
      delete vinculoPayload.cliente_id;
      vinculoPayload.bono = parseFloat(vinculoPayload.bono) || 0.00;

      if (editingVinculoId) {
        const { error: dbError } = await supabase
          .from("vinculos_laborales")
          .update(vinculoPayload)
          .eq("id", editingVinculoId);
        
        if (dbError) throw dbError;
        alert("Puesto laboral actualizado correctamente.");
      } else {
        const { data: newVinc, error: dbError } = await supabase
          .from("vinculos_laborales")
          .insert([vinculoPayload])
          .select("id")
          .single();
        
        if (dbError) throw dbError;
        
        // Save corresponding contract if values are provided
        if (newVinc && contractModalidadId && contractFechaInicio) {
          const { error: contractErr } = await supabase
            .from("contratos")
            .insert([{
              vinculo_laboral_id: newVinc.id,
              modalidad_contrato_id: contractModalidadId,
              fecha_inicio: contractFechaInicio,
              fecha_fin: contractFechaFin || null,
              estado: "Vigente"
            }]);
          if (contractErr) {
            console.error("Error creating associated contract:", contractErr);
            alert("Puesto creado, pero ocurrió un error al registrar su contrato inicial: " + contractErr.message);
          }
        }
      }

      setIsVinculoModalOpen(false);
      setEditingVinculoId(null);
      loadVinculos(activePersona.id);
      loadPersonas();
    } catch (err: any) {
      alert("Error al guardar puesto laboral: " + err.message);
    }
  };

  // Cese logic
  const handleOpenCese = (vinculoId: any) => {
    setCeseForm({
      vinculo_id: vinculoId,
      fecha_cese: new Date().toISOString().split("T")[0],
      motivo_cese: "Término de contrato"
    });
    setIsCeseModalOpen(true);
  };

  const handleSaveCese = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error: dbError } = await supabase
        .from("vinculos_laborales")
        .update({
          estado: "Inactivo",
          fecha_cese: ceseForm.fecha_cese,
          motivo_cese: ceseForm.motivo_cese
        })
        .eq("id", ceseForm.vinculo_id);

      if (dbError) throw dbError;

      // Update any active/Vigente contracts for this vinculo to Vencido
      await supabase
        .from("contratos")
        .update({ estado: "Vencido" })
        .eq("vinculo_laboral_id", ceseForm.vinculo_id)
        .eq("estado", "Vigente");

      setIsCeseModalOpen(false);
      loadVinculos(activePersona.id);
    } catch (err: any) {
      alert("Error al dar de baja: " + err.message);
    }
  };

  const handleDeleteVinculo = async (vinculoId: any) => {
    if (!confirm("¿Está seguro de eliminar este puesto (vínculo laboral) y todos sus contratos asociados de forma permanente? Esta acción borrará el registro por completo y no se puede deshacer.")) {
      return;
    }
    try {
      const { error: dbError } = await supabase
        .from("vinculos_laborales")
        .delete()
        .eq("id", vinculoId);

      if (dbError) throw dbError;

      if (activePersona) {
        loadVinculos(activePersona.id);
      }
    } catch (err: any) {
      alert("Error al eliminar puesto: " + err.message);
    }
  };

  // Seeding test personnel
  const [seeding, setSeeding] = useState(false);
  const handleSeedPersonnel = async () => {
    setSeeding(true);
    try {
      // Find a default document type and pension system
      const { data: firstDoc } = await supabase.from("tipos_documento").select("id").limit(1).single();
      const { data: firstPension } = await supabase.from("sistemas_pension").select("id").limit(1).single();

      if (!firstDoc || !firstPension) {
        alert("Primero debes precargar los Diccionarios de Datos en la Fase 1.");
        return;
      }

      await supabase.from("personas").insert([
        {
          tipo_documento_id: firstDoc.id,
          numero_documento: "74839201",
          nombres: "Juan Carlos",
          apellidos: "Pérez Ramos",
          sexo: "Masculino",
          fecha_nacimiento: "1992-05-15",
          direccion: "Av. Las Palmeras 123",
          telefono: "999888777",
          correo: "jperez@gmail.com",
          sistema_pension_id: firstPension.id,
          talla_polo: "M",
          talla_pantalon: "32",
          talla_calzado: "40",
          fecha_ultimo_emo: "2026-01-10"
        },
        {
          tipo_documento_id: firstDoc.id,
          numero_documento: "48291039",
          nombres: "Ana Sofía",
          apellidos: "Guzmán Loayza",
          sexo: "Femenino",
          fecha_nacimiento: "1995-10-22",
          direccion: "Calle Los Pinos 542",
          telefono: "987654321",
          correo: "aguzman@gmail.com",
          sistema_pension_id: firstPension.id,
          talla_polo: "S",
          talla_pantalon: "28",
          talla_calzado: "37",
          fecha_ultimo_emo: "2026-03-15"
        }
      ]);

      loadPersonas();
    } catch (err: any) {
      alert("Error al precargar personal: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  // Filter list
  // Helper to get labor entry date
  const getFechaIngreso = (p: any): string | null => {
    if (p.fecha_ingreso) return p.fecha_ingreso;
    if (!p.vinculos_laborales) return null;
    const dates = p.vinculos_laborales
      .flatMap((v: any) => v.contratos || [])
      .map((c: any) => c.fecha_inicio)
      .filter(Boolean);
    if (dates.length === 0) return null;
    dates.sort();
    return dates[0];
  };

  // Safe formatting helper to prevent timezone shift issues
  const formatDMY = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Export filtered people to Excel
  // Flat rows mapping each person + active vínculo (position) combination
  const tableRows = React.useMemo(() => {
    const list: any[] = [];
    personas.forEach(p => {
      // Find all active vínculos
      const activeVinculos = p.vinculos_laborales?.filter((v: any) => v.estado === "Activo") || [];
      
      if (activeVinculos.length > 0) {
        activeVinculos.forEach((v: any) => {
          list.push({
            id: `${p.id}-${v.id}`,
            persona: p,
            vinculo: v,
            isCesado: false
          });
        });
      } else {
        // If they have inactive vínculos, they are cesados, otherwise they are "sin puesto"
        const hasInactive = p.vinculos_laborales?.some((v: any) => v.estado === "Inactivo");
        list.push({
          id: `${p.id}-none`,
          persona: p,
          vinculo: null,
          isCesado: hasInactive
        });
      }
    });
    return list;
  }, [personas]);

  const uniqueClientes = React.useMemo(() => {
    const map = new Map<number, string>();
    sedes.forEach(s => {
      if (s.clientes) {
        if (!filterEmpresa || String(s.clientes.empresa_interna_id) === filterEmpresa) {
          map.set(s.clientes.id, s.clientes.razon_social);
        }
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sedes, filterEmpresa]);

  const filteredSedesForDropdown = React.useMemo(() => {
    return sedes.filter(s => {
      if (filterEmpresa && s.clientes && String(s.clientes.empresa_interna_id) !== filterEmpresa) {
        return false;
      }
      if (filterCliente && String(s.cliente_id) !== filterCliente) {
        return false;
      }
      return true;
    });
  }, [sedes, filterEmpresa, filterCliente]);

  // KPI Calculations
  const stats = React.useMemo(() => {
    const activePeopleIds = new Set(tableRows.filter(r => !r.isCesado).map(r => r.persona.id));
    const kpiActivosCount = activePeopleIds.size;

    const cesadoPeopleIds = new Set(tableRows.filter(r => r.isCesado).map(r => r.persona.id));
    const kpiCesadosCount = cesadoPeopleIds.size;

    let kpiContratosPorVencer = 0;
    let kpiContratosVencidos = 0;
    let kpiSinContrato = 0;

    let kpiEmosPorVencer = 0;
    let kpiEmosVencidos = 0;
    let kpiSinEmo = 0;

    let kpiVacacionesAlerta = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    personas.forEach(p => {
      const activeVinculos = p.vinculos_laborales?.filter((v: any) => v.estado === "Activo") || [];
      const isActive = activeVinculos.length > 0;

      if (isActive) {
        // Contract metrics
        activeVinculos.forEach((v: any) => {
          const activeContract = (v.contratos || []).find((c: any) => c.estado === "Vigente");
          if (!activeContract) {
            kpiSinContrato++;
          } else {
            if (activeContract.fecha_fin) {
              const end = new Date(activeContract.fecha_fin);
              end.setHours(0, 0, 0, 0);
              const diff = end.getTime() - today.getTime();
              const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
              if (diffDays < 0) {
                kpiContratosVencidos++;
              } else if (diffDays >= 0 && diffDays <= 30) {
                kpiContratosPorVencer++;
              }
            }
          }
        });

        // EMO metrics
        if (!p.fecha_ultimo_emo) {
          kpiSinEmo++;
        } else {
          const emoDate = new Date(p.fecha_ultimo_emo);
          emoDate.setHours(0, 0, 0, 0);
          const expDate = new Date(emoDate);
          expDate.setFullYear(expDate.getFullYear() + 1);
          
          const diff = expDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
          if (diffDays < 0) {
            kpiEmosVencidos++;
          } else if (diffDays >= 0 && diffDays <= 30) {
            kpiEmosPorVencer++;
          }
        }

        // Vacations metrics
        let hasVacationAlert = false;
        activeVinculos.forEach((v: any) => {
          const diasAnuales = v.regimenes_laborales?.dias_vacaciones ?? 30;
          const fIng = p.fecha_ingreso || getFechaIngreso(p);
          if (fIng) {
            const ingDate = new Date(fIng);
            ingDate.setHours(0, 0, 0, 0);
            const diffTime = Math.max(0, today.getTime() - ingDate.getTime());
            const years = diffTime / (1000 * 60 * 60 * 24 * 365.25);
            const diasGanados = years * diasAnuales;
            const diasGozados = v.vacaciones_historico?.reduce((sum: number, vac: any) => sum + (vac.dias_calendario || 0), 0) ?? 0;
            const net = Math.max(0, Math.floor(diasGanados - diasGozados));
            if (net >= (2 * diasAnuales) - 10) {
              hasVacationAlert = true;
            }
          }
        });
        if (hasVacationAlert) {
          kpiVacacionesAlerta++;
        }
      }
    });

    return {
      kpiActivosCount,
      kpiCesadosCount,
      kpiContratosPorVencer,
      kpiContratosVencidos,
      kpiSinContrato,
      kpiEmosPorVencer,
      kpiEmosVencidos,
      kpiSinEmo,
      kpiVacacionesAlerta
    };
  }, [tableRows, personas]);

  // Filter list reactively
  const filteredRows = tableRows.filter(row => {
    const p = row.persona;
    const v = row.vinculo;

    // 1. Tab filter
    if (filterTab === "activos") {
      if (row.isCesado) return false;
    } else {
      if (!row.isCesado) return false;
    }

    // 2. Text search
    const q = searchQuery.toLowerCase();
    if (q) {
      const fullName = `${p.nombres} ${p.apellidos}`.toLowerCase();
      const matchesSearch = fullName.includes(q) || p.numero_documento.includes(q) || (p.correo && p.correo.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }

    // 3. Sede filter
    if (filterSede) {
      if (!v || String(v.sede_id) !== filterSede) return false;
    }

    // 4. Empresa filter
    if (filterEmpresa) {
      if (!v || String(v.empresa_interna_id) !== filterEmpresa) return false;
    }

    // 5. Date ranges
    const fIngreso = getFechaIngreso(p);
    if (filterFechaDesde) {
      if (!fIngreso || fIngreso < filterFechaDesde) return false;
    }
    if (filterFechaHasta) {
      if (!fIngreso || fIngreso > filterFechaHasta) return false;
    }

    // 6. Contrato filters (Estado y Expiración)
    const activeContract = v?.contratos?.find((c: any) => c.estado === "Vigente");
    
    let contractStatus = "sin_puesto";
    if (v) {
      if (activeContract) {
        if (!activeContract.fecha_fin) {
          contractStatus = "indeterminado";
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const end = new Date(activeContract.fecha_fin);
          end.setHours(0, 0, 0, 0);
          const diffTime = end.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            contractStatus = "vencido";
          } else if (diffDays <= 30) {
            contractStatus = "por_vencer";
          } else {
            contractStatus = "vigente";
          }
        }
      } else {
        contractStatus = "sin_contrato";
      }
    } else if (row.isCesado) {
      contractStatus = "cesado";
    } else {
      contractStatus = "sin_puesto";
    }

    if (filterEstadoContrato) {
      if (filterEstadoContrato === "sin_contrato" && contractStatus !== "sin_contrato") return false;
      if (filterEstadoContrato === "vigente" && contractStatus !== "vigente" && contractStatus !== "indeterminado") return false;
      if (filterEstadoContrato === "por_vencer" && contractStatus !== "por_vencer") return false;
      if (filterEstadoContrato === "vencido" && contractStatus !== "vencido") return false;
      if (filterEstadoContrato === "cesado" && contractStatus !== "cesado") return false;
      if (filterEstadoContrato === "sin_puesto" && contractStatus !== "sin_puesto") return false;
    }

    if (filterFechaVencimiento) {
      if (!activeContract || !activeContract.fecha_fin || activeContract.fecha_fin > filterFechaVencimiento) {
        return false;
      }
    }

    if (filterCliente) {
      if (!v || !v.sedes || String(v.sedes.cliente_id) !== filterCliente) return false;
    }

    if (filterVacacionesAlerta) {
      let hasAlert = false;
      if (v && v.estado === "Activo") {
        const diasAnuales = v.regimenes_laborales?.dias_vacaciones ?? 30;
        const fIng = p.fecha_ingreso || getFechaIngreso(p);
        if (fIng) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const ingDate = new Date(fIng);
          ingDate.setHours(0, 0, 0, 0);
          const diffTime = Math.max(0, today.getTime() - ingDate.getTime());
          const years = diffTime / (1000 * 60 * 60 * 24 * 365.25);
          const diasGanados = years * diasAnuales;
          const diasGozados = v.vacaciones_historico?.reduce((sum: number, vac: any) => sum + (vac.dias_calendario || 0), 0) ?? 0;
          const net = Math.max(0, Math.floor(diasGanados - diasGozados));
          if (net >= (2 * diasAnuales) - 10) {
            hasAlert = true;
          }
        }
      }
      if (filterVacacionesAlerta === "si" && !hasAlert) return false;
      if (filterVacacionesAlerta === "no" && hasAlert) return false;
    }

    // 7. Inconsistencia filter
    if (filterInconsistencia) {
      const belongsToCompany = v?.sedes?.clientes?.empresa_interna_id === v?.empresa_interna_id;
      if (!v || belongsToCompany) return false;
    }

    // 8. Cuenta Sueldo filter
    if (filterCuentaSueldo) {
      if (filterCuentaSueldo === "tiene_nro") {
        if (!p.cuenta_sueldo || p.cuenta_sueldo === "TIENE_CUENTA" || p.cuenta_sueldo === "POR_AFILIAR") return false;
      } else if (filterCuentaSueldo === "tiene_cuenta") {
        if (p.cuenta_sueldo !== "TIENE_CUENTA") return false;
      } else if (filterCuentaSueldo === "por_afiliar") {
        if (p.cuenta_sueldo !== "POR_AFILIAR") return false;
      } else if (filterCuentaSueldo === "sin_cuenta") {
        if (p.cuenta_sueldo && p.cuenta_sueldo.trim() !== "") return false;
      } else if (filterCuentaSueldo === "subsanar") {
        if (p.cuenta_sueldo !== "TIENE_CUENTA" && p.cuenta_sueldo !== "POR_AFILIAR") return false;
      }
    }

    return true;
  });

  const paginatedPersonas = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const filteredPersonas = paginatedPersonas;

  // New Export function for Excel
  const exportPersonasToExcel = () => {
    const headers = [
      "Tipo Documento", "Número Documento", "Apellidos", "Nombres", "Sexo", 
      "Empresa Planilla", "Cliente", "Sede Operativa", "Cargo", "Régimen Laboral",
      "Sueldo Básico", "Bono", "Asignación Familiar", "F. Ingreso", 
      "Inicio Contrato", "Fin Contrato", "Estado Contrato", 
      "Régimen Pensionario", "CUSSP", "Banco Sueldo", "Cuenta Sueldo",
      "Banco CTS", "Cuenta CTS",
      "Último EMO", "Teléfono", "Correo", "Talla Polo", "Talla Pantalón", "Talla Calzado"
    ];

    const rows = filteredRows.map(row => {
      const p = row.persona;
      const v = row.vinculo;
      const fIng = getFechaIngreso(p);
      
      const activeContract = v?.contratos?.find((c: any) => c.estado === "Vigente");
      let cEstado = "Sin Contrato";
      if (v) {
        if (activeContract) {
          if (!activeContract.fecha_fin) cEstado = "Indeterminado";
          else {
            const today = new Date();
            today.setHours(0,0,0,0);
            const end = new Date(activeContract.fecha_fin);
            const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000*60*60*24));
            cEstado = diffDays < 0 ? "Vencido" : `${diffDays}d`;
          }
        }
      } else if (row.isCesado) {
        cEstado = "Cesado";
      }

      // Bank lookups
      const bancoSueldoNombre = bancos.find(b => b.id === p.banco_sueldo_id)?.nombre || "-";
      const bancoCtsNombre = bancos.find(b => b.id === p.banco_cts_id)?.nombre || "-";

      return [
        p.tipos_documento?.codigo || "DNI",
        p.numero_documento,
        p.apellidos,
        p.nombres,
        p.sexo,
        v?.empresas_internas?.razon_social || "Sin Puesto Activo",
        v?.sedes?.clientes?.razon_social || "-",
        v?.sedes?.nombre || "-",
        v?.cargos?.nombre || "-",
        v?.regimenes_laborales?.nombre || "-",
        v ? (v.sueldo_basico !== undefined && v.sueldo_basico !== null ? parseFloat(v.sueldo_basico) : 0) : "-",
        v ? (v.bono !== undefined && v.bono !== null ? parseFloat(v.bono) : 0) : "-",
        v ? (v.asignacion_familiar ? "Sí" : "No") : "-",
        fIng ? fIng.split("-").reverse().join("-") : "-",
        activeContract?.fecha_inicio ? activeContract.fecha_inicio.split("-").reverse().join("-") : "-",
        activeContract?.fecha_fin ? activeContract.fecha_fin.split("-").reverse().join("-") : "-",
        cEstado,
        p.sistemas_pension?.nombre || "-",
        p.codigo_cuss_afp || "-",
        bancoSueldoNombre,
        p.cuenta_sueldo === "TIENE_CUENTA"
          ? "Tiene Cuenta (Pendiente)"
          : p.cuenta_sueldo === "POR_AFILIAR"
          ? "Por Afiliar"
          : p.cuenta_sueldo || "-",
        bancoCtsNombre,
        p.cuenta_cts || "-",
        p.fecha_ultimo_emo ? p.fecha_ultimo_emo.split("-").reverse().join("-") : "-",
        p.telefono || "",
        p.correo || "",
        p.talla_polo || "",
        p.talla_pantalon || "",
        p.talla_calzado || ""
      ];
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Personal y Puestos");
    XLSX.writeFile(wb, "reporte_personal_y_puestos.xlsx");
  };

  const filteredSedesForVinculo = sedes
    .filter(s => s.cliente_id === vinculoForm.cliente_id)
    .filter(s => s.nombre.toLowerCase().includes(sedeSearchText.toLowerCase()));

  const filteredCargosForVinculo = cargos
    .filter(c => c.nombre.toLowerCase().includes(cargoSearchText.toLowerCase()));

  const filteredSedesForCreation = sedes
    .filter(s => s.cliente_id === personaForm.cliente_id)
    .filter(s => s.nombre.toLowerCase().includes(creationSedeSearchText.toLowerCase()));

  const filteredCargosForCreation = cargos
    .filter(c => c.nombre.toLowerCase().includes(creationCargoSearchText.toLowerCase()));

  const handleSedeBlur = () => {
    setTimeout(() => {
      setShowSedeDropdown(false);
      const selectedSede = sedes.find(s => s.id === vinculoForm.sede_id);
      if (selectedSede) {
        setSedeSearchText(selectedSede.nombre);
      } else {
        setSedeSearchText("");
      }
    }, 200);
  };

  const handleCargoBlur = () => {
    setTimeout(() => {
      setShowCargoDropdown(false);
      const selectedCargo = cargos.find(c => c.id === vinculoForm.cargo_id);
      if (selectedCargo) {
        setCargoSearchText(selectedCargo.nombre);
      } else {
        setCargoSearchText("");
      }
    }, 200);
  };

  const handleCreationSedeBlur = () => {
    setTimeout(() => {
      setShowCreationSedeDropdown(false);
      const selectedSede = sedes.find(s => s.id === personaForm.sede_id);
      if (selectedSede) {
        setCreationSedeSearchText(selectedSede.nombre);
      } else {
        setCreationSedeSearchText("");
      }
    }, 200);
  };

  const handleCreationCargoBlur = () => {
    setTimeout(() => {
      setShowCreationCargoDropdown(false);
      const selectedCargo = cargos.find(c => c.id === personaForm.cargo_id);
      if (selectedCargo) {
        setCreationCargoSearchText(selectedCargo.nombre);
      } else {
        setCreationCargoSearchText("");
      }
    }, 200);
  };

  const handleOpenAddContractQuick = (vinculoId: number) => {
    setQuickContratoForm({
      vinculo_laboral_id: vinculoId,
      modalidad_contrato_id: modalidades[0]?.id || "",
      fecha_inicio: new Date().toISOString().split("T")[0],
      fecha_fin: "",
      estado: "Vigente",
      archivo_pdf: ""
    });
    setIsQuickContratoModalOpen(true);
  };

  const handleSaveQuickContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...quickContratoForm };
      if (!payload.fecha_fin) {
        payload.fecha_fin = null;
      }
      
      // Archive existing active contracts
      await supabase
        .from("contratos")
        .update({ estado: "Renovado" })
        .eq("vinculo_laboral_id", payload.vinculo_laboral_id)
        .eq("estado", "Vigente");

      const { error: dbError } = await supabase
        .from("contratos")
        .insert([payload]);
      
      if (dbError) throw dbError;
      
      setIsQuickContratoModalOpen(false);
      loadPersonas();
    } catch (err: any) {
      alert("Error al registrar contrato: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto pr-1">
      
      {/* 1. VIEW MODE: LIST OF WORKERS */}
      {viewMode === "list" && (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 flex-shrink-0 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Recursos Humanos
              </span>
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <UserSquare className="w-8 h-8 text-blue-600" />
                Módulo de Personal
              </h1>
              <p className="text-sm text-slate-500 max-w-xl">
                Gestión de recursos humanos, contratos y EMOs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {personas.length === 0 && !loading && (
                <button
                  onClick={handleSeedPersonnel}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${seeding ? "animate-spin" : ""}`} />
                  Precargar Colaboradores
                </button>
              )}
              <button 
                onClick={() => {
                  setImportRows([]);
                  setImportStatus({ processed: 0, total: 0, errors: [], successCount: 0 });
                  setViewMode("import");
                }}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 stroke-[3]" />
                Importar Masivo
              </button>
              <button 
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                Registrar Persona
              </button>
            </div>
          </div>

          {/* Bento Grid KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-shrink-0">
            {/* KPI 1: Contratos */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-2.5">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
                  <FileText className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Contratos Críticos</span>
                  <span className="text-xl font-black text-rose-650 flex items-baseline gap-1">
                    {stats.kpiContratosVencidos + stats.kpiSinContrato}
                    <span className="text-[10px] font-bold text-slate-400 font-normal">vencidos / sin puesto</span>
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-2 grid grid-cols-2 gap-1 text-center">
                <div className="border-r border-slate-100">
                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Por Vencer</span>
                  <span className="text-xs font-extrabold text-amber-600">{stats.kpiContratosPorVencer} <span className="text-[9px] text-slate-400 font-normal">pers.</span></span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Sin Contrato</span>
                  <span className="text-xs font-extrabold text-slate-600">{stats.kpiSinContrato} <span className="text-[9px] text-slate-400 font-normal">pers.</span></span>
                </div>
              </div>
            </div>

            {/* KPI 2: EMOs */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-2.5">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
                  <Activity className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">EMOs Críticos</span>
                  <span className="text-xl font-black text-red-655 flex items-baseline gap-1">
                    {stats.kpiEmosVencidos + stats.kpiSinEmo}
                    <span className="text-[10px] font-bold text-slate-400 font-normal">vencidos / sin registro</span>
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-2 grid grid-cols-2 gap-1 text-center">
                <div className="border-r border-slate-100">
                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Por Vencer</span>
                  <span className="text-xs font-extrabold text-red-550">{stats.kpiEmosPorVencer} <span className="text-[9px] text-slate-400 font-normal">pers.</span></span>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Sin Registro</span>
                  <span className="text-xs font-extrabold text-slate-600">{stats.kpiSinEmo} <span className="text-[9px] text-slate-400 font-normal">pers.</span></span>
                </div>
              </div>
            </div>

            {/* KPI 3: Alerta Vacaciones */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-2.5">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                  <Calendar className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Alerta Vacaciones</span>
                  <span className="text-xl font-black text-amber-600 flex items-baseline gap-1">
                    {stats.kpiVacacionesAlerta}
                    <span className="text-[10px] font-bold text-slate-455 font-normal">personas en alerta</span>
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-2 text-center">
                <p className="text-[9px] font-medium text-slate-400 leading-tight">
                  Colaboradores activos con <strong>2 periodos acumulados</strong> (o a menos de 10 días de alcanzarlos).
                </p>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden flex-1 min-h-[400px]">
            {/* Search and Filters Toolbar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/10 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 max-w-3xl">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por Nombre, DNI o Correo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                    />
                  </div>

                  {/* Ingreso Desde / Hasta inputs */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ingreso:</span>
                      <input
                        type="date"
                        value={filterFechaDesde}
                        onChange={(e) => setFilterFechaDesde(e.target.value)}
                        className="border-none text-xs text-slate-600 focus:outline-none font-mono bg-transparent"
                        title="Fecha de Ingreso Desde"
                      />
                      <span className="text-slate-300 text-[10px] font-bold">a</span>
                      <input
                        type="date"
                        value={filterFechaHasta}
                        onChange={(e) => setFilterFechaHasta(e.target.value)}
                        className="border-none text-xs text-slate-600 focus:outline-none font-mono bg-transparent"
                        title="Fecha de Ingreso Hasta"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                    <button
                      onClick={() => setFilterTab("activos")}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer ${
                        filterTab === "activos"
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-700 bg-transparent"
                      }`}
                    >
                      Activos ({stats.kpiActivosCount})
                    </button>
                    <button
                      onClick={() => setFilterTab("cesados")}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer ${
                        filterTab === "cesados"
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-700 bg-transparent"
                      }`}
                    >
                      Cesados ({stats.kpiCesadosCount})
                    </button>
                  </div>

                  {/* Filtro Inconsistencias */}
                  <label className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100/75 text-amber-800 px-3 py-2 rounded-lg text-xs font-bold border border-amber-200 shadow-sm cursor-pointer select-none transition-colors">
                    <input
                      type="checkbox"
                      checked={filterInconsistencia}
                      onChange={(e) => setFilterInconsistencia(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer accent-amber-600"
                    />
                    <span>⚠️ Con Inconsistencias</span>
                  </label>

                  <button 
                    onClick={exportPersonasToExcel}
                    className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-xs font-semibold border border-blue-200 transition-colors shadow-sm cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" />
                    Exportar Excel
                  </button>
                  {(filterSede || filterEmpresa || filterFechaDesde || filterFechaHasta || filterEstadoContrato || filterFechaVencimiento || filterCliente || filterVacacionesAlerta || filterInconsistencia || filterCuentaSueldo) && (
                    <button
                      onClick={() => {
                        setFilterSede("");
                        setFilterEmpresa("");
                        setFilterFechaDesde("");
                        setFilterFechaHasta("");
                        setFilterEstadoContrato("");
                        setFilterFechaVencimiento("");
                        setFilterCliente("");
                        setFilterVacacionesAlerta("");
                        setFilterInconsistencia(false);
                        setFilterCuentaSueldo("");
                      }}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 text-xs font-medium px-2 py-1 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    >
                      Limpiar Filtros
                    </button>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                {/* Empresa Select */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Filtrar por Empresa</label>
                  <select
                    value={filterEmpresa}
                    onChange={(e) => {
                      const nextEmp = e.target.value;
                      setFilterEmpresa(nextEmp);
                      if (nextEmp) {
                        const belongs = sedes.some(s => s.clientes && String(s.clientes.id) === filterCliente && String(s.clientes.empresa_interna_id) === nextEmp);
                        if (!belongs) {
                          setFilterCliente("");
                        }
                        const SedeBelongs = sedes.some(s => String(s.id) === filterSede && s.clientes && String(s.clientes.empresa_interna_id) === nextEmp);
                        if (!SedeBelongs) {
                          setFilterSede("");
                        }
                      }
                    }}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-600 cursor-pointer"
                  >
                    <option value="">Todas las Empresas</option>
                    {empresas.map(e => (
                      <option key={e.id} value={e.id}>{e.razon_social}</option>
                    ))}
                  </select>
                </div>

                {/* Cliente Select */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Filtrar por Cliente</label>
                  <select
                    value={filterCliente}
                    onChange={(e) => {
                      const nextCli = e.target.value;
                      setFilterCliente(nextCli);
                      if (nextCli) {
                        const belongs = sedes.some(s => String(s.id) === filterSede && String(s.cliente_id) === nextCli);
                        if (!belongs) {
                          setFilterSede("");
                        }
                      }
                    }}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-600 cursor-pointer"
                  >
                    <option value="">Todos los Clientes</option>
                    {uniqueClientes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Sede Select */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Filtrar por Sede</label>
                  <select
                    value={filterSede}
                    onChange={(e) => setFilterSede(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-600 cursor-pointer"
                  >
                    <option value="">Todas las Sedes</option>
                    {filteredSedesForDropdown.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Estado Contrato Select */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estado Contrato</label>
                  <select
                    value={filterEstadoContrato}
                    onChange={(e) => setFilterEstadoContrato(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-600 cursor-pointer"
                  >
                    <option value="">Todos los Estados</option>
                    <option value="vigente">Vigente</option>
                    <option value="por_vencer">Por Vencer (≤30 días)</option>
                    <option value="vencido">Vencido</option>
                    <option value="sin_contrato">Sin Contrato</option>
                    <option value="sin_puesto">Sin Puesto Activo</option>
                  </select>
                </div>

                {/* Fecha Vencimiento Hasta */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Vence Hasta</label>
                  <input
                    type="date"
                    value={filterFechaVencimiento}
                    onChange={(e) => setFilterFechaVencimiento(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-600 font-mono"
                  />
                </div>

                {/* Alerta Vacaciones Select */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Alerta Vacaciones</label>
                  <select
                    value={filterVacacionesAlerta}
                    onChange={(e) => setFilterVacacionesAlerta(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-600 cursor-pointer"
                  >
                    <option value="">Todas las Vacaciones</option>
                    <option value="si">Con Alertas (&gt;= 2 periodos o cerca)</option>
                    <option value="no">Sin Alertas</option>
                  </select>
                </div>

                {/* Cuenta Sueldo Select */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cuenta Sueldo</label>
                  <select
                    value={filterCuentaSueldo}
                    onChange={(e) => setFilterCuentaSueldo(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-600 cursor-pointer"
                  >
                    <option value="">Todas las Cuentas</option>
                    <option value="tiene_nro">Con Nro. Cuenta</option>
                    <option value="tiene_cuenta">Tiene Cuenta (Pendiente Nro.)</option>
                    <option value="por_afiliar">Por Afiliar</option>
                    <option value="sin_cuenta">Sin Cuenta / Vacío</option>
                    <option value="subsanar">Pendiente Subsanación</option>
                  </select>
                </div>
              </div>
              
              {error && (
                <div className="bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2">
                  <X className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto relative">
              {loading && personas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-sm font-medium">Buscando fichas maestras...</p>
                </div>
              ) : filteredPersonas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100">
                    <UserSquare className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">No hay colaboradores registrados</h3>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                      <th className="px-6 py-4 bg-slate-50">DOCUMENTO</th>
                      <th className="px-6 py-4 bg-slate-50">NOMBRES</th>
                      <th className="px-6 py-4 bg-slate-50">EMPRESA / PUESTO</th>
                      <th className="px-6 py-4 bg-slate-50">CONTACTO</th>
                      <th className="px-6 py-4 bg-slate-50">TALLAS</th>
                      <th className="px-6 py-4 bg-slate-50">INICIO 1ER CONTRATO</th>
                      <th className="px-6 py-4 bg-slate-50 text-center">CONTRATO VIGENTE</th>
                      <th className="px-6 py-4 bg-slate-50 text-center">ESTADO CONTRATO</th>
                      <th className="px-6 py-4 bg-slate-50 text-center">VENC. EMO</th>
                      <th className="px-6 py-4 bg-slate-50 text-right">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPersonas.map((row) => {
                      const p = row.persona;
                      const v = row.vinculo;
                      const activeContract = v?.contratos?.find((c: any) => c.estado === "Vigente");
                      
                      const getStatusBadge = (contract: any, hasActiveVinc: boolean) => {
                        if (!hasActiveVinc) {
                          if (row.isCesado) {
                            return { 
                              label: "Cesado - Vínculo Inactivo", 
                              badgeClass: "bg-slate-100 text-slate-500 border-slate-200" 
                            };
                          }
                          return { 
                            label: "Sin Puesto", 
                            badgeClass: "bg-slate-100 text-slate-400 border-slate-200" 
                          };
                        }
                        if (!contract) {
                          return { 
                            label: "Sin Contrato", 
                            badgeClass: "bg-red-100 text-red-700 border-red-200 font-bold" 
                          };
                        }
                        
                        if (!contract.fecha_fin) {
                          return { 
                            label: "Indeterminado", 
                            badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold" 
                          };
                        }
                        
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const end = new Date(contract.fecha_fin);
                        end.setHours(0, 0, 0, 0);
                        const diffTime = end.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays < 0) {
                          return { 
                            label: "Vencido", 
                            badgeClass: "bg-red-100 text-red-800 border-red-200 font-bold" 
                          };
                        }
                        if (diffDays <= 15) {
                          return { 
                            label: `Faltan ${diffDays} d (Crítico)`, 
                            badgeClass: "bg-red-50 text-red-650 border-red-200 font-bold animate-pulse" 
                          };
                        }
                        if (diffDays <= 30) {
                          return { 
                            label: `Faltan ${diffDays} d (Alerta)`, 
                            badgeClass: "bg-amber-50 text-amber-700 border-amber-200 font-bold" 
                          };
                        }
                        return { 
                          label: `Faltan ${diffDays} d`, 
                          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold" 
                        };
                      };
                      
                      const getEmoDisplay = (fechaEmoStr: string | null) => {
                        if (!fechaEmoStr) return <span className="text-slate-400 font-semibold">-</span>;
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const emo = new Date(fechaEmoStr);
                        emo.setFullYear(emo.getFullYear() + 1);
                        const diff = emo.getTime() - today.getTime();
                        const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
                        
                        if (diffDays < 0) {
                          return (
                            <span className="inline-flex px-2 py-0.5 bg-red-100 text-red-800 border border-red-200 text-[10px] font-bold rounded-full">
                              Vencido ({Math.abs(diffDays)}d)
                            </span>
                          );
                        }
                        if (diffDays <= 30) {
                          return (
                            <span className="inline-flex px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-full animate-pulse">
                              Faltan {diffDays} d
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full">
                            Faltan {diffDays} d
                          </span>
                        );
                      };

                      const getVacationsBadge = () => {
                        if (!v) return null;
                        const diasAnuales = v.regimenes_laborales?.dias_vacaciones ?? 30;
                        const fIng = p.fecha_ingreso || getFechaIngreso(p);
                        if (!fIng) return null;
                        
                        const today = new Date();
                        const ing = new Date(fIng);
                        const diffTime = Math.max(0, today.getTime() - ing.getTime());
                        const years = diffTime / (1000 * 60 * 60 * 24 * 365.25);
                        const diasGanados = years * diasAnuales;
                        const diasGozados = v.vacaciones_historico?.reduce((sum: number, vac: any) => sum + (vac.dias_calendario || 0), 0) ?? 0;
                        const net = Math.max(0, Math.floor(diasGanados - diasGozados));
                        if (net === 0) return null;
                        
                        const periodos = Math.floor(net / diasAnuales);
                        const hasContract = v.contratos?.some((c: any) => c.estado === "Vigente");
                        return (
                          <div className="mt-1 flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-100 px-1.5 py-0.5 rounded">
                              Vacaciones: {periodos} per. acumulados ({net} d)
                            </span>
                            {!hasContract && (
                              <span className="text-[9px] text-red-500 font-semibold flex items-center gap-0.5">
                                ⚠️ Sin contrato vigente (cálculo por Fecha Ingreso)
                              </span>
                            )}
                          </div>
                        );
                      };

                      const badge = getStatusBadge(activeContract, !!v);
                      
                      return (
                        <tr key={row.id} className="hover:bg-slate-50/40 transition-colors text-slate-700">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-slate-800 font-mono">
                              {p.numero_documento}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                              {p.tipos_documento?.codigo || "DNI"}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-semibold text-slate-800">
                              {p.apellidos}, {p.nombres}
                            </div>
                            <div className="flex flex-col gap-1 items-start mt-1">
                              {p.cuenta_sueldo === "TIENE_CUENTA" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-850 border border-amber-100 px-1.5 py-0.5 rounded">
                                  💳 Tiene Cuenta (Nro Pendiente)
                                </span>
                              )}
                              {p.cuenta_sueldo === "POR_AFILIAR" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-100 px-1.5 py-0.5 rounded">
                                  🏦 Por Afiliar
                                </span>
                              )}
                            </div>
                            {getVacationsBadge()}
                          </td>
                          <td className="px-6 py-4">
                            {v ? (
                              <>
                                <div className="text-sm font-semibold text-slate-750">
                                  {v.empresas_internas?.razon_social}
                                </div>
                                <div className="text-xs text-slate-500 font-medium">
                                  {v.cargos?.nombre}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  Sede: {v.sedes?.nombre} {v.sedes?.clientes?.razon_social ? `(${v.sedes.clientes.razon_social})` : ""}
                                </div>
                                {(() => {
                                  const belongsToCompany = v.sedes?.clientes?.empresa_interna_id === v.empresa_interna_id;
                                  if (!belongsToCompany) {
                                    return (
                                      <div className="mt-1.5">
                                        {!v.excepcion_aprobada ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider animate-pulse">
                                            ⚠️ Inconsistencia (Por Aprobar)
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-250 uppercase tracking-wider">
                                            ⚠️ Inconsistencia (Aprobado)
                                          </span>
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </>
                            ) : (
                              row.isCesado ? (
                                <span className="text-xs text-slate-400 italic">Cesado - Vínculo Inactivo</span>
                              ) : (
                                <span className="inline-flex px-2.5 py-1 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase">
                                  ⚠️ Sin Puesto Activo
                                </span>
                              )
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-700">{p.telefono || "-"}</div>
                            <div className="text-xs text-slate-400 font-mono">{p.correo || "-"}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold" title="Polo">P: {p.talla_polo || "-"}</span>
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold" title="Pantalón">T: {p.talla_pantalon || "-"}</span>
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold" title="Calzado">C: {p.talla_calzado || "-"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono font-bold">
                            {formatDMY(getFechaIngreso(p))}
                          </td>
                          <td className="px-6 py-4 text-center text-xs font-mono">
                            {v ? (
                              activeContract ? (
                                <div className="inline-block px-2.5 py-1 bg-slate-50 rounded border border-slate-100">
                                  <span className="font-semibold text-slate-500">Ini:</span> {formatDMY(activeContract.fecha_inicio)}<br/>
                                  <span className="font-semibold text-slate-500">Fin:</span> {activeContract.fecha_fin ? formatDMY(activeContract.fecha_fin) : "Indet."}
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    sessionStorage.setItem("autoSelectContractPersonaId", p.id.toString());
                                    window.dispatchEvent(new CustomEvent("navigate-to", { detail: { path: "/rrhh/contratos" } }));
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-red-650 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded transition-all cursor-pointer shadow-sm"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  Crear Contrato
                                </button>
                              )
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.badgeClass}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {getEmoDisplay(p.fecha_ultimo_emo)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedPersonaForHistory(p);
                                  setIsContractHistoryModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                title="Ver Historial de Contratos / Renovaciones"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenView(p)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                title="Ver Vínculos / Puesto"
                              >
                                <Briefcase className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(p)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Editar Ficha"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenDeleteConfirm(p)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Eliminar Ficha"
                              >
                                <Trash2 className="w-4 h-4" />
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

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/10 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 text-xs text-slate-500 font-medium font-sans">
              <div className="flex items-center gap-4 flex-wrap">
                <span>Total: <strong className="text-slate-800 font-bold">{filteredRows.length}</strong> colaboradores registrados</span>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5">
                  <span>Mostrar</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 border border-slate-200 rounded bg-white text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>por pág.</span>
                </div>
              </div>

              {filteredRows.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="mr-2 text-slate-500">
                    Mostrando <strong className="text-slate-700 font-bold">{(currentPage - 1) * pageSize + 1}</strong> - <strong className="text-slate-700 font-bold">{Math.min(currentPage * pageSize, filteredRows.length)}</strong>
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors cursor-pointer"
                    >
                      Ant.
                    </button>
                    
                    {(() => {
                      const totalPages = Math.ceil(filteredRows.length / pageSize);
                      const pages: (number | string)[] = [];
                      for (let i = 1; i <= totalPages; i++) {
                        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                          if (pages.length > 0) {
                            const lastPage = pages[pages.length - 1];
                            if (typeof lastPage === "number" && i - lastPage > 1) {
                              pages.push("...");
                            }
                          }
                          pages.push(i);
                        }
                      }
                      
                      return pages.map((page, idx) => {
                        if (page === "...") {
                          return <span key={`ellipse-${idx}`} className="px-1 text-slate-400">...</span>;
                        }
                        return (
                          <button
                            type="button"
                            key={page}
                            onClick={() => setCurrentPage(page as number)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                              currentPage === page
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      });
                    })()}

                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredRows.length / pageSize), prev + 1))}
                      disabled={currentPage === Math.ceil(filteredRows.length / pageSize)}
                      className="px-2.5 py-1 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors cursor-pointer"
                    >
                      Sig.
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Excel Import View */}
      {viewMode === "import" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-5xl mx-auto w-full space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al Listado
              </button>
              <div className="space-y-0.5">
                <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                  Importar Personal y Contratos Masivamente
                </h2>
                <p className="text-xs text-slate-500">
                  Sube tu archivo de plantilla en formato Excel (.xlsx) para registrar colaboradores, puestos y contratos en un solo paso.
                </p>
              </div>
            </div>
            <button 
              onClick={() => setViewMode("list")}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Workflow Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between space-y-3">
              <div>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs mb-2">1</span>
                <h4 className="text-xs font-bold text-slate-700">Descarga la Plantilla</h4>
                <p className="text-[11px] text-slate-500 mt-1">Obtén el formato estructurado de Excel (.xlsx) con todos los campos requeridos y ejemplos de llenado en formato DD-MM-YYYY.</p>
              </div>
              <button 
                type="button"
                onClick={downloadExcelTemplate}
                className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                Descargar Excel (.xlsx)
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between space-y-3 text-center">
              <div>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs mb-2">2</span>
                <h4 className="text-xs font-bold text-slate-700">Llena los Datos</h4>
                <p className="text-[11px] text-slate-500 mt-1">Completa los datos en Excel. Recuerda registrar fechas en formato DD-MM-YYYY (ej. 20-08-1990) y mantener los nombres de catálogos exactos.</p>
              </div>
              <span className="text-[10px] text-slate-400 font-mono italic">Registrar fechas: DD-MM-YYYY</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between space-y-3">
              <div>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs mb-2">3</span>
                <h4 className="text-xs font-bold text-slate-700">Sube y Valida</h4>
                <p className="text-[11px] text-slate-500 mt-1">Sube el archivo Excel. El sistema validará automáticamente cada fila y podrás inspeccionar errores con el botón de ojo.</p>
              </div>
              <label className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors text-center animate-pulse">
                <Upload className="w-4 h-4" />
                Seleccionar Excel (.xlsx)
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          {/* Import Progress Bar */}
          {(importing || importStatus.processed > 0) && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-blue-800">
                <span>Estado de la Importación</span>
                <span>Procesado: {importStatus.processed} de {importStatus.total}</span>
              </div>
              <div className="w-full bg-blue-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${importStatus.total > 0 ? (importStatus.processed / importStatus.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-blue-600 font-medium">
                <span>Éxito: {importStatus.successCount} registros</span>
                <span>Errores: {importStatus.errors.length}</span>
              </div>

              {importStatus.errors.length > 0 && (
                <div className="bg-white border border-red-100 p-3 rounded-lg max-h-32 overflow-y-auto text-[10px] text-red-600 font-mono space-y-1">
                  {importStatus.errors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Table Preview */}
          {importRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 p-4 rounded-xl border border-slate-100 gap-3">
                <span className="text-xs font-bold text-slate-700">
                  Vista Previa del Archivo ({importRows.length} filas detectadas, {importRows.filter(r => r.isValid).length} listas)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportRows([]);
                      setViewMode("list");
                    }}
                    className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-200"
                  >
                    Cancelar
                  </button>
                  {importRows.some(r => !r.isValid || r.warnings.length > 0) && (
                    <button
                      onClick={downloadErrorReport}
                      className="py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-red-200 transition-all cursor-pointer"
                    >
                      <FileDown className="w-4 h-4" />
                      Exportar Reporte Errores
                    </button>
                  )}
                  {importRows.filter(r => r.isValid).length > 0 && (
                    <button
                      onClick={executeImport}
                      disabled={importing}
                      className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-100 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                      Iniciar Importación
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/40 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-3">Fila</th>
                      <th className="px-4 py-3">DNI / Personal</th>
                      <th className="px-4 py-3">Puesto / Sede</th>
                      <th className="px-4 py-3 text-right font-medium">Sueldo</th>
                      <th className="px-4 py-3">Contrato (Inicio / Fin)</th>
                      <th className="px-4 py-3 text-center">Validación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(() => {
                      const readyCount = importRows.filter(r => r.isValid && r.warnings.length === 0).length;
                      const problemRows = importRows.filter(r => !r.isValid || r.warnings.length > 0);

                      return (
                        <>
                          {readyCount > 0 && (
                            <tr className="bg-emerald-50/10 hover:bg-emerald-50/20 transition-colors border-l-4 border-emerald-500">
                              <td className="px-4 py-4 font-mono font-bold text-slate-400">-</td>
                              <td className="px-4 py-4" colSpan={2}>
                                <div className="font-bold text-emerald-800 flex items-center gap-2 text-sm">
                                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                  {readyCount} colaboradores listos para importar
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                  Registros sin errores ni advertencias detectados en la plantilla. Se omiten de forma individual para facilitar la revisión de problemas.
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right font-semibold text-slate-400">-</td>
                              <td className="px-4 py-4 font-mono text-[10px] text-slate-400">-</td>
                              <td className="px-4 py-4 text-center">
                                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 text-[10px] font-bold">
                                  Listo ({readyCount})
                                </span>
                              </td>
                            </tr>
                          )}

                          {problemRows.map((row) => (
                            <tr 
                              key={row.rowNumber} 
                              className={`hover:bg-slate-50/20 transition-colors ${
                                !row.isValid ? "bg-red-50/5" : "bg-amber-50/5"
                              }`}
                            >
                              <td className="px-4 py-3 font-mono font-bold text-slate-400">
                                {row.rowNumber}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-800">{row.nombres}</div>
                                <div className="text-[10px] text-slate-500 font-mono">DNI: {row.dni}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-700 truncate max-w-[200px]">{row.sedeCargo}</div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[200px]">Empresa: {row.empresa}</div>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-indigo-700">
                                S/. {row.sueldo.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 font-mono text-[10px] text-slate-600">
                                {row.vigencia}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {row.isValid ? (
                                    <>
                                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 text-[10px] font-semibold">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Advertencia
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setActiveErrorRow(row)}
                                        className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition-all cursor-pointer"
                                        title="Ver Detalles de Advertencia"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2.5 py-1 rounded border border-red-200 text-[10px] font-semibold">
                                        <X className="w-3.5 h-3.5" />
                                        Errores ({row.errors.length})
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setActiveErrorRow(row)}
                                        className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-all cursor-pointer"
                                        title="Ver Detalles de Errores"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. VIEW MODE: CREATE / EDIT PERSONA FORM */}
      {viewMode === "form" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="p-2 hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center"
                title="Volver al Listado"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="font-heading text-xl font-bold text-slate-900">
                {editingId ? "Modificar Ficha Maestra" : "Nueva Ficha Maestra de Personal"}
              </h2>
            </div>
            <button 
              onClick={() => setViewMode("list")}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Tabs */}
          <div className="flex border-b border-slate-100 mb-6 gap-2">
            <button
              type="button"
              onClick={() => setActiveFormTab("personales")}
              className={`pb-2 px-4 text-sm font-semibold border-b-2 transition-all bg-transparent border-none cursor-pointer ${
                activeFormTab === "personales" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Datos Personales
            </button>
            <button
              type="button"
              onClick={() => setActiveFormTab("financieros")}
              className={`pb-2 px-4 text-sm font-semibold border-b-2 transition-all bg-transparent border-none cursor-pointer ${
                activeFormTab === "financieros" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Cuentas y Pensiones
            </button>
            <button
              type="button"
              onClick={() => setActiveFormTab("tallas")}
              className={`pb-2 px-4 text-sm font-semibold border-b-2 transition-all bg-transparent border-none cursor-pointer ${
                activeFormTab === "tallas" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Tallas y Médico
            </button>
            {!editingId && (
              <button
                type="button"
                onClick={() => setActiveFormTab("puesto")}
                className={`pb-2 px-4 text-sm font-semibold border-b-2 transition-all bg-transparent border-none cursor-pointer ${
                  activeFormTab === "puesto" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Puesto y Contrato
              </button>
            )}
          </div>

          <form onSubmit={handleSavePersona} className="space-y-6">
            {/* TABS 1: DATOS PERSONALES */}
            {activeFormTab === "personales" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Tipo Documento</label>
                  <select
                    required
                    value={personaForm.tipo_documento_id || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, tipo_documento_id: parseInt(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    {tiposDoc.map((td) => (
                      <option key={td.id} value={td.id}>{td.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Número Documento</label>
                  <input
                    type="text"
                    required
                    value={personaForm.numero_documento || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, numero_documento: e.target.value.replace(/\D/g, "") })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none font-mono"
                    placeholder="DNI de 8 dígitos"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombres</label>
                  <input
                    type="text"
                    required
                    value={personaForm.nombres || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, nombres: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    placeholder="Nombres completos"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Apellidos</label>
                  <input
                    type="text"
                    required
                    value={personaForm.apellidos || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, apellidos: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    placeholder="Apellidos completos"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sexo</label>
                  <select
                    value={personaForm.sexo || "Masculino"}
                    onChange={(e) => setPersonaForm({ ...personaForm, sexo: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha de Nacimiento</label>
                  <input
                    type="date"
                    required
                    value={personaForm.fecha_nacimiento || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, fecha_nacimiento: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Dirección de Residencia</label>
                  <input
                    type="text"
                    value={personaForm.direccion || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, direccion: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    placeholder="Av., Calle, Nro de departamento..."
                  />
                </div>
                <div className="relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Buscar Distrito (Ubigeo)</label>
                  <input
                    type="text"
                    value={ubigeoSearch}
                    onChange={(e) => handleUbigeoSearch(e.target.value)}
                    placeholder="Escribe el nombre del distrito (ej. Miraflores)..."
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                  {ubigeoResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {ubigeoResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setPersonaForm({ ...personaForm, ubigeo_id: u.id });
                            setUbigeoSearch(`${u.departamento} - ${u.provincia} - ${u.distrito}`);
                            setUbigeoResults([]);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-medium"
                        >
                          {u.departamento} - {u.provincia} - {u.distrito} ({u.id})
                        </button>
                      ))}
                    </div>
                  )}
                  {personaForm.ubigeo_id && (
                    <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
                      Ubigeo seleccionado: {personaForm.ubigeo_id}
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Teléfono Móvil</label>
                  <input
                    type="text"
                    value={personaForm.telefono || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, telefono: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    placeholder="999888777"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={personaForm.correo || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, correo: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    placeholder="colaborador@correo.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha de Ingreso Laboral</label>
                  <input
                    type="date"
                    required
                    value={personaForm.fecha_ingreso || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, fecha_ingreso: e.target.value || "" })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha de 1° Contrato</label>
                  <input
                    type="date"
                    required
                    value={personaForm.fecha_primer_contrato || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, fecha_primer_contrato: e.target.value || "" })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none font-mono"
                  />
                </div>
              </div>
            )}

            {/* TABS 2: DATOS FINANCIEROS */}
            {activeFormTab === "financieros" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Banco Sueldo</label>
                  <select
                    value={personaForm.banco_sueldo_id || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, banco_sueldo_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="">Ninguno</option>
                    {bancos.map((b) => (
                      <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cuenta Sueldo</label>
                  <input
                    type="text"
                    disabled={personaForm.cuenta_sueldo === "TIENE_CUENTA" || personaForm.cuenta_sueldo === "POR_AFILIAR"}
                    value={
                      (personaForm.cuenta_sueldo === "TIENE_CUENTA" || personaForm.cuenta_sueldo === "POR_AFILIAR")
                        ? ""
                        : personaForm.cuenta_sueldo || ""
                    }
                    onChange={(e) => setPersonaForm({ ...personaForm, cuenta_sueldo: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none font-mono disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder={
                      personaForm.cuenta_sueldo === "TIENE_CUENTA"
                        ? "[Tiene Cuenta - Nro Pendiente]"
                        : personaForm.cuenta_sueldo === "POR_AFILIAR"
                        ? "[Por Afiliar - Apertura Pendiente]"
                        : "Nro. Cuenta"
                    }
                  />
                  <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={personaForm.cuenta_sueldo === "TIENE_CUENTA"}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPersonaForm({ ...personaForm, cuenta_sueldo: "TIENE_CUENTA" });
                          } else {
                            setPersonaForm({ ...personaForm, cuenta_sueldo: "" });
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Tiene Cuenta (Sin Nro.)
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={personaForm.cuenta_sueldo === "POR_AFILIAR"}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPersonaForm({ ...personaForm, cuenta_sueldo: "POR_AFILIAR" });
                          } else {
                            setPersonaForm({ ...personaForm, cuenta_sueldo: "" });
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Por Afiliar
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Banco CTS</label>
                  <select
                    value={personaForm.banco_cts_id || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, banco_cts_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="">Ninguno</option>
                    {bancos.map((b) => (
                      <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cuenta CTS</label>
                  <input
                    type="text"
                    value={personaForm.cuenta_cts || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, cuenta_cts: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none font-mono"
                    placeholder="Nro. Cuenta CTS"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sistema de Pensión</label>
                  <select
                    required
                    value={personaForm.sistema_pension_id || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, sistema_pension_id: parseInt(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    {pensiones.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Código CUSS (AFP)</label>
                  <input
                    type="text"
                    value={personaForm.codigo_cuss_afp || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, codigo_cuss_afp: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none font-mono"
                    placeholder="Solo si es AFP"
                  />
                </div>
              </div>
            )}

            {/* TABS 3: TALLAS Y MEDICO */}
            {activeFormTab === "tallas" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Talla Polo / Camisa</label>
                  <input
                    type="text"
                    value={personaForm.talla_polo || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, talla_polo: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    placeholder="Ej. S, M, L, XL"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Talla Pantalón</label>
                  <input
                    type="text"
                    value={personaForm.talla_pantalon || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, talla_pantalon: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    placeholder="Ej. 30, 32, 34"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Talla Calzado</label>
                  <input
                    type="text"
                    value={personaForm.talla_calzado || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, talla_calzado: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    placeholder="Ej. 38, 40, 42"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha de Último EMO</label>
                  <input
                    type="date"
                    value={personaForm.fecha_ultimo_emo || ""}
                    onChange={(e) => setPersonaForm({ ...personaForm, fecha_ultimo_emo: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none font-mono"
                  />
                </div>
              </div>
            )}

            {/* TABS 4: PUESTO Y CONTRATO */}
            {activeFormTab === "puesto" && !editingId && (
              <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Empresa Interna (Planilla)</label>
                    <select
                      value={personaForm.empresa_interna_id || ""}
                      onChange={(e) => {
                        const empId = parseInt(e.target.value);
                        const availableClients = getClientesForEmpresa(empId);
                        const firstCli = availableClients[0];
                        const clientSedes = firstCli ? sedes.filter(s => s.cliente_id === firstCli.id) : [];
                        const firstSede = clientSedes[0];
                        setPersonaForm({
                          ...personaForm,
                          empresa_interna_id: empId,
                          cliente_id: firstCli ? firstCli.id : "",
                          sede_id: firstSede?.id || ""
                        });
                        setCreationSedeSearchText(firstSede ? firstSede.nombre : "");
                      }}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    >
                      {empresas.map((e) => (
                        <option key={e.id} value={e.id}>{e.razon_social}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cliente (Servicio)</label>
                    <select
                      value={personaForm.cliente_id || ""}
                      onChange={(e) => {
                        const cliId = parseInt(e.target.value);
                        const clientSedes = sedes.filter(s => s.cliente_id === cliId);
                        const firstSede = clientSedes[0];
                        setPersonaForm({
                          ...personaForm,
                          cliente_id: cliId,
                          sede_id: firstSede?.id || ""
                        });
                        setCreationSedeSearchText(firstSede ? firstSede.nombre : "");
                      }}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    >
                      <option value="" disabled>Seleccione un cliente</option>
                      {getClientesForEmpresa(personaForm.empresa_interna_id).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sede / Obra Asignada</label>
                    <input
                      type="text"
                      value={creationSedeSearchText}
                      onChange={(e) => {
                        setCreationSedeSearchText(e.target.value);
                        setShowCreationSedeDropdown(true);
                      }}
                      onFocus={() => setShowCreationSedeDropdown(true)}
                      onBlur={handleCreationSedeBlur}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                      placeholder="Buscar sede..."
                    />
                    {showCreationSedeDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {filteredSedesForCreation.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-slate-400">No se encontraron sedes</div>
                        ) : (
                          filteredSedesForCreation.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={() => {
                                setPersonaForm({ ...personaForm, sede_id: s.id });
                                setCreationSedeSearchText(s.nombre);
                                setShowCreationSedeDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-medium border-none cursor-pointer"
                            >
                              {s.nombre}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cargo a Desempeñar</label>
                    <input
                      type="text"
                      value={creationCargoSearchText}
                      onChange={(e) => {
                        setCreationCargoSearchText(e.target.value);
                        setShowCreationCargoDropdown(true);
                      }}
                      onFocus={() => setShowCreationCargoDropdown(true)}
                      onBlur={handleCreationCargoBlur}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                      placeholder="Buscar cargo..."
                    />
                    {showCreationCargoDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {filteredCargosForCreation.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-slate-400">No se encontraron cargos</div>
                        ) : (
                          filteredCargosForCreation.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={() => {
                                setPersonaForm({ ...personaForm, cargo_id: c.id });
                                setCreationCargoSearchText(c.nombre);
                                setShowCreationCargoDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-medium border-none cursor-pointer"
                            >
                              {c.nombre}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Tipo de Trabajador</label>
                    <select
                      value={personaForm.tipo_trabajador_id || ""}
                      onChange={(e) => setPersonaForm({ ...personaForm, tipo_trabajador_id: parseInt(e.target.value) })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    >
                      {tiposTrab.map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Régimen Laboral</label>
                    <select
                      value={personaForm.regimen_laboral_id || ""}
                      onChange={(e) => setPersonaForm({ ...personaForm, regimen_laboral_id: parseInt(e.target.value) })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    >
                      {regimenes.map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sueldo Básico (S/.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={personaForm.sueldo_basico === undefined ? 1025 : personaForm.sueldo_basico}
                      onChange={(e) => setPersonaForm({ ...personaForm, sueldo_basico: parseFloat(e.target.value) })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Bono (S/.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={personaForm.bono === undefined ? 0 : personaForm.bono}
                      onChange={(e) => setPersonaForm({ ...personaForm, bono: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none font-semibold text-indigo-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Especificación Lugar Trabajo</label>
                    <input
                      type="text"
                      value={personaForm.lugar_especifico_trabajo || ""}
                      onChange={(e) => setPersonaForm({ ...personaForm, lugar_especifico_trabajo: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none"
                      placeholder="Ej. Garita de Control, Almacén"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="creation_asignacion_familiar"
                    checked={!!personaForm.asignacion_familiar}
                    onChange={(e) => setPersonaForm({ ...personaForm, asignacion_familiar: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4.5 w-4.5 cursor-pointer accent-blue-600"
                  />
                  <label htmlFor="creation_asignacion_familiar" className="text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none">
                    Aplica Asignación Familiar
                  </label>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Detalle del Contrato Inicial</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Modalidad de Contrato</label>
                      <select
                        value={personaForm.contrato_modalidad_id || ""}
                        onChange={(e) => setPersonaForm({ ...personaForm, contrato_modalidad_id: parseInt(e.target.value) })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
                      >
                        {modalidades.map((m) => (
                          <option key={m.id} value={m.id}>{m.nombre}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">F. Inicio Contrato</label>
                      <input
                        type="date"
                        value={personaForm.contrato_fecha_inicio || ""}
                        onChange={(e) => setPersonaForm({ ...personaForm, contrato_fecha_inicio: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">F. Fin (Opcional)</label>
                      <input
                        type="date"
                        value={personaForm.contrato_fecha_fin || ""}
                        onChange={(e) => setPersonaForm({ ...personaForm, contrato_fecha_fin: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Form */}
            <div className="border-t border-slate-100 pt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-200 transition-all flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                Guardar Ficha
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. VIEW MODE: DETAIL & JOBS LIST (VINCULOS LABORALES) */}
      {viewMode === "view" && activePersona && (
        <div className="space-y-6">
          {/* Header Worker Profile */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-xl shadow-inner">
                {activePersona.nombres.substring(0, 1)}{activePersona.apellidos.substring(0, 1)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-xl font-bold text-slate-900">
                    {activePersona.apellidos}, {activePersona.nombres}
                  </h2>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                    ID: {activePersona.id}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {activePersona.tipos_documento?.codigo || "DNI"}: <span className="font-mono font-bold text-slate-700">{activePersona.numero_documento}</span>
                  <span className="mx-2 text-slate-300">|</span>
                  Contacto: <span className="text-slate-700 font-bold">{activePersona.telefono || "No registrado"}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button 
                onClick={() => setViewMode("list")}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al Listado
              </button>
              <button 
                onClick={handleOpenAddVinculo}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md shadow-blue-200 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                Asignar Puesto (Vínculo)
              </button>
            </div>
          </div>

          {/* Persona quick facts cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sistema Pensión</span>
              <span className="text-sm font-bold text-slate-800">{activePersona.sistemas_pension?.nombre || "Ninguno"}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tallas Registradas</span>
              <span className="text-xs font-bold text-slate-800 block mt-0.5">Polo: {activePersona.talla_polo || "-"} / Pantalón: {activePersona.talla_pantalon || "-"}</span>
              <span className="text-xs font-bold text-slate-800 block">Calzado: {activePersona.talla_calzado || "-"}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fecha Nacimiento</span>
              <span className="text-sm font-semibold text-slate-800 font-mono">{formatDMY(activePersona.fecha_nacimiento)}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fecha Ingreso</span>
              <span className="text-sm font-bold text-blue-600 font-mono">{formatDMY(getFechaIngreso(activePersona))}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fecha 1° Contrato</span>
              <span className="text-sm font-semibold text-slate-800 font-mono">{formatDMY(activePersona.fecha_primer_contrato || getFechaIngreso(activePersona))}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Último EMO</span>
              <span className="text-sm font-semibold text-slate-800 font-mono">{formatDMY(activePersona.fecha_ultimo_emo)}</span>
            </div>
          </div>

          {/* Vínculos Laborales list (Multi-Obra) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/10 flex items-center justify-between">
              <h3 className="font-heading text-sm font-bold text-slate-800 uppercase tracking-wider">
                Vínculos Laborales / Contratos de Puesto Activos e Históricos
              </h3>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full">
                Multi-Obra Habilitado
              </span>
            </div>

            <div className="overflow-x-auto">
              {vinculos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <div className="p-3 bg-slate-50 text-slate-400 rounded-xl">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-700">Sin puestos asignados</h4>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">Este colaborador no está asignado a ninguna empresa ni obra/sede actualmente.</p>
                  </div>
                  <button 
                    onClick={handleOpenAddVinculo}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold underline"
                  >
                    Asignar puesto ahora
                  </button>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Puesto / Cargo</th>
                      <th className="px-6 py-4">Empresa (Planilla)</th>
                      <th className="px-6 py-4">Cliente (Servicio) / Sede</th>
                      <th className="px-6 py-4">Condiciones</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vinculos.map((v) => (
                      <tr key={v.id} className={`hover:bg-slate-50/20 transition-colors ${v.estado === "Inactivo" ? "bg-slate-50/50 opacity-75" : ""}`}>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-800">{v.cargos?.nombre || "No cargo"}</div>
                          <div className="text-xs text-slate-500">{v.tipos_trabajador?.nombre || "General"}</div>
                          {v.lugar_especifico_trabajo && (
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">Esp: {v.lugar_especifico_trabajo}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            {v.empresas_internas?.razon_social || "No empresa"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {v.sedes?.nombre || "No sede"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium ml-5">
                            Cli: {v.sedes?.clientes?.razon_social || "No cliente"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-700 font-semibold">{v.regimenes_laborales?.nombre || "Gral"}</div>
                          <div className="text-sm text-indigo-700 font-bold flex flex-col mt-0.5">
                            <div className="flex items-center">
                              <span className="text-xs font-bold mr-0.5">S/</span>
                              {parseFloat(v.sueldo_basico).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                            </div>
                            {v.bono > 0 && (
                              <div className="text-[10px] text-emerald-750 font-bold flex items-center">
                                <span className="font-semibold text-slate-400 mr-0.5">Bono: S/</span>
                                {parseFloat(v.bono).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                          {v.asignacion_familiar && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1 py-0.5 rounded mt-1 inline-block">Asig. Fam.</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            v.estado === "Activo" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          }`}>
                            {v.estado}
                          </span>
                          {v.estado === "Inactivo" && v.fecha_cese && (
                            <div className="text-[10px] text-slate-500 font-medium mt-1">
                              <div>Cese: {new Date(v.fecha_cese).toLocaleDateString("es-PE")}</div>
                              {v.motivo_cese && <div className="text-red-500 italic font-normal">"{v.motivo_cese}"</div>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {v.estado === "Activo" ? (
                              <button
                                onClick={() => handleOpenCese(v.id)}
                                className="px-2 py-1 bg-red-50 text-red-600 border border-red-100 rounded text-xs font-semibold hover:bg-red-100 active:scale-95 transition-all"
                                title="Cesar puesto (Soft Delete)"
                              >
                                Cesar Puesto
                              </button>
                            ) : (
                              <div className="text-xs text-slate-400 font-medium italic" title={v.motivo_cese}>
                                Cese Registrado
                              </div>
                            )}
                            <button
                              onClick={() => handleOpenEditVinculo(v)}
                              className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded text-xs font-semibold hover:bg-blue-100 active:scale-95 transition-all cursor-pointer"
                              title="Editar puesto laboral (Sueldo, Cargo, Sede, etc.)"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteVinculo(v.id)}
                              className="px-2 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded text-xs font-semibold hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                              title="Eliminar puesto permanentemente"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL FOR ASSIGNING JOB LINK (VINCULO LABORAL) */}
      {isVinculoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg animate-slide-in relative border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                {editingVinculoId ? "Editar Puesto y Régimen" : "Asignar Puesto y Régimen"}
              </h3>
              <button 
                onClick={() => { setIsVinculoModalOpen(false); setEditingVinculoId(null); }}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {empresas.length === 0 || sedes.length === 0 ? (
              <div className="space-y-4 py-4">
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <Info className="w-4 h-4 shrink-0" />
                    No hay Empresas o Sedes registradas en Supabase.
                  </p>
                  <p>
                    Para poder asignar un puesto a un colaborador, primero debes registrar tus Empresas y Sedes en la sección de <strong>Configuración ➔ Estructura Comercial</strong>.
                  </p>
                  <p className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 p-2 rounded mt-2">
                    💡 Consejo: Si estás con el rol de Recursos Humanos y no ves la opción de Estructura Comercial en el menú lateral, cambia tu rol temporalmente a "Administrador" en la barra superior.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsVinculoModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveVinculo} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Empresa Interna (Planilla)</label>
                  <select
                    required
                    value={vinculoForm.empresa_interna_id || ""}
                    onChange={(e) => {
                      const empId = parseInt(e.target.value);
                      const availableClients = getClientesForEmpresa(empId);
                      const firstCli = availableClients[0];
                      const validSedes = firstCli ? sedes.filter(s => s.cliente_id === firstCli.id) : [];
                      const defaultSede = validSedes[0];
                      setVinculoForm({ 
                        ...vinculoForm, 
                        empresa_interna_id: empId, 
                        cliente_id: firstCli ? firstCli.id : "",
                        sede_id: defaultSede?.id || "" 
                      });
                      setSedeSearchText(defaultSede ? defaultSede.nombre : "");
                    }}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                  >
                    {empresas.map((e) => (
                      <option key={e.id} value={e.id}>{e.razon_social}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cliente (Servicio)</label>
                  <select
                    required
                    value={vinculoForm.cliente_id || ""}
                    onChange={(e) => {
                      const cliId = parseInt(e.target.value);
                      const clientSedes = sedes.filter(s => s.cliente_id === cliId);
                      const firstSede = clientSedes[0];
                      setVinculoForm({
                        ...vinculoForm,
                        cliente_id: cliId,
                        sede_id: firstSede?.id || ""
                      });
                      setSedeSearchText(firstSede ? firstSede.nombre : "");
                    }}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                  >
                    <option value="" disabled>Seleccione un cliente</option>
                    {getClientesForEmpresa(vinculoForm.empresa_interna_id).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sede / Obra Asignada</label>
                    <input
                      type="text"
                      required
                      placeholder="Buscar o seleccionar sede..."
                      value={sedeSearchText}
                      onChange={(e) => {
                        setSedeSearchText(e.target.value);
                        setShowSedeDropdown(true);
                      }}
                      onFocus={() => setShowSedeDropdown(true)}
                      onBlur={handleSedeBlur}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                    />
                    {showSedeDropdown && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {filteredSedesForVinculo.length === 0 ? (
                          <div className="p-3 text-xs text-slate-400 italic text-center font-medium">No se encontraron sedes</div>
                        ) : (
                          filteredSedesForVinculo.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={() => {
                                setVinculoForm(prev => ({ ...prev, sede_id: s.id }));
                                setSedeSearchText(s.nombre);
                                setShowSedeDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-slate-50 transition-colors ${
                                vinculoForm.sede_id === s.id ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700"
                              }`}
                            >
                              {s.nombre}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="relative">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cargo a Desempeñar</label>
                    <input
                      type="text"
                      required
                      placeholder="Buscar o seleccionar cargo..."
                      value={cargoSearchText}
                      onChange={(e) => {
                        setCargoSearchText(e.target.value);
                        setShowCargoDropdown(true);
                      }}
                      onFocus={() => setShowCargoDropdown(true)}
                      onBlur={handleCargoBlur}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                    />
                    {showCargoDropdown && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {filteredCargosForVinculo.length === 0 ? (
                          <div className="p-3 text-xs text-slate-400 italic text-center font-medium">No se encontraron cargos</div>
                        ) : (
                          filteredCargosForVinculo.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={() => {
                                setVinculoForm(prev => ({ ...prev, cargo_id: c.id }));
                                setCargoSearchText(c.nombre);
                                setShowCargoDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-slate-50 transition-colors ${
                                vinculoForm.cargo_id === c.id ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700"
                              }`}
                            >
                              {c.nombre}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Tipo de Trabajador</label>
                    <select
                      required
                      value={vinculoForm.tipo_trabajador_id || ""}
                      onChange={(e) => setVinculoForm({ ...vinculoForm, tipo_trabajador_id: parseInt(e.target.value) })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                    >
                      {tiposTrab.map((tt) => (
                        <option key={tt.id} value={tt.id}>{tt.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Régimen Laboral</label>
                    <select
                      required
                      value={vinculoForm.regimen_laboral_id || ""}
                      onChange={(e) => setVinculoForm({ ...vinculoForm, regimen_laboral_id: parseInt(e.target.value) })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                    >
                      {regimenes.map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre} ({r.dias_vacaciones} días vacac.)</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sueldo Básico (S/.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      required
                      value={vinculoForm.sueldo_basico ?? 1025.00}
                      onChange={(e) => setVinculoForm({ ...vinculoForm, sueldo_basico: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-semibold text-indigo-750"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Bono (S/.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={vinculoForm.bono ?? 0.00}
                      onChange={(e) => setVinculoForm({ ...vinculoForm, bono: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-semibold text-indigo-750"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Especificación Lugar</label>
                    <input
                      type="text"
                      value={vinculoForm.lugar_especifico_trabajo || ""}
                      onChange={(e) => setVinculoForm({ ...vinculoForm, lugar_especifico_trabajo: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      placeholder="Ej. Garita de Control, Almacén A"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="asigFam"
                    checked={vinculoForm.asignacion_familiar || false}
                    onChange={(e) => setVinculoForm({ ...vinculoForm, asignacion_familiar: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="asigFam" className="text-sm font-semibold text-slate-700 select-none">
                    Aplica Asignación Familiar
                  </label>
                </div>

                {/* Campos de Contrato Inicial */}
                {!editingVinculoId && (
                  <div className="border-t border-slate-100 pt-4 mt-2">
                    <h4 className="font-bold text-xs text-blue-600 uppercase tracking-wider mb-3">Detalle del Contrato Inicial</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Modalidad de Contrato</label>
                        <select
                          required={!editingVinculoId}
                          value={vinculoForm.contrato_modalidad_id || ""}
                          onChange={(e) => setVinculoForm({ ...vinculoForm, contrato_modalidad_id: parseInt(e.target.value) })}
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                        >
                          <option value="" disabled>Seleccione una modalidad</option>
                          {modalidades.map((m) => (
                            <option key={m.id} value={m.id}>{m.nombre}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">F. Inicio Contrato</label>
                          <input
                            type="date"
                            required={!editingVinculoId}
                            value={vinculoForm.contrato_fecha_inicio || ""}
                            onChange={(e) => setVinculoForm({ ...vinculoForm, contrato_fecha_inicio: e.target.value })}
                            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">F. Fin (Opcional)</label>
                          <input
                            type="date"
                            value={vinculoForm.contrato_fecha_fin || ""}
                            onChange={(e) => setVinculoForm({ ...vinculoForm, contrato_fecha_fin: e.target.value })}
                            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono"
                            placeholder="Indeterminado"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => { setIsVinculoModalOpen(false); setEditingVinculoId(null); }}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md cursor-pointer border-none"
                  >
                    {editingVinculoId ? "Guardar Cambios" : "Confirmar Puesto"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL FOR Logical Termination (CESE VINCULO LABORAL) */}
      {isCeseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-slide-in relative border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                Registrar Cese (Baja Lógica)
              </h3>
              <button 
                onClick={() => setIsCeseModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCese} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-700 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>Atención:</strong> Dar de baja el puesto marcará el vínculo como Inactivo. Se conservará todo el historial de entregas de uniformes y EPP para este colaborador.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha de Cese</label>
                <input
                  type="date"
                  required
                  value={ceseForm.fecha_cese}
                  onChange={(e) => setCeseForm({ ...ceseForm, fecha_cese: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Motivo del Cese</label>
                <textarea
                  required
                  rows={3}
                  value={ceseForm.motivo_cese}
                  onChange={(e) => setCeseForm({ ...ceseForm, motivo_cese: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none"
                  placeholder="Detallar el motivo de cese de la persona..."
                />
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCeseModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 shadow-md"
                >
                  Confirmar Baja Lógica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL TO SHOW DETAILED VALIDATION ERRORS FOR AN IMPORT ROW */}
      {activeErrorRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-100 animate-slide-in space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-heading text-base font-bold text-slate-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                Detalle de Validación - Fila {activeErrorRow.rowNumber}
              </h3>
              <button 
                onClick={() => setActiveErrorRow(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-500 font-medium">Colaborador:</div>
              <div className="text-sm font-bold text-slate-800">{activeErrorRow.nombres} (DNI: {activeErrorRow.dni})</div>
            </div>

            {activeErrorRow.errors.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-red-600 flex items-center gap-1">
                  <X className="w-4 h-4 shrink-0" />
                  Errores encontrados ({activeErrorRow.errors.length}):
                </div>
                <ul className="bg-red-50/50 rounded-xl p-3 border border-red-100 list-disc list-inside text-xs text-red-800 space-y-1">
                  {activeErrorRow.errors.map((err: string, idx: number) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {activeErrorRow.warnings.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Advertencias ({activeErrorRow.warnings.length}):
                </div>
                <ul className="bg-amber-50/50 rounded-xl p-3 border border-amber-100 list-disc list-inside text-xs text-amber-800 space-y-1">
                  {activeErrorRow.warnings.map((w: string, idx: number) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveErrorRow(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 7. QUICK CONTRACT CREATION MODAL */}
      {isQuickContratoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 animate-slide-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Registrar Contrato Inicial
              </h3>
              <button 
                onClick={() => setIsQuickContratoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickContrato} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Modalidad de Contrato</label>
                <select
                  required
                  value={quickContratoForm.modalidad_contrato_id || ""}
                  onChange={(e) => setQuickContratoForm({ ...quickContratoForm, modalidad_contrato_id: parseInt(e.target.value) })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                >
                  <option value="" disabled>Seleccione una modalidad</option>
                  {modalidades.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    required
                    value={quickContratoForm.fecha_inicio || ""}
                    onChange={(e) => setQuickContratoForm({ ...quickContratoForm, fecha_inicio: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha de Fin (Opcional)</label>
                  <input
                    type="date"
                    value={quickContratoForm.fecha_fin || ""}
                    onChange={(e) => setQuickContratoForm({ ...quickContratoForm, fecha_fin: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono"
                    placeholder="En blanco si es indeterminado"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre de Archivo PDF (Simulado)</label>
                <input
                  type="text"
                  value={quickContratoForm.archivo_pdf || ""}
                  onChange={(e) => setQuickContratoForm({ ...quickContratoForm, archivo_pdf: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono"
                  placeholder="Ej. contrato_inicial.pdf"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsQuickContratoModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md shadow-blue-200 active:scale-95 transition-all flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. CONTRACT HISTORY MODAL FOR A SPECIFIC PERSON */}
      {isContractHistoryModalOpen && selectedPersonaForHistory && (() => {
        const p = selectedPersonaForHistory;
        const pContracts = p.vinculos_laborales?.flatMap((v: any) => 
          (v.contratos || []).map((c: any) => ({
            ...c,
            vinculo: v
          }))
        ) || [];
        
        // Sort contracts chronologically (newest first)
        pContracts.sort((a: any, b: any) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime());

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-4xl border border-slate-100 animate-slide-in flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 flex-shrink-0">
                <div className="space-y-1">
                  <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Historial de Contratos y Renovaciones
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Colaborador: <span className="text-slate-800 font-bold">{p.apellidos}, {p.nombres}</span> (DNI: {p.numero_documento})
                  </p>
                </div>
                <button 
                  onClick={() => setIsContractHistoryModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content body */}
              <div className="flex-1 overflow-y-auto min-h-[200px] space-y-4 pr-1">
                {pContracts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <div className="p-3 bg-white text-slate-400 rounded-xl shadow-sm">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-700">Sin contratos registrados</h4>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">Esta persona no registra contratos en su historial de puesto.</p>
                    </div>
                    {p.vinculos_laborales?.some((v: any) => v.estado === "Activo") ? (
                      <button 
                        onClick={() => {
                          setIsContractHistoryModalOpen(false);
                          sessionStorage.setItem("autoSelectContractPersonaId", p.id.toString());
                          window.dispatchEvent(new CustomEvent("navigate-to", { detail: { path: "/rrhh/contratos" } }));
                        }}
                        className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-md cursor-pointer border-none"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ir a Registro de Contratos
                      </button>
                    ) : (
                      <p className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded">
                        ⚠️ Debe tener un puesto laboral ACTIVO para poder generarle un contrato.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="px-4 py-3">Puesto / Empresa</th>
                          <th className="px-4 py-3">Sede / Obra</th>
                          <th className="px-4 py-3">Modalidad</th>
                          <th className="px-4 py-3">Vigencia (Inicio / Fin)</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                          <th className="px-4 py-3 text-right">Archivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {pContracts.map((c: any) => {
                          const v = c.vinculo;
                          
                          // Contract alerts
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const end = c.fecha_fin ? new Date(c.fecha_fin) : null;
                          if (end) end.setHours(0, 0, 0, 0);
                          const diffDays = end ? Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 999;
                          
                          let badgeClass = "bg-slate-100 text-slate-700";
                          if (c.estado === "Vigente") {
                            if (!end) badgeClass = "bg-emerald-100 text-emerald-800 border border-emerald-250";
                            else if (diffDays < 0) badgeClass = "bg-red-100 text-red-800 border border-red-200";
                            else if (diffDays <= 15) badgeClass = "bg-red-50 text-red-650 border border-red-200 font-bold animate-pulse";
                            else if (diffDays <= 30) badgeClass = "bg-amber-50 text-amber-700 border border-amber-200 font-bold";
                            else badgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                          } else if (c.estado === "Renovado") {
                            badgeClass = "bg-slate-100 text-slate-400";
                          } else if (c.estado === "Vencido") {
                            badgeClass = "bg-red-100 text-red-800";
                          }
                          
                          return (
                            <tr key={c.id} className="hover:bg-slate-50/20 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-800">{v.cargos?.nombre}</div>
                                <div className="text-[10px] text-slate-400 font-medium">Empresa: {v.empresas_internas?.razon_social}</div>
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-650">
                                Sede: {v.sedes?.nombre}
                              </td>
                              <td className="px-4 py-3 text-slate-600 font-medium">
                                {modalidades.find(m => m.id === c.modalidad_contrato_id)?.nombre || "Plazo Fijo"}
                              </td>
                              <td className="px-4 py-3 font-mono text-[10px] text-slate-600">
                                <div>Ini: {formatDMY(c.fecha_inicio)}</div>
                                <div>Fin: {c.fecha_fin ? formatDMY(c.fecha_fin) : "Indeterminado"}</div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
                                  {c.estado === "Vigente" && end && diffDays < 0 ? "Vencido (Vigente)" : c.estado}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {c.archivo_pdf ? (
                                  <a
                                    href="#"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      alert("Visualizando archivo: " + c.archivo_pdf);
                                    }}
                                    className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 font-bold hover:underline"
                                  >
                                    <FileDown className="w-3.5 h-3.5" />
                                    PDF
                                  </a>
                                ) : (
                                  <span className="text-slate-350 italic text-[10px]">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal footer actions */}
              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-between flex-shrink-0">
                <div>
                  {p.vinculos_laborales?.some((v: any) => v.estado === "Activo") && (
                    <button 
                      onClick={() => {
                        setIsContractHistoryModalOpen(false);
                        sessionStorage.setItem("autoSelectContractPersonaId", p.id.toString());
                        window.dispatchEvent(new CustomEvent("navigate-to", { detail: { path: "/rrhh/contratos" } }));
                      }}
                      className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Gestionar Contratos (Modificar/Renovar)
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsContractHistoryModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer bg-white"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-100 flex flex-col items-center text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500 border border-red-100">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-heading text-base font-bold text-slate-900">
                ¿Eliminar ficha de personal?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Estás a punto de eliminar permanentemente la ficha de <strong>{deleteConfirmName}</strong>. Esta acción borrará todo su historial laboral y no se puede deshacer.
              </p>
            </div>

            <div className="flex gap-2.5 w-full pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all bg-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-lg text-xs font-bold shadow-md shadow-red-100 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Loading/Progress Overlay */}
      {importing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-100 flex flex-col items-center text-center space-y-5 animate-scale-up">
            {!importSuccess ? (
              <>
                <div className="relative w-20 h-20">
                  {/* Spinning outer border */}
                  <div className="absolute inset-0 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                  {/* Inside sheet icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileSpreadsheet className="w-8 h-8 text-emerald-600 animate-pulse" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-heading text-lg font-bold text-slate-800">
                    Procesando Archivo de Personal...
                  </h3>
                  <p className="text-xs text-slate-500 font-medium min-h-[32px] leading-relaxed">
                    {importStatusText}
                  </p>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full space-y-1">
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-full rounded-full transition-all duration-300 ease-out" 
                      style={{ width: `${importStatus.total > 0 ? (importStatus.processed / importStatus.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>PROGRESO</span>
                    <span>{importStatus.total > 0 ? Math.round((importStatus.processed / importStatus.total) * 100) : 0}%</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {importStatus.errors.length === 0 && importStatus.warnings.length === 0 ? (
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 shadow-inner">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 stroke-[2.5] animate-bounce" />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 shadow-inner">
                    <AlertTriangle className="w-10 h-10 text-amber-500 stroke-[2.5] animate-bounce" />
                  </div>
                )}

                <div className="space-y-2 w-full">
                  <h3 className="font-heading text-xl font-bold text-slate-900">
                    {importStatus.errors.length === 0 
                      ? (importStatus.warnings.length === 0 ? "¡Importación Completada!" : "Importación con Advertencias")
                      : "Importación con Observaciones"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {importStatus.errors.length === 0 
                      ? `Se registraron y vincularon correctamente ${importStatus.successCount} fichas de personal ${importStatus.warnings.length > 0 ? `(${importStatus.warnings.length} bajo excepción)` : ''}.`
                      : `Se procesaron exitosamente ${importStatus.successCount} registros y fallaron ${importStatus.errors.length} registros.`
                    }
                  </p>
                </div>

                {importStatus.errors.length > 0 && (
                  <div className="w-full bg-red-50/50 border border-red-100 p-3 rounded-lg max-h-32 overflow-y-auto text-[10px] text-red-600 font-mono text-left space-y-1">
                    <p className="font-bold border-b border-red-100 pb-1 mb-1 uppercase tracking-wider text-[9px] text-red-700">Listado de Errores:</p>
                    {importStatus.errors.map((err, i) => (
                      <div key={i} className="flex gap-1.5 items-start">
                        <span className="text-red-400 font-bold shrink-0">•</span>
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}

                {importStatus.warnings.length > 0 && (
                  <div className="w-full bg-amber-50/50 border border-amber-100 p-3 rounded-lg max-h-32 overflow-y-auto text-[10px] text-amber-800 font-mono text-left space-y-1">
                    <p className="font-bold border-b border-amber-100 pb-1 mb-1 uppercase tracking-wider text-[9px] text-amber-700">Excepciones de Sede Registradas:</p>
                    {importStatus.warnings.map((warn, i) => (
                      <div key={i} className="flex gap-1.5 items-start">
                        <span className="text-amber-400 font-bold shrink-0">•</span>
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="w-full flex gap-3">
                  {(importStatus.errors.length > 0 || importStatus.warnings.length > 0) && (
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold border border-slate-200 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <FileDown className="w-4 h-4 text-slate-500" /> Exportar TXT
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCloseImportOverlay}
                    className={`py-3 text-white rounded-xl text-sm font-bold shadow-lg transition-all cursor-pointer ${
                      importStatus.errors.length === 0 && importStatus.warnings.length === 0
                        ? "w-full bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 active:scale-[0.98]" 
                        : "flex-1 bg-blue-600 hover:bg-blue-700 shadow-blue-105 active:scale-[0.98]"
                    }`}
                  >
                    Aceptar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
