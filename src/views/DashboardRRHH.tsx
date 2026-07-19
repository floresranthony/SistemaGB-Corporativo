import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { 
  Users, 
  FileText, 
  Activity, 
  Calendar, 
  AlertTriangle, 
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Building,
  ShieldAlert,
  Clock,
  Search,
  Plus,
  X,
  Check,
  PlusCircle,
  Eye,
  Info
} from "lucide-react";

interface EmoModalState {
  personaId: number;
  nombres: string;
  fecha_ultimo_emo: string;
}

interface ContractRenewModalState {
  personaId: number;
  vinculoId: number;
  nombres: string;
  modalidad_contrato_id: number | string;
  fecha_fin: string;
}

interface VacationModalState {
  personaId: number;
  vinculoId: number;
  nombres: string;
}

export function DashboardRRHH() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data States
  const [personas, setPersonas] = useState<any[]>([]);
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [hiringRequests, setHiringRequests] = useState<any[]>([]);

  // Search States
  const [searchContracts, setSearchContracts] = useState("");
  const [searchEmos, setSearchEmos] = useState("");
  const [searchVacations, setSearchVacations] = useState("");

  // Days alert limit filter states
  const [filterContractsDays, setFilterContractsDays] = useState<number>(30);
  const [filterEmosDays, setFilterEmosDays] = useState<number>(30);

  // Modal States
  const [emoModal, setEmoModal] = useState<EmoModalState | null>(null);
  const [contractModal, setContractModal] = useState<ContractRenewModalState | null>(null);
  const [vacationModal, setVacationModal] = useState<VacationModalState | null>(null);
  
  // Exception Modal States
  const [isInconsistenciasModalOpen, setIsInconsistenciasModalOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Form input states
  const [emoDateInput, setEmoDateInput] = useState("");
  const [contractFormInput, setContractFormInput] = useState({
    modalidad_contrato_id: "",
    fecha_inicio: "",
    fecha_fin: "",
    archivo_pdf: ""
  });
  const [vacationFormInput, setVacationFormInput] = useState({
    fecha_inicio: new Date().toISOString().split("T")[0],
    fecha_fin: new Date().toISOString().split("T")[0],
    notas: ""
  });

  const calculatedVacationDays = React.useMemo(() => {
    if (!vacationFormInput.fecha_inicio || !vacationFormInput.fecha_fin) return 0;
    const start = new Date(vacationFormInput.fecha_inicio);
    const end = new Date(vacationFormInput.fecha_fin);
    const diff = end.getTime() - start.getTime();
    if (diff < 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [vacationFormInput.fecha_inicio, vacationFormInput.fecha_fin]);

  const loadLookupsAndData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Modalidades
      const { data: modData } = await supabase.from("modalidades_contrato").select("*");
      setModalidades(modData || []);

      // 2. Fetch Pizarra Requests
      const { data: piz } = await supabase
        .from("solicitudes_personal")
        .select(`
          *,
          sedes (id, nombre),
          cargos (id, nombre)
        `)
        .order("id", { ascending: false })
        .limit(4);
      setHiringRequests(piz || []);

      // 3. Fetch Unified Collaborators Dataset
      const { data: resData, error: dbError } = await supabase
        .from("personas")
        .select(`
          id,
          nombres,
          apellidos,
          numero_documento,
          fecha_ultimo_emo,
          fecha_ingreso,
          fecha_primer_contrato,
          telefono,
          correo,
          vinculos_laborales (
            id,
            estado,
            empresa_interna_id,
            sede_id,
            cargo_id,
            regimen_laboral_id,
            excepcion_sede,
            excepcion_aprobada,
            regimenes_laborales (id, dias_vacaciones),
            cargos (id, nombre),
            empresas_internas (id, razon_social),
            sedes (id, nombre, cliente_id, clientes (id, empresa_interna_id)),
            contratos (
              id,
              fecha_inicio,
              fecha_fin,
              estado,
              modalidad_contrato_id
            ),
            vacaciones_historico (
              id,
              dias_calendario
            )
          )
        `);

      if (dbError) throw dbError;
      setPersonas(resData || []);
    } catch (err: any) {
      console.error("Error loading dashboard data:", err);
      setError(err.message || "Error al cargar los datos del panel.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLookupsAndData();
  }, []);

  // Safe formatting helper to prevent timezone shift issues
  const formatDMY = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

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

  // Derivative values: KPI Calculations
  const stats = React.useMemo(() => {
    let personalActivo = 0;
    let personalInactivo = 0;
    let contratosPorVencer = 0;
    let emosVencidos = 0;
    let vacacionesCriticas = 0;
    let inconsistenciasSede = 0;
    let porRegularizarSede = 0;

    personas.forEach(p => {
      const activeVincs = p.vinculos_laborales?.filter((v: any) => v.estado === "Activo") || [];
      const hasActive = activeVincs.length > 0;

      if (hasActive) {
        personalActivo++;

        // 1. Check contracts por vencer (Vigente, <= 30 days)
        activeVincs.forEach((v: any) => {
          const activeContract = v.contratos?.find((c: any) => c.estado === "Vigente");
          if (activeContract && activeContract.fecha_fin) {
            const today = new Date();
            today.setHours(0,0,0,0);
            const end = new Date(activeContract.fecha_fin);
            const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 30) {
              contratosPorVencer++;
            }
          }
        });

        // 2. Check EMOs (vencidos or <= 30 days)
        if (p.fecha_ultimo_emo) {
          const emoDate = new Date(p.fecha_ultimo_emo);
          const today = new Date();
          today.setHours(0,0,0,0);
          const expiryDate = new Date(emoDate.setFullYear(emoDate.getFullYear() + 1));
          const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 30) {
            emosVencidos++;
          }
        } else {
          emosVencidos++; // No EMO counts as alert
        }

        // 3. Check Vacaciones Críticas (>= 2 periodos accumulated)
        activeVincs.forEach((v: any) => {
          const diasAnuales = v.regimenes_laborales?.dias_vacaciones ?? 30;
          const fIng = p.fecha_ingreso || getFechaIngreso(p);
          if (fIng) {
            const today = new Date();
            const ing = new Date(fIng);
            const diffTime = Math.max(0, today.getTime() - ing.getTime());
            const years = diffTime / (1000 * 60 * 60 * 24 * 365.25);
            const diasGanados = years * diasAnuales;
            const diasGozados = v.vacaciones_historico?.reduce((sum: number, vac: any) => sum + (vac.dias_calendario || 0), 0) ?? 0;
            const net = Math.max(0, Math.floor(diasGanados - diasGozados));
            const periodos = net / diasAnuales;
            if (periodos >= 2.0) {
              vacacionesCriticas++;
            }
          }
        });

        // 4. Check exceptions (unapproved vs approved-but-not-regularized)
        activeVincs.forEach((v: any) => {
          if (v.excepcion_sede) {
            if (!v.excepcion_aprobada) {
              inconsistenciasSede++;
            } else {
              const belongsToCompany = v.sedes?.clientes?.empresa_interna_id === v.empresa_interna_id;
              if (!belongsToCompany) {
                porRegularizarSede++;
              }
            }
          }
        });
      } else {
        const hasInactive = p.vinculos_laborales?.some((v: any) => v.estado === "Inactivo");
        if (hasInactive) {
          personalInactivo++;
        }
      }
    });

    return {
      personalActivo,
      personalInactivo,
      contratosPorVencer,
      emosVencidos,
      vacacionesCriticas,
      inconsistenciasSede,
      porRegularizarSede
    };
  }, [personas]);

  // Derivative values: Company Distribution (Donut SVG structure)
  const empresaDistribution = React.useMemo(() => {
    const empMap: Record<string, number> = {};
    let totalActives = 0;

    personas.forEach(p => {
      const activeVincs = p.vinculos_laborales?.filter((v: any) => v.estado === "Activo") || [];
      activeVincs.forEach((v: any) => {
        const empVal = v.empresas_internas;
        const name = (Array.isArray(empVal) ? empVal[0]?.razon_social : (empVal as any)?.razon_social) || "Otros";
        empMap[name] = (empMap[name] || 0) + 1;
        totalActives++;
      });
    });

    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
    let accumulatedPct = 0;

    return Object.keys(empMap).map((key, index) => {
      const count = empMap[key];
      const pct = totalActives > 0 ? Math.round((count / totalActives) * 100) : 0;
      const color = colors[index % colors.length];
      
      const offset = 263.89 - (pct * 263.89) / 100;
      const rotation = (accumulatedPct * 360) / 100 - 90;
      
      accumulatedPct += pct;

      return {
        name: key,
        count,
        pct,
        color,
        strokeDashoffset: offset,
        transform: `rotate(${rotation} 50 50)`
      };
    });
  }, [personas]);

  // List 1: Contracts Alerts
  const contractsAlerts = React.useMemo(() => {
    const list: any[] = [];
    personas.forEach(p => {
      p.vinculos_laborales?.forEach((v: any) => {
        if (v.estado === "Activo") {
          const c = v.contratos?.find((contr: any) => contr.estado === "Vigente");
          if (c && c.fecha_fin) {
            const today = new Date();
            today.setHours(0,0,0,0);
            const end = new Date(c.fecha_fin);
            const diffTime = end.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            list.push({
              id: c.id,
              persona: p,
              vinculo: v,
              contrato: c,
              fecha_fin: c.fecha_fin,
              dias_restantes: diffDays
            });
          }
        }
      });
    });
    return list;
  }, [personas]);

  const filteredContracts = React.useMemo(() => {
    return contractsAlerts.filter(item => {
      const q = searchContracts.toLowerCase();
      if (q) {
        const fullName = `${item.persona.nombres} ${item.persona.apellidos}`.toLowerCase();
        const matches = fullName.includes(q) || item.persona.numero_documento.includes(q);
        if (!matches) return false;
      }

      if (filterContractsDays !== 9999) {
        if (item.dias_restantes > filterContractsDays) return false;
      }
      return true;
    }).sort((a, b) => a.dias_restantes - b.dias_restantes);
  }, [contractsAlerts, searchContracts, filterContractsDays]);

  // List 2: EMO Alerts
  const emosAlerts = React.useMemo(() => {
    const list: any[] = [];
    personas.forEach(p => {
      const hasActiveVinc = p.vinculos_laborales?.some((v: any) => v.estado === "Activo");
      if (hasActiveVinc) {
        if (p.fecha_ultimo_emo) {
          const emoDate = new Date(p.fecha_ultimo_emo);
          const today = new Date();
          today.setHours(0,0,0,0);
          const expiryDate = new Date(emoDate.setFullYear(emoDate.getFullYear() + 1));
          const diffTime = expiryDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          list.push({
            persona: p,
            fecha_vence: expiryDate.toISOString().split("T")[0],
            dias_restantes: diffDays
          });
        } else {
          list.push({
            persona: p,
            fecha_vence: null,
            dias_restantes: -9999
          });
        }
      }
    });
    return list;
  }, [personas]);

  const filteredEmos = React.useMemo(() => {
    return emosAlerts.filter(item => {
      const q = searchEmos.toLowerCase();
      if (q) {
        const fullName = `${item.persona.nombres} ${item.persona.apellidos}`.toLowerCase();
        const matches = fullName.includes(q) || item.persona.numero_documento.includes(q);
        if (!matches) return false;
      }

      if (filterEmosDays !== 9999) {
        if (item.dias_restantes > filterEmosDays && item.dias_restantes !== -9999) return false;
      }
      return true;
    }).sort((a, b) => a.dias_restantes - b.dias_restantes);
  }, [emosAlerts, searchEmos, filterEmosDays]);

  // List 3: Vacation Alerts
  const vacationsAlerts = React.useMemo(() => {
    const list: any[] = [];
    personas.forEach(p => {
      p.vinculos_laborales?.forEach((v: any) => {
        if (v.estado === "Activo") {
          const diasAnuales = v.regimenes_laborales?.dias_vacaciones ?? 30;
          const fIng = p.fecha_ingreso || getFechaIngreso(p);
          if (fIng) {
            const today = new Date();
            const ing = new Date(fIng);
            const diffTime = Math.max(0, today.getTime() - ing.getTime());
            const years = diffTime / (1000 * 60 * 60 * 24 * 365.25);
            const diasGanados = years * diasAnuales;
            const diasGozados = v.vacaciones_historico?.reduce((sum: number, vac: any) => sum + (vac.dias_calendario || 0), 0) ?? 0;
            const net = Math.max(0, Math.floor(diasGanados - diasGozados));
            const periodos = net / diasAnuales;

            if (periodos >= 2.0) {
              list.push({
                persona: p,
                vinculo: v,
                net,
                periodos,
                fecha_ingreso: fIng
              });
            }
          }
        }
      });
    });
    return list;
  }, [personas]);

  const filteredVacations = React.useMemo(() => {
    return vacationsAlerts.filter(item => {
      const q = searchVacations.toLowerCase();
      if (q) {
        const fullName = `${item.persona.nombres} ${item.persona.apellidos}`.toLowerCase();
        const matches = fullName.includes(q) || item.persona.numero_documento.includes(q);
        if (!matches) return false;
      }
      return true;
    }).sort((a, b) => b.periodos - a.periodos);
  }, [vacationsAlerts, searchVacations]);

  // Direct actions triggers
  const handleOpenRenewModal = (item: any) => {
    let defaultStartDate = new Date().toISOString().split("T")[0];
    if (item.contrato?.fecha_fin) {
      const nextDay = new Date(item.contrato.fecha_fin);
      nextDay.setDate(nextDay.getDate() + 1);
      defaultStartDate = nextDay.toISOString().split("T")[0];
    }

    setContractFormInput({
      modalidad_contrato_id: String(item.contrato?.modalidad_contrato_id || modalidades[0]?.id || ""),
      fecha_inicio: defaultStartDate,
      fecha_fin: "",
      archivo_pdf: ""
    });
    setContractModal({
      personaId: item.persona.id,
      vinculoId: item.vinculo.id,
      nombres: `${item.persona.apellidos}, ${item.persona.nombres}`,
      modalidad_contrato_id: item.contrato?.modalidad_contrato_id || "",
      fecha_fin: item.contrato?.fecha_fin || ""
    });
  };

  const handleOpenEmoModal = (item: any) => {
    setEmoDateInput(item.persona.fecha_ultimo_emo || new Date().toISOString().split("T")[0]);
    setEmoModal({
      personaId: item.persona.id,
      nombres: `${item.persona.apellidos}, ${item.persona.nombres}`,
      fecha_ultimo_emo: item.persona.fecha_ultimo_emo || ""
    });
  };

  const handleOpenVacationModal = (item: any) => {
    setVacationFormInput({
      fecha_inicio: new Date().toISOString().split("T")[0],
      fecha_fin: new Date().toISOString().split("T")[0],
      notas: ""
    });
    setVacationModal({
      personaId: item.persona.id,
      vinculoId: item.vinculo.id,
      nombres: `${item.persona.apellidos}, ${item.persona.nombres}`
    });
  };

  // Submit direct corrections to Supabase
  const handleSaveRenewContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractModal) return;
    setLoading(true);
    try {
      // 1. Renovate previous contracts (set state to Renovado)
      await supabase
        .from("contratos")
        .update({ estado: "Renovado" })
        .eq("vinculo_laboral_id", contractModal.vinculoId)
        .eq("estado", "Vigente");

      // 2. Insert new active contract
      const { error: dbError } = await supabase
        .from("contratos")
        .insert([{
          vinculo_laboral_id: contractModal.vinculoId,
          modalidad_contrato_id: parseInt(contractFormInput.modalidad_contrato_id),
          fecha_inicio: contractFormInput.fecha_inicio,
          fecha_fin: contractFormInput.fecha_fin || null,
          estado: "Vigente",
          archivo_pdf: contractFormInput.archivo_pdf || null
        }]);

      if (dbError) throw dbError;
      
      setContractModal(null);
      await loadLookupsAndData();
      alert("Contrato renovado exitosamente.");
    } catch (err: any) {
      alert("Error al renovar contrato: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emoModal) return;
    setLoading(true);
    try {
      const { error: dbError } = await supabase
        .from("personas")
        .update({ fecha_ultimo_emo: emoDateInput || null })
        .eq("id", emoModal.personaId);

      if (dbError) throw dbError;

      setEmoModal(null);
      await loadLookupsAndData();
      alert("Examen médico (EMO) actualizado exitosamente.");
    } catch (err: any) {
      alert("Error al actualizar EMO: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacationModal) return;
    if (calculatedVacationDays <= 0) {
      alert("La fecha de fin debe ser posterior o igual a la fecha de inicio.");
      return;
    }
    setLoading(true);
    try {
      const { error: dbError } = await supabase
        .from("vacaciones_historico")
        .insert([{
          vinculo_laboral_id: vacationModal.vinculoId,
          dias_calendario: calculatedVacationDays,
          fecha_inicio: vacationFormInput.fecha_inicio,
          fecha_fin: vacationFormInput.fecha_fin,
          notas: vacationFormInput.notas || null
        }]);

      if (dbError) throw dbError;

      setVacationModal(null);
      await loadLookupsAndData();
      alert("Vacaciones registradas. El acumulado se ha reducido.");
    } catch (err: any) {
      alert("Error al registrar vacaciones: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveException = async (vinculoId: number) => {
    setApprovingId(vinculoId);
    try {
      const { error: dbErr } = await supabase
        .from("vinculos_laborales")
        .update({ excepcion_aprobada: true })
        .eq("id", vinculoId);

      if (dbErr) throw dbErr;
      
      setSuccessMessage("Excepción aprobada correctamente.");
      await loadLookupsAndData();
    } catch (err: any) {
      console.error("Error approving exception:", err);
      alert("Error al aprobar la excepción: " + (err.message || err));
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between flex-shrink-0 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
            Recursos Humanos
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600 animate-pulse" />
            Dashboard de RRHH
          </h1>
          <p className="text-xs text-slate-500 max-w-xl">
            Control de alertas críticas: contratos por vencer, EMOs, goce vacacional e incorporaciones en curso.
          </p>
        </div>
        <div>
          <button 
            onClick={loadLookupsAndData}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-xs font-semibold hover:bg-slate-50 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Sincronizar Panel
          </button>
        </div>
      </div>

      {/* Alert Banner for Sede/Company mismatch exceptions */}
      {(stats.inconsistenciasSede > 0 || stats.porRegularizarSede > 0) && (
        <div className="bg-amber-50/70 border-2 border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm animate-fade-in flex-shrink-0">
          <div className="flex gap-3.5 items-start md:items-center">
            <div className="p-3 bg-amber-100 text-amber-900 rounded-2xl shrink-0 border border-amber-200 shadow-inner">
              <AlertTriangle className="w-6 h-6 text-amber-600 animate-bounce" />
            </div>
            <div className="text-left space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <p className="text-sm sm:text-base font-extrabold text-slate-800">
                  Inconsistencias de Sede en Vínculos Laborales
                </p>
                <span className="inline-flex items-center justify-center bg-amber-200/60 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-black border border-amber-300 w-fit shrink-0">
                  {stats.inconsistenciasSede + stats.porRegularizarSede} en total
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.inconsistenciasSede > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg border border-red-200 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    {stats.inconsistenciasSede} por aprobar
                  </span>
                )}
                {stats.porRegularizarSede > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg border border-amber-300 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {stats.porRegularizarSede} por regularizar
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsInconsistenciasModalOpen(true)}
            className="w-full md:w-auto px-5 py-3 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-100 shrink-0 cursor-pointer text-center"
          >
            Revisar y Regularizar
          </button>
        </div>
      )}

      {/* Bento Grid KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Active staff */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Personal Activo</span>
            <span className="text-2xl font-black text-slate-900">{stats.personalActivo}</span>
          </div>
        </div>

        {/* KPI 2: Cesado staff */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Personal Cesado</span>
            <span className="text-2xl font-black text-slate-900 text-slate-550">{stats.personalInactivo}</span>
          </div>
        </div>

        {/* KPI 3: Near-expiry contracts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Contratos por Vencer</span>
            <span className={`text-2xl font-black ${stats.contratosPorVencer > 0 ? "text-amber-600" : "text-slate-900"}`}>
              {stats.contratosPorVencer}
            </span>
          </div>
        </div>

        {/* KPI 4: EMO alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">EMOs por Vencer</span>
            <span className={`text-2xl font-black ${stats.emosVencidos > 0 ? "text-red-600" : "text-slate-900"}`}>
              {stats.emosVencidos}
            </span>
          </div>
        </div>

        {/* KPI 5: Vacation alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Vacaciones Acumuladas</span>
            <span className={`text-2xl font-black ${stats.vacacionesCriticas > 0 ? "text-rose-600" : "text-slate-900"}`}>
              {stats.vacacionesCriticas}
            </span>
          </div>
        </div>
      </div>

      {/* Middle row: Chart + Hiring requests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Company distribution (Donut SVG style) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-heading text-xs font-bold text-slate-800 uppercase tracking-wider">
              Personal Activo por Empresa
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
            {empresaDistribution.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No hay colaboradores activos para mostrar.
              </div>
            ) : (
              <>
                {/* SVG Donut Chart */}
                <div className="relative w-40 h-40 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {empresaDistribution.map((slice, i) => (
                      <circle
                        key={i}
                        cx="50"
                        cy="50"
                        r="42"
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="12"
                        strokeDasharray="263.89"
                        strokeDashoffset={slice.strokeDashoffset}
                        transform={slice.transform}
                        className="transition-all duration-500 hover:stroke-[14px]"
                      />
                    ))}
                    <circle cx="50" cy="50" r="33" fill="#ffffff" />
                  </svg>
                  {/* Center info */}
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black text-slate-800">{stats.personalActivo}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Activos</span>
                  </div>
                </div>

                {/* Legend list */}
                <div className="flex-1 space-y-2">
                  {empresaDistribution.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600 font-medium truncate max-w-[180px]" title={item.name}>{item.name}</span>
                      </div>
                      <span className="font-bold text-slate-800">{item.pct}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Requerimientos Pizarra summary */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="font-heading text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              Requerimientos de Personal Activos
            </h3>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full">
              {hiringRequests.length} activos
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-3">
            {hiringRequests.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-medium">
                No hay requerimientos activos por completar.
              </div>
            ) : (
              hiringRequests.map((r) => {
                const pct = Math.min(100, Math.floor((r.plazas_cubiertas / r.plazas_solicitadas) * 100));
                return (
                  <div key={r.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100/50 flex flex-col space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-slate-800">{r.cargos?.nombre || "Puesto Desconocido"}</div>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                        r.estado === "Completado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {r.estado}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">Sede: {r.sedes?.nombre || "-"}</div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Plazas cubiertas</span>
                        <span>{r.plazas_cubiertas} / {r.plazas_solicitadas}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Three alerts tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Table 1: Vencimiento de Contratos */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col space-y-3 min-h-[420px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="font-heading text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              Vencimiento de Contratos
            </h3>
            {contractsAlerts.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-black rounded-full">
                {contractsAlerts.length} alertas
              </span>
            )}
          </div>

          {/* Filters Contracts */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o DNI..."
                value={searchContracts}
                onChange={(e) => setSearchContracts(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
              />
            </div>
            <select
              value={filterContractsDays}
              onChange={(e) => setFilterContractsDays(Number(e.target.value))}
              className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white font-semibold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value={15}>Ver Próximos 15 días</option>
              <option value={30}>Ver Próximos 30 días</option>
              <option value={60}>Ver Próximos 60 días</option>
              <option value={9999}>Todos</option>
            </select>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-50 rounded-lg">
            {filteredContracts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                Sin alertas de contrato en este rango.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase">
                    <th className="px-3 py-2">Trabajador</th>
                    <th className="px-2 py-2">Fecha Vence</th>
                    <th className="px-2 py-2 text-center">Días Rest.</th>
                    <th className="px-2 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredContracts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-800 uppercase tracking-tight">{c.persona.apellidos}, {c.persona.nombres}</div>
                        <div className="text-[9px] text-slate-400 font-mono">DNI: {c.persona.numero_documento}</div>
                      </td>
                      <td className="px-2 py-2.5 font-mono text-slate-600">
                        {formatDMY(c.fecha_fin)}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black ${
                          c.dias_restantes <= 0 ? "bg-red-100 text-red-800" : c.dias_restantes <= 15 ? "bg-red-50 text-red-650 animate-pulse" : "bg-amber-100 text-amber-800"
                        }`}>
                          {c.dias_restantes <= 0 ? `Vencido (${Math.abs(c.dias_restantes)}d)` : `${c.dias_restantes}d`}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenRenewModal(c)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          title="Corregir / Renovar Contrato"
                        >
                          <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Table 2: Vencimiento de EMOs */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col space-y-3 min-h-[420px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="font-heading text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              Vencimiento de EMOs
            </h3>
            {emosAlerts.length > 0 && (
              <span className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-800 text-[9px] font-black rounded-full">
                {emosAlerts.length} alertas
              </span>
            )}
          </div>

          {/* Filters EMOs */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o DNI..."
                value={searchEmos}
                onChange={(e) => setSearchEmos(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
              />
            </div>
            <select
              value={filterEmosDays}
              onChange={(e) => setFilterEmosDays(Number(e.target.value))}
              className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white font-semibold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value={15}>Ver Próximos 15 días</option>
              <option value={30}>Ver Próximos 30 días</option>
              <option value={60}>Ver Próximos 60 días</option>
              <option value={9999}>Todos</option>
            </select>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-50 rounded-lg">
            {filteredEmos.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                Sin alertas de EMO en este rango.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase">
                    <th className="px-3 py-2">Trabajador</th>
                    <th className="px-2 py-2">Fecha Vence</th>
                    <th className="px-2 py-2 text-center">Días Rest.</th>
                    <th className="px-2 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmos.map((e, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-800 uppercase tracking-tight">{e.persona.apellidos}, {e.persona.nombres}</div>
                        <div className="text-[9px] text-slate-400 font-mono">DNI: {e.persona.numero_documento}</div>
                      </td>
                      <td className="px-2 py-2.5 font-mono text-slate-600">
                        {e.fecha_vence ? formatDMY(e.fecha_vence) : "Sin Registro"}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black ${
                          e.dias_restantes <= 0 ? "bg-red-100 text-red-800" : e.dias_restantes <= 15 ? "bg-red-50 text-red-650 animate-pulse" : "bg-amber-100 text-amber-800"
                        }`}>
                          {e.dias_restantes === -9999 ? "Vencido / Sin registro" : e.dias_restantes <= 0 ? `Vencido (${Math.abs(e.dias_restantes)}d)` : `${e.dias_restantes}d`}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEmoModal(e)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          title="Corregir / Registrar EMO"
                        >
                          <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Table 3: Alerta de Vacaciones */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col space-y-3 min-h-[420px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="font-heading text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              Alerta de Vacaciones
            </h3>
            {vacationsAlerts.length > 0 && (
              <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 text-[9px] font-black rounded-full">
                {vacationsAlerts.length} alertas
              </span>
            )}
          </div>

          {/* Filters Vacations */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o DNI..."
                value={searchVacations}
                onChange={(e) => setSearchVacations(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
              />
            </div>
            <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 rounded-lg flex items-center">
              Límite ≥ 2 periodos
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-50 rounded-lg">
            {filteredVacations.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                Sin alertas críticas de vacaciones.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase">
                    <th className="px-3 py-2">Trabajador</th>
                    <th className="px-2 py-2">Pendiente</th>
                    <th className="px-2 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVacations.map((v, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-800 uppercase tracking-tight">{v.persona.apellidos}, {v.persona.nombres}</div>
                        <div className="text-[9px] text-slate-400 font-mono">DNI: {v.persona.numero_documento} | INGRESO: {formatDMY(v.fecha_ingreso)}</div>
                      </td>
                      <td className="px-2 py-2.5 text-slate-700 font-medium">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-800">
                          {v.net} días ({v.periodos.toFixed(1)} per.)
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenVacationModal(v)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                            title="Registrar días gozados (más)"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
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

      {/* MODAL 1: ACTUALIZAR EMO */}
      {emoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 animate-slide-in space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Actualizar Examen Médico (EMO)
              </h3>
              <button 
                onClick={() => setEmoModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-xs text-slate-500 font-semibold">
              Colaborador: <span className="text-slate-800 font-bold">{emoModal.nombres}</span>
            </div>

            <form onSubmit={handleSaveEmo} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha de Último EMO</label>
                <input
                  type="date"
                  required
                  value={emoDateInput}
                  onChange={(e) => setEmoDateInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none text-slate-700 font-mono"
                />
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEmoModal(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-100"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RENOVAR CONTRATO */}
      {contractModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 animate-slide-in space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Corregir / Renovar Contrato
              </h3>
              <button 
                onClick={() => setContractModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-xs text-slate-500 font-semibold">
              Colaborador: <span className="text-slate-800 font-bold">{contractModal.nombres}</span>
            </div>

            <form onSubmit={handleSaveRenewContract} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Modalidad de Contrato</label>
                <select
                  required
                  value={contractFormInput.modalidad_contrato_id}
                  onChange={(e) => setContractFormInput({ ...contractFormInput, modalidad_contrato_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none text-slate-700"
                >
                  <option value="">Seleccione Modalidad</option>
                  {modalidades.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha de Inicio</label>
                <input
                  type="date"
                  required
                  value={contractFormInput.fecha_inicio}
                  onChange={(e) => setContractFormInput({ ...contractFormInput, fecha_inicio: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none text-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha de Término (Opcional)</label>
                <input
                  type="date"
                  value={contractFormInput.fecha_fin}
                  onChange={(e) => setContractFormInput({ ...contractFormInput, fecha_fin: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none text-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Enlace PDF / Archivo</label>
                <input
                  type="text"
                  placeholder="URL o nombre del archivo pdf..."
                  value={contractFormInput.archivo_pdf}
                  onChange={(e) => setContractFormInput({ ...contractFormInput, archivo_pdf: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none text-slate-700"
                />
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setContractModal(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-100"
                >
                  Confirmar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTRAR VACACIONES */}
      {vacationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 animate-slide-in space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Registrar Vacaciones Gozadas
              </h3>
              <button 
                onClick={() => setVacationModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-xs text-slate-500 font-semibold">
              Colaborador: <span className="text-slate-800 font-bold">{vacationModal.nombres}</span>
            </div>

            <form onSubmit={handleSaveVacation} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    required
                    value={vacationFormInput.fecha_inicio}
                    onChange={(e) => setVacationFormInput({ ...vacationFormInput, fecha_inicio: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none text-slate-700 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    required
                    value={vacationFormInput.fecha_fin}
                    onChange={(e) => setVacationFormInput({ ...vacationFormInput, fecha_fin: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none text-slate-700 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Días Calculados</label>
                <div className="px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm font-bold text-slate-800">
                  {calculatedVacationDays} días
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Notas / Observaciones</label>
                <textarea
                  rows={2}
                  value={vacationFormInput.notas}
                  onChange={(e) => setVacationFormInput({ ...vacationFormInput, notas: e.target.value })}
                  placeholder="Detallar descanso vacacional..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none text-slate-700"
                />
                <span className="text-[9px] text-slate-400 block mt-1">
                  * Estos días se guardarán en la bitácora histórica y reducirán el saldo acumulado en riesgo.
                </span>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setVacationModal(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-100"
                >
                  Registrar Goce
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Sede/Company Inconsistencies */}
      {isInconsistenciasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl border border-slate-100 flex flex-col space-y-4 animate-scale-up max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Revisión de Excepciones de Sede
              </h3>
              <button 
                onClick={() => setIsInconsistenciasModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 leading-normal flex-shrink-0">
              Los siguientes colaboradores se han registrado en sedes que no corresponden a su empresa facturadora. Confirma la aprobación de cada caso para habilitar su ficha formalmente y retirar la alerta.
            </p>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {/* Sección 1: Pendientes de Aprobación */}
              <div className="space-y-2 text-left">
                <h4 className="text-[10px] font-bold text-red-600 bg-red-50 px-3 py-1 rounded-md uppercase tracking-wider inline-block">
                  Pendientes de Aprobación (Bloqueados)
                </h4>
                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 bg-white">
                  {(() => {
                    const list = personas.filter(p => {
                      const activeVincs = p.vinculos_laborales?.filter((v: any) => v.estado === "Activo") || [];
                      return activeVincs.some((v: any) => v.excepcion_sede && !v.excepcion_aprobada);
                    }).map(p => {
                      const activeVinc = p.vinculos_laborales.find((v: any) => v.estado === "Activo" && v.excepcion_sede && !v.excepcion_aprobada);
                      return {
                        personaId: p.id,
                        vinculoId: activeVinc.id,
                        nombres: `${p.apellidos}, ${p.nombres}`,
                        dni: p.numero_documento,
                        empresa: activeVinc.empresas_internas?.razon_social || "Desconocida",
                        sede: activeVinc.sedes?.nombre || "Desconocida",
                        cliente: activeVinc.sedes?.clientes?.razon_social || "No especificado"
                      };
                    });

                    if (list.length === 0) {
                      return (
                        <div className="p-6 text-center text-slate-400 text-xs">
                          No hay excepciones pendientes de aprobación.
                        </div>
                      );
                    }

                    return list.map((item) => (
                      <div key={item.vinculoId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-800">{item.nombres}</p>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">DNI: {item.dni}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 pt-1 text-xs text-slate-600">
                            <div>
                              <span className="font-semibold text-slate-400">Empresa:</span> {item.empresa}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-400">Cliente/Sede:</span> {item.cliente} / {item.sede}
                            </div>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          disabled={approvingId === item.vinculoId}
                          onClick={() => handleApproveException(item.vinculoId)}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-50 cursor-pointer shrink-0"
                        >
                          {approvingId === item.vinculoId ? "Aprobando..." : "Aprobar Excepción"}
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Sección 2: Aprobados Pendientes de Regularizar */}
              <div className="space-y-2 text-left pt-2">
                <h4 className="text-[10px] font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-md uppercase tracking-wider inline-block">
                  Aprobados Temporalmente (Pendientes de Regularizar)
                </h4>
                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 bg-white">
                  {(() => {
                    const list: any[] = [];
                    personas.forEach(p => {
                      const activeVincs = p.vinculos_laborales?.filter((v: any) => v.estado === "Activo" && v.excepcion_sede && v.excepcion_aprobada) || [];
                      activeVincs.forEach((v: any) => {
                        const belongsToCompany = v.sedes?.clientes?.empresa_interna_id === v.empresa_interna_id;
                        if (!belongsToCompany) {
                          list.push({
                            personaId: p.id,
                            vinculoId: v.id,
                            nombres: `${p.apellidos}, ${p.nombres}`,
                            dni: p.numero_documento,
                            empresa: v.empresas_internas?.razon_social || "Desconocida",
                            sede: v.sedes?.nombre || "Desconocida",
                            cliente: v.sedes?.clientes?.razon_social || "No especificado"
                          });
                        }
                      });
                    });

                    if (list.length === 0) {
                      return (
                        <div className="p-6 text-center text-slate-400 text-xs">
                          No hay excepciones aprobadas pendientes de regularización.
                        </div>
                      );
                    }

                    return list.map((item) => (
                      <div key={item.vinculoId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30 animate-fade-in">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-800">{item.nombres}</p>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">DNI: {item.dni}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 pt-1 text-xs text-slate-600">
                            <div>
                              <span className="font-semibold text-slate-400">Empresa:</span> {item.empresa}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-400">Cliente/Sede:</span> {item.cliente} / {item.sede}
                            </div>
                          </div>
                        </div>
                        
                        <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 text-center">
                          Aprobado temporal
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-end flex-shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setIsInconsistenciasModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-colors cursor-pointer bg-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {successMessage && (
        <div className="fixed bottom-5 right-5 z-[100] flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-800 animate-slide-in text-xs font-semibold">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-slate-900 shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span>{successMessage}</span>
          <button 
            onClick={() => setSuccessMessage(null)}
            className="text-slate-400 hover:text-white ml-2 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
