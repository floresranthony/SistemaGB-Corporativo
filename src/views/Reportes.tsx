import React, { useState } from "react";
import { 
  FileSpreadsheet, 
  Users, 
  Calendar, 
  Package, 
  Download, 
  Loader2, 
  Building,
  CheckCircle2,
  Clock
} from "lucide-react";
import { supabase } from "../utils/supabase";
import * as XLSX from "xlsx";

export function Reportes() {
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const [successReport, setSuccessReport] = useState<string | null>(null);

  const triggerDownloadIndicator = (reportId: string) => {
    setSuccessReport(reportId);
    setTimeout(() => {
      setSuccessReport(null);
    }, 3000);
  };

  // Report 1: Clients and Headquarters (Estructura Comercial)
  const downloadEstructuraComercial = async () => {
    setDownloadingReport("estructura");
    try {
      // 1. Fetch Clientes with internal company info
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

      // 2. Fetch Sedes
      const { data: sedes, error: sedeErr } = await supabase
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
      const sedesList = sedes || [];

      // 3. Consolidated sheet
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

      // 4. Clients sheet
      const clientsRows = clientesList.map(c => ({
        "RUC Cliente": c.ruc,
        "Razón Social": c.razon_social,
        "Empresa Interna (Nómina)": c.empresas_internas ? (c.empresas_internas as any).razon_social : "-",
        "Estado": c.activo ? "Activo" : "Inactivo"
      }));

      // 5. Sedes sheet
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

      // Generate Workbook
      const wb = XLSX.utils.book_new();
      
      const wsConsolidated = XLSX.utils.json_to_sheet(consolidatedRows);
      const wsClients = XLSX.utils.json_to_sheet(clientsRows);
      const wsSedes = XLSX.utils.json_to_sheet(sedesRows);

      // Add worksheets
      XLSX.utils.book_append_sheet(wb, wsConsolidated, "Estructura Consolidada");
      XLSX.utils.book_append_sheet(wb, wsClients, "Clientes");
      XLSX.utils.book_append_sheet(wb, wsSedes, "Sedes Operativas");

      // Write file
      XLSX.writeFile(wb, "reporte_estructura_comercial.xlsx");
      triggerDownloadIndicator("estructura");
    } catch (error: any) {
      console.error("Error generating Estructura Comercial report:", error);
      alert("Error al generar el reporte de Estructura Comercial: " + error.message);
    } finally {
      setDownloadingReport(null);
    }
  };

  // Report 2: General Personnel Report
  const downloadPersonalGeneral = async () => {
    setDownloadingReport("personal");
    try {
      const { data: personas, error: perErr } = await supabase
        .from("personas")
        .select(`
          id,
          tipo_documento_id,
          tipos_documento (codigo, nombre),
          numero_documento,
          nombres,
          apellidos,
          sexo,
          fecha_nacimiento,
          telefono,
          correo,
          direccion,
          ubigeo_id,
          ubigeo_distritos (departamento, provincia, distrito),
          sistema_pension_id,
          sistemas_pension (nombre),
          vinculos_laborales (
            id,
            estado,
            fecha_ingreso,
            fecha_primer_contrato,
            empresa_interna_id,
            empresas_internas (razon_social),
            sede_id,
            sedes (
              nombre, 
              clientes (razon_social)
            ),
            cargo_id,
            cargos (nombre),
            regimen_laboral_id,
            regimenes_laborales (nombre)
          )
        `);

      if (perErr) throw perErr;

      const personasList = personas || [];

      const rows = personasList.map(p => {
        // Find active vinculo, if none, take the latest one
        const activeVinculo = p.vinculos_laborales?.find((v: any) => v.estado === "Activo") 
          || (p.vinculos_laborales && p.vinculos_laborales.length > 0 ? p.vinculos_laborales[p.vinculos_laborales.length - 1] : null);

        const ubigeoStr = p.ubigeo_distritos 
          ? `${(p.ubigeo_distritos as any).distrito} - ${(p.ubigeo_distritos as any).provincia} (${(p.ubigeo_distritos as any).departamento})`
          : (p.ubigeo_id || "-");

        return {
          "Tipo Doc": p.tipos_documento ? (p.tipos_documento as any).codigo : "-",
          "Nro Documento": p.numero_documento,
          "Nombres": p.nombres,
          "Apellidos": p.apellidos,
          "Sexo": p.sexo || "-",
          "Fecha Nacimiento": p.fecha_nacimiento || "-",
          "Teléfono": p.telefono || "-",
          "Correo": p.correo || "-",
          "Dirección": p.direccion || "-",
          "Ubigeo (Distrito)": ubigeoStr,
          "Sistema Pensión": p.sistemas_pension ? (p.sistemas_pension as any).nombre : "-",
          "Fecha Ingreso": activeVinculo && (activeVinculo as any).fecha_ingreso ? (activeVinculo as any).fecha_ingreso : "-",
          "Fecha Primer Contrato": activeVinculo && (activeVinculo as any).fecha_primer_contrato ? (activeVinculo as any).fecha_primer_contrato : "-",
          "Estado Laboral": activeVinculo ? (activeVinculo as any).estado : "Sin Vínculo",
          "Empresa Interna (Nómina)": activeVinculo && (activeVinculo as any).empresas_internas ? (activeVinculo as any).empresas_internas.razon_social : "-",
          "Cliente": activeVinculo && (activeVinculo as any).sedes && (activeVinculo as any).sedes.clientes ? (activeVinculo as any).sedes.clientes.razon_social : "-",
          "Sede Operativa": activeVinculo && (activeVinculo as any).sedes ? (activeVinculo as any).sedes.nombre : "-",
          "Cargo": activeVinculo && (activeVinculo as any).cargos ? (activeVinculo as any).cargos.nombre : "-",
          "Régimen Laboral": activeVinculo && (activeVinculo as any).regimenes_laborales ? (activeVinculo as any).regimenes_laborales.nombre : "-"
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Colaboradores General");
      XLSX.writeFile(wb, "reporte_personal_general.xlsx");
      triggerDownloadIndicator("personal");
    } catch (error: any) {
      console.error("Error generating Personal report:", error);
      alert("Error al generar el reporte de Personal: " + error.message);
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
      description: "Reporte consolidado con los datos personales, previsionales y puestos activos de todos los colaboradores registrados en el sistema.",
      icon: Users,
      badge: "Disponible",
      colorClass: "bg-emerald-50 text-emerald-600 border-emerald-100",
      btnClass: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100",
      action: downloadPersonalGeneral,
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
                    className={`w-full flex items-center justify-center gap-2 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 ${report.btnClass}`}
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
    </div>
  );
}
