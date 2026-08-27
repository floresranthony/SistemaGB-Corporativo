import React, { useState, useEffect, useMemo } from "react";
import { 
  FileSpreadsheet, 
  Users, 
  Calendar, 
  Package, 
  Download, 
  Loader2, 
  Building,
  CheckCircle2,
  Clock,
  X,
  Search,
  Check,
  Briefcase,
  CheckSquare,
  Filter
} from "lucide-react";
import { supabase } from "../utils/supabase";
import * as XLSX from "xlsx";
import { SearchableMultiSelect } from "../components/SearchableMultiSelect";

// Columns available for custom export
const AVAILABLE_COLUMNS = [
  // Datos Personales
  { id: "tipo_doc", label: "Tipo Doc", group: "Datos Personales" },
  { id: "nro_doc", label: "Nro Documento", group: "Datos Personales" },
  { id: "apellidos", label: "Apellidos", group: "Datos Personales" },
  { id: "nombres", label: "Nombres", group: "Datos Personales" },
  { id: "sexo", label: "Sexo", group: "Datos Personales" },
  { id: "fecha_nacimiento", label: "Fecha Nacimiento", group: "Datos Personales" },
  { id: "telefono", label: "Teléfono", group: "Datos Personales" },
  { id: "correo", label: "Correo", group: "Datos Personales" },
  { id: "direccion", label: "Dirección", group: "Datos Personales" },
  { id: "ubigeo", label: "Ubigeo (Distrito)", group: "Datos Personales" },
  { id: "talla_polo", label: "Talla Polo", group: "Datos Personales" },
  { id: "talla_pantalon", label: "Talla Pantalón", group: "Datos Personales" },
  { id: "talla_calzado", label: "Talla Calzado", group: "Datos Personales" },

  // Datos Laborales
  { id: "fecha_ingreso", label: "Fecha Ingreso", group: "Datos Laborales" },
  { id: "fecha_primer_contrato", label: "Fecha 1er Contrato", group: "Datos Laborales" },
  { id: "fecha_inicio_contrato", label: "Inicio Contrato Vigente", group: "Datos Laborales" },
  { id: "fecha_fin_contrato", label: "Fin Contrato Vigente", group: "Datos Laborales" },
  { id: "estado_contrato", label: "Estado Contrato", group: "Datos Laborales" },
  { id: "estado_laboral", label: "Estado Laboral (Vínculo)", group: "Datos Laborales" },
  { id: "empresa_planilla", label: "Empresa Planilla (Nómina)", group: "Datos Laborales" },
  { id: "cliente", label: "Cliente", group: "Datos Laborales" },
  { id: "sede_operativa", label: "Sede Operativa", group: "Datos Laborales" },
  { id: "cargo", label: "Cargo", group: "Datos Laborales" },
  { id: "regimen_laboral", label: "Régimen Laboral", group: "Datos Laborales" },
  { id: "ultimo_emo", label: "Último EMO", group: "Datos Laborales" },

  // Datos Financieros
  { id: "sueldo_basico", label: "Sueldo Básico", group: "Datos Financieros" },
  { id: "bono", label: "Bono 1", group: "Datos Financieros" },
  { id: "bono_secundario", label: "Bono 2", group: "Datos Financieros" },
  { id: "asignacion_familiar", label: "Asignación Familiar", group: "Datos Financieros" },
  { id: "vencimiento_asignacion_familiar", label: "Venc. Asig. Familiar", group: "Datos Financieros" },
  { id: "sistema_pension", label: "Sistema Pensión", group: "Datos Financieros" },
  { id: "cussp", label: "Código CUSSP AFP", group: "Datos Financieros" },
  { id: "banco_sueldo", label: "Banco Sueldo", group: "Datos Financieros" },
  { id: "cuenta_sueldo", label: "Cuenta Sueldo", group: "Datos Financieros" },
  { id: "banco_cts", label: "Banco CTS", group: "Datos Financieros" },
  { id: "cuenta_cts", label: "Cuenta CTS", group: "Datos Financieros" }
];

const columnGroups = ["Datos Personales", "Datos Laborales", "Datos Financieros"];

