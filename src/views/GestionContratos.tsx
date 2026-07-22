import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { 
  ArrowLeft,
  Upload,
  Pencil,
  FileText, 
  Plus, 
  Trash2, 
  Search, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  X, 
  Check, 
  RefreshCw, 
  User, 
  Briefcase, 
  FileDown,
  Building,
  UserSquare,
  AlertCircle
} from "lucide-react";

export function GestionContratos() {
  const [loading, setLoading] = useState(false);
  const [personas, setPersonas] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalidades, setModalidades] = useState<any[]>([]);
  
  const [selectedPersona, setSelectedPersona] = useState<any | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingContractId, setEditingContractId] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFormValues(prev => ({ ...prev, archivo_pdf: file.name }));
    }
  };

  const handleOpenEdit = (c: any) => {
    setEditingContractId(c.id);
    setIsRenewing(false);
    setSelectedFile(null);
    setFormValues({
      vinculo_laboral_id: c.vinculo_laboral_id,
      modalidad_contrato_id: c.modalidad_contrato_id,
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_fin || "",
      estado: c.estado,
      archivo_pdf: c.archivo_pdf || ""
    });
  };
  
  const [formValues, setFormValues] = useState<Record<string, any>>({
    vinculo_laboral_id: "",
    modalidad_contrato_id: "",
    fecha_inicio: "",
    fecha_fin: "",
    estado: "Vigente",
    archivo_pdf: ""
  });

  const loadLookups = async () => {
    try {
      const { data } = await supabase.from("modalidades_contrato").select("id, nombre");
      setModalidades(data || []);
    } catch (err) {
      console.error("Error loading lookups for contracts:", err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
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
            creado_en,
            empresas_internas (id, razon_social),
            sedes (id, nombre, cliente_id, clientes (id, razon_social)),
            cargos (id, nombre),
            contratos (
              id,
              vinculo_laboral_id,
              fecha_inicio,
              fecha_fin,
              estado,
              archivo_pdf,
              modalidad_contrato_id,
              modalidades_contrato (id, nombre)
            )
          )
        `)
        .order("apellidos", { ascending: true });

      if (dbError) throw dbError;
      setPersonas(resData || []);
    } catch (err: any) {
      console.error("Error loading contracts:", err);
      setError(err.message || "Error al cargar los contratos de personal.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLookups();
    loadData();
  }, []);

  useEffect(() => {
    const autoPersonaId = sessionStorage.getItem("autoSelectContractPersonaId");
    if (!autoPersonaId) {
      window.dispatchEvent(new CustomEvent("navigate-to", { detail: { path: "/rrhh/fichas" } }));
      return;
    }

    if (personas.length > 0) {
      const found = personas.find(p => p.id.toString() === autoPersonaId);
      if (found) {
        setSelectedPersona(found);
        
        const activeVinculos = found.vinculos_laborales?.filter((v: any) => v.estado === "Activo") || [];
        const targetV = activeVinculos[0] || found.vinculos_laborales?.[0] || null;
        
        setFormValues(prev => {
          if (prev.vinculo_laboral_id && prev.modalidad_contrato_id) return prev;
          return {
            vinculo_laboral_id: targetV?.id || "",
            modalidad_contrato_id: modalidades[0]?.id || "",
            fecha_inicio: new Date().toISOString().split("T")[0],
            fecha_fin: "",
            estado: "Vigente",
            archivo_pdf: ""
          };
        });
      }
    }
  }, [personas, modalidades]);

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

  const handleOpenRenew = (c: any) => {
    setIsRenewing(true);
    setEditingContractId(null);
    setSelectedFile(null);
    let nextStartDate = new Date().toISOString().split("T")[0];
    if (c.fecha_fin) {
      const prevEndDate = new Date(c.fecha_fin);
      prevEndDate.setDate(prevEndDate.getDate() + 1);
      nextStartDate = prevEndDate.toISOString().split("T")[0];
    }

    setFormValues({
      vinculo_laboral_id: c.vinculo_laboral_id,
      modalidad_contrato_id: c.modalidad_contrato_id,
      fecha_inicio: nextStartDate,
      fecha_fin: "",
      estado: "Vigente",
      archivo_pdf: ""
    });
  };

  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.vinculo_laboral_id) {
      alert("Debes seleccionar el puesto del colaborador.");
      return;
    }
    
    setLoading(true);
    try {
      let fileName = formValues.archivo_pdf;
      if (selectedFile) {
        const arrayBuffer = await selectedFile.arrayBuffer();
        if (!fileName) {
          fileName = selectedFile.name;
        }

        const uploadUrl = (import.meta as any).env?.DEV ? "/api/upload-contrato" : "api/upload-contrato.php";
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "x-file-name": encodeURIComponent(fileName)
          },
          body: arrayBuffer
        });

        if (!response.ok) {
          const resErr = await response.json();
          throw new Error(resErr.error || "Error al subir el archivo al servidor local.");
        }
      }

      const payload = { ...formValues, archivo_pdf: fileName || null };
      if (!payload.fecha_fin) {
        payload.fecha_fin = null;
      }

      if (editingContractId) {
        const { error: dbError } = await supabase
          .from("contratos")
          .update(payload)
          .eq("id", editingContractId);
        
        if (dbError) throw dbError;
        alert("Contrato actualizado correctamente.");
        setEditingContractId(null);
      } else {
        if (payload.estado === "Vigente") {
          await supabase
            .from("contratos")
            .update({ estado: "Renovado" })
            .eq("vinculo_laboral_id", payload.vinculo_laboral_id)
            .eq("estado", "Vigente");
        }

        const { error: dbError } = await supabase
          .from("contratos")
          .insert([payload]);

        if (dbError) throw dbError;
        alert("Contrato registrado correctamente.");
      }

      setIsRenewing(false);
      setSelectedFile(null);
      
      setFormValues({
        vinculo_laboral_id: payload.vinculo_laboral_id,
        modalidad_contrato_id: modalidades[0]?.id || "",
        fecha_inicio: new Date().toISOString().split("T")[0],
        fecha_fin: "",
        estado: "Vigente",
        archivo_pdf: ""
      });

      await loadData();
    } catch (err: any) {
      console.error("Error saving contract:", err);
      alert("Error al registrar contrato: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContract = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar este contrato de forma permanente del historial?")) {
      return;
    }
    setLoading(true);
    try {
      const { error: dbError } = await supabase
        .from("contratos")
        .delete()
        .eq("id", id);
      
      if (dbError) throw dbError;

      alert("Contrato eliminado.");
      await loadData();
    } catch (err: any) {
      console.error("Error deleting contract:", err);
      alert("Error al eliminar contrato: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedPersonaContracts = React.useMemo(() => {
    if (!selectedPersona) return [];
    return (selectedPersona.vinculos_laborales || []).flatMap((v: any) => {
      const contrs = v.contratos || [];
      return contrs.map((c: any) => ({
        ...c,
        vinculo: v,
        vinculo_laboral_id: c.vinculo_laboral_id || v.id
      }));
    }).sort((a: any, b: any) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime());
  }, [selectedPersona]);

  if (loading && !selectedPersona) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-slate-450 text-sm font-medium">Cargando contratos del colaborador...</p>
      </div>
    );
  }

  if (!selectedPersona) {
    return null;
  }

  const handleBackToPersonal = () => {
    sessionStorage.removeItem("autoSelectContractPersonaId");
    window.dispatchEvent(new CustomEvent("navigate-to", { detail: { path: "/rrhh/fichas" } }));
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Header with back button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 flex-shrink-0 gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>Recursos Humanos</span>
            <span className="text-slate-300">/</span>
            <span>Fichas de Personal</span>
            <span className="text-slate-300">/</span>
            <span className="text-blue-600 font-extrabold">Contratos</span>
          </div>
          
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-8 h-8 text-blue-600" />
            Contratos de {selectedPersona.apellidos}, {selectedPersona.nombres}
          </h1>
          
          <p className="text-xs text-slate-500 font-medium">
            DNI: <span className="font-mono font-bold text-slate-700">{selectedPersona.numero_documento}</span>
            {selectedPersona.correo && (
              <>
                <span className="mx-2 text-slate-350">|</span>
                Correo: <span className="text-slate-700 font-bold">{selectedPersona.correo}</span>
              </>
            )}
            <span className="mx-2 text-slate-355">|</span>
            F. Ingreso: <span className="text-slate-700 font-bold">{formatDMY(selectedPersona.fecha_ingreso || getFechaIngresoFallback(selectedPersona.vinculos_laborales || [], selectedPersona))}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBackToPersonal}
            className="inline-flex items-center gap-2 bg-slate-50 border border-slate-250 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 px-4 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer hover:-translate-x-0.5 active:scale-95"
            title="Regresar al listado de fichas de personal"
          >
            <ArrowLeft className="w-4 h-4 text-blue-600 font-extrabold stroke-[2.5]" />
            Volver a Personal
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-2.5 rounded-lg text-xs font-semibold hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto pr-1">
        
        {/* Column 1: Contract History (7 columns) */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-[400px]">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 bg-slate-50/10 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Historial Completo de Contratos</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full">
                {selectedPersonaContracts.length} Registros
              </span>
            </div>

            <div className="flex-1 overflow-x-auto bg-white">
              {selectedPersonaContracts.length === 0 ? (
                <div className="text-center py-24 text-slate-400 space-y-3">
                  <FileText className="w-12 h-12 mx-auto text-slate-300" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-700">No se registran contratos</p>
                    <p className="text-[11px] text-slate-450 max-w-xs mx-auto">Este colaborador no tiene contratos registrados para sus puestos activos o históricos.</p>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/40 font-bold text-slate-500 uppercase tracking-wider text-[9px]">
                      <th className="px-4 py-3.5">Puesto / Empresa</th>
                      <th className="px-4 py-3.5">Sede</th>
                      <th className="px-4 py-3.5">Modalidad</th>
                      <th className="px-4 py-3.5">Vigencia (Inicio/Fin)</th>
                      <th className="px-4 py-3.5 text-center">Estado</th>
                      <th className="px-4 py-3.5 text-center">PDF</th>
                      <th className="px-4 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {selectedPersonaContracts.map((c: any) => {
                      const v = c.vinculo;
                      
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      const end = c.fecha_fin ? new Date(c.fecha_fin) : null;
                      const diffDays = end ? Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 999;
                      
                      let badgeClass = "bg-slate-105 text-slate-550 border-slate-200";
                      if (c.estado === "Vigente") {
                        if (!end) badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-150 font-semibold";
                        else if (diffDays < 0) badgeClass = "bg-red-50 text-red-850 border-red-200 font-bold";
                        else if (diffDays <= 15) badgeClass = "bg-red-50 text-red-650 border-red-200 font-bold animate-pulse";
                        else if (diffDays <= 30) badgeClass = "bg-amber-50 text-amber-700 border-amber-200 font-bold";
                        else badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-150 font-semibold";
                      } else if (c.estado === "Renovado") {
                        badgeClass = "bg-slate-50 text-slate-400 border-slate-200";
                      } else if (c.estado === "Vencido") {
                        badgeClass = "bg-red-50 text-red-700 border-red-150";
                      } else if (c.estado === "Anulado") {
                        badgeClass = "bg-slate-50 text-slate-400 line-through border-slate-200";
                      }

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/20 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-800">
                              {v.estado === "Inactivo" && <span className="text-red-500 font-bold mr-1">[Cesado]</span>}
                              {v.cargos?.nombre}
                            </div>
                            <div className="text-[9px] text-slate-400 font-medium">Empresa: {v.empresas_internas?.razon_social}</div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-550 font-semibold">
                            {v.sedes?.nombre}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 font-semibold">
                            {c.modalidades_contrato?.nombre || "Plazo Fijo"}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[10px] text-slate-650">
                            <div>Ini: {formatDMY(c.fecha_inicio)}</div>
                            <div>Fin: {c.fecha_fin ? formatDMY(c.fecha_fin) : "Indeterminado"}</div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${badgeClass}`}>
                              {c.estado === "Vigente" && end && diffDays < 0 ? "Vencido (Vigente)" : c.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {c.archivo_pdf ? (
                              <a
                                href={`uploads/contratos/${encodeURIComponent(c.archivo_pdf)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 font-bold hover:underline"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                                PDF
                              </a>
                            ) : (
                              <span className="text-slate-350 italic text-[10px]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {c.estado === "Vigente" && v.estado === "Activo" && (
                                <button
                                  onClick={() => handleOpenRenew(c)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer border-none"
                                  title="Renovar este contrato"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEdit(c)}
                                className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors cursor-pointer border-none"
                                title="Editar este contrato (cambiar PDF, fechas, etc.)"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteContract(c.id)}
                                className="p-1 text-red-650 hover:bg-red-50 rounded transition-colors cursor-pointer border-none"
                                title="Eliminar este contrato permanentemente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          </div>
        </div>

        {/* Column 2: Contract Registration/Renewal Form (5 columns) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              {editingContractId ? (
                <Pencil className="w-4 h-4 text-amber-600 stroke-[2.5]" />
              ) : (
                <Plus className="w-4 h-4 text-blue-600 stroke-[3]" />
              )}
              {editingContractId ? "Editar Contrato Registrado" : isRenewing ? "Renovar Contrato Vigente" : "Registrar Nuevo Contrato"}
            </h4>
            
            <form onSubmit={handleSaveContract} className="space-y-4">
              
              {/* Select Job / Vinculo */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Puesto / Obra Asignado</label>
                <select
                  required
                  value={formValues.vinculo_laboral_id}
                  onChange={(e) => setFormValues({ ...formValues, vinculo_laboral_id: parseInt(e.target.value) })}
                  disabled={isRenewing}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 cursor-pointer"
                >
                  <option value="" disabled>Seleccione puesto...</option>
                  {(selectedPersona.vinculos_laborales || [])
                    .filter((v: any) => v.estado === "Activo")
                    .map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.cargos?.nombre} ({v.sedes?.nombre}) &bull; {v.empresas_internas?.razon_social}
                      </option>
                    ))
                  }
                  {/* Fallback to inactive vinculos if no active ones are found, just to avoid breaking UI */}
                  {(selectedPersona.vinculos_laborales || [])
                    .filter((v: any) => v.estado === "Inactivo")
                    .map((v: any) => (
                      <option key={v.id} value={v.id} disabled>
                        [INACTIVO] {v.cargos?.nombre} ({v.sedes?.nombre})
                      </option>
                    ))
                  }
                </select>
              </div>

              {/* Modalidad de Contrato */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Modalidad de Contrato</label>
                <select
                  required
                  value={formValues.modalidad_contrato_id}
                  onChange={(e) => setFormValues({ ...formValues, modalidad_contrato_id: parseInt(e.target.value) })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 cursor-pointer"
                >
                  <option value="" disabled>Seleccione modalidad...</option>
                  {modalidades.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    required
                    value={formValues.fecha_inicio}
                    onChange={(e) => setFormValues({ ...formValues, fecha_inicio: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha Fin (Opcional)</label>
                  <input
                    type="date"
                    value={formValues.fecha_fin}
                    onChange={(e) => setFormValues({ ...formValues, fecha_fin: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-700"
                    placeholder="Indeterminado"
                  />
                </div>
              </div>

              {/* PDF upload option */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Adjuntar PDF Escaneado (Opcional)</label>
                <div className="relative border border-dashed border-slate-350 hover:border-blue-450 hover:bg-slate-50/50 rounded-xl p-4 text-center transition-all cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-1.5">
                    <Upload className="w-5 h-5 text-slate-400" />
                    {selectedFile ? (
                      <p className="text-xs font-bold text-slate-800 truncate max-w-[250px]">{selectedFile.name}</p>
                    ) : (
                      <p className="text-[11px] text-slate-500 font-semibold">Haz clic para buscar o arrastra el PDF aquí</p>
                    )}
                  </div>
                </div>
              </div>

              {/* PDF path */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre final del archivo PDF</label>
                <input
                  type="text"
                  value={formValues.archivo_pdf || ""}
                  onChange={(e) => setFormValues({ ...formValues, archivo_pdf: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-700 bg-slate-50"
                  placeholder="Se auto-completa al seleccionar un archivo"
                />
              </div>

              {/* Estado */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Estado del Contrato</label>
                <select
                  value={formValues.estado}
                  onChange={(e) => setFormValues({ ...formValues, estado: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 cursor-pointer"
                >
                  <option value="Vigente">Vigente (Activo)</option>
                  <option value="Renovado">Renovado (Sustituido)</option>
                  <option value="Vencido">Vencido</option>
                  <option value="Anulado">Anulado</option>
                </select>
              </div>

              {/* Submit buttons */}
              <div className="flex gap-2 pt-2">
                {isRenewing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsRenewing(false);
                      const activeVinculos = selectedPersona.vinculos_laborales?.filter((v: any) => v.estado === "Activo") || [];
                      const targetV = activeVinculos[0] || selectedPersona.vinculos_laborales?.[0] || null;
                      setFormValues({
                        vinculo_laboral_id: targetV?.id || "",
                        modalidad_contrato_id: modalidades[0]?.id || "",
                        fecha_inicio: new Date().toISOString().split("T")[0],
                        fecha_fin: "",
                        estado: "Vigente",
                        archivo_pdf: ""
                      });
                    }}
                    className="flex-1 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-all cursor-pointer bg-white"
                  >
                    Cancelar Ren.
                  </button>
                )}
                {editingContractId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingContractId(null);
                      const activeVinculos = selectedPersona.vinculos_laborales?.filter((v: any) => v.estado === "Activo") || [];
                      const targetV = activeVinculos[0] || selectedPersona.vinculos_laborales?.[0] || null;
                      setFormValues({
                        vinculo_laboral_id: targetV?.id || "",
                        modalidad_contrato_id: modalidades[0]?.id || "",
                        fecha_inicio: new Date().toISOString().split("T")[0],
                        fecha_fin: "",
                        estado: "Vigente",
                        archivo_pdf: ""
                      });
                    }}
                    className="flex-1 py-2 border border-slate-200 text-slate-550 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-all cursor-pointer bg-white"
                  >
                    Cancelar Edic.
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-1.5 cursor-pointer border-none"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  {editingContractId ? "Guardar Cambios" : isRenewing ? "Renovar Puesto" : "Registrar Contrato"}
                </button>
              </div>

            </form>
          </div>
        </div>

      </div>

    </div>
  );
}
