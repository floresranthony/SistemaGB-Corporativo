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
          fecha_ultimo_emo,
          fecha_ingreso,
          fecha_primer_contrato
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
          empresas_internas (id, razon_social),
          sedes (id, nombre),
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
    if (person?.fecha_ingreso) return person.fecha_ingreso;
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
    setGeneratingPdf(true);
    setTimeout(() => {
      setGeneratingPdf(false);
      window.print();
    }, 1200);
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
                    Fecha Ingreso: <span className="font-mono text-indigo-600 font-bold mr-3">{formatDMY(selectedPerson.fecha_ingreso || getFechaIngresoFallback(vinculos, selectedPerson))}</span>
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

          {/* Printable Conformity Sheet */}
          <div className="hidden print:block bg-white p-8 border border-slate-300 rounded-lg text-xs space-y-6 max-w-2xl mx-auto">
            <div className="text-center border-b pb-4">
              <h1 className="text-lg font-bold">CARGO DE CONFORMIDAD DE ENTREGA DE EPP Y UNIFORMES</h1>
              <p className="text-slate-500 font-mono mt-1">Grupo Bax Logística / Operaciones de Almacén</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div><strong>Colaborador:</strong> {selectedPerson.apellidos}, {selectedPerson.nombres}</div>
              <div><strong>Nro. Documento:</strong> {selectedPerson.numero_documento}</div>
              <div><strong>Cargo / Sede:</strong> {activeVinculo?.cargos?.nombre} ({activeVinculo?.sedes?.nombre})</div>
              <div><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString("es-PE")}</div>
            </div>

            <div className="border-t pt-4">
              <p className="mb-4">El suscrito declara haber recibido a conformidad y bajo responsabilidad las siguientes dotaciones de prendas de vestir, equipos de protección y materiales para el desempeño de sus labores:</p>
              
              <table className="w-full border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-50 text-[10px]">
                    <th className="border border-slate-300 p-2 text-left">Código Req.</th>
                    <th className="border border-slate-300 p-2 text-left">Descripción / Producto</th>
                    <th className="border border-slate-300 p-2 text-center">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {entregas.map((e) => (
                    <tr key={e.id}>
                      <td className="border border-slate-300 p-2 font-mono">{e.requerimientos?.codigo}</td>
                      <td className="border border-slate-300 p-2">{e.productos?.nombre} (Talla: {e.producto_tallas?.tallas?.valor || "Única"})</td>
                      <td className="border border-slate-300 p-2 text-center">{e.cantidad_entregada}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-24 grid grid-cols-2 gap-10 text-center">
              <div className="border-t border-slate-400 pt-2">
                Firma del Colaborador
                <div className="text-[10px] text-slate-400 font-mono mt-1">DNI: _______________________</div>
              </div>
              <div className="border-t border-slate-400 pt-2">
                Firma Responsable Almacén
                <div className="text-[10px] text-slate-400 font-mono mt-1">Entregado por</div>
              </div>
            </div>
          </div>
          
        </div>
      )}

    </div>
  );
}