export function Reportes() {
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const [successReport, setSuccessReport] = useState<string | null>(null);

  // Custom report config states
  const [isCustomReportModalOpen, setIsCustomReportModalOpen] = useState(false);
  const [personas, setPersonas] = useState<any[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);

  // Lookups lists for filtering
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState<string[]>([]);
  const [filterCliente, setFilterCliente] = useState<string[]>([]);
  const [filterSede, setFilterSede] = useState<string[]>([]);
  const [filterEstadoContrato, setFilterEstadoContrato] = useState("");
  const [filterFechaVencimiento, setFilterFechaVencimiento] = useState("");
  const [filterVacacionesAlerta, setFilterVacacionesAlerta] = useState("");
  const [filterCuentaSueldo, setFilterCuentaSueldo] = useState("");
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");
  const [filterTab, setFilterTab] = useState<"todos" | "activos" | "cesados">("todos");
  const [filterInconsistencia, setFilterInconsistencia] = useState(false);

  // Selected Columns Array
  const [selectedColumns, setSelectedColumns] = useState<string[]>(AVAILABLE_COLUMNS.map(c => c.id));

  // Load catalogs on mount
  const loadLookups = async () => {
    try {
      const [e, s, b] = await Promise.all([
        supabase.from("empresas_internas").select("*").eq("activo", true),
        supabase.from("sedes").select("*, clientes(id, razon_social, empresa_interna_id)").eq("activo", true),
        supabase.from("bancos").select("*")
      ]);
      setEmpresas(e.data || []);
      setSedes(s.data || []);
      setBancos(b.data || []);
    } catch (err) {
      console.error("Error loading lookups in Reportes:", err);
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  // Reactively prune selected clients/sedes when parent filters change in modal
  useEffect(() => {
    if (filterEmpresa.length > 0) {
      setFilterCliente(prev => prev.filter(clientId => 
        sedes.some(s => String(s.cliente_id) === clientId && s.clientes && filterEmpresa.includes(String(s.clientes.empresa_interna_id)))
      ));
    }
  }, [filterEmpresa, sedes]);

  useEffect(() => {
    if (filterCliente.length > 0) {
      setFilterSede(prev => prev.filter(sedeId => 
        sedes.some(s => String(s.id) === sedeId && filterCliente.includes(String(s.cliente_id)))
      ));
    } else if (filterEmpresa.length > 0) {
      setFilterSede(prev => prev.filter(sedeId => 
        sedes.some(s => String(s.id) === sedeId && s.clientes && filterEmpresa.includes(String(s.clientes.empresa_interna_id)))
      ));
    }
  }, [filterCliente, filterEmpresa, sedes]);

  const uniqueClientes = useMemo(() => {
    const map = new Map<number, string>();
    sedes.forEach(s => {
      if (s.clientes) {
        if (filterEmpresa.length === 0 || filterEmpresa.includes(String(s.clientes.empresa_interna_id))) {
          map.set(s.clientes.id, s.clientes.razon_social);
        }
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sedes, filterEmpresa]);

  const filteredSedesForDropdown = useMemo(() => {
    return sedes.filter(s => {
      if (filterEmpresa.length > 0 && s.clientes && !filterEmpresa.includes(String(s.clientes.empresa_interna_id))) {
        return false;
      }
      if (filterCliente.length > 0 && !filterCliente.includes(String(s.cliente_id))) {
        return false;
      }
      return true;
    });
  }, [sedes, filterEmpresa, filterCliente]);

  const openConfigureModal = async () => {
    setIsCustomReportModalOpen(true);
    if (personas.length === 0) {
      setLoadingPersonas(true);
      try {
        const { data, error } = await supabase
          .from("personas")
          .select(`
            *,
            tipos_documento (id, codigo, nombre),
            sistemas_pension (id, nombre, tipo),
            ubigeo_distritos (id, departamento, provincia, distrito),
            vinculos_laborales (
              id,
              estado,
              fecha_ingreso,
              fecha_primer_contrato,
              empresa_interna_id,
              sede_id,
              cargo_id,
              regimen_laboral_id,
              sueldo_basico,
              bono,
              bono_secundario,
              asignacion_familiar,
              vencimiento_asignacion_familiar,
              tipo_trabajador_id,
              lugar_especifico_trabajo,
              fecha_cese,
              motivo_cese,
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
        if (error) throw error;
        setPersonas(data || []);
      } catch (err) {
        console.error("Error loading personas:", err);
      } finally {
        setLoadingPersonas(false);
      }
    }
  };

  const getFechaIngreso = (p: any): string | null => {
    if (!p.vinculos_laborales) return null;
    const active = p.vinculos_laborales.find((v: any) => v.estado === "Activo");
    if (active && active.fecha_ingreso) return active.fecha_ingreso;

    const sorted = [...p.vinculos_laborales].sort((a: any, b: any) => b.id - a.id);
    const mostRecent = sorted[0];
    if (mostRecent && mostRecent.fecha_ingreso) return mostRecent.fecha_ingreso;

    const dates = p.vinculos_laborales
      .flatMap((v: any) => v.contratos || [])
      .map((c: any) => c.fecha_inicio)
      .filter(Boolean);
    if (dates.length === 0) return null;
    dates.sort();
    return dates[0];
  };

  // Helper to map and filter people records in memory
  const tableRows = useMemo(() => {
    const list: any[] = [];
    personas.forEach(p => {
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

  // Filter list reactively
  const filteredRows = useMemo(() => {
    return tableRows.filter(row => {
      const p = row.persona;
      const v = row.vinculo;

      // 1. Tab filter (Activos / Cesados / Todos)
      if (filterTab === "activos") {
        if (row.isCesado) return false;
      } else if (filterTab === "cesados") {
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
      if (filterSede.length > 0) {
        if (!v || !filterSede.includes(String(v.sede_id))) return false;
      }

      // 4. Empresa filter
      if (filterEmpresa.length > 0) {
        if (!v || !filterEmpresa.includes(String(v.empresa_interna_id))) return false;
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

      // 7. Cliente filter
      if (filterCliente.length > 0) {
        if (!v || !v.sedes || !filterCliente.includes(String(v.sedes.cliente_id))) return false;
      }

      // 8. Alerta Vacaciones
      if (filterVacacionesAlerta) {
        let hasAlert = false;
        if (v && v.estado === "Activo") {
          const diasAnuales = v.regimenes_laborales?.dias_vacaciones ?? 30;
          const fIng = v.fecha_primer_contrato || v.fecha_ingreso || (v.contratos && v.contratos.map((c: any) => c.fecha_inicio).filter(Boolean).sort()[0]) || v.creado_en;
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

      // 9. Inconsistencias
      if (filterInconsistencia) {
        const belongsToCompany = v?.sedes?.clientes?.empresa_interna_id === v?.empresa_interna_id;
        if (!v || belongsToCompany) return false;
      }

      // 10. Cuenta Sueldo
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
  }, [tableRows, searchQuery, filterSede, filterEmpresa, filterFechaDesde, filterFechaHasta, filterEstadoContrato, filterFechaVencimiento, filterTab, filterCliente, filterVacacionesAlerta, filterInconsistencia, filterCuentaSueldo]);

  const triggerDownloadIndicator = (reportId: string) => {
    setSuccessReport(reportId);
    setTimeout(() => {
      setSuccessReport(null);
    }, 3000);
  };

  // Safe formatting helper to split and reverse YYYY-MM-DD
  const formatExcelDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  // Dynamic selector controllers
  const toggleColumn = (id: string) => {
    setSelectedColumns(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.id));
  };

  const clearAllColumns = () => {
    setSelectedColumns([]);
  };

  const selectColumnsByGroup = (groupName: string) => {
    const groupCols = AVAILABLE_COLUMNS.filter(c => c.group === groupName).map(c => c.id);
    setSelectedColumns(prev => {
      const next = new Set([...prev]);
      groupCols.forEach(id => next.add(id));
      return Array.from(next);
    });
  };

  const deselectColumnsByGroup = (groupName: string) => {
    const groupCols = AVAILABLE_COLUMNS.filter(c => c.group === groupName).map(c => c.id);
    setSelectedColumns(prev => prev.filter(id => !groupCols.includes(id)));
  };

  // Compile filters and headers to generate the Excel report
  const generateCustomExcel = () => {
    if (filteredRows.length === 0) {
      alert("No hay personas que coincidan con los filtros actuales.");
      return;
    }
    if (selectedColumns.length === 0) {
      alert("Debe seleccionar al menos una columna para exportar.");
      return;
    }

    setDownloadingReport("personal-custom");
    try {
      const rows = filteredRows.map(row => {
        const p = row.persona;
        const v = row.vinculo;

        const activeContract = v?.contratos?.find((c: any) => c.estado === "Vigente");
        let cEstado = "Sin Contrato";
        if (v) {
          if (activeContract) {
            if (!activeContract.fecha_fin) cEstado = "Indeterminado";
            else {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const end = new Date(activeContract.fecha_fin);
              const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              cEstado = diffDays < 0 ? "Vencido" : `${diffDays}d`;
            }
          }
        } else if (row.isCesado) {
          cEstado = "Cesado";
        }

        const ubigeoStr = p.ubigeo_distritos 
          ? `${p.ubigeo_distritos.distrito} - ${p.ubigeo_distritos.provincia} (${p.ubigeo_distritos.departamento})`
          : (p.ubigeo_id || "-");

        const bancoSueldoNombre = bancos.find(b => b.id === p.banco_sueldo_id)?.nombre || "-";
        const bancoCtsNombre = bancos.find(b => b.id === p.banco_cts_id)?.nombre || "-";

        const cellData: Record<string, any> = {};
        
        AVAILABLE_COLUMNS.forEach(col => {
          if (!selectedColumns.includes(col.id)) return;
          
          let val: any = "-";
          switch (col.id) {
            case "tipo_doc": val = p.tipos_documento?.codigo || "DNI"; break;
            case "nro_doc": val = p.numero_documento; break;
            case "apellidos": val = p.apellidos; break;
            case "nombres": val = p.nombres; break;
            case "sexo": val = p.sexo || "-"; break;
            case "fecha_nacimiento": val = formatExcelDate(p.fecha_nacimiento); break;
            case "telefono": val = p.telefono || "-"; break;
            case "correo": val = p.correo || "-"; break;
            case "direccion": val = p.direccion || "-"; break;
            case "ubigeo": val = ubigeoStr; break;
            case "talla_polo": val = p.talla_polo || "-"; break;
            case "talla_pantalon": val = p.talla_pantalon || "-"; break;
            case "talla_calzado": val = p.talla_calzado || "-"; break;
            case "fecha_ingreso": val = v?.fecha_ingreso ? formatExcelDate(v.fecha_ingreso) : "-"; break;
            case "fecha_primer_contrato": val = v?.fecha_primer_contrato ? formatExcelDate(v.fecha_primer_contrato) : "-"; break;
            case "fecha_inicio_contrato": val = activeContract?.fecha_inicio ? formatExcelDate(activeContract.fecha_inicio) : "-"; break;
            case "fecha_fin_contrato": val = activeContract?.fecha_fin ? formatExcelDate(activeContract.fecha_fin) : "-"; break;
            case "estado_contrato": val = cEstado; break;
            case "estado_laboral": val = v ? v.estado : (row.isCesado ? "Cesado" : "Sin Vínculo"); break;
            case "empresa_planilla": val = v?.empresas_internas?.razon_social || "Sin Puesto Activo"; break;
            case "cliente": val = v?.sedes?.clientes?.razon_social || "-"; break;
            case "sede_operativa": val = v?.sedes?.nombre || "-"; break;
            case "cargo": val = v?.cargos?.nombre || "-"; break;
            case "regimen_laboral": val = v?.regimenes_laborales?.nombre || "-"; break;
            case "ultimo_emo": val = p.fecha_ultimo_emo ? formatExcelDate(p.fecha_ultimo_emo) : "-"; break;
            case "sueldo_basico": val = v ? (v.sueldo_basico !== undefined && v.sueldo_basico !== null ? parseFloat(v.sueldo_basico) : 0) : "-"; break;
            case "bono": val = v ? (v.bono !== undefined && v.bono !== null ? parseFloat(v.bono) : 0) : "-"; break;
            case "bono_secundario": val = v ? (v.bono_secundario !== undefined && v.bono_secundario !== null ? parseFloat(v.bono_secundario) : 0) : "-"; break;
            case "asignacion_familiar": val = v ? (v.asignacion_familiar ? "Sí" : "No") : "-"; break;
            case "vencimiento_asignacion_familiar": val = v?.vencimiento_asignacion_familiar ? formatExcelDate(v.vencimiento_asignacion_familiar) : "-"; break;
            case "sistema_pension": val = p.sistemas_pension?.nombre || "-"; break;
            case "cussp": val = p.codigo_cuss_afp || "-"; break;
            case "banco_sueldo": val = bancoSueldoNombre; break;
            case "cuenta_sueldo": val = p.cuenta_sueldo === "TIENE_CUENTA" ? "Tiene Cuenta (Pendiente)" : p.cuenta_sueldo === "POR_AFILIAR" ? "Por Afiliar" : p.cuenta_sueldo || "-"; break;
            case "banco_cts": val = bancoCtsNombre; break;
            case "cuenta_cts": val = p.cuenta_cts || "-"; break;
          }
          cellData[col.label] = val;
        });

        return cellData;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Colaboradores Filtrados");
      XLSX.writeFile(wb, "padron_personal_personalizado.xlsx");
      
      triggerDownloadIndicator("personal-custom");
      setIsCustomReportModalOpen(false);
    } catch (err: any) {
      console.error("Error generating custom Excel:", err);
      alert("Error al generar el reporte: " + err.message);
    } finally {
      setDownloadingReport(null);
    }
  };

  // Report 1: Clients and Headquarters (Estructura Comercial)
  const downloadEstructuraComercial = async () => {
    setDownloadingReport("estructura");
    try {
      const { data: clientes, error: cliErr } = await supabase
        .from("clientes")
        .select(`
          id,
          razon_social,
          ruc,
          activo,
          empresa_interna_id,
          empresas_internas (
            razon_social
          )
        `)
        .order("razon_social", { ascending: true });

      if (cliErr) throw cliErr;

      const { data: sedesData, error: sedeErr } = await supabase
        .from("sedes")
        .select(`
          id,
          nombre,
          direccion,
          distrito,
          contacto_nombre,
          contacto_telefono,
          presupuesto,
          activo,
          cliente_id
        `)
        .order("nombre", { ascending: true });

      if (sedeErr) throw sedeErr;

      const clientesList = clientes || [];
      const sedesList = sedesData || [];

      const consolidatedRows = sedesList.map(s => {
        const cli = clientesList.find(c => c.id === s.cliente_id);
        return {
          "RUC Cliente": cli ? cli.ruc : "-",
          "Cliente": cli ? cli.razon_social : "-",
          "Empresa Interna (Nómina)": cli && cli.empresas_internas ? (cli.empresas_internas as any).razon_social : "-",
          "Nombre Sede": s.nombre || "-",
          "Dirección Sede": s.direccion || "-",
          "Distrito Sede": s.distrito || "-",
          "Contacto Sede": s.contacto_nombre || "-",
          "Teléfono Contacto": s.contacto_telefono || "-",
          "Presupuesto Sede": s.presupuesto || 0,
          "Estado Sede": s.activo ? "Activo" : "Inactivo",
          "Estado Cliente": cli && cli.activo ? "Activo" : "Inactivo"
        };
      });

      const clientsRows = clientesList.map(c => ({
        "RUC Cliente": c.ruc,
        "Razón Social": c.razon_social,
        "Empresa Interna (Nómina)": c.empresas_internas ? (c.empresas_internas as any).razon_social : "-",
        "Estado": c.activo ? "Activo" : "Inactivo"
      }));

      const sedesRows = sedesList.map(s => {
        const cli = clientesList.find(c => c.id === s.cliente_id);
        return {
          "Nombre Sede": s.nombre,
          "Cliente Asociado": cli ? cli.razon_social : "-",
          "Dirección": s.direccion || "-",
          "Distrito": s.distrito || "-",
          "Contacto": s.contacto_nombre || "-",
          "Teléfono": s.contacto_telefono || "-",
          "Presupuesto Mensual": s.presupuesto || 0,
          "Estado": s.activo ? "Activo" : "Inactivo"
        };
      });

      const wb = XLSX.utils.book_new();
      
      const wsConsolidated = XLSX.utils.json_to_sheet(consolidatedRows);
      const wsClients = XLSX.utils.json_to_sheet(clientsRows);
      const wsSedes = XLSX.utils.json_to_sheet(sedesRows);

      XLSX.utils.book_append_sheet(wb, wsConsolidated, "Estructura Consolidada");
      XLSX.utils.book_append_sheet(wb, wsClients, "Clientes");
      XLSX.utils.book_append_sheet(wb, wsSedes, "Sedes Operativas");

      XLSX.writeFile(wb, "reporte_estructura_comercial.xlsx");
      triggerDownloadIndicator("estructura");
    } catch (error: any) {
      console.error("Error generating Estructura Comercial report:", error);
      alert("Error al generar el reporte de Estructura Comercial: " + error.message);
    } finally {
      setDownloadingReport(null);
    }
  };

  const reportsList = [
    {
      id: "estructura",
      title: "Estructura Comercial Consolidada",
      description: "Listado completo de clientes, sus empresas internas y todas las sedes operativas asignadas en el sistema. Organizado en múltiples pestañas.",
      icon: Building,
      badge: "Disponible",
      colorClass: "bg-blue-50 text-blue-600 border-blue-100",
      btnClass: "bg-blue-600 hover:bg-blue-700 shadow-blue-100",
      action: downloadEstructuraComercial,
      available: true
    },
    {
      id: "personal",
      title: "Padrón General de Personal",
      description: "Reporte consolidado con los datos personales, previsionales y puestos activos de todos los colaboradores registrados en el sistema. Permite pre-filtrar y elegir columnas.",
      icon: Users,
      badge: "Disponible",
      colorClass: "bg-emerald-50 text-emerald-600 border-emerald-100",
      btnClass: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100",
      action: openConfigureModal,
      available: true
    },
    {
      id: "contratos",
      title: "Contratos por Vencer",
      description: "Alertas y listado de colaboradores con contratos próximos a expirar en los siguientes 30, 60 y 90 días, incluyendo información del puesto.",
      icon: Calendar,
      badge: "Próximamente",
      colorClass: "bg-amber-50 text-amber-600 border-amber-100",
      btnClass: "bg-slate-100 text-slate-400 cursor-not-allowed",
      action: () => {},
      available: false
    },
    {
      id: "uniformes",
      title: "Stock y Almacén de Uniformes",
      description: "Resumen de stock disponible en almacén clasificado por talla, prenda y EPP, además de alertas de niveles mínimos de reposición.",
      icon: Package,
      badge: "Próximamente",
      colorClass: "bg-purple-50 text-purple-600 border-purple-100",
      btnClass: "bg-slate-100 text-slate-400 cursor-not-allowed",
      action: () => {},
      available: false
    }
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="space-y-1 flex-shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
          Inteligencia y Exportación
        </span>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <FileSpreadsheet className="w-8 h-8 text-blue-600" />
          Descarga de Reportes
        </h1>
        <p className="text-sm text-slate-500 max-w-2xl">
          Descarga información clave de tu organización en formato Excel estructurado para análisis local, auditorías y toma de decisiones operativas.
        </p>
      </div>

      {/* Grid de Reportes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 pb-8">
        {reportsList.map((report) => {
          const IconComponent = report.icon;
          const isDownloading = downloadingReport === report.id;
          const isSuccess = successReport === report.id;

          return (
            <div 
              key={report.id}
              className={`bg-white rounded-2xl border border-slate-100 p-6 flex flex-col justify-between shadow-sm transition-all duration-300 transform ${
                report.available 
                  ? "hover:shadow-md hover:-translate-y-0.5" 
                  : "opacity-85"
              }`}
            >
              <div className="space-y-4">
                {/* Badge & Icon */}
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-xl border ${report.colorClass}`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  
                  {report.available ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {report.badge}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-100">
                      <Clock className="w-3.5 h-3.5" />
                      {report.badge}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <h3 className="font-heading text-lg font-bold text-slate-800 tracking-tight">
                    {report.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {report.description}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-slate-50">
                {report.available ? (
                  <button
                    onClick={report.action}
                    disabled={!!downloadingReport}
                    className={`w-full flex items-center justify-center gap-2 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 ${report.btnClass} cursor-pointer border-none`}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generando reporte...
                      </>
                    ) : isSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        ¡Descargado con éxito!
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Descargar Excel
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 bg-slate-50 text-slate-400 px-4 py-3 rounded-xl text-sm font-semibold cursor-not-allowed border border-slate-100"
                  >
                    No disponible
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Custom Report Configurer */}
      {isCustomReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-905/65 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 w-full max-w-4xl shadow-2xl flex flex-col my-8 max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
              <div className="space-y-1">
                <h2 className="font-heading text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  Configurar Padrón General de Personal
                </h2>
                <p className="text-xs text-slate-500">
                  Aplica filtros para seleccionar el personal y elige qué columnas exportar en tu reporte de Excel.
                </p>
              </div>
              <button
                onClick={() => setIsCustomReportModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Loading Indicator for first load */}
              {loadingPersonas ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-xs text-slate-500">Cargando datos del personal...</p>
                </div>
              ) : (
                <>
                  {/* Sección 1: Filtros de Personal (11 filtros) */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      1. Filtrar Personal ({filteredRows.length} coincidentes)
                    </h3>
                    
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                      {/* Primera Fila de Filtros: Buscador, Rangos y Tabs */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {/* Buscador de Texto */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Buscar por Nombre, DNI o Correo</label>
                          <div className="flex items-center gap-2 bg-white border border-slate-250 rounded-lg px-2.5 py-1 text-xs">
                            <Search className="w-4 h-4 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              placeholder="Buscar..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full bg-transparent border-none focus:outline-none py-0.5 text-slate-605 placeholder:text-slate-400"
                            />
                          </div>
                        </div>

                        {/* Rango Fecha Ingreso */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ingreso Desde</label>
                          <input
                            type="date"
                            value={filterFechaDesde}
                            onChange={(e) => setFilterFechaDesde(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-650 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ingreso Hasta</label>
                          <input
                            type="date"
                            value={filterFechaHasta}
                            onChange={(e) => setFilterFechaHasta(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-650 font-mono"
                          />
                        </div>
                      </div>

                      {/* Segunda Fila de Filtros: Empresa, Cliente y Sede */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {/* Empresa */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Filtrar por Empresa</label>
                          <SearchableMultiSelect
                            value={filterEmpresa}
                            options={empresas.map(e => ({ value: String(e.id), label: e.razon_social }))}
                            onChange={setFilterEmpresa}
                            placeholder="Todas las Empresas"
                            allLabel="Todas las Empresas"
                            compact={true}
                          />
                        </div>

                        {/* Cliente */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Filtrar por Cliente</label>
                          <SearchableMultiSelect
                            value={filterCliente}
                            options={uniqueClientes.map(c => ({ value: String(c.id), label: c.name }))}
                            onChange={setFilterCliente}
                            placeholder="Todos los Clientes"
                            allLabel="Todos los Clientes"
                            compact={true}
                          />
                        </div>

                        {/* Sede */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Filtrar por Sede</label>
                          <SearchableMultiSelect
                            value={filterSede}
                            options={filteredSedesForDropdown.map(s => ({ value: String(s.id), label: s.nombre }))}
                            onChange={setFilterSede}
                            placeholder="Todas las Sedes"
                            allLabel="Todas las Sedes"
                            compact={true}
                          />
                        </div>
                      </div>

                      {/* Tercera Fila de Filtros: Estado Contrato, Vence Hasta, Vacaciones, Cuenta Sueldo */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                        {/* Estado Contrato */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estado Contrato</label>
                          <select
                            value={filterEstadoContrato}
                            onChange={(e) => setFilterEstadoContrato(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-650 cursor-pointer"
                          >
                            <option value="">Todos los Estados</option>
                            <option value="vigente">Vigente</option>
                            <option value="por_vencer">Por Vencer (≤30 días)</option>
                            <option value="vencido">Vencido</option>
                            <option value="sin_contrato">Sin Contrato</option>
                            <option value="sin_puesto">Sin Puesto Activo</option>
                          </select>
                        </div>

                        {/* Vence Hasta */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Contrato Vence Hasta</label>
                          <input
                            type="date"
                            value={filterFechaVencimiento}
                            onChange={(e) => setFilterFechaVencimiento(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-650 font-mono"
                          />
                        </div>

                        {/* Alerta Vacaciones */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Alerta Vacaciones</label>
                          <select
                            value={filterVacacionesAlerta}
                            onChange={(e) => setFilterVacacionesAlerta(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-650 cursor-pointer"
                          >
                            <option value="">Todas las Vacaciones</option>
                            <option value="si">Con Alertas</option>
                            <option value="no">Sin Alertas</option>
                          </select>
                        </div>

                        {/* Cuenta Sueldo */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cuenta Sueldo</label>
                          <select
                            value={filterCuentaSueldo}
                            onChange={(e) => setFilterCuentaSueldo(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-650 cursor-pointer"
                          >
                            <option value="">Todas las Cuentas</option>
                            <option value="tiene_nro">Tiene Nro. Cuenta</option>
                            <option value="tiene_cuenta">Tiene Cuenta (Pendiente)</option>
                            <option value="por_afiliar">Por Afiliar</option>
                            <option value="sin_cuenta">Sin Cuenta Registrada</option>
                            <option value="subsanar">Subsanar (Pendiente/Afiliar)</option>
                          </select>
                        </div>
                      </div>

                      {/* Cuarta Fila de Filtros: Activos/Cesados Toggle y Checkbox de Inconsistencias */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-200">
                        {/* Activos vs Cesados Buttons */}
                        <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-lg border-none">
                          <button
                            onClick={() => setFilterTab("todos")}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all border-none cursor-pointer ${
                              filterTab === "todos" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-705 bg-transparent"
                            }`}
                          >
                            Todos ({tableRows.length})
                          </button>
                          <button
                            onClick={() => setFilterTab("activos")}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all border-none cursor-pointer ${
                              filterTab === "activos" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-705 bg-transparent"
                            }`}
                          >
                            Activos ({tableRows.filter(r => !r.isCesado).length})
                          </button>
                          <button
                            onClick={() => setFilterTab("cesados")}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all border-none cursor-pointer ${
                              filterTab === "cesados" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-705 bg-transparent"
                            }`}
                          >
                            Cesados ({tableRows.filter(r => r.isCesado).length})
                          </button>
                        </div>

                        {/* Filtro Inconsistencias & Clean Filters */}
                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100/75 text-amber-800 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border border-amber-205 shadow-sm cursor-pointer select-none transition-colors">
                            <input
                              type="checkbox"
                              checked={filterInconsistencia}
                              onChange={(e) => setFilterInconsistencia(e.target.checked)}
                              className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer accent-amber-600"
                            />
                            <span>⚠️ Con Inconsistencias</span>
                          </label>

                          {(searchQuery || filterSede.length > 0 || filterEmpresa.length > 0 || filterFechaDesde || filterFechaHasta || filterEstadoContrato || filterFechaVencimiento || filterCliente.length > 0 || filterVacacionesAlerta || filterInconsistencia || filterCuentaSueldo || filterTab !== "todos") && (
                            <button
                              onClick={() => {
                                setSearchQuery("");
                                setFilterSede([]);
                                setFilterEmpresa([]);
                                setFilterFechaDesde("");
                                setFilterFechaHasta("");
                                setFilterEstadoContrato("");
                                setFilterFechaVencimiento("");
                                setFilterCliente([]);
                                setFilterVacacionesAlerta("");
                                setFilterInconsistencia(false);
                                setFilterCuentaSueldo("");
                                setFilterTab("todos");
                              }}
                              className="text-[10px] text-slate-500 hover:text-slate-800 font-bold bg-transparent border-none cursor-pointer hover:underline"
                            >
                              Limpiar Filtros
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sección 2: Selección de Columnas (Rejilla de checkbox agrupados) */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                        2. Seleccionar Columnas ({selectedColumns.length} de {AVAILABLE_COLUMNS.length} marcadas)
                      </h3>
                      
                      {/* Acciones Rápidas */}
                      <div className="flex items-center gap-2 text-[10px] font-bold text-blue-650">
                        <button onClick={selectAllColumns} className="hover:underline cursor-pointer bg-transparent border-none p-0 text-blue-600">Marcar Todo</button>
                        <span className="text-slate-300">|</span>
                        <button onClick={clearAllColumns} className="hover:underline cursor-pointer bg-transparent border-none p-0 text-blue-600">Limpiar Todo</button>
                        <span className="text-slate-300">|</span>
                        <button 
                          onClick={() => setSelectedColumns(["tipo_doc", "nro_doc", "apellidos", "nombres", "sexo", "estado_laboral"])} 
                          className="hover:underline cursor-pointer bg-transparent border-none p-0 text-blue-600"
                        >
                          Solo Básicos
                        </button>
                        <span className="text-slate-300">|</span>
                        <button 
                          onClick={() => setSelectedColumns(["nro_doc", "apellidos", "nombres", "empresa_planilla", "cliente", "sede_operativa", "cargo", "regimen_laboral", "fecha_ingreso"])} 
                          className="hover:underline cursor-pointer bg-transparent border-none p-0 text-blue-600"
                        >
                          Solo Puesto
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {columnGroups.map(group => {
                        const cols = AVAILABLE_COLUMNS.filter(c => c.group === group);
                        const groupSelected = cols.filter(c => selectedColumns.includes(c.id));
                        const isAllSelected = groupSelected.length === cols.length;

                        return (
                          <div key={group} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between h-full space-y-3 shadow-sm">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                                <span className="text-[10px] font-extrabold text-slate-800 uppercase tracking-widest">{group}</span>
                                <button
                                  type="button"
                                  onClick={() => isAllSelected ? deselectColumnsByGroup(group) : selectColumnsByGroup(group)}
                                  className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer bg-transparent border-none p-0"
                                >
                                  {isAllSelected ? "Deseleccionar" : "Seleccionar"}
                                </button>
                              </div>
                              <div className="grid grid-cols-1 gap-2.5">
                                {cols.map(col => {
                                  const isChecked = selectedColumns.includes(col.id);
                                  return (
                                    <label key={col.id} className="flex items-center gap-2 text-xs text-slate-650 cursor-pointer select-none hover:text-slate-900 transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleColumn(col.id)}
                                        className="rounded text-blue-650 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer accent-blue-600 border-slate-300"
                                      />
                                      <span>{col.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/30 rounded-b-2xl">
              <div className="text-xs text-slate-500">
                {!loadingPersonas && (
                  <span>Se exportarán <strong className="text-slate-700">{filteredRows.length}</strong> personas con <strong className="text-slate-700">{selectedColumns.length}</strong> columnas.</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsCustomReportModalOpen(false)}
                  className="px-4 py-2 bg-transparent hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={generateCustomExcel}
                  disabled={loadingPersonas || filteredRows.length === 0 || selectedColumns.length === 0 || !!downloadingReport}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer border-none"
                >
                  {downloadingReport === "personal-custom" ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generando Excel...
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      Descargar Excel
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
