import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { 
  Search, 
  Shirt, 
  Printer, 
  RefreshCw, 
  Activity,
  FileCheck,
  User,
  ClipboardList
} from "lucide-react";

export function KardexEntregas() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Personnel selection
  const [people, setPeople] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [vinculos, setVinculos] = useState<any[]>([]);
  const [activeVinculo, setActiveVinculo] = useState<any | null>(null);

  // Kardex Details (EPP & Uniform Deliveries)
  const [entregas, setEntregas] = useState<any[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Load all people for autocomplete
  const loadPeople = async () => {
    try {
      const { data: res, error: err } = await supabase
        .from("personas")
        .select(`
          id,
          nombres,
          apellidos,
          numero_documento,
          talla_polo,
          talla_pantalon,
          talla_calzado,
          fecha_ultimo_emo
        `)
        .order("apellidos", { ascending: true });
      if (err) throw err;
      setPeople(res || []);
    } catch (e) {
      console.error("Error loading people for kardex:", e);
    }
  };

  useEffect(() => {
    loadPeople();
  }, []);

  // When a person is selected, load their jobs (vinculos)
  const handleSelectPerson = async (person: any) => {
    setSelectedPerson(person);
    setActiveVinculo(null);
    setEntregas([]);
    
    try {
      const { data: vData, error: vErr } = await supabase
        .from("vinculos_laborales")
        .select(`
          *,
          empresas_internas (*),
          sedes (
            id,
            nombre,
            clientes (
              id,
              razon_social
            )
          ),
          cargos (id, nombre),
          regimenes_laborales (id, nombre, dias_vacaciones),
          contratos (
            id,
            fecha_inicio,
            estado
          )
        `)
        .eq("persona_id", person.id);
      
      if (vErr) throw vErr;
      setVinculos(vData || []);
      
      // Auto-select the active link if any, otherwise the first one
      if (vData && vData.length > 0) {
        const active = vData.find(v => v.estado === "Activo") || vData[0];
        handleSelectVinculo(active);
      }
    } catch (e) {
      console.error("Error loading job links for person:", e);
    }
  };

  // Load deliveries for the specific job link (vinculo)
  const handleSelectVinculo = async (vinculo: any) => {
    setActiveVinculo(vinculo);
    setLoading(true);
    setError(null);
    try {
      // Fetch Deliveries (requerimiento_detalles)
      const { data: entData, error: entErr } = await supabase
        .from("requerimiento_detalles")
        .select(`
          id,
          cantidad_entregada,
          producto_id,
          producto_talla_id,
          productos (id, nombre, sku, es_uniforme),
          producto_tallas (id, tallas(valor)),
          requerimientos (id, codigo, fecha_entrega, estado)
        `)
        .eq("vinculo_laboral_id", vinculo.id)
        .gt("cantidad_entregada", 0);
      
      if (entErr) throw entErr;
      setEntregas(entData || []);

    } catch (e: any) {
      console.error("Error loading EPP deliveries:", e);
      setError(e.message || "Error al cargar entregas del Kardex.");
    } finally {
      setLoading(false);
    }
  };

  // Autocomplete matching list
  const matchedPeople = people.filter(p => {
    const q = searchQuery.toLowerCase();
    if (!q) return false;
    const fullName = `${p.nombres} ${p.apellidos}`.toLowerCase();
    return fullName.includes(q) || p.numero_documento.includes(q);
  });

  const getFechaIngresoFallback = (vinculosList: any[], person: any): string | null => {
    const active = vinculosList.find((v: any) => v.estado === "Activo");
    if (active && active.fecha_ingreso) return active.fecha_ingreso;
    
    const sorted = [...vinculosList].sort((a: any, b: any) => b.id - a.id);
    const mostRecent = sorted[0];
    if (mostRecent && mostRecent.fecha_ingreso) return mostRecent.fecha_ingreso;

    const dates = vinculosList
      .flatMap((v: any) => v.contratos || [])
      .map((c: any) => c.fecha_inicio)
      .filter(Boolean);
    if (dates.length === 0) return null;
    dates.sort();
    return dates[0];
  };

  const formatDMY = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const handlePrintConformity = () => {
    if (!selectedPerson || !activeVinculo) return;

    setGeneratingPdf(true);

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Por favor, permite las ventanas emergentes (popups) en tu navegador para poder previsualizar el Cargo de Conformidad.");
      setGeneratingPdf(false);
      return;
    }

    const docName = `CARGO-${selectedPerson.numero_documento}`;

    // Resolve company logo
    const internalCompany = activeVinculo.empresas_internas;
    let companyLogo = "logo.png";
    if (internalCompany) {
      if (internalCompany.logo_url) {
        const rawLogo = internalCompany.logo_url;
        companyLogo = rawLogo.startsWith("/") ? rawLogo.substring(1) : rawLogo;
      } else {
        const rucClean = String(internalCompany.ruc || "").trim();
        const socialClean = String(internalCompany.razon_social || "").toLowerCase();
        if (rucClean === "20601234567" || socialClean.includes("bax")) {
          companyLogo = "logo_bax.jpg";
        } else if (rucClean === "20609876543" || socialClean.includes("office") || socialClean.includes("mac")) {
          companyLogo = "logo_office.jpg";
        }
      }
    }

    // Build EPP elements rows (max 15 rows for A4 single-page format)
    const maxRows = 15;
    let tableRowsHtml = "";
    for (let i = 0; i < maxRows; i++) {
      const delivery = entregas[i];
      if (delivery) {
        const dateStr = delivery.requerimientos?.fecha_entrega 
          ? new Date(delivery.requerimientos.fecha_entrega).toLocaleDateString("es-PE")
          : "-";
        const sizeStr = delivery.producto_tallas?.tallas?.valor ? ` (Talla: ${delivery.producto_tallas.tallas.valor})` : "";
        const prodName = `${delivery.productos?.nombre || ""}${sizeStr}`;
        
        tableRowsHtml += `
          <tr style="height: 24px;">
            <td style="border: 1px solid black; text-align: center; font-weight: bold; font-size: 10px;">${i + 1}</td>
            <td style="border: 1px solid black; padding: 0 8px; font-size: 10px; font-weight: 600; text-align: left;">${prodName}</td>
            <td style="border: 1px solid black; text-align: center; font-size: 10px; font-weight: 700;">${delivery.cantidad_entregada}</td>
            <td style="border: 1px solid black; text-align: center; font-size: 10px; font-family: monospace;">${dateStr}</td>
            <td style="border: 1px solid black; text-align: center; font-size: 10px; font-family: monospace;">${dateStr}</td>
            <td style="border: 1px solid black;"></td>
          </tr>
        `;
      } else {
        tableRowsHtml += `
          <tr style="height: 24px;">
            <td style="border: 1px solid black; text-align: center; font-weight: bold; font-size: 10px; color: #94a3b8;">${i + 1}</td>
            <td style="border: 1px solid black;"></td>
            <td style="border: 1px solid black;"></td>
            <td style="border: 1px solid black;"></td>
            <td style="border: 1px solid black;"></td>
            <td style="border: 1px solid black;"></td>
          </tr>
        `;
      }
    }

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
            #print-kardex-conformidad {
              background-color: white;
              width: 794px;
              height: 1122px;
              margin: 20px auto;
              padding: 40px;
              box-sizing: border-box;
              box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            @media print {
              body {
                background-color: white;
                padding: 0;
              }
              #print-kardex-conformidad {
                box-shadow: none;
                width: 100%;
                height: auto;
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
              <span style="font-weight: 800; font-size: 13px; letter-spacing: 0.3px;">Previsualización de Cargo de Conformidad</span>
              <span style="font-size: 10px; color: #94a3b8; font-weight: 600; margin-top: 2px;">Colaborador: ${selectedPerson.apellidos}, ${selectedPerson.nombres}</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button onclick="imprimirConformidad()" style="background-color: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; font-family: system-ui, sans-serif; display: flex; align-items: center; gap: 4px; transition: all 0.15s; text-transform: uppercase; letter-spacing: 0.3px;">
                🖨️ Imprimir Cargo
              </button>
              <button onclick="descargarPDF()" style="background-color: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; font-family: system-ui, sans-serif; display: flex; align-items: center; gap: 4px; transition: all 0.15s; text-transform: uppercase; letter-spacing: 0.3px;">
                📥 Descargar PDF
              </button>
            </div>
          </div>

          <div id="print-kardex-conformidad">
            <div style="border: 2px solid black; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; height: 100%; color: black; box-sizing: border-box; background-color: white;">
              <div>
                <!-- Header Table -->
                <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-bottom: 12px; font-family: Arial, sans-serif;">
                  <tbody>
                    <tr>
                      <td style="width: 20%; border: 1px solid black; padding: 6px; text-align: center; vertical-align: middle;">
                        <img src="${companyLogo}" alt="Logo" style="max-height: 44px; max-width: 110px; display: block; margin: 0 auto;" />
                      </td>
                      <td style="width: 55%; border: 1px solid black; padding: 6px; text-align: center; vertical-align: middle;">
                        <div style="font-weight: 900; font-size: 13px; text-transform: uppercase; text-align: center; color: black; letter-spacing: 0.3px;">REGISTRO DE ENTREGA DE EPP O E. EMERGENCIA</div>
                      </td>
                      <td style="width: 25%; border: 1px solid black; padding: 6px; font-size: 9px; font-weight: bold; vertical-align: middle; color: black; font-family: monospace;">
                        <div style="border-bottom: 1px solid black; padding-bottom: 2px;">CÓDIGO: RG-53-SIG-GB</div>
                        <div style="border-bottom: 1px solid black; padding-top: 2px; padding-bottom: 2px;">REVISIÓN: 00</div>
                        <div style="border-bottom: 1px solid black; padding-top: 2px; padding-bottom: 2px;">APROBADO: C.A.C</div>
                        <div style="padding-top: 2px;">FECHA: 26/10/2022</div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- Empresa Block -->
                <div style="border: 1px solid black; margin-bottom: 12px; font-family: Arial, sans-serif; font-size: 9px; color: black;">
                  <div style="background-color: #cbd5e1; font-weight: bold; padding: 3px 6px; border-bottom: 1px solid black; text-transform: uppercase; font-size: 9px; text-align: left;">
                    DATOS DE LA EMPRESA
                  </div>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                      <tr>
                        <td style="width: 50%; padding: 4px 6px; border-bottom: 1px solid black; border-right: 1px solid black; text-align: left;">
                          <strong>RAZÓN SOCIAL:</strong> ${internalCompany?.razon_social || "GRUPO BAX"}
                        </td>
                        <td style="width: 50%; padding: 4px 6px; border-bottom: 1px solid black; text-align: left;">
                          <strong>RUC:</strong> ${internalCompany?.ruc || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td style="width: 50%; padding: 4px 6px; border-right: 1px solid black; text-align: left;">
                          <strong>ACTIVIDAD ECONÓMICA:</strong> LIMPIEZA CONVENCIONAL E INDUSTRIAL
                        </td>
                        <td style="width: 50%; padding: 4px 6px; text-align: left;">
                          <strong>DOMICILIO:</strong> ${internalCompany?.direccion_fiscal || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 4px 6px; border-top: 1px solid black; text-align: left;">
                          <strong>CLIENTE:</strong> ${activeVinculo?.sedes?.clientes?.razon_social || "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Trabajador Block -->
                <div style="border: 1px solid black; margin-bottom: 12px; font-family: Arial, sans-serif; font-size: 9px; color: black;">
                  <div style="background-color: #cbd5e1; font-weight: bold; padding: 3px 6px; border-bottom: 1px solid black; text-transform: uppercase; font-size: 9px; text-align: left;">
                    DATOS DEL TRABAJADOR
                  </div>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                      <tr>
                        <td style="width: 50%; padding: 4px 6px; border-bottom: 1px solid black; border-right: 1px solid black; text-align: left;">
                          <strong>NOMBRES Y APELLIDOS:</strong> ${selectedPerson.apellidos}, ${selectedPerson.nombres}
                        </td>
                        <td style="width: 50%; padding: 4px 6px; border-bottom: 1px solid black; text-align: left;">
                          <strong>ÁREA / SEDE:</strong> ${activeVinculo?.sedes?.nombre || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td style="width: 50%; padding: 4px 6px; border-bottom: 1px solid black; border-right: 1px solid black; text-align: left;">
                          <strong>CARGO:</strong> ${activeVinculo?.cargos?.nombre || "-"}
                        </td>
                        <td style="width: 50%; padding: 4px 6px; border-bottom: 1px solid black; text-align: left;">
                          <strong>DNI:</strong> ${selectedPerson.numero_documento}
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 4px 6px; text-align: left;">
                          <strong>TALLA DE:</strong> &nbsp;&nbsp;&nbsp;&nbsp; 
                          ZAPATO: <span style="text-decoration: underline; font-weight: bold;">&nbsp;&nbsp;${selectedPerson.talla_calzado || "___"}&nbsp;&nbsp;</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
                          CAMISA / POLO: <span style="text-decoration: underline; font-weight: bold;">&nbsp;&nbsp;${selectedPerson.talla_polo || "___"}&nbsp;&nbsp;</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
                          PANTALÓN: <span style="text-decoration: underline; font-weight: bold;">&nbsp;&nbsp;${selectedPerson.talla_pantalon || "___"}&nbsp;&nbsp;</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Elementos Entregados Table -->
                <table style="width: 100%; border-collapse: collapse; border: 1px solid black; font-family: Arial, sans-serif; margin-bottom: 15px;">
                  <thead>
                    <tr style="background-color: #cbd5e1; font-size: 8px; font-weight: bold; text-transform: uppercase; height: 24px; text-align: center;">
                      <th style="border: 1px solid black; width: 6%;">ITEM</th>
                      <th style="border: 1px solid black; width: 44%;">DESCRIPCIÓN DEL EQUIPO DE PROTECCIÓN PERSONAL / UNIFORME</th>
                      <th style="border: 1px solid black; width: 8%;">CANT.</th>
                      <th style="border: 1px solid black; width: 14%;">FECHA DE ENTREGA</th>
                      <th style="border: 1px solid black; width: 14%;">FECHA DE RENOVACIÓN</th>
                      <th style="border: 1px solid black; width: 14%;">FIRMA DEL COLABORADOR</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRowsHtml}
                  </tbody>
                </table>
              </div>

              <!-- Responsable del Registro Block -->
              <div style="border: 1px solid black; font-family: Arial, sans-serif; font-size: 9px; color: black; margin-top: auto;">
                <div style="background-color: #cbd5e1; font-weight: bold; padding: 3px 6px; border-bottom: 1px solid black; text-transform: uppercase; font-size: 9px; text-align: left;">
                  RESPONSABLE DEL REGISTRO
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                  <tbody>
                    <tr style="height: 32px;">
                      <td style="width: 50%; padding: 4px 6px; border-bottom: 1px solid black; border-right: 1px solid black; vertical-align: bottom; text-align: left;">
                        <strong>NOMBRE:</strong> ____________________________________________________
                      </td>
                      <td style="width: 25%; padding: 4px 6px; border-bottom: 1px solid black; border-right: 1px solid black; vertical-align: bottom; text-align: left;">
                        <strong>FECHA:</strong> ____ / ____ / ________
                      </td>
                      <td style="width: 25%; padding: 4px 6px; border-bottom: 1px solid black; vertical-align: bottom; text-align: left;" rowspan="2">
                        <strong>FIRMA:</strong> <br/><br/>
                      </td>
                    </tr>
                    <tr style="height: 32px;">
                      <td style="width: 50%; padding: 4px 6px; border-right: 1px solid black; vertical-align: bottom; text-align: left;">
                        <strong>CARGO:</strong> _____________________________________________________
                      </td>
                      <td style="width: 25%; padding: 4px 6px; border-right: 1px solid black; vertical-align: bottom; text-align: left;">
                        <strong>DNI:</strong> ___________________
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <script>
            function imprimirConformidad() {
              window.print();
            }

            function descargarPDF() {
              const element = document.getElementById('print-kardex-conformidad');
              const opt = {
                margin: 0,
                filename: '${docName}.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
              };
              html2pdf().set(opt).from(element).save();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setGeneratingPdf(false);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 flex-shrink-0 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Almacén y Logística / Entrega de Dotaciones
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-indigo-600" />
            Kardex de Entregas
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Monitorea las dotaciones de EPP y uniformes recibidas por cada colaborador y descarga los cargos de conformidad firmados.
          </p>
        </div>
      </div>

      {/* Autocomplete Search worker */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col space-y-4 max-w-xl">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Buscar Colaborador (Nombre o DNI)</label>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Escribe apellidos, nombres o DNI..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value) setSelectedPerson(null);
            }}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          
          {/* Match results list */}
          {matchedPeople.length > 0 && !selectedPerson && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto divide-y divide-slate-100">
              {matchedPeople.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    handleSelectPerson(p);
                    setSearchQuery(`${p.apellidos}, ${p.nombres}`);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between text-sm transition-colors"
                >
                  <div>
                    <span className="font-semibold text-slate-800">{p.apellidos}, {p.nombres}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">DNI: {p.numero_documento}</span>
                  </div>
                  <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">Seleccionar</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected worker data */}
      {selectedPerson && (
        <div className="space-y-6 animate-fade-in print:space-y-4">
          
          {/* Summary Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 print:border-none print:shadow-none">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold">
                <User className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">{selectedPerson.apellidos}, {selectedPerson.nombres}</h2>
                <div className="text-xs text-slate-500 font-medium space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold">Tallas registradas:</span> 
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-bold">Polo: {selectedPerson.talla_polo || "-"}</span>
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-bold">Pantalón: {selectedPerson.talla_pantalon || "-"}</span>
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-bold">Calzado: {selectedPerson.talla_calzado || "-"}</span>
                    <span className="text-slate-300">|</span>
                    <span className="flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-rose-500" />
                      Último EMO: <span className="font-mono text-slate-700 font-bold">{formatDMY(selectedPerson.fecha_ultimo_emo)}</span>
                    </span>
                  </div>
                  <div>
                    Fecha Ingreso: <span className="font-mono text-indigo-600 font-bold mr-3">{formatDMY(getFechaIngresoFallback(vinculos, selectedPerson))}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Select Active Job Link */}
            {vinculos.length > 1 && (
              <div className="flex items-center gap-2 self-start md:self-auto">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Puesto:</span>
                <select
                  value={activeVinculo?.id || ""}
                  onChange={(e) => {
                    const v = vinculos.find(x => x.id === parseInt(e.target.value));
                    if (v) handleSelectVinculo(v);
                  }}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold text-slate-600 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                >
                  {vinculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.cargos?.nombre} ({v.sedes?.nombre}) [{v.estado}]
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {activeVinculo && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col print:border-none print:shadow-none">
              
              {/* Table Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="font-heading text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Shirt className="w-5 h-5 text-indigo-600" />
                  Dotaciones Entregadas a este Puesto
                </h3>
                
                {entregas.length > 0 && (
                  <button
                    onClick={handlePrintConformity}
                    disabled={generatingPdf}
                    className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-indigo-100 cursor-pointer"
                  >
                    {generatingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                    Imprimir Cargo Conformidad
                  </button>
                )}
              </div>

              {/* Table / List */}
              <div className="overflow-x-auto min-h-[300px]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                    <p className="text-xs">Consultando entregas...</p>
                  </div>
                ) : entregas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                    <Shirt className="w-10 h-10 text-slate-300 animate-pulse" />
                    <h4 className="text-xs font-bold text-slate-700">Sin entregas registradas</h4>
                    <p className="text-[11px] text-slate-400 max-w-xs">No se registran despachos aprobados y entregados para este puesto laboral.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/20 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="px-6 py-3.5">Cód. Requerimiento</th>
                        <th className="px-6 py-3.5">Fecha de Entrega</th>
                        <th className="px-6 py-3.5">Producto / Detalle</th>
                        <th className="px-6 py-3.5 text-center">Cantidad Recibida</th>
                        <th className="px-6 py-3.5">Categoría</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {entregas.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-3.5 font-mono font-bold text-indigo-600">
                            {e.requerimientos?.codigo || "REQ-XXX"}
                          </td>
                          <td className="px-6 py-3.5 text-slate-500 font-mono">
                            {e.requerimientos?.fecha_entrega ? new Date(e.requerimientos.fecha_entrega).toLocaleDateString("es-PE") : "En tránsito"}
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="font-semibold text-slate-800">{e.productos?.nombre}</div>
                            {e.productos?.es_uniforme && (
                              <div className="text-[10px] text-slate-400 font-medium">Talla: {e.producto_tallas?.tallas?.valor || "Única"}</div>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-center font-bold text-slate-900">
                            {e.cantidad_entregada} un.
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                              e.productos?.es_uniforme ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-blue-50 text-blue-700 border-blue-100"
                            }`}>
                              {e.productos?.es_uniforme ? "Uniforme" : "EPP / Material"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          )}
          
        </div>
      )}

    </div>
  );
}
