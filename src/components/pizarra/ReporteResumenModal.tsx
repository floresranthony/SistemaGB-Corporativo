import React, { useState, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  Printer,
  Sparkles,
  Share2
} from "lucide-react";
import * as XLSX from "xlsx";

interface VacancyItem {
  id: number;
  fecha_solicitud?: string;
  turno?: string;
  plazas_solicitadas: number;
  plazas_cubiertas: number;
  estado: string;
  motivo_vacante?: string;
  genero_requerido?: string;
  sedes?: {
    id?: number;
    nombre?: string;
    direccion?: string;
    distrito?: string;
    clientes?: {
      id?: number;
      razon_social?: string;
    };
  };
  cargos?: {
    id?: number;
    nombre?: string;
  };
}

interface ReporteResumenModalProps {
  isOpen: boolean;
  onClose: () => void;
  vacancies: VacancyItem[];
}

// Función auxiliar para normalizar y abreviar nombres de clientes conocidos
function formatClientSedeName(req: VacancyItem): string {
  const rawClient = req.sedes?.clientes?.razon_social || "";
  const rawSede = req.sedes?.nombre || "";

  // Limpieza de razones sociales comunes
  let clientClean = rawClient
    .replace(/\bS\.A\.C\.|\bSAC|\bS\.A\.|\bSA|\bS\.R\.L\.|\bSRL|\bE\.I\.R\.L\.|\bEIRL/gi, "")
    .replace(/\bPANIFICADORA\b/gi, "")
    .replace(/\bDEL PERU\b/gi, "")
    .replace(/\bMANTENIMIENTO INDUSTRIAL Y COMERCIAL\b/gi, "")
    .trim();

  // Si el cliente quedó muy genérico o vacío, usar la sede
  if (!clientClean && rawSede) {
    return rawSede.toUpperCase();
  }

  // Si la sede tiene un nombre distintivo (ej. "SEDE CALLAO", "SEDE SANTA ANITA", "CAFAE CENTRAL", "MAISON CHORRILLOS")
  let sedeClean = rawSede
    .replace(/^SEDE\s+/i, "")
    .replace(/^MICSAC\s*-\s*SEDE\s*/i, "")
    .trim();

  // Si el nombre del cliente ya contiene la sede o viceversa
  if (sedeClean && clientClean && !clientClean.toUpperCase().includes(sedeClean.toUpperCase())) {
    return `${clientClean.toUpperCase()} (${sedeClean.toUpperCase()})`;
  }

  return (clientClean || rawSede || "SIN NOMBRE").toUpperCase();
}

