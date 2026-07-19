import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
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
  Search
} from "lucide-react";

export function PizarraDigital() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeVinculos, setActiveVinculos] = useState<any[]>([]);

  // Lookups
  const [sedes, setSedes] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [regimenes, setRegimenes] = useState<any[]>([]);
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);

  // Modals state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isIngresoModalOpen, setIsIngresoModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [showQuickPersona, setShowQuickPersona] = useState(false);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");
  const [showCandidateDropdown, setShowCandidateDropdown] = useState(false);

  // Forms
  const [requestForm, setRequestForm] = useState<Record<string, any>>({});
  const [ingresoForm, setIngresoForm] = useState<Record<string, any>>({});
  const [quickPersonaForm, setQuickPersonaForm] = useState<Record<string, any>>({
    nombres: "",
    apellidos: "",
    tipo_documento_id: "",
    numero_documento: "",
    sexo: "Masculino",
    fecha_nacimiento: "",
    telefono: "",
    correo: "",
    fecha_ingreso: new Date().toISOString().split("T")[0],
    fecha_primer_contrato: new Date().toISOString().split("T")[0]
  });

  // Current user role for client-side visibility simulation
  const currentRole = localStorage.getItem("bax_role") || "admin";

  const loadLookups = async () => {
    try {
      const [s, c, p, r, d] = await Promise.all([
        supabase.from("sedes").select("*").eq("activo", true),
        supabase.from("cargos").select("*").eq("activo", true),
        supabase.from("personas").select("id, nombres, apellidos, numero_documento"),
        supabase.from("regimenes_laborales").select("id, nombre"),
        supabase.from("tipos_documento").select("id, nombre")
      ]);
      setSedes(s.data || []);
      setCargos(c.data || []);
      setPersonas(p.data || []);
      setRegimenes(r.data || []);
      setDocumentTypes(d.data || []);
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
              cliente_id,
              clientes (
                id,
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

  // Open Create Vacancy Modal
  const handleOpenRequest = () => {
    setRequestForm({
      sede_id: sedes[0]?.id || "",
      cargo_id: cargos[0]?.id || "",
      turno: "Rotativo",
      genero_requerido: "Indistinto",
      plazas_solicitadas: 1,
      plazas_cubiertas: 0,
      estado: "Pendiente",
      motivo_vacante: "Incremento de personal",
      fecha_solicitud: new Date().toISOString().split("T")[0]
    });
    setIsRequestModalOpen(true);
  };

  // Save Vacancy Request
  const handleSaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: dbErr } = await supabase
        .from("solicitudes_personal")
        .insert([requestForm]);

      if (dbErr) throw dbErr;
      setIsRequestModalOpen(false);
      loadSolicitudes();
    } catch (err: any) {
      console.error("Error creating vacancy request:", err);
      setError(err.message || "Error al crear solicitud.");
    } finally {
      setLoading(false);
    }
  };

  // Open Register Onboarding (Ingreso) Modal
  const handleOpenIngreso = (request: any) => {
    setSelectedRequest(request);
    setShowQuickPersona(false); // reset view to standard candidate selection
    
    // Find the target company for the request
    const targetEmpresaId = request.sedes?.clientes?.empresa_interna_id;

    // Filter available candidates: only exclude if they have an active vínculo in the target company
    const availablePersonas = personas.filter(
      (p) => !activeVinculos.some(
        (v) => v.estado === "Activo" && v.persona_id === p.id && v.empresa_interna_id === targetEmpresaId
      )
    );

    const defaultPersona = availablePersonas[0];
    setIngresoForm({
      persona_id: defaultPersona?.id || "",
      empresa_interna_id: targetEmpresaId || "", // dynamic from the request
      sueldo_basico: 1025.00,
      regimen_laboral_id: regimenes[0]?.id || "",
      fecha_inicio: new Date().toISOString().split("T")[0],
      fecha_fin: ""
    });
    setCandidateSearchQuery(
      defaultPersona
        ? `${defaultPersona.apellidos}, ${defaultPersona.nombres} - DNI: ${defaultPersona.numero_documento}`
        : ""
    );
    setShowCandidateDropdown(false);
    setIsIngresoModalOpen(true);
  };

  // Save Onboarding
  const handleSaveIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingresoForm.persona_id) {
      alert("Por favor seleccione un candidato válido.");
      return;
    }
    setLoading(true);
    try {
      const targetEmpresaId = selectedRequest.sedes?.clientes?.empresa_interna_id;
      if (!targetEmpresaId) {
        alert("La sede seleccionada no tiene una empresa facturadora configurada a través de su cliente.");
        setLoading(false);
        return;
      }

      // 1. Get first worker type to link the new employee to
      const { data: firstType } = await supabase.from("tipos_trabajador").select("id").limit(1).single();

      if (!firstType) {
        alert("Primero debes configurar Tipos de Trabajador en la Base de Datos.");
        setLoading(false);
        return;
      }

      // Get first contract modality to link the contract to
      const { data: firstModality } = await supabase.from("modalidades_contrato").select("id").limit(1).single();

      if (!firstModality) {
        alert("Primero debes configurar Modalidades de Contrato en la Base de Datos.");
        setLoading(false);
        return;
      }

      // 2. Create the Vínculo Laboral (Job Connection) for the person
      const { error: jobErr } = await supabase
        .from("vinculos_laborales")
        .insert([{
          persona_id: ingresoForm.persona_id,
          empresa_interna_id: targetEmpresaId, // Use the correct company!
          sede_id: selectedRequest.sede_id,
          cargo_id: selectedRequest.cargo_id,
          tipo_trabajador_id: firstType.id,
          regimen_laboral_id: ingresoForm.regimen_laboral_id,
          sueldo_basico: ingresoForm.sueldo_basico,
          estado: "Activo",
          solicitud_id: selectedRequest.id
        }]);

      if (jobErr) throw jobErr;

      // 3. Get the ID of the newly created vínculo
      const { data: newVinc, error: vincFetchErr } = await supabase
        .from("vinculos_laborales")
        .select("id")
        .eq("persona_id", ingresoForm.persona_id)
        .eq("estado", "Activo")
        .order("id", { ascending: false })
        .limit(1)
        .single();
      
      if (vincFetchErr) throw vincFetchErr;

      // 4. Create the Vigente contract
      const { error: contractErr } = await supabase
        .from("contratos")
        .insert([{
          vinculo_laboral_id: newVinc.id,
          modalidad_contrato_id: firstModality.id,
          fecha_inicio: ingresoForm.fecha_inicio || new Date().toISOString().split("T")[0],
          fecha_fin: ingresoForm.fecha_fin || null,
          estado: "Vigente"
        }]);
      
      if (contractErr) throw contractErr;

      // 5. Update persona dates if they are empty
      const today = new Date().toISOString().split("T")[0];
      const { data: currentPersona } = await supabase
        .from("personas")
        .select("fecha_ingreso, fecha_primer_contrato")
        .eq("id", ingresoForm.persona_id)
        .single();

      if (currentPersona) {
        const updatePayload: any = {};
        if (!currentPersona.fecha_ingreso) {
          updatePayload.fecha_ingreso = ingresoForm.fecha_inicio || today;
        }
        if (!currentPersona.fecha_primer_contrato) {
          updatePayload.fecha_primer_contrato = ingresoForm.fecha_inicio || today;
        }

        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from("personas")
            .update(updatePayload)
            .eq("id", ingresoForm.persona_id);
        }
      }

      // 6. Increment plazas_cubiertas and update status
      const newCovered = selectedRequest.plazas_cubiertas + 1;
      const newEstado = newCovered >= selectedRequest.plazas_solicitadas ? "Completado" : "Parcial";

      const { error: reqErr } = await supabase
        .from("solicitudes_personal")
        .update({
          plazas_cubiertas: newCovered,
          estado: newEstado
        })
        .eq("id", selectedRequest.id);

      if (reqErr) throw reqErr;

      setIsIngresoModalOpen(false);
      loadSolicitudes();
    } catch (err: any) {
      alert("Error al registrar ingreso: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create Quick Candidate Master Profile
  const handleSaveQuickPersona = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: firstPension } = await supabase.from("sistemas_pension").select("id").limit(1).single();
      const { data: firstDoc } = await supabase.from("tipos_documento").select("id").limit(1).single();

      const payload = {
        ...quickPersonaForm,
        tipo_documento_id: quickPersonaForm.tipo_documento_id || firstDoc?.id || 1,
        sistema_pension_id: firstPension?.id || 1
      };

      const { data: resPers, error: persErr } = await supabase
        .from("personas")
        .insert([payload])
        .select("id, nombres, apellidos, numero_documento")
        .single();

      if (persErr) throw persErr;

      // Refresh lookups to include the new persona
      await loadLookups();
      
      // Select the new persona in the onboarding form
      setIngresoForm((prev) => ({ ...prev, persona_id: resPers.id }));
      setCandidateSearchQuery(`${resPers.apellidos}, ${resPers.nombres} - DNI: ${resPers.numero_documento}`);
      setShowQuickPersona(false);
      
      // Reset quick persona form
      setQuickPersonaForm({
        nombres: "",
        apellidos: "",
        tipo_documento_id: firstDoc?.id || "",
        numero_documento: "",
        sexo: "Masculino",
        fecha_nacimiento: "",
        telefono: "",
        correo: "",
        fecha_ingreso: new Date().toISOString().split("T")[0],
        fecha_primer_contrato: new Date().toISOString().split("T")[0]
      });

      alert("Candidato creado con éxito y seleccionado.");
    } catch (err: any) {
      alert("Error al crear candidato: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Remove worker (cese/deserción dirigida)
  const handleRemoveWorker = async (vinculo: any, request: any) => {
    const workerName = `${vinculo.personas?.apellidos}, ${vinculo.personas?.nombres}`;
    if (!confirm(`¿Está seguro de cesar al colaborador ${workerName}? Esto registrará su cese y liberará su vacante en la pizarra.`)) {
      return;
    }

    const motivo = prompt("Ingrese el motivo del cese:", "Deserción / Retiro temprano");
    if (motivo === null) return; // User cancelled prompt

    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      // 1. Update vinculo_laboral to Inactivo
      const { error: vinculoErr } = await supabase
        .from("vinculos_laborales")
        .update({
          estado: "Inactivo",
          fecha_cese: today,
          motivo_cese: motivo || "Deserción / Retiro temprano"
        })
        .eq("id", vinculo.id);

      if (vinculoErr) throw vinculoErr;

      // 2. Update Vigente contracts to Vencido
      const { error: contratoErr } = await supabase
        .from("contratos")
        .update({ estado: "Vencido" })
        .eq("vinculo_laboral_id", vinculo.id)
        .eq("estado", "Vigente");

      if (contratoErr) throw contratoErr;

      // 3. Decrement plazas_cubiertas and update status of solicitudes_personal
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

      await loadSolicitudes();
    } catch (e: any) {
      alert("Error al remover colaborador: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Seed Vacancies if empty
  const [seeding, setSeeding] = useState(false);
  const handleSeedVacancies = async () => {
    setSeeding(true);
    try {
      const { data: activeSedes } = await supabase.from("sedes").select("id").limit(2);
      const { data: activeCargos } = await supabase.from("cargos").select("id").limit(2);

      if (!activeSedes || activeSedes.length === 0 || !activeCargos || activeCargos.length === 0) {
        alert("Primero debes registrar Sedes y Cargos en la Fase 1.");
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

      loadSolicitudes();
    } catch (err: any) {
      alert("Error al precargar vacantes: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  // Filter list
  const filteredData = data.filter((s) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    const sedeName = s.sedes?.nombre?.toLowerCase() || "";
    const cargoName = s.cargos?.nombre?.toLowerCase() || "";
    return sedeName.includes(q) || cargoName.includes(q);
  });

  // Filter candidates for autocomplete
  const targetEmpresaId = selectedRequest?.sedes?.clientes?.empresa_interna_id;
  const filteredCandidates = personas
    .filter((p) => {
      return !activeVinculos.some(
        (v) => v.estado === "Activo" && v.persona_id === p.id && v.empresa_interna_id === targetEmpresaId
      );
    })
    .filter((p) => {
      const q = candidateSearchQuery.toLowerCase();
      if (!q) return true;
      const fullName = `${p.apellidos} ${p.nombres}`.toLowerCase();
      const document = p.numero_documento.toLowerCase();
      return fullName.includes(q) || document.includes(q);
    });

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto pr-1">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 flex-shrink-0 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Recursos Humanos / Planificación de Personal
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-8 h-8 text-blue-600" />
            Pizarra Digital de Personal
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Reemplaza las pizarras físicas de contratación. Monitoriza los requerimientos de personal por sede y registra ingresos de candidatos de forma directa.
          </p>
        </div>
        <div className="flex items-center gap-2">
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

          {(currentRole === "admin" || currentRole === "supervisor") && (
            <button
              onClick={handleOpenRequest}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Nueva Vacante
            </button>
          )}
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por Sede o Cargo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
          />
        </div>
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-100 px-3 py-1 text-xs rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Main Grid bento board of vacancy cards */}
      {loading && data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm">Sincronizando pizarra de reclutamiento...</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 py-16 text-center space-y-4">
          <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100 max-w-max mx-auto">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">No hay vacantes activas en la pizarra</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.map((req) => {
            const pct = Math.min(100, Math.floor((req.plazas_cubiertas / req.plazas_solicitadas) * 100));
            const isCompleted = req.estado === "Completado";

            return (
              <div
                key={req.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 ${isCompleted ? "border-emerald-200 bg-emerald-50/5" : "border-slate-100"
                  }`}
              >
                {/* Header card */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                      Solicitud ID: #{req.id}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isCompleted ? "bg-emerald-100 text-emerald-800" :
                      req.estado === "Parcial" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800 animate-pulse"
                      }`}>
                      {req.estado}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Briefcase className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 leading-tight">
                          {req.cargos?.nombre || "Cargo Desconocido"}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-medium">Turno: {req.turno}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-600 font-medium">
                        Sede: {req.sedes?.nombre || "Sede Desconocida"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details / Motivo */}
                {req.motivo_vacante && (
                  <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                    "{req.motivo_vacante}"
                  </div>
                )}

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      Plazas Cubiertas
                    </span>
                    <span className={isCompleted ? "text-emerald-600" : "text-slate-800"}>
                      {req.plazas_cubiertas} de {req.plazas_solicitadas}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${isCompleted ? "bg-emerald-500" : "bg-blue-500"
                        }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono text-right">
                    Solicitado: {new Date(req.fecha_solicitud).toLocaleDateString("es-PE")}
                  </div>
                </div>
                {/* Colaboradores Asignados */}
                {(() => {
                  const vacancyVinculos = activeVinculos.filter(
                    (v) => v.solicitud_id === req.id && v.estado === "Activo"
                  );
                  if (vacancyVinculos.length === 0) return null;
                  return (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Colaboradores Asignados:
                      </span>
                      <div className="space-y-1">
                        {vacancyVinculos.map((v) => (
                          <div key={v.id} className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-700 font-medium truncate max-w-[180px]">
                              {v.personas?.apellidos}, {v.personas?.nombres}
                            </span>
                            {currentRole !== "supervisor" && currentRole !== "gerencia" && (
                              <button
                                onClick={() => handleRemoveWorker(v, req)}
                                className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50 transition-colors shrink-0"
                                title="Cesar colaborador / Registrar deserción"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Historial de Deserciones / Retiros */}
                {(() => {
                  const inactiveVinculos = activeVinculos.filter(
                    (v) => v.solicitud_id === req.id && v.estado === "Inactivo"
                  );
                  if (inactiveVinculos.length === 0) return null;
                  return (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Deserciones / Retiros:
                      </span>
                      <div className="space-y-1">
                        {inactiveVinculos.map((v) => (
                          <div key={v.id} className="text-[11px] bg-red-50/50 text-red-700 px-2.5 py-1.5 rounded-lg border border-red-100/50">
                            <div className="font-semibold truncate max-w-[200px]" title={`${v.personas?.apellidos}, ${v.personas?.nombres}`}>
                              {v.personas?.apellidos}, {v.personas?.nombres}
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                              Cese: {new Date(v.fecha_cese).toLocaleDateString("es-PE")} | Motivo: <span className="italic font-sans">"{v.motivo_cese}"</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Onboarding buttons */}
                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  {currentRole !== "supervisor" && currentRole !== "gerencia" && !isCompleted && (
                    <button
                      onClick={() => handleOpenIngreso(req)}
                      className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 active:scale-95 transition-all flex items-center justify-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Registrar Ingreso
                    </button>
                  )}

                  {isCompleted && (
                    <div className="w-full flex items-center justify-center gap-1.5 py-2 text-emerald-600 text-xs font-bold bg-emerald-50 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                      Vacante Completada
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Supervisor: Create Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 animate-slide-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Solicitar Personal
              </h3>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRequest} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sede / Centro Trabajo</label>
                <select
                  required
                  value={requestForm.sede_id || ""}
                  onChange={(e) => setRequestForm({ ...requestForm, sede_id: parseInt(e.target.value) })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                >
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cargo Requerido</label>
                  <select
                    required
                    value={requestForm.cargo_id || ""}
                    onChange={(e) => setRequestForm({ ...requestForm, cargo_id: parseInt(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                  >
                    {cargos.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Turno</label>
                  <select
                    value={requestForm.turno || "Rotativo"}
                    onChange={(e) => setRequestForm({ ...requestForm, turno: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
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
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
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
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RRHH: Onboarding Candidate Modal */}
      {isIngresoModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 animate-slide-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Registrar Onboarding / Candidato
              </h3>
              <button
                onClick={() => setIsIngresoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {showQuickPersona ? (
              <form onSubmit={handleSaveQuickPersona} className="space-y-4">
                <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-xs">
                  Creando ficha maestra rápida. Una vez creada, se seleccionará automáticamente.
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombres</label>
                    <input
                      type="text"
                      required
                      value={quickPersonaForm.nombres || ""}
                      onChange={(e) => setQuickPersonaForm({ ...quickPersonaForm, nombres: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Apellidos</label>
                    <input
                      type="text"
                      required
                      value={quickPersonaForm.apellidos || ""}
                      onChange={(e) => setQuickPersonaForm({ ...quickPersonaForm, apellidos: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Tipo Doc.</label>
                    <select
                      required
                      value={quickPersonaForm.tipo_documento_id || ""}
                      onChange={(e) => setQuickPersonaForm({ ...quickPersonaForm, tipo_documento_id: parseInt(e.target.value) })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {documentTypes.map((dt) => (
                        <option key={dt.id} value={dt.id}>{dt.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nro. Documento</label>
                    <input
                      type="text"
                      required
                      value={quickPersonaForm.numero_documento || ""}
                      onChange={(e) => setQuickPersonaForm({ ...quickPersonaForm, numero_documento: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sexo</label>
                    <select
                      value={quickPersonaForm.sexo || "Masculino"}
                      onChange={(e) => setQuickPersonaForm({ ...quickPersonaForm, sexo: e.target.value })}
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
                      required
                      value={quickPersonaForm.fecha_nacimiento || ""}
                      onChange={(e) => setQuickPersonaForm({ ...quickPersonaForm, fecha_nacimiento: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={quickPersonaForm.telefono || ""}
                      onChange={(e) => setQuickPersonaForm({ ...quickPersonaForm, telefono: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Correo</label>
                    <input
                      type="email"
                      value={quickPersonaForm.correo || ""}
                      onChange={(e) => setQuickPersonaForm({ ...quickPersonaForm, correo: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowQuickPersona(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all"
                  >
                    Regresar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md flex items-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                    Crear Candidato
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveIngreso} className="space-y-4">
                <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-xs space-y-1">
                  <div><strong>Sede Destino:</strong> {selectedRequest.sedes?.nombre}</div>
                  <div><strong>Cargo:</strong> {selectedRequest.cargos?.nombre}</div>
                </div>

                <div className="relative">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Candidato (Ficha Maestra)</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickPersona(true)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      + Crear Ficha Rápida
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    required
                    placeholder="Buscar por nombre o DNI..."
                    value={candidateSearchQuery}
                    onChange={(e) => {
                      setCandidateSearchQuery(e.target.value);
                      setShowCandidateDropdown(true);
                      setIngresoForm((prev) => ({ ...prev, persona_id: "" }));
                    }}
                    onFocus={() => setShowCandidateDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowCandidateDropdown(false);
                        const selected = personas.find(p => p.id === ingresoForm.persona_id);
                        if (selected) {
                          setCandidateSearchQuery(`${selected.apellidos}, ${selected.nombres} - DNI: ${selected.numero_documento}`);
                        } else {
                          setCandidateSearchQuery("");
                        }
                      }, 200);
                    }}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-white"
                  />

                  {showCandidateDropdown && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100 font-sans">
                      {filteredCandidates.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 italic text-center font-medium">No se encontraron candidatos</div>
                      ) : (
                        filteredCandidates.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={() => {
                              setIngresoForm((prev) => ({ ...prev, persona_id: p.id }));
                              setCandidateSearchQuery(`${p.apellidos}, ${p.nombres} - DNI: ${p.numero_documento}`);
                              setShowCandidateDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-slate-50 transition-colors ${
                              ingresoForm.persona_id === p.id ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700"
                            }`}
                          >
                            {p.apellidos}, {p.nombres} - DNI: {p.numero_documento}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  <span className="text-[10px] text-slate-400 block mt-1">Busca y selecciona al postulante de su Ficha Maestra o usa el formulario rápido.</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sueldo Básico (S/.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      required
                      value={ingresoForm.sueldo_basico || ""}
                      onChange={(e) => setIngresoForm({ ...ingresoForm, sueldo_basico: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-semibold text-indigo-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Régimen Laboral</label>
                    <select
                      required
                      value={ingresoForm.regimen_laboral_id || ""}
                      onChange={(e) => setIngresoForm({ ...ingresoForm, regimen_laboral_id: parseInt(e.target.value) })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                    >
                      <option value="">Seleccione...</option>
                      {regimenes.map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha Inicio Contrato</label>
                    <input
                      type="date"
                      required
                      value={ingresoForm.fecha_inicio || ""}
                      onChange={(e) => setIngresoForm({ ...ingresoForm, fecha_inicio: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha Fin (Opcional)</label>
                    <input
                      type="date"
                      value={ingresoForm.fecha_fin || ""}
                      onChange={(e) => setIngresoForm({ ...ingresoForm, fecha_fin: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsIngresoModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md flex items-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                    Registrar Onboarding
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
