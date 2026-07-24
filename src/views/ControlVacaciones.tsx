import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import * as XLSX from "xlsx";
import { 
  Calendar, 
  Search, 
  Plus, 
  Trash2, 
  Clock, 
  Check, 
  X, 
  RefreshCw, 
  AlertCircle, 
  Printer, 
  Building, 
  User, 
  Filter, 
  ArrowUpDown,
  Download,
  Info,
  CalendarDays,
  FileSpreadsheet,
  FileDown,
  Upload,
  AlertTriangle
} from "lucide-react";

export function ControlVacaciones() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data lists
  const [personas, setPersonas] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [regimenes, setRegimenes] = useState<any[]>([]);
  
  // Selection / Modal state
  const [selectedPersona, setSelectedPersona] = useState<any | null>(null);
  const [activeVinculo, setActiveVinculo] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vacationForm, setVacationForm] = useState({
    fecha_inicio: "",
    fecha_fin: "",
    periodo: "",
    notas: ""
  });
  
  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos"); // todos, critico, proximo, normal
  const [filterSede, setFilterSede] = useState("todas");
  const [filterEmpresa, setFilterEmpresa] = useState("todas");
  const [filterRegimen, setFilterRegimen] = useState("todos");
  const [filterCliente, setFilterCliente] = useState("todos");
  const [filterVinculoEstado, setFilterVinculoEstado] = useState("Activo"); // Activo, Todos, Inactivo
  
  // Printing state
  const [printingRequest, setPrintingRequest] = useState(false);
  const [printType, setPrintType] = useState<"solicitud" | "kardex">("solicitud");

  // Bulk Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState({
    processed: 0,
    total: 0,
    successCount: 0,
    errors: [] as any[]
  });

  // Load everything
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch lookups
      const [sedesRes, empresasRes, regRes] = await Promise.all([
        supabase.from("sedes").select("id, nombre, cliente_id, clientes(id, razon_social, empresa_interna_id)").eq("activo", true),
        supabase.from("empresas_internas").select("id, razon_social").eq("activo", true),
        supabase.from("regimenes_laborales").select("id, nombre, dias_vacaciones")
      ]);
      
      setSedes(sedesRes.data || []);
      setEmpresas(empresasRes.data || []);
      setRegimenes(regRes.data || []);

      // 2. Fetch personas with vinculos and vacations
      const { data: resData, error: dbError } = await supabase
        .from("personas")
        .select(`
          id,
          nombres,
          apellidos,
          numero_documento,
          correo,
          fecha_ingreso,
          vinculos_laborales (
            id,
            estado,
            empresa_interna_id,
            sede_id,
            cargo_id,
            regimen_laboral_id,
            creado_en,
            regimenes_laborales (id, nombre, dias_vacaciones),
            cargos (id, nombre),
            empresas_internas (id, razon_social),
            sedes (id, nombre, cliente_id, clientes (id, razon_social)),
            contratos (
              id,
              fecha_inicio,
              estado
            ),
            vacaciones_historico (
              id,
              fecha_inicio,
              fecha_fin,
              dias_calendario,
              notas,
              creado_en,
              periodo_inicio,
              periodo_fin
            )
          )
        `)
        .order("apellidos", { ascending: true });

      if (dbError) throw dbError;
      setPersonas(resData || []);
    } catch (err: any) {
      console.error("Error loading vacations data:", err);
      setError(err.message || "Error al cargar la información vacacional.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper: Get fallback entry date based on first contract
  const getFechaIngresoFallback = (vinculosList: any[], person: any): string | null => {
    if (person?.fecha_ingreso) return person.fecha_ingreso;
    const dates = vinculosList
      .flatMap((v: any) => v.contratos || [])
      .map((c: any) => c.fecha_inicio)
      .filter(Boolean);
    if (dates.length === 0) return null;
    dates.sort();
    return dates[0];
  };

  // Helper: Format date
  const formatDMY = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Helper: Calculate individual vacations metrics
  const getVacationMetrics = (person: any, v: any) => {
    if (!person || !v) return { years: 0, earned: 0, taken: 0, balance: 0, periodos: 0, status: "normal", startDateStr: "", isFromContract: false, hasContract: false, daysPerYear: 30 };

    // Para el cálculo continuo de vacaciones, se debe usar la fecha de ingreso inicial de la relación laboral
    const startDateStr = person.fecha_ingreso || getFechaIngresoFallback(person.vinculos_laborales || [], person) || v.creado_en;
    const isFromContract = false;
    const hasContract = !!(v.contratos && v.contratos.length > 0);

    const startDate = new Date(startDateStr);
    const today = new Date();
    
    // Years of service
    const diffTime = today.getTime() - startDate.getTime();
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    const years = Math.max(0, parseFloat(diffYears.toFixed(2)));

    // Days earned according to regime
    const daysPerYear = v.regimenes_laborales?.dias_vacaciones || 30;
    const earned = Math.floor(years * daysPerYear);

    // Days taken
    const taken = v.vacaciones_historico?.reduce((sum: number, vac: any) => sum + (vac.dias_calendario || 0), 0) ?? 0;

    // Balance
    const balance = Math.max(0, earned - taken);
    const periodos = parseFloat((balance / daysPerYear).toFixed(2));

    // Status: critical if >= 2 periods, proximo if >= 2 periods - 10 days
    const limit = daysPerYear * 2;
    let status = "normal";
    if (balance >= limit) {
      status = "critico";
    } else if (balance >= limit - 10) {
      status = "proximo";
    }

    return { years, earned, taken, balance, periodos, status, daysPerYear, startDateStr, isFromContract, hasContract };
  };

  // Calculate metrics for selected person's active vinculo
  const selectedMetrics = activeVinculo ? getVacationMetrics(selectedPersona, activeVinculo) : null;

  // Helper: Calculate periods dynamically based on entry date
  const calculatePeriods = (startDateStr: string | null) => {
    if (!startDateStr) return [];
    const periods = [];
    const entryDate = new Date(startDateStr);
    const today = new Date();
    
    // Safety check for extremely old dates or future dates
    if (isNaN(entryDate.getTime())) return [];
    
    let currentStart = new Date(entryDate);
    
    while (currentStart < today) {
      const currentEnd = new Date(currentStart);
      currentEnd.setFullYear(currentEnd.getFullYear() + 1);
      currentEnd.setDate(currentEnd.getDate() - 1);
      
      const startStr = currentStart.toISOString().split("T")[0];
      const endStr = currentEnd.toISOString().split("T")[0];
      
      periods.push({
        start: startStr,
        end: endStr,
        label: `${formatDMY(startStr)} al ${formatDMY(endStr)}`
      });
      
      currentStart.setFullYear(currentStart.getFullYear() + 1);
    }
    
    return periods.reverse();
  };

  const availablePeriods = React.useMemo(() => {
    if (!selectedMetrics || !selectedMetrics.startDateStr) return [];
    return calculatePeriods(selectedMetrics.startDateStr);
  }, [selectedMetrics]);

  useEffect(() => {
    if (availablePeriods.length > 0 && !vacationForm.periodo) {
      setVacationForm(prev => ({ ...prev, periodo: `${availablePeriods[0].start}|${availablePeriods[0].end}` }));
    }
  }, [availablePeriods, isModalOpen]);

  const getVacationPeriodKey = (vac: any, periods: any[]) => {
    if (vac.periodo_inicio && vac.periodo_fin) {
      return `${vac.periodo_inicio}|${vac.periodo_fin}`;
    }
    if (!vac.fecha_inicio) return "";
    const sortedPeriods = [...periods].sort((a, b) => b.start.localeCompare(a.start));
    for (const p of sortedPeriods) {
      if (vac.fecha_inicio >= p.start) {
        return `${p.start}|${p.end}`;
      }
    }
    return periods.length > 0 ? `${periods[periods.length - 1].start}|${periods[periods.length - 1].end}` : "";
  };

  const distributeVacationDays = (
    startDateStr: string,
    endDateStr: string,
    vacacionesHistorico: any[],
    periods: any[],
    daysPerYear: number,
    startPeriodKey?: string
  ) => {
    const start = new Date(startDateStr + "T12:00:00");
    const end = new Date(endDateStr + "T12:00:00");
    const diffTime = end.getTime() - start.getTime();
    let totalDaysToDistribute = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (totalDaysToDistribute <= 0) return [];

    let sortedPeriods = [...periods].sort((a, b) => a.start.localeCompare(b.start));

    // Si se especifica un periodo de inicio, ignoramos los anteriores
    if (startPeriodKey && startPeriodKey !== "auto") {
      const [startPKey] = startPeriodKey.split("|");
      const startIndex = sortedPeriods.findIndex(p => p.start === startPKey);
      if (startIndex !== -1) {
        sortedPeriods = sortedPeriods.slice(startIndex);
      }
    }

    const periodsWithBalance = sortedPeriods.map(p => {
      const goces = vacacionesHistorico.filter((v: any) => {
        const key = getVacationPeriodKey(v, periods);
        return key === `${p.start}|${p.end}`;
      });

      const taken = goces.reduce((sum: number, v: any) => sum + (v.dias_calendario || 0), 0);
      const balance = Math.max(0, daysPerYear - taken);
      return {
        ...p,
        balance,
        taken
      };
    });

    const parts: any[] = [];
    let currentStartDateStr = startDateStr;

    for (const p of periodsWithBalance) {
      if (totalDaysToDistribute <= 0) break;

      if (p.balance > 0) {
        const daysToConsume = Math.min(totalDaysToDistribute, p.balance);
        const partEndDate = new Date(currentStartDateStr + "T12:00:00");
        partEndDate.setDate(partEndDate.getDate() + daysToConsume - 1);
        const partEndDateStr = partEndDate.toISOString().split("T")[0];

        parts.push({
          periodo_inicio: p.start,
          periodo_fin: p.end,
          fecha_inicio: currentStartDateStr,
          fecha_fin: partEndDateStr,
          dias_calendario: daysToConsume
        });

        totalDaysToDistribute -= daysToConsume;

        const nextStartDate = new Date(partEndDateStr + "T12:00:00");
        nextStartDate.setDate(nextStartDate.getDate() + 1);
        currentStartDateStr = nextStartDate.toISOString().split("T")[0];
      }
    }

    // Si aún quedan días y hay periodos, los asignamos al periodo más reciente (adelanto de vacaciones)
    if (totalDaysToDistribute > 0 && periodsWithBalance.length > 0) {
      const newestPeriod = periodsWithBalance[periodsWithBalance.length - 1];
      const partEndDate = new Date(currentStartDateStr + "T12:00:00");
      partEndDate.setDate(partEndDate.getDate() + totalDaysToDistribute - 1);
      const partEndDateStr = partEndDate.toISOString().split("T")[0];

      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.periodo_inicio === newestPeriod.start) {
        lastPart.fecha_fin = partEndDateStr;
        lastPart.dias_calendario += totalDaysToDistribute;
      } else {
        parts.push({
          periodo_inicio: newestPeriod.start,
          periodo_fin: newestPeriod.end,
          fecha_inicio: currentStartDateStr,
          fecha_fin: partEndDateStr,
          dias_calendario: totalDaysToDistribute
        });
      }
    }

    return parts;
  };

  const periodSummary = React.useMemo(() => {
    if (!selectedPersona || !activeVinculo || !availablePeriods.length) return [];
    
    return availablePeriods.map(p => {
      const goces = activeVinculo.vacaciones_historico?.filter((v: any) => {
        const key = getVacationPeriodKey(v, availablePeriods);
        return key === `${p.start}|${p.end}`;
      }) || [];
      
      const taken = goces.reduce((sum: number, v: any) => sum + (v.dias_calendario || 0), 0);
      const earned = activeVinculo.regimenes_laborales?.dias_vacaciones || 30;
      const balance = Math.max(0, earned - taken);
      
      return {
        ...p,
        earned,
        taken,
        balance,
        goces
      };
    });
  }, [selectedPersona, activeVinculo, availablePeriods]);

  // Bulk Template and Importer logic
  const downloadExcelTemplate = () => {
    const headers = [
      "DNI",
      "Inicio Periodo Vacacional",
      "Fin Periodo Vacacional",
      "Fecha de Salida",
      "Fecha de Retorno",
      "Observacion"
    ];
    
    const exampleRow1 = [
      "45666182",
      "01-11-2024",
      "31-10-2025",
      "17-03-2026",
      "31-03-2026",
      "Goce del primer periodo vacacional"
    ];
    const exampleRow2 = [
      "71234567",
      "15-05-2025",
      "14-05-2026",
      "20-05-2026",
      "03-06-2026",
      "Adelanto de vacaciones"
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow1, exampleRow2]);
    
    ws["!cols"] = [
      { wch: 12 },
      { wch: 24 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Importacion");
    XLSX.writeFile(wb, "plantilla_importacion_vacaciones.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
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
          setImporting(false);
          return;
        }

        const headers = jsonData[0].map((h: any) => String(h || "").trim().toLowerCase());
        const dniIdx = headers.indexOf("dni");
        const inicioPeriodoIdx = headers.findIndex(h => h.includes("inicio") && h.includes("periodo"));
        const finPeriodoIdx = headers.findIndex(h => h.includes("fin") && h.includes("periodo"));
        const salidaIdx = headers.findIndex(h => h.includes("salida"));
        const retornoIdx = headers.findIndex(h => h.includes("retorno") || (h.includes("fin") && !h.includes("periodo")));
        const obsIdx = headers.findIndex(h => h.includes("observacion") || h.includes("nota"));

        if (dniIdx === -1 || salidaIdx === -1 || retornoIdx === -1 || inicioPeriodoIdx === -1 || finPeriodoIdx === -1) {
          alert("No se encontraron las columnas requeridas: 'DNI', 'Inicio Periodo Vacacional', 'Fin Periodo Vacacional', 'Fecha de Salida', 'Fecha de Retorno'.");
          setImporting(false);
          return;
        }

        const parseDate = (val: any): string | null => {
          if (!val) return null;
          if (val instanceof Date) {
            if (isNaN(val.getTime())) return null;
            const yyyy = val.getFullYear();
            const mm = String(val.getMonth() + 1).padStart(2, "0");
            const dd = String(val.getDate()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd}`;
          }
          const num = Number(val);
          if (!isNaN(num) && num > 10000 && num < 100000) {
            const date = new Date((num - 25569) * 86400 * 1000);
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, "0");
            const dd = String(date.getDate()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd}`;
          }
          const str = String(val).trim();
          const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
          if (dmy) {
            const date = new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
            if (!isNaN(date.getTime())) {
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            }
          }
          const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
          if (ymd) {
            const date = new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
            if (!isNaN(date.getTime())) {
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            }
          }
          return null;
        };

        const parsedRows: any[] = [];
        let errorsCount = 0;

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === "")) {
            continue;
          }

          const rowNum = i + 1;
          const rawDni = String(row[dniIdx] || "").trim();
          const rawInicioPeriodo = row[inicioPeriodoIdx];
          const rawFinPeriodo = row[finPeriodoIdx];
          const rawSalida = row[salidaIdx];
          const rawRetorno = row[retornoIdx];
          const rawObs = obsIdx !== -1 ? String(row[obsIdx] || "").trim() : "";

          const errors: string[] = [];

          if (!rawDni) errors.push("DNI es obligatorio.");
          const person = personas.find(p => String(p.numero_documento).trim() === rawDni);
          
          let activeVinculoId = null;
          let colabName = "";

          if (rawDni && !person) {
            errors.push(`DNI '${rawDni}' no encontrado en el sistema.`);
          } else if (person) {
            colabName = `${person.apellidos}, ${person.nombres}`;
            const activeV = person.vinculos_laborales?.find((v: any) => v.estado === "Activo");
            if (!activeV) {
              errors.push(`El colaborador no tiene un contrato ACTIVO.`);
            } else {
              activeVinculoId = activeV.id;
            }
          }

          const parsedInicioPeriodo = parseDate(rawInicioPeriodo);
          const parsedFinPeriodo = parseDate(rawFinPeriodo);
          const parsedSalida = parseDate(rawSalida);
          const parsedRetorno = parseDate(rawRetorno);

          if (!rawInicioPeriodo) errors.push("Inicio del Periodo es obligatorio.");
          else if (!parsedInicioPeriodo) errors.push(`Fecha de inicio de periodo '${rawInicioPeriodo}' inválida.`);

          if (!rawFinPeriodo) errors.push("Fin del Periodo es obligatorio.");
          else if (!parsedFinPeriodo) errors.push(`Fecha de fin de periodo '${rawFinPeriodo}' inválida.`);

          if (!rawSalida) errors.push("Fecha de Salida es obligatoria.");
          else if (!parsedSalida) errors.push(`Fecha de salida '${rawSalida}' inválida.`);

          if (!rawRetorno) errors.push("Fecha de Retorno es obligatoria.");
          else if (!parsedRetorno) errors.push(`Fecha de retorno '${rawRetorno}' inválida.`);

          let dias = 0;
          if (parsedSalida && parsedRetorno) {
            const start = new Date(parsedSalida);
            const end = new Date(parsedRetorno);
            const diffTime = end.getTime() - start.getTime();
            dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            if (dias <= 0) {
              errors.push("La fecha de salida debe ser anterior o igual a la de retorno.");
            }
          }

          const isValid = errors.length === 0;

          if (isValid && person) {
            const activeV = person.vinculos_laborales?.find((v: any) => v.estado === "Activo");
            const startDateStr = person.fecha_ingreso || getFechaIngresoFallback(person.vinculos_laborales || [], person) || activeV.creado_en;
            const employeePeriods = calculatePeriods(startDateStr);
            const daysPerYear = activeV.regimenes_laborales?.dias_vacaciones || 30;
            const vacationHistory = activeV.vacaciones_historico || [];

            // Distribuimos desde el periodo del Excel si coincide, o hacemos FIFO desde el inicio (auto)
            const startPeriodKey = (parsedInicioPeriodo && parsedFinPeriodo) ? `${parsedInicioPeriodo}|${parsedFinPeriodo}` : "auto";

            const distributedParts = distributeVacationDays(
              parsedSalida!,
              parsedRetorno!,
              vacationHistory,
              employeePeriods,
              daysPerYear,
              startPeriodKey
            );

            if (distributedParts.length > 0) {
              distributedParts.forEach((part, idx) => {
                const noteSuffix = distributedParts.length > 1 ? ` (Parte ${idx + 1} de ${distributedParts.length})` : "";
                parsedRows.push({
                  rowNumber: rowNum,
                  dni: rawDni,
                  colaborador: colabName || "Desconocido",
                  periodo_inicio: part.periodo_inicio,
                  periodo_fin: part.periodo_fin,
                  fecha_inicio: part.fecha_inicio,
                  fecha_fin: part.fecha_fin,
                  dias_calendario: part.dias_calendario,
                  notas: (rawObs || "Carga masiva Excel") + noteSuffix,
                  isValid: true,
                  errors: [],
                  vinculo_laboral_id: activeVinculoId
                });
              });
            } else {
              errorsCount++;
              parsedRows.push({
                rowNumber: rowNum,
                dni: rawDni,
                colaborador: colabName || "Desconocido",
                periodo_inicio: parsedInicioPeriodo,
                periodo_fin: parsedFinPeriodo,
                fecha_inicio: parsedSalida,
                fecha_fin: parsedRetorno,
                dias_calendario: dias,
                notas: rawObs,
                isValid: false,
                errors: ["Error al distribuir los días de vacaciones por periodos."],
                vinculo_laboral_id: activeVinculoId
              });
            }
          } else {
            errorsCount++;
            parsedRows.push({
              rowNumber: rowNum,
              dni: rawDni,
              colaborador: colabName || "Desconocido",
              periodo_inicio: parsedInicioPeriodo,
              periodo_fin: parsedFinPeriodo,
              fecha_inicio: parsedSalida,
              fecha_fin: parsedRetorno,
              dias_calendario: dias,
              notas: rawObs,
              isValid: false,
              errors,
              vinculo_laboral_id: activeVinculoId
            });
          }
        }

        setImportRows(parsedRows);
        setImportStatus({
          processed: 0,
          total: parsedRows.length,
          successCount: parsedRows.length - errorsCount,
          errors: parsedRows.filter(r => !r.isValid)
        });

      } catch (err: any) {
        console.error("Error reading Excel:", err);
        alert("Error al leer el archivo Excel: " + err.message);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const executeBulkImport = async () => {
    const validRows = importRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert("No hay registros válidos para importar.");
      return;
    }

    setImporting(true);
    let successCount = 0;
    const batchSize = 50;

    try {
      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        const payloads = batch.map(r => ({
          vinculo_laboral_id: r.vinculo_laboral_id,
          fecha_inicio: r.fecha_inicio,
          fecha_fin: r.fecha_fin,
          dias_calendario: r.dias_calendario,
          periodo_inicio: r.periodo_inicio,
          periodo_fin: r.periodo_fin,
          notas: r.notas || "Carga masiva Excel"
        }));

        const { error: insertError } = await supabase
          .from("vacaciones_historico")
          .insert(payloads);

        if (insertError) throw insertError;
        successCount += batch.length;
        
        setImportStatus(prev => ({
          ...prev,
          processed: successCount
        }));
      }

      alert(`Se importaron ${successCount} registros de vacaciones con éxito.`);
      setIsImportModalOpen(false);
      setImportRows([]);
      await loadData();
      
    } catch (err: any) {
      console.error("Error importing:", err);
      alert("Error al registrar vacaciones: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorReport = () => {
    const errorRows = importRows.filter(r => !r.isValid);
    if (errorRows.length === 0) {
      alert("No hay errores para exportar.");
      return;
    }

    const headers = ["Fila Excel", "DNI", "Colaborador", "Detalle de Errores"];
    const rows = errorRows.map(r => [
      r.rowNumber,
      r.dni,
      r.colaborador,
      r.errors.join(" | ")
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    ws["!cols"] = [
      { wch: 10 },
      { wch: 12 },
      { wch: 25 },
      { wch: 50 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Errores de Importacion");
    XLSX.writeFile(wb, "errores_importacion_vacaciones.xlsx");
  };

  const handlePrint = (type: "solicitud" | "kardex") => {
    setPrintType(type);
    setPrintingRequest(true);
    setTimeout(() => {
      setPrintingRequest(false);
      window.print();
    }, 1200);
  };

  const uniqueClientes = React.useMemo(() => {
    const map = new Map<number, string>();
    sedes.forEach(s => {
      if (s.clientes) {
        if (filterEmpresa === "todas" || String(s.clientes.empresa_interna_id) === filterEmpresa) {
          map.set(s.clientes.id, s.clientes.razon_social);
        }
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sedes, filterEmpresa]);

  const filteredSedesForDropdown = React.useMemo(() => {
    return sedes.filter(s => {
      if (filterEmpresa !== "todas" && s.clientes && String(s.clientes.empresa_interna_id) !== filterEmpresa) {
        return false;
      }
      if (filterCliente !== "todos" && String(s.cliente_id) !== filterCliente) {
        return false;
      }
      return true;
    });
  }, [sedes, filterEmpresa, filterCliente]);

  // Process and compute rows with active job link
  const processedRows = React.useMemo(() => {
    return personas.flatMap(p => {
      const links = p.vinculos_laborales || [];
      
      // If filtering by specific link state
      const filteredLinks = links.filter((l: any) => {
        if (filterVinculoEstado === "Todos") return true;
        return l.estado === filterVinculoEstado;
      });

      return filteredLinks.map((v: any) => {
        const metrics = getVacationMetrics(p, v);
        return {
          persona: p,
          vinculo: v,
          metrics
        };
      });
    });
  }, [personas, filterVinculoEstado]);

  // Apply filters
  const filteredRows = React.useMemo(() => {
    return processedRows.filter(row => {
      // 1. Text Search (Nombres, Apellidos, DNI)
      const q = searchQuery.toLowerCase();
      if (q) {
        const fullName = `${row.persona.nombres} ${row.persona.apellidos}`.toLowerCase();
        const dni = row.persona.numero_documento.toLowerCase();
        const cargo = (row.vinculo.cargos?.nombre || "").toLowerCase();
        if (!fullName.includes(q) && !dni.includes(q) && !cargo.includes(q)) return false;
      }

      // 2. Alert Status
      if (filterStatus !== "todos") {
        if (row.metrics.status !== filterStatus) return false;
      }

      // 3. Sede
      if (filterSede !== "todas") {
        if (row.vinculo.sede_id?.toString() !== filterSede) return false;
      }

      // 4. Empresa
      if (filterEmpresa !== "todas") {
        if (row.vinculo.empresa_interna_id?.toString() !== filterEmpresa) return false;
      }

      // 5. Régimen Laboral
      if (filterRegimen !== "todos") {
        if (row.vinculo.regimenes_laborales?.nombre !== filterRegimen) return false;
      }

      // 6. Cliente
      if (filterCliente !== "todos") {
        if (!row.vinculo.sedes || String(row.vinculo.sedes.cliente_id) !== filterCliente) return false;
      }

      return true;
    });
  }, [processedRows, searchQuery, filterStatus, filterSede, filterEmpresa, filterRegimen, filterCliente]);

  // General KPIs based on ACTIVE status rows
  const stats = React.useMemo(() => {
    const activeRows = processedRows.filter(r => r.vinculo.estado === "Activo");
    const total = activeRows.length;
    const criticos = activeRows.filter(r => r.metrics.status === "critico").length;
    const proximos = activeRows.filter(r => r.metrics.status === "proximo").length;
    const totalGozados = activeRows.reduce((acc, curr) => acc + curr.metrics.taken, 0);

    return { total, criticos, proximos, totalGozados };
  }, [processedRows]);

  // Open detail panel / modal
  const handleOpenDetails = (row: any) => {
    setSelectedPersona(row.persona);
    setActiveVinculo(row.vinculo);
    setVacationForm({
      fecha_inicio: new Date().toISOString().split("T")[0],
      fecha_fin: "",
      periodo: "auto",
      notas: ""
    });
    setIsModalOpen(true);
  };

  // Register Vacation Goce
  const handleSaveVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacationForm.fecha_inicio || !vacationForm.fecha_fin) {
      alert("Por favor completa las fechas de inicio y fin.");
      return;
    }
    
    let startPeriodKey = "auto";
    if (vacationForm.periodo !== "auto") {
      const parts = vacationForm.periodo.split("|");
      if (parts.length === 2) {
        startPeriodKey = vacationForm.periodo;
      } else {
        alert("Por favor, seleccione el periodo vacacional correspondiente.");
        return;
      }
    }

    const start = new Date(vacationForm.fecha_inicio);
    const end = new Date(vacationForm.fecha_fin);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays <= 0) {
      alert("La fecha de fin debe ser posterior o igual a la de inicio.");
      return;
    }

    setLoading(true);
    try {
      const daysPerYear = activeVinculo.regimenes_laborales?.dias_vacaciones || 30;
      const distributedParts = distributeVacationDays(
        vacationForm.fecha_inicio,
        vacationForm.fecha_fin,
        activeVinculo.vacaciones_historico || [],
        availablePeriods,
        daysPerYear,
        startPeriodKey
      );

      if (distributedParts.length === 0) {
        alert("No se pudieron distribuir los días de vacaciones.");
        setLoading(false);
        return;
      }

      const payloads = distributedParts.map((part, idx) => {
        const noteSuffix = distributedParts.length > 1 ? ` (Parte ${idx + 1} de ${distributedParts.length})` : "";
        return {
          vinculo_laboral_id: activeVinculo.id,
          fecha_inicio: part.fecha_inicio,
          fecha_fin: part.fecha_fin,
          dias_calendario: part.dias_calendario,
          periodo_inicio: part.periodo_inicio,
          periodo_fin: part.periodo_fin,
          notas: (vacationForm.notas || "Registro de descanso físico") + noteSuffix
        };
      });

      const { error: insertError } = await supabase
        .from("vacaciones_historico")
        .insert(payloads);

      if (insertError) throw insertError;

      // Close modal or reload
      alert(`Descanso vacacional registrado con éxito (${distributedParts.length} periodo(s) afectado(s)).`);
      await loadData();
      
      // Update selected states to reflect changes in details panel
      const updatedPersona = personas.find(p => p.id === selectedPersona.id);
      if (updatedPersona) {
        const updatedVinculo = updatedPersona.vinculos_laborales.find((v: any) => v.id === activeVinculo.id);
        setSelectedPersona(updatedPersona);
        setActiveVinculo(updatedVinculo);
      }
      
      setVacationForm({
        fecha_inicio: new Date().toISOString().split("T")[0],
        fecha_fin: "",
        periodo: "auto",
        notas: ""
      });

    } catch (err: any) {
      console.error("Error inserting vacation:", err);
      alert("Error al registrar vacaciones: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Vacation Goce
  const handleDeleteVacation = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este descanso vacacional? Los días se sumarán de vuelta al saldo del colaborador.")) {
      return;
    }

    setLoading(true);
    try {
      const { error: dbErr } = await supabase
        .from("vacaciones_historico")
        .delete()
        .eq("id", id);

      if (dbErr) throw dbErr;

      alert("Registro de vacaciones eliminado.");
      await loadData();

      // Update selected states
      const updatedPersona = personas.find(p => p.id === selectedPersona.id);
      if (updatedPersona) {
        const updatedVinculo = updatedPersona.vinculos_laborales.find((v: any) => v.id === activeVinculo.id);
        setSelectedPersona(updatedPersona);
        setActiveVinculo(updatedVinculo);
      }

    } catch (e: any) {
      console.error("Error deleting vacation:", e);
      alert("Error al eliminar vacaciones: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintRequest = () => {
    setPrintingRequest(true);
    setTimeout(() => {
      setPrintingRequest(false);
      window.print();
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 flex-shrink-0 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Recursos Humanos / Control Interno
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-8 h-8 text-emerald-600" />
            Control de Vacaciones
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Monitorea el balance de descansos físicos del personal y previene contingencias legales por acumulación excesiva de periodos vacacionales.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start md:self-auto">
          {(localStorage.getItem("bax_role") || "admin") === "admin" && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 border border-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer shadow-md shadow-emerald-100"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Carga Masiva
            </button>
          )}
          
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Recargar Datos
          </button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <User className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Monitoreados Activos</span>
            <span className="text-2xl font-black text-slate-800">{stats.total}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-red-50 text-red-650 rounded-xl">
            <AlertCircle className="w-6 h-6 text-red-600 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Estado Crítico (2+ Per.)</span>
            <span className="text-2xl font-black text-red-600">{stats.criticos}</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-55 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Próximos a 2 Periodos</span>
            <span className="text-2xl font-black text-amber-650 text-amber-600">{stats.proximos}</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Días Gozados (Suma Activos)</span>
            <span className="text-2xl font-black text-blue-650 text-blue-600">{stats.totalGozados} d</span>
          </div>
        </div>

      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Nombre, Apellidos, DNI o Cargo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-100 focus:outline-none bg-white font-medium text-slate-700"
            />
          </div>
          
          {/* Main quick filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setFilterVinculoEstado("Activo")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer ${
                  filterVinculoEstado === "Activo"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 bg-transparent"
                }`}
              >
                Activos
              </button>
              <button
                onClick={() => setFilterVinculoEstado("Todos")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer ${
                  filterVinculoEstado === "Todos"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 bg-transparent"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterVinculoEstado("Inactivo")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer ${
                  filterVinculoEstado === "Inactivo"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 bg-transparent"
                }`}
              >
                Cesados
              </button>
            </div>
          </div>
        </div>

        {/* Dropdowns filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
          
          {/* Filter Empresa */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filtrar por Empresa</label>
            <select
              value={filterEmpresa}
              onChange={(e) => {
                const nextEmp = e.target.value;
                setFilterEmpresa(nextEmp);
                if (nextEmp !== "todas") {
                  const belongs = sedes.some(s => s.clientes && String(s.clientes.id) === filterCliente && String(s.clientes.empresa_interna_id) === nextEmp);
                  if (!belongs) {
                    setFilterCliente("todos");
                  }
                  const SedeBelongs = sedes.some(s => String(s.id) === filterSede && s.clientes && String(s.clientes.empresa_interna_id) === nextEmp);
                  if (!SedeBelongs) {
                    setFilterSede("todas");
                  }
                }
              }}
              className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="todas">Todas las Empresas</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.razon_social}</option>
              ))}
            </select>
          </div>

          {/* Filter Cliente */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filtrar por Cliente</label>
            <select
              value={filterCliente}
              onChange={(e) => {
                const nextCli = e.target.value;
                setFilterCliente(nextCli);
                if (nextCli !== "todos") {
                  const belongs = sedes.some(s => String(s.id) === filterSede && String(s.cliente_id) === nextCli);
                  if (!belongs) {
                    setFilterSede("todas");
                  }
                }
              }}
              className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos los Clientes</option>
              {uniqueClientes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Filter Sede */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filtrar por Sede</label>
            <select
              value={filterSede}
              onChange={(e) => setFilterSede(e.target.value)}
              className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="todas">Todas las Sedes</option>
              {filteredSedesForDropdown.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>

          {/* Filter Régimen */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Régimen Laboral</label>
            <select
              value={filterRegimen}
              onChange={(e) => setFilterRegimen(e.target.value)}
              className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos los Regímenes</option>
              {regimenes.map(r => (
                <option key={r.id} value={r.nombre}>{r.nombre}</option>
              ))}
            </select>
          </div>

          {/* Filter Status Alert */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estado de Alerta</label>
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-600 focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos los Estados</option>
                <option value="critico">🚨 Crítico (2+ periodos)</option>
                <option value="proximo">⚠️ Próximo a 2 periodos</option>
                <option value="normal">✅ Óptimo / Normal</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col flex-1 min-h-[400px]">
        <div className="overflow-x-auto overflow-y-auto flex-1 relative">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                <th className="px-6 py-4 bg-slate-50">Colaborador</th>
                <th className="px-6 py-4 bg-slate-50">Empresa / Puesto</th>
                <th className="px-6 py-4 bg-slate-50">Ingreso / Régimen</th>
                <th className="px-6 py-4 text-center bg-slate-50">Años Serv.</th>
                <th className="px-6 py-4 text-center bg-slate-100">Ganados</th>
                <th className="px-6 py-4 text-center bg-slate-100">Gozados</th>
                <th className="px-6 py-4 text-center bg-slate-100">Pendientes</th>
                <th className="px-6 py-4 bg-slate-50">Alerta Legal</th>
                <th className="px-6 py-4 text-right print:hidden bg-slate-50">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading && personas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                      <p className="text-slate-450 text-xs">Cargando saldos vacacionales...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Calendar className="w-10 h-10 mx-auto text-slate-350" />
                      <p className="font-semibold text-slate-700 text-xs">No se encontraron resultados</p>
                      <p className="text-[11px] text-slate-400">Prueba ajustando los filtros de búsqueda o el tipo de alerta legal.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const p = row.persona;
                  const v = row.vinculo;
                  const m = row.metrics;
                  
                  return (
                    <tr key={`${p.id}-${v.id}`} className="hover:bg-slate-50/30 transition-colors">
                      {/* Person detail */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{p.apellidos}, {p.nombres}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">DNI: {p.numero_documento}</div>
                      </td>
                      
                      {/* Job detail */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{v.cargos?.nombre || "Sin Puesto"}</div>
                        <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-2 mt-0.5">
                          <span>{v.empresas_internas?.razon_social || "Grupo Bax"}</span>
                          <span className="text-slate-200">|</span>
                          <span className="font-bold text-slate-500">{v.sedes?.nombre || "N/A"}</span>
                        </div>
                      </td>

                      {/* Regimen */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="font-mono">{formatDMY(m.startDateStr)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{v.regimenes_laborales?.nombre || "General (30d)"}</div>
                      </td>

                      {/* Years of service */}
                      <td className="px-6 py-4 text-center font-semibold font-mono">
                        {m.years} a.
                      </td>

                      {/* Ganados */}
                      <td className="px-6 py-4 text-center font-bold bg-slate-50/20 font-mono">
                        {m.earned} d
                      </td>

                      {/* Gozados */}
                      <td className="px-6 py-4 text-center font-bold text-blue-600 bg-slate-50/20 font-mono">
                        {m.taken} d
                      </td>

                      {/* Pendientes */}
                      <td className="px-6 py-4 text-center font-black text-slate-900 bg-slate-50/20 font-mono">
                        {m.balance} d
                      </td>

                      {/* Alert State Badge */}
                      <td className="px-6 py-4">
                        {m.status === "critico" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-red-50 text-red-750 border border-red-200 text-red-700 animate-pulse">
                            <AlertCircle className="w-3 h-3" />
                            CRÍTICO (2+ Per)
                          </span>
                        )}
                        {m.status === "proximo" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-500" />
                            PRÓXIMO LIMITE
                          </span>
                        )}
                        {m.status === "normal" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <Check className="w-3 h-3 text-emerald-500" />
                            ÓPTIMO
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right print:hidden">
                        <button
                          onClick={() => handleOpenDetails(row)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                        >
                          Ver Historial
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Count footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-55 bg-slate-50/30 text-xs text-slate-450 font-semibold flex items-center justify-between">
          <span>Mostrando {filteredRows.length} de {processedRows.length} registros laborales.</span>
        </div>
      </div>

      {/* Selected Person Details Modal (Drawer) */}
      {isModalOpen && selectedPersona && activeVinculo && selectedMetrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-slide-in border border-slate-100 flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-extrabold text-slate-800">
                    Saldos y Descansos: {selectedPersona.apellidos}, {selectedPersona.nombres}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {activeVinculo.cargos?.nombre || "Sin puesto"} &bull; {activeVinculo.sedes?.nombre || "Sin sede"} &bull; DNI: {selectedPersona.numero_documento}
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-655 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
              
              {/* Metrics side (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                <div className={`p-4 rounded-xl border space-y-4 ${
                  selectedMetrics.status === "critico" ? "bg-red-50/20 border-red-200" : "bg-slate-50/20 border-slate-150"
                }`}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Cálculo Vacacional ({activeVinculo.regimenes_laborales?.nombre || "General"})
                  </div>
                  
                  {selectedMetrics.status === "critico" && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-[11px] flex gap-1.5 items-start">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>Acumulación Crítica:</strong> Registra {selectedMetrics.balance} días pendientes. Requiere goce vacacional urgente.
                      </div>
                    </div>
                  )}

                  {!selectedMetrics.hasContract && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-[10px] flex gap-1.5 items-start">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <div>
                        <strong>Sin Contrato Registrado:</strong> Las vacaciones se acumulan desde la Fecha de Ingreso ({formatDMY(selectedMetrics.startDateStr)}).
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-650">
                      <span>Inicio Acumulación:</span>
                      <span className="font-mono text-slate-900">{formatDMY(selectedMetrics.startDateStr)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-slate-650">
                      <span>Origen Fecha:</span>
                      <span className={`font-semibold ${selectedMetrics.isFromContract ? "text-emerald-600" : "text-amber-600"}`}>
                        {selectedMetrics.isFromContract ? "Contrato Vigente" : "Fecha de Ingreso"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-slate-650">
                      <span>Años de Servicio:</span>
                      <span className="font-mono text-slate-900">{selectedMetrics.years} años</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-slate-650">
                      <span>Días Anuales:</span>
                      <span className="font-mono text-slate-900">{selectedMetrics.daysPerYear} d/año</span>
                    </div>
                    
                    <div className="border-t border-slate-100 my-2 pt-2 space-y-2">
                      <div className="flex justify-between text-xs font-semibold text-slate-650">
                        <span>Días Ganados:</span>
                        <span className="font-mono text-slate-950">{selectedMetrics.earned} días</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-slate-650">
                        <span>Días Gozados:</span>
                        <span className="font-mono text-blue-600 font-bold">{selectedMetrics.taken} días</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-100 text-slate-900">
                        <span>Saldo Pendiente:</span>
                        <span className={`font-mono ${selectedMetrics.status === "critico" ? "text-red-700 font-black" : "text-emerald-700"}`}>
                          {selectedMetrics.balance} días
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => handlePrint("solicitud")}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir Solicitud
                    </button>
                    <button
                      onClick={() => handlePrint("kardex")}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 rounded-lg text-xs font-bold border border-emerald-150 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      Imprimir Kardex SUNAFIL
                    </button>
                  </div>
                </div>

                {/* Registrar Vacaciones Form */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/70 space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                    <Plus className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    Registrar Descanso Físico
                  </h4>
                  <form onSubmit={handleSaveVacation} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha Inicio</label>
                      <input
                        type="date"
                        required
                        value={vacationForm.fecha_inicio}
                        onChange={(e) => setVacationForm({ ...vacationForm, fecha_inicio: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha Fin (Inclusive)</label>
                      <input
                        type="date"
                        required
                        value={vacationForm.fecha_fin}
                        onChange={(e) => setVacationForm({ ...vacationForm, fecha_fin: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Periodo Correspondiente
                      </label>
                      <select
                        required
                        value={vacationForm.periodo}
                        onChange={(e) => setVacationForm({ ...vacationForm, periodo: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white font-semibold text-slate-700"
                      >
                        <option value="auto">Automático (Por antigüedad - FIFO)</option>
                        {availablePeriods.map((p, idx) => (
                          <option key={idx} value={`${p.start}|${p.end}`}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Notas / Observaciones</label>
                      <textarea
                        rows={2}
                        value={vacationForm.notas}
                        onChange={(e) => setVacationForm({ ...vacationForm, notas: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
                        placeholder="Ej. Goce correspondiente al periodo..."
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      Registrar Periodo
                    </button>
                  </form>
                </div>
              </div>

              {/* History list side (8 cols) */}
              <div className="lg:col-span-8 flex flex-col h-full min-h-[300px]">
                <div className="bg-slate-50/40 rounded-xl border border-slate-150 overflow-hidden flex flex-col h-full max-h-[480px]">
                  <div className="p-3.5 border-b border-slate-200/60 bg-white">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Historial de Descansos Registrados</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-150 bg-white">
                    {(!activeVinculo.vacaciones_historico || activeVinculo.vacaciones_historico.length === 0) ? (
                      <div className="text-center py-20 text-slate-400 space-y-2">
                        <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-medium">No se registran periodos vacacionales gozados para este puesto.</p>
                      </div>
                    ) : (
                      activeVinculo.vacaciones_historico.map((vac: any) => (
                        <div key={vac.id} className="p-4 flex items-center justify-between hover:bg-slate-50/40 transition-colors">
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-slate-800 flex flex-wrap items-center gap-1.5">
                              <span>{formatDMY(vac.fecha_inicio)} ➔ {formatDMY(vac.fecha_fin)}</span>
                              {vac.periodo_inicio && vac.periodo_fin && (
                                <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-150 px-1.5 py-0.5 rounded">
                                  Periodo: {formatDMY(vac.periodo_inicio)} al {formatDMY(vac.periodo_fin)}
                                </span>
                              )}
                            </div>
                            {vac.notas && (
                              <p className="text-[10px] text-slate-500 font-medium">{vac.notas}</p>
                            )}
                            <div className="text-[9px] text-slate-400 font-mono">
                              Registrado: {new Date(vac.creado_en || new Date()).toLocaleDateString("es-PE")}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3.5">
                            <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-lg">
                              {vac.dias_calendario} días
                            </span>
                            <button
                              onClick={() => handleDeleteVacation(vac.id)}
                              disabled={loading}
                              className="p-1.5 text-slate-400 hover:text-red-655 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="Eliminar descanso vacacional"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Printable Request Sheet */}
      {selectedPersona && activeVinculo && selectedMetrics && (
        <div className="hidden print:block bg-white p-8 border border-slate-350 rounded-lg text-xs space-y-8 max-w-2xl mx-auto">
          <div className="text-center border-b pb-4">
            <h1 className="text-lg font-bold">SOLICITUD DE DESCANSO VACACIONAL</h1>
            <p className="text-slate-500 font-mono mt-1">Recursos Humanos / Control de Personal - Grupo Bax</p>
          </div>
          
          <div className="space-y-4">
            <p className="leading-relaxed">
              Por medio del presente documento, yo <strong>{selectedPersona.apellidos}, {selectedPersona.nombres}</strong>, identificado con documento de identidad N° <strong>{selectedPersona.numero_documento}</strong>, en mi condición de colaborador en el puesto de <strong>{activeVinculo.cargos?.nombre}</strong> para la empresa <strong>{activeVinculo.empresas_internas?.razon_social}</strong> en la sede <strong>{activeVinculo.sedes?.nombre}</strong>, solicito formalmente el goce de mi descanso físico vacacional según el siguiente detalle:
            </p>
            
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
              <div><strong>Fecha de Inicio:</strong> ________________________</div>
              <div><strong>Fecha de Finalización:</strong> ________________________</div>
              <div><strong>Total de Días Solicitados:</strong> _______ días calendario</div>
              <div><strong>Periodo Adquirido Correspondiente:</strong> ________________________</div>
            </div>

            <div className="pt-4 space-y-2 text-justify">
              <h3 className="font-bold uppercase text-[10px] tracking-wider text-slate-700">Declaración Jurada y Conformidad:</h3>
              <p className="text-[10px] text-slate-550 leading-relaxed text-slate-500">
                El suscrito declara que las fechas arriba solicitadas han sido coordinadas y consensuadas previamente con su jefatura inmediata, garantizando la no afectación de las operaciones del área. Asimismo, se conviene que los días gozados se deducirán directamente del saldo vacacional acumulado a la fecha.
              </p>
            </div>
          </div>

          <div className="pt-28 grid grid-cols-2 gap-12 text-center">
            <div className="border-t border-slate-400 pt-2">
              Firma del Colaborador
              <div className="text-[9px] text-slate-400 font-mono mt-1">DNI: {selectedPersona.numero_documento}</div>
            </div>
            <div className="border-t border-slate-400 pt-2">
              V°B° Jefe Directo / Recursos Humanos
              <div className="text-[9px] text-slate-400 font-mono mt-1">Aprobado por</div>
            </div>
          </div>

          <div className="pt-10 border-t border-dashed border-slate-300 text-[9px] text-slate-400 flex justify-between">
            <span>Fecha de emisión: {new Date().toLocaleDateString("es-PE")} {new Date().toLocaleTimeString("es-PE", {hour: '2-digit', minute:'2-digit'})}</span>
            <span>Documento generado por Antigravity HR System</span>
          </div>
        </div>
      )}

      {/* Printable Kardex Sheet for SUNAFIL */}
      {selectedPersona && activeVinculo && selectedMetrics && printType === "kardex" && (
        <div className="hidden print:block bg-white p-8 border border-slate-300 rounded-lg text-xs space-y-6 max-w-4xl mx-auto font-sans">
          <div className="text-center border-b pb-4 flex justify-between items-center">
            <div className="text-left">
              <h2 className="text-sm font-bold text-slate-800 uppercase">{activeVinculo.empresas_internas?.razon_social || "GRUPO BAX"}</h2>
              <p className="text-[9px] text-slate-450 font-mono">RUC: {activeVinculo.empresas_internas?.ruc || "-"}</p>
            </div>
            <div className="text-right">
              <h1 className="text-md font-bold text-slate-900">KARDEX VACACIONAL DE CONTROL INTERNO</h1>
              <p className="text-[9px] text-slate-500 font-mono">Reporte de Cumplimiento Laboral (SUNAFIL)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-slate-50/50">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Colaborador</div>
              <div className="text-xs font-bold text-slate-800">{selectedPersona.apellidos}, {selectedPersona.nombres}</div>
              <div className="text-[10px] mt-1 text-slate-400 uppercase font-bold">Documento (DNI/CE)</div>
              <div className="text-xs font-semibold text-slate-800">{selectedPersona.numero_documento}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Puesto / Sede</div>
              <div className="text-xs font-semibold text-slate-800">{activeVinculo.cargos?.nombre} &bull; {activeVinculo.sedes?.nombre}</div>
              <div className="text-[10px] mt-1 text-slate-400 uppercase font-bold">Fecha de Ingreso</div>
              <div className="text-xs font-semibold text-slate-800">{formatDMY(selectedMetrics.startDateStr)} (Antigüedad: {selectedMetrics.years} años)</div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold uppercase text-[10px] tracking-wider text-slate-700">Resumen de Saldos por Periodo Vacacional:</h3>
            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold text-slate-750">
                  <th className="border p-2">Periodo Anual Acumulado</th>
                  <th className="border p-2 text-center">Días Ganados</th>
                  <th className="border p-2 text-center">Días Gozados</th>
                  <th className="border p-2 text-center">Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {periodSummary.map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 text-[11px] text-slate-800">
                    <td className="border p-2 font-semibold">Periodo: {p.label}</td>
                    <td className="border p-2 text-center font-mono">{p.earned} días</td>
                    <td className="border p-2 text-center font-mono text-blue-600 font-bold">{p.taken} días</td>
                    <td className="border p-2 text-center font-mono font-bold text-emerald-700">{p.balance} días</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold uppercase text-[10px] tracking-wider text-slate-700">Detalle Cronológico de Descansos Físicos Gozados:</h3>
            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold text-slate-750">
                  <th className="border p-2">Fecha Salida</th>
                  <th className="border p-2">Fecha Retorno</th>
                  <th className="border p-2 text-center">Días Gozados</th>
                  <th className="border p-2">Periodo Asociado</th>
                  <th className="border p-2">Observaciones / Notas</th>
                </tr>
              </thead>
              <tbody>
                {(!activeVinculo.vacaciones_historico || activeVinculo.vacaciones_historico.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="border p-4 text-center text-slate-400 font-medium">No se registran descansos vacacionales.</td>
                  </tr>
                ) : (
                  [...activeVinculo.vacaciones_historico]
                    .sort((a: any, b: any) => b.fecha_inicio.localeCompare(a.fecha_inicio))
                    .map((vac: any, idx: number) => {
                      const periodKey = getVacationPeriodKey(vac, availablePeriods);
                      const periodLabel = periodKey 
                        ? `${formatDMY(periodKey.split("|")[0])} - ${formatDMY(periodKey.split("|")[1])}`
                        : "-";
                      return (
                        <tr key={idx} className="hover:bg-slate-50 text-[10px] text-slate-800">
                          <td className="border p-2 font-mono">{formatDMY(vac.fecha_inicio)}</td>
                          <td className="border p-2 font-mono">{formatDMY(vac.fecha_fin)}</td>
                          <td className="border p-2 text-center font-mono font-bold text-blue-600">{vac.dias_calendario} d</td>
                          <td className="border p-2 font-medium">{periodLabel}</td>
                          <td className="border p-2 text-slate-500">{vac.notas || "-"}</td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-20 grid grid-cols-2 gap-12 text-center">
            <div className="border-t border-slate-400 pt-2">
              Firma del Colaborador
              <div className="text-[9px] text-slate-400 font-mono mt-0.5">DNI: {selectedPersona.numero_documento}</div>
            </div>
            <div className="border-t border-slate-400 pt-2">
              V°B° Recursos Humanos / Representante Legal
              <div className="text-[9px] text-slate-400 font-mono mt-0.5">Grupo Bax S.A.C.</div>
            </div>
          </div>

          <div className="pt-10 border-t border-dashed border-slate-300 text-[9px] text-slate-400 flex justify-between">
            <span>Fecha de emisión: {new Date().toLocaleDateString("es-PE")} {new Date().toLocaleTimeString("es-PE", {hour: '2-digit', minute:'2-digit'})}</span>
            <span>Documento generado para inspección SUNAFIL - Antigravity HR System</span>
          </div>
        </div>
      )}

      {/* MODAL DE CARGA MASIVA DE EXCEL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider block">Importar Vacaciones Masivamente</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Sube tu plantilla Excel para registrar descansos vacacionales y periodos anuales en un solo paso.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportRows([]);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Pasos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs mb-2">1</span>
                    <h4 className="text-xs font-bold text-slate-750">Descarga la Plantilla</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Obtén el archivo estructurado con solo 6 columnas: DNI, periodos y fechas de vacaciones.</p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadExcelTemplate}
                    className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" />
                    Descargar Plantilla
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex flex-col justify-between space-y-3 text-center">
                  <div>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs mb-2">2</span>
                    <h4 className="text-xs font-bold text-slate-750">Llena la Información</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Completa los datos en Excel. Utiliza fechas con formato DD-MM-YYYY (ej. 20-08-1990) y digita DNI reales.</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono italic">Formatos de fecha: DD-MM-YYYY</span>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs mb-2">3</span>
                    <h4 className="text-xs font-bold text-slate-750">Sube y Valida</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Arrastra o selecciona el archivo. El sistema verificará de inmediato la consistencia y contratos activos.</p>
                  </div>
                  <label className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors text-center">
                    <Upload className="w-4 h-4" />
                    Seleccionar Archivo
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={importing}
                    />
                  </label>
                </div>
              </div>

              {/* Progress and Report */}
              {importRows.length > 0 && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Resultado del Análisis de Datos</span>
                      <div className="flex gap-4 text-xs font-medium text-slate-500 mt-1">
                        <span>Filas Leídas: <strong className="text-slate-800 font-bold">{importStatus.total}</strong></span>
                        <span className="text-emerald-600 font-semibold">Válidos: {importStatus.successCount}</span>
                        <span className="text-red-500 font-semibold">Errores: {importStatus.errors.length}</span>
                      </div>
                    </div>
                    {importStatus.errors.length > 0 && (
                      <button
                        onClick={downloadErrorReport}
                        className="inline-flex items-center gap-1 bg-red-50 text-red-650 px-3 py-1.5 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Descargar Reporte Errores
                      </button>
                    )}
                  </div>

                  {/* Tabla de Preview */}
                  <div className="border border-slate-150 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] font-bold text-slate-650 border-b border-slate-150 uppercase tracking-wider">
                          <th className="p-2.5 text-center">Fila</th>
                          <th className="p-2.5">DNI</th>
                          <th className="p-2.5">Colaborador</th>
                          <th className="p-2.5">Período Anual</th>
                          <th className="p-2.5">Fechas Goce</th>
                          <th className="p-2.5 text-center">Días</th>
                          <th className="p-2.5">Estado / Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-700 bg-white">
                        {importRows.map((row, idx) => (
                          <tr key={idx} className={row.isValid ? "hover:bg-slate-50/50" : "bg-red-50/20 hover:bg-red-50/30"}>
                            <td className="p-2.5 text-center font-mono text-slate-400">{row.rowNumber}</td>
                            <td className="p-2.5 font-mono text-slate-750 font-bold">{row.dni}</td>
                            <td className="p-2.5 font-bold text-slate-800">{row.colaborador}</td>
                            <td className="p-2.5 font-mono text-[10px]">
                              {row.periodo_inicio ? `${formatDMY(row.periodo_inicio)} ➔ ${formatDMY(row.periodo_fin)}` : "-"}
                            </td>
                            <td className="p-2.5 font-mono text-[10px]">
                              {row.fecha_inicio ? `${formatDMY(row.fecha_inicio)} ➔ ${formatDMY(row.fecha_fin)}` : "-"}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-blue-600">{row.dias_calendario} d</td>
                            <td className="p-2.5">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">
                                  <Check className="w-3 h-3 stroke-[3]" /> Válido
                                </span>
                              ) : (
                                <span className="inline-flex flex-col gap-0.5 text-red-650 text-[9px] bg-red-50 border border-red-100 p-1.5 rounded-lg max-w-[250px]">
                                  {row.errors.map((errStr: string, eIdx: number) => (
                                    <span key={eIdx} className="leading-tight">• {errStr}</span>
                                  ))}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-150 bg-slate-50/30 flex items-center justify-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportRows([]);
                }}
                disabled={importing}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeBulkImport}
                disabled={importing || importStatus.successCount === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold active:scale-95 shadow-md shadow-emerald-100 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:shadow-none"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    Confirmar e Importar ({importStatus.successCount})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