export const ReporteResumenModal: React.FC<ReporteResumenModalProps> = ({
  isOpen,
  onClose,
  vacancies
}) => {
  const [copied, setCopied] = useState(false);
  const [filterMode, setFilterMode] = useState<"todos" | "faltantes" | "completos">("todos");
  const [formatMode, setFormatMode] = useState<"simple" | "con_cargo" | "detallado">("con_cargo");
  const [includeHeaderFooter, setIncludeHeaderFooter] = useState(true);

  // Cálculos consolidados
  const totalSolicitadas = vacancies.reduce((acc, v) => acc + (v.plazas_solicitadas || 0), 0);
  const totalCubiertas = vacancies.reduce((acc, v) => acc + (v.plazas_cubiertas || 0), 0);
  const totalFaltantes = Math.max(0, totalSolicitadas - totalCubiertas);
  const totalCompletadas = vacancies.filter(v => (v.plazas_cubiertas || 0) >= (v.plazas_solicitadas || 0)).length;
  const totalIncompletas = vacancies.filter(v => (v.plazas_cubiertas || 0) < (v.plazas_solicitadas || 0)).length;

  // Filtrado de las vacantes para el reporte
  const filteredVacancies = useMemo(() => {
    return vacancies.filter(v => {
      const faltan = Math.max(0, (v.plazas_solicitadas || 0) - (v.plazas_cubiertas || 0));
      if (filterMode === "faltantes") return faltan > 0;
      if (filterMode === "completos") return faltan === 0;
      return true;
    });
  }, [vacancies, filterMode]);

  // Generación del texto del reporte
  const generatedText = useMemo(() => {
    const today = new Date();
    const dateStr = today.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    const timeStr = today.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit"
    });

    const lines: string[] = [];

    if (includeHeaderFooter) {
      lines.push(`📋 *REPORTE DE COBERTURA DE VACANTES - GRUPO BAX*`);
      lines.push(`📅 Fecha: ${dateStr} ${timeStr}`);
      lines.push(
        `📊 Estado: ${totalCubiertas}/${totalSolicitadas} plazas cubiertas (${totalFaltantes} faltantes)`
      );
      lines.push(`────────────────────────────`);
    }

    if (filteredVacancies.length === 0) {
      lines.push(`(No hay registros que coincidan con el filtro seleccionado)`);
    } else {
      filteredVacancies.forEach(req => {
        const name = formatClientSedeName(req);
        const solicitadas = req.plazas_solicitadas || 0;
        const cubiertas = req.plazas_cubiertas || 0;
        const faltan = Math.max(0, solicitadas - cubiertas);
        const isComplete = faltan === 0 || req.estado === "Completado";
        const cargoName = req.cargos?.nombre || "Personal";
        const turno = req.turno ? `[${req.turno}]` : "";

        if (formatMode === "simple") {
          if (isComplete) {
            lines.push(`${name} : COMPLETO`);
          } else {
            lines.push(`${name} : falta ${faltan}`);
          }
        } else if (formatMode === "con_cargo") {
          if (isComplete) {
            lines.push(`${name} : COMPLETO (${cargoName})`);
          } else {
            const palabraFalta = faltan === 1 ? "falta" : "faltan";
            const cargoLower = cargoName.toLowerCase();
            if (cargoLower.includes("descanser")) {
              lines.push(`${name} : ${palabraFalta} ${faltan} descanseros`);
            } else {
              lines.push(`${name} : ${palabraFalta} ${faltan} (${cargoName})`);
            }
          }
        } else if (formatMode === "detallado") {
          const clientFull = req.sedes?.clientes?.razon_social || "";
          const sedeFull = req.sedes?.nombre || "";
          if (isComplete) {
            lines.push(`✅ ${clientFull} - ${sedeFull} | ${cargoName} ${turno}: ${cubiertas}/${solicitadas} cubiertas (COMPLETO)`);
          } else {
            lines.push(`⏳ ${clientFull} - ${sedeFull} | ${cargoName} ${turno}: ${cubiertas}/${solicitadas} cubiertas (Faltan ${faltan})`);
          }
        }
      });
    }

    if (includeHeaderFooter) {
      lines.push(`────────────────────────────`);
      lines.push(`📌 *RESUMEN TOTAL:*`);
      lines.push(`• Solicitadas: ${totalSolicitadas}`);
      lines.push(`• Cubiertas: ${totalCubiertas}`);
      lines.push(`• Faltantes: ${totalFaltantes}`);
      lines.push(`• Vacantes Completadas: ${totalCompletadas} | Incompletas: ${totalIncompletas}`);
    }

    return lines.join("\n");
  }, [
    filteredVacancies,
    filterMode,
    formatMode,
    includeHeaderFooter,
    totalSolicitadas,
    totalCubiertas,
    totalFaltantes,
    totalCompletadas,
    totalIncompletas
  ]);

  // Copiar al portapapeles
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Error al copiar texto:", err);
    }
  };

  // Descargar archivo .TXT
  const handleDownloadTxt = () => {
    const today = new Date().toISOString().split("T")[0];
    const blob = new Blob([generatedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_Vacantes_BAX_${today}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Descargar archivo Excel (.xlsx)
  const handleDownloadExcel = () => {
    const today = new Date().toISOString().split("T")[0];
    const wb = XLSX.utils.book_new();

    const dataRows = filteredVacancies.map((req, idx) => {
      const solicitadas = req.plazas_solicitadas || 0;
      const cubiertas = req.plazas_cubiertas || 0;
      const faltantes = Math.max(0, solicitadas - cubiertas);
      const isComplete = faltantes === 0 || req.estado === "Completado";

      return {
        "N°": idx + 1,
        "ID Vacante": `#${req.id}`,
        "Cliente": req.sedes?.clientes?.razon_social || "No asignado",
        "Sede Operativa": req.sedes?.nombre || "No asignada",
        "Cargo Requerido": req.cargos?.nombre || "No especificado",
        "Turno": req.turno || "Día",
        "Plazas Solicitadas": solicitadas,
        "Plazas Cubiertas": cubiertas,
        "Plazas Faltantes": faltantes,
        "Estado": isComplete ? "COMPLETO" : "FALTA CUBRIR",
        "Motivo": req.motivo_vacante || "Sin motivo registrado",
        "Fecha Solicitud": req.fecha_solicitud || ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataRows);

    // Ajustar anchos de columna
    ws["!cols"] = [
      { wch: 5 },  // N°
      { wch: 12 }, // ID Vacante
      { wch: 30 }, // Cliente
      { wch: 25 }, // Sede
      { wch: 25 }, // Cargo
      { wch: 12 }, // Turno
      { wch: 18 }, // Plazas Solicitadas
      { wch: 16 }, // Plazas Cubiertas
      { wch: 16 }, // Plazas Faltantes
      { wch: 15 }, // Estado
      { wch: 30 }, // Motivo
      { wch: 15 }  // Fecha
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Reporte de Vacantes");
    XLSX.writeFile(wb, `Reporte_Vacantes_BAX_${today}.xlsx`);
  };

  // Imprimir
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte de Vacantes - Grupo BAX</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; padding: 24px; color: #1e293b; }
            h1 { font-size: 18px; margin-bottom: 4px; color: #0f172a; }
            .date { font-size: 12px; color: #64748b; margin-bottom: 16px; }
            pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>Reporte de Cobertura de Vacantes y Plazas</h1>
          <div class="date">Generado el ${new Date().toLocaleString("es-PE")}</div>
          <pre>${generatedText.replace(/[*_]/g, "")}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 border border-blue-400/40 rounded-xl text-blue-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                  Reporte de Plazas Cubiertas y Faltantes
                </h3>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Resumen Ejecutivo
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Genera el resumen listo para WhatsApp, archivo de texto o exportación en Excel.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
          
          {/* KPI Mini Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Solicitadas
              </span>
              <div className="text-xl font-black text-slate-800 mt-0.5 font-mono">
                {totalSolicitadas} <span className="text-xs font-normal text-slate-400 font-sans">plazas</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs bg-emerald-50/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                Plazas Cubiertas
              </span>
              <div className="text-xl font-black text-emerald-700 mt-0.5 font-mono">
                {totalCubiertas} <span className="text-xs font-normal text-emerald-600/70 font-sans">cubiertas</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-red-100 shadow-xs bg-red-50/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 block">
                Plazas Faltantes
              </span>
              <div className="text-xl font-black text-red-700 mt-0.5 font-mono">
                {totalFaltantes} <span className="text-xs font-normal text-red-600/70 font-sans">por cubrir</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-xs bg-blue-50/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                % Cobertura
              </span>
              <div className="text-xl font-black text-blue-700 mt-0.5 font-mono">
                {totalSolicitadas > 0 ? Math.round((totalCubiertas / totalSolicitadas) * 100) : 0}%
              </div>
            </div>
          </div>

          {/* Configuration Controls Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              
              {/* Filtro de vacantes */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-blue-600" />
                  Filtrar:
                </span>
                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFilterMode("todos")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      filterMode === "todos"
                        ? "bg-white text-blue-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Todos ({vacancies.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("faltantes")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      filterMode === "faltantes"
                        ? "bg-white text-red-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Faltantes ({totalIncompletas})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("completos")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      filterMode === "completos"
                        ? "bg-white text-emerald-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Completos ({totalCompletadas})
                  </button>
                </div>
              </div>

              {/* Formato de texto */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Formato:
                </span>
                <select
                  value={formatMode}
                  onChange={(e) => setFormatMode(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="simple">Simple (ej: BIMBO : falta 3)</option>
                  <option value="con_cargo">Con Cargo (ej: BIMBO : falta 3 Operarios)</option>
                  <option value="detallado">Detallado (Cliente - Sede | Cargo)</option>
                </select>
              </div>

            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeHeaderFooter}
                  onChange={(e) => setIncludeHeaderFooter(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Incluir encabezado corporativo y resumen numérico</span>
              </label>

              <span className="text-[11px] text-slate-400">
                Mostrando {filteredVacancies.length} de {vacancies.length} vacantes
              </span>
            </div>
          </div>

          {/* Text Output Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Vista Previa del Reporte de Texto:
              </span>
              <span className="text-[11px] text-slate-400">
                Listo para pegar en WhatsApp o enviar por correo
              </span>
            </div>

            <div className="relative group">
              <textarea
                readOnly
                value={generatedText}
                rows={11}
                className="w-full bg-slate-900 text-emerald-300 font-mono text-xs sm:text-sm p-4 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner leading-relaxed resize-none selection:bg-blue-600 selection:text-white"
              />

              {/* Floating Quick Copy Button */}
              <button
                type="button"
                onClick={handleCopy}
                className={`absolute right-3 top-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer ${
                  copied
                    ? "bg-emerald-600 text-white scale-105"
                    : "bg-white/90 hover:bg-white text-slate-800 hover:text-blue-700 backdrop-blur-xs"
                }`}
                title="Copiar texto al portapapeles"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    ¡Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              title="Imprimir reporte"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              Imprimir
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            
            {/* Descargar TXT */}
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 transition-all cursor-pointer active:scale-95"
              title="Descargar archivo de texto plano (.txt)"
            >
              <FileText className="w-4 h-4 text-slate-600" />
              Descargar .TXT
            </button>

            {/* Descargar Excel */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all cursor-pointer active:scale-95"
              title="Exportar reporte detallado a Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Descargar Excel (.xlsx)
            </button>

            {/* Copiar WhatsApp Destacado */}
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold shadow-md transition-all cursor-pointer active:scale-95 ${
                copied
                  ? "bg-emerald-600 text-white shadow-emerald-200"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  ¡Copiado para WhatsApp!
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Copiar para WhatsApp
                </>
              )}
            </button>

          </div>

        </div>

      </div>
    </div>
  );
};
