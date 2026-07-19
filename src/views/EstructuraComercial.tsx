import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { 
  Building, 
  Users, 
  MapPin, 
  Plus, 
  Trash2, 
  Edit2, 
  RefreshCw, 
  Check, 
  X, 
  Search, 
  Phone,
  User,
  FileSpreadsheet,
  Upload,
  Download,
  AlertCircle
} from "lucide-react";
import * as XLSX from "xlsx";

type StructureTab = "empresas" | "clientes" | "sedes";

export function EstructuraComercial() {
  const [activeTab, setActiveTab] = useState<StructureTab>("empresas");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Data lists
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<any | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [seeding, setSeeding] = useState(false);

  // Excel Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [parsedData, setParsedData] = useState<{
    clientes: any[];
    sedes: any[];
    errors: string[];
    warnings: string[];
  } | null>(null);

  // Filters state
  const [filterClienteId, setFilterClienteId] = useState("");
  const [filterEmpresaInternaId, setFilterEmpresaInternaId] = useState("");
  const [filterSupervisorId, setFilterSupervisorId] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  // Reset filters on tab change
  useEffect(() => {
    setSearchQuery("");
    setFilterClienteId("");
    setFilterEmpresaInternaId("");
    setFilterSupervisorId("");
    setClientSearchQuery("");
    setIsClientDropdownOpen(false);
  }, [activeTab]);

  // Fetch all data
  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Empresas Internas
      const { data: empData, error: empErr } = await supabase
        .from("empresas_internas")
        .select("*")
        .order("razon_social", { ascending: true });
      if (empErr) throw empErr;
      setEmpresas(empData || []);

      // 2. Fetch Clientes with Empresa Interna info
      const { data: cliData, error: cliErr } = await supabase
        .from("clientes")
        .select(`
          *,
          empresas_internas (
            id,
            razon_social
          )
        `)
        .order("razon_social", { ascending: true });
      if (cliErr) throw cliErr;
      setClientes(cliData || []);

      // 3. Fetch Sedes with Cliente info
      const { data: sedeData, error: sedeErr } = await supabase
        .from("sedes")
        .select(`
          *,
          clientes (
            id,
            razon_social,
            empresa_interna_id
          )
        `)
        .order("nombre", { ascending: true });
      if (sedeErr) throw sedeErr;

      // 3.5 Fetch supervisor-sede relations separately to bypass PostgREST cache bugs
      const { data: relData, error: relErr } = await supabase
        .from("usuario_sedes")
        .select(`
          sede_id,
          usuarios (
            id,
            nombres,
            apellidos,
            username
          )
        `);
      if (relErr) throw relErr;

      const relations = relData || [];
      const mergedSedes = (sedeData || []).map(sede => ({
        ...sede,
        usuario_sedes: relations.filter((r: any) => r.sede_id === sede.id)
      }));

      setSedes(mergedSedes);

      // 4. Fetch Active Users to validate supervisor usernames during import and display in filter
      const { data: usrData, error: usrErr } = await supabase
        .from("usuarios")
        .select("id, username, nombres, apellidos, activo, roles(codigo)")
        .eq("activo", true);
      if (usrErr) throw usrErr;
      setUsuarios(usrData || []);

    } catch (err: any) {
      console.error("Error loading commercial structure data:", err);
      setError(err.message || "Error al cargar la estructura comercial.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Excel template downloader
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Tab 1: Clientes
    const wsClientesData = [
      ["RUC Cliente (11 digitos)", "Razon Social Cliente", "Empresa Facturadora (RUC o Razon Social)", "Activo (SI/NO)"],
      ["20100998877", "Minera Las Bambas S.A.", "Grupo Bax Logística S.A.C.", "SI"],
      ["20500112233", "Supermercados Peruanos S.A.", "20601234567", "SI"]
    ];
    const wsClientes = XLSX.utils.aoa_to_sheet(wsClientesData);
    XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");

    // Tab 2: Sedes
    const wsSedesData = [
      ["RUC/Nombre Cliente", "Nombre de Sede", "Direccion", "Distrito", "Contacto Nombre", "Contacto Telefono", "Presupuesto Asignado", "Activo (SI/NO)", "Supervisores (Usernames)"],
      ["20100998877", "Sede Mina Apurímac", "Km 50 Vía Progreso", "Challhuahuacho", "Ing. Carlos Pérez", "999888777", 25000.00, "SI", "supervisor, rr_hh_apuri"],
      ["Minera Las Bambas S.A.", "Sede Puerto Matarani", "Terminal Portuario Matarani", "Islay", "Juan Soto", "988777666", 15000.00, "SI", "supervisor"]
    ];
    const wsSedes = XLSX.utils.aoa_to_sheet(wsSedesData);
    XLSX.utils.book_append_sheet(wb, wsSedes, "Sedes");

    // Tab 3: Empresas Internas de Referencia (so they know what to write)
    const wsRefData = [
      ["RUC Empresa Facturadora", "Razon Social (Empresas Internas Disponibles)"],
      ...empresas.map(e => [e.ruc, e.razon_social])
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(wsRefData);
    XLSX.utils.book_append_sheet(wb, wsRef, "Empresas Internas (Referencia)");

    // Write file
    XLSX.writeFile(wb, "Plantilla_Estructura_Comercial.xlsx");
  };

  // Excel file uploader and validator
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });

        const errors: string[] = [];
        const warnings: string[] = [];
        
        let importedClientes: any[] = [];
        if (workbook.SheetNames.includes("Clientes")) {
          const sheet = workbook.Sheets["Clientes"];
          const rawRows = XLSX.utils.sheet_to_json(sheet) as any[];
          
          rawRows.forEach((row: any, index: number) => {
            const rowNum = index + 2;
            const ruc = String(row["RUC Cliente (11 digitos)"] || "").trim().replace(/\D/g, "");
            const razonSocial = String(row["Razon Social Cliente"] || "").trim();
            const empresaRef = String(row["Empresa Facturadora (RUC o Razon Social)"] || "").trim();
            const activoVal = String(row["Activo (SI/NO)"] || "").trim().toUpperCase();

            if (!ruc && !razonSocial && !empresaRef) {
              return; // ignore completely empty row
            }

            if (!ruc) {
              errors.push(`[Clientes - Fila ${rowNum}] El RUC del Cliente es obligatorio.`);
              return;
            }
            if (ruc.length !== 11) {
              errors.push(`[Clientes - Fila ${rowNum}] El RUC del Cliente debe tener exactamente 11 dígitos (Ingresado: "${ruc}").`);
            }
            if (!razonSocial) {
              errors.push(`[Clientes - Fila ${rowNum}] La Razón Social del cliente es obligatoria.`);
            }
            if (!empresaRef) {
              errors.push(`[Clientes - Fila ${rowNum}] La Empresa Facturadora (RUC o Razón Social) es obligatoria.`);
            }

            // Find internal company
            const targetEmp = empresas.find(e => 
              e.ruc === empresaRef || 
              String(e.razon_social).toLowerCase() === empresaRef.toLowerCase()
            );

            if (!targetEmp && empresaRef) {
              errors.push(`[Clientes - Fila ${rowNum}] La Empresa Facturadora "${empresaRef}" no existe en el sistema.`);
            }

            importedClientes.push({
              ruc,
              razon_social: razonSocial,
              empresa_interna_id: targetEmp?.id,
              empresa_nombre: targetEmp?.razon_social || empresaRef,
              activo: activoVal !== "NO",
              rowNum
            });
          });
        }

        let importedSedes: any[] = [];
        if (workbook.SheetNames.includes("Sedes")) {
          const sheet = workbook.Sheets["Sedes"];
          const rawRows = XLSX.utils.sheet_to_json(sheet) as any[];

          rawRows.forEach((row: any, index: number) => {
            const rowNum = index + 2;
            const clienteRef = String(row["RUC/Nombre Cliente"] || "").trim();
            const nombre = String(row["Nombre de Sede"] || "").trim();
            const direccion = String(row["Direccion"] || "").trim();
            const distrito = String(row["Distrito"] || "").trim();
            const contactoNombre = String(row["Contacto Nombre"] || "").trim();
            const contactoTelefono = String(row["Contacto Telefono"] || "").trim();
            const presupuestoVal = row["Presupuesto Asignado"];
            const activoVal = String(row["Activo (SI/NO)"] || "").trim().toUpperCase();

            if (!clienteRef && !nombre) {
              return; // ignore completely empty row
            }

            if (!clienteRef) {
              errors.push(`[Sedes - Fila ${rowNum}] El Cliente (RUC o Razón Social) es obligatorio.`);
            }
            if (!nombre) {
              errors.push(`[Sedes - Fila ${rowNum}] El Nombre de Sede es obligatorio.`);
            }

            // Look up client in database
            let targetCli = clientes.find(c => 
              c.ruc === clienteRef || 
              String(c.razon_social).toLowerCase() === clienteRef.toLowerCase()
            );

            // Check if client is being imported in the current Clientes tab
            const newCli = importedClientes.find(c => 
              c.ruc === clienteRef || 
              String(c.razon_social).toLowerCase() === clienteRef.toLowerCase()
            );

            if (!targetCli && !newCli && clienteRef) {
              errors.push(`[Sedes - Fila ${rowNum}] El Cliente "${clienteRef}" no existe en la base de datos ni está listado en la hoja de Clientes para importar.`);
            }

            const presupuesto = parseFloat(presupuestoVal) || 0;

            const supervisoresColExists = "Supervisores (Usernames)" in row;
            const supervisoresVal = supervisoresColExists ? String(row["Supervisores (Usernames)"] || "").trim() : null;
            const parsedSupervisores: string[] = [];

            if (supervisoresVal) {
              const usernames = supervisoresVal.split(",").map(s => s.trim()).filter(Boolean);
              usernames.forEach(uname => {
                const userExists = usuarios.some(u => String(u.username).toLowerCase() === uname.toLowerCase());
                if (!userExists) {
                  warnings.push(`[Sedes - Fila ${rowNum}] El usuario "${uname}" no existe en el sistema o no está activo.`);
                }
                parsedSupervisores.push(uname);
              });
            }

            importedSedes.push({
              clienteRef,
              cliente_id: targetCli?.id || null,
              nombre,
              direccion,
              distrito,
              contacto_nombre: contactoNombre,
              contacto_telefono: contactoTelefono,
              presupuesto,
              activo: activoVal !== "NO",
              supervisores: supervisoresColExists ? parsedSupervisores : null,
              supervisoresColExists,
              rowNum
            });
          });
        }

        if (importedClientes.length === 0 && importedSedes.length === 0) {
          errors.push("El archivo Excel no contiene registros válidos en las hojas 'Clientes' o 'Sedes'.");
        }

        setParsedData({
          clientes: importedClientes,
          sedes: importedSedes,
          errors,
          warnings
        });

      } catch (err: any) {
        console.error("Error parsing Excel file:", err);
        setParsedData({
          clientes: [],
          sedes: [],
          errors: ["Error al leer el archivo Excel: " + err.message],
          warnings: []
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Submit parsed data to Supabase
  const handleImportSubmit = async () => {
    if (!parsedData || parsedData.errors.length > 0) return;
    setImportLoading(true);
    setError(null);
    setImportProgress(0);
    setImportStatusText("Iniciando importación masiva...");

    try {
      const clientMap: Record<string, number> = {};

      // Prepopulate client map with existing clients
      clientes.forEach(c => {
        clientMap[c.ruc] = c.id;
        clientMap[String(c.razon_social).toLowerCase()] = c.id;
      });

      let processedItems = 0;
      const totalItems = parsedData.clientes.length + parsedData.sedes.length;

      // 1. Insert/Upsert Clientes
      for (let i = 0; i < parsedData.clientes.length; i++) {
        const cli = parsedData.clientes[i];
        setImportStatusText(`Procesando cliente ${i + 1} de ${parsedData.clientes.length}: ${cli.razon_social}...`);
        
        const { data: existingCli } = await supabase
          .from("clientes")
          .select("id")
          .eq("ruc", cli.ruc)
          .maybeSingle();

        if (existingCli) {
          const { error: updErr } = await supabase
            .from("clientes")
            .update({
              empresa_interna_id: cli.empresa_interna_id,
              razon_social: cli.razon_social,
              activo: cli.activo
            })
            .eq("id", existingCli.id);
          if (updErr) throw updErr;
          clientMap[cli.ruc] = existingCli.id;
          clientMap[cli.razon_social.toLowerCase()] = existingCli.id;
        } else {
          const { data: newCli, error: insErr } = await supabase
            .from("clientes")
            .insert([{
              empresa_interna_id: cli.empresa_interna_id,
              ruc: cli.ruc,
              razon_social: cli.razon_social,
              activo: cli.activo
            }])
            .select("id")
            .single();
          if (insErr) throw insErr;
          clientMap[cli.ruc] = newCli.id;
          clientMap[cli.razon_social.toLowerCase()] = newCli.id;
        }

        processedItems++;
        setImportProgress(Math.round((processedItems / totalItems) * 100));
      }

      // 2. Insert/Upsert Sedes
      for (let i = 0; i < parsedData.sedes.length; i++) {
        const sd = parsedData.sedes[i];
        setImportStatusText(`Procesando sede ${i + 1} de ${parsedData.sedes.length}: ${sd.nombre}...`);

        const clienteId = sd.cliente_id || clientMap[sd.clienteRef.toLowerCase()] || clientMap[sd.clienteRef];
        if (!clienteId) {
          throw new Error(`No se pudo resolver el ID del cliente "${sd.clienteRef}" para la sede "${sd.nombre}"`);
        }

        const { data: existingSede } = await supabase
          .from("sedes")
          .select("id")
          .eq("cliente_id", clienteId)
          .eq("nombre", sd.nombre)
          .maybeSingle();

        const payload = {
          cliente_id: clienteId,
          nombre: sd.nombre,
          direccion: sd.direccion,
          distrito: sd.distrito,
          contacto_nombre: sd.contacto_nombre,
          contacto_telefono: sd.contacto_telefono,
          presupuesto: sd.presupuesto,
          activo: sd.activo
        };

        let targetSedeId = existingSede?.id;
        if (existingSede) {
          const { error: updErr } = await supabase
            .from("sedes")
            .update(payload)
            .eq("id", existingSede.id);
          if (updErr) throw updErr;
        } else {
          const { data: newSedeData, error: insErr } = await supabase
            .from("sedes")
            .insert([payload])
            .select("id")
            .single();
          if (insErr) throw insErr;
          targetSedeId = newSedeData.id;
        }

        // Handle supervisor assignments if the column was in the Excel sheet
        if (sd.supervisoresColExists && targetSedeId) {
          const { error: delErr } = await supabase
            .from("usuario_sedes")
            .delete()
            .eq("sede_id", targetSedeId);
          if (delErr) throw delErr;

          if (sd.supervisores && sd.supervisores.length > 0) {
            const relationsToInsert = sd.supervisores
              .map((uname: string) => {
                const u = usuarios.find(usr => String(usr.username).toLowerCase() === uname.toLowerCase());
                return u ? { usuario_id: u.id, sede_id: targetSedeId } : null;
              })
              .filter(Boolean);

            if (relationsToInsert.length > 0) {
              const { error: relErr } = await supabase
                .from("usuario_sedes")
                .insert(relationsToInsert);
              if (relErr) throw relErr;
            }
          }
        }

        processedItems++;
        setImportProgress(Math.round((processedItems / totalItems) * 100));
      }

      setImportSuccess(true);
      await loadAllData();
    } catch (err: any) {
      console.error("Error during import execution:", err);
      setError(err.message || "Ocurrió un error al guardar los datos de importación.");
      setImportLoading(false);
    }
  };

  const handleCloseImportOverlay = () => {
    setIsImportModalOpen(false);
    setImportLoading(false);
    setImportSuccess(false);
    setImportProgress(0);
    setImportStatusText("");
    setParsedData(null);
  };

  // Seed standard business structure
  const handleSeedStructure = async () => {
    setSeeding(true);
    setError(null);
    try {
      // 1. Insert Empresas Internas
      const { data: newEmpresas, error: eErr } = await supabase
        .from("empresas_internas")
        .insert([
          { ruc: "20601234567", razon_social: "Grupo Bax Logística S.A.C.", representante_legal: "Renzo Bax", direccion_fiscal: "Av. Elmer Faucett 120, Callao", activo: true },
          { ruc: "20609876543", razon_social: "Office Mac Soluciones S.A.C.", representante_legal: "Margarita Mac", direccion_fiscal: "Jr. Carabaya 540, Lima", activo: true }
        ])
        .select();

      if (eErr) throw eErr;
      if (!newEmpresas || newEmpresas.length === 0) throw new Error("No se pudieron insertar empresas");

      const empBaxId = newEmpresas.find(e => e.ruc === "20601234567")?.id;
      const empMacId = newEmpresas.find(e => e.ruc === "20609876543")?.id;

      // 2. Insert Clientes
      const { data: newClientes, error: cErr } = await supabase
        .from("clientes")
        .insert([
          { empresa_interna_id: empBaxId, ruc: "20100998877", razon_social: "Minera Las Bambas S.A.", activo: true },
          { empresa_interna_id: empBaxId, ruc: "20500112233", razon_social: "Supermercados Peruanos S.A. (Plaza Vea)", activo: true },
          { empresa_interna_id: empMacId, ruc: "20300445566", razon_social: "Banco de Crédito del Perú (BCP)", activo: true }
        ])
        .select();

      if (cErr) throw cErr;
      if (!newClientes || newClientes.length === 0) throw new Error("No se pudieron insertar clientes");

      const cliBambasId = newClientes.find(c => c.ruc === "20100998877")?.id;
      const cliVeaId = newClientes.find(c => c.ruc === "20500112233")?.id;
      const cliBcpId = newClientes.find(c => c.ruc === "20300445566")?.id;

      // 3. Insert Sedes
      const { error: sErr } = await supabase
        .from("sedes")
        .insert([
          { cliente_id: cliBambasId, nombre: "Sede Mina Apurímac", direccion: "Km 50 Vía Progreso", distrito: "Challhuahuacho", contacto_nombre: "Ing. Carlos Pérez", contacto_telefono: "999888777", presupuesto: 25000.00, activo: true },
          { cliente_id: cliVeaId, nombre: "Sede Plaza Vea Higuereta", direccion: "Av. Aviación 3500", distrito: "Santiago de Surco", contacto_nombre: "Gte. Ana Loayza", contacto_telefono: "987654321", presupuesto: 12000.00, activo: true },
          { cliente_id: cliBcpId, nombre: "Sede Central San Isidro", direccion: "Calle Centenario 156", distrito: "San Isidro", contacto_nombre: "Adm. Luis Torres", contacto_telefono: "955444333", presupuesto: 18000.00, activo: true }
        ]);

      if (sErr) throw sErr;
      await loadAllData();
    } catch (err: any) {
      console.error("Error seeding structure:", err);
      setError(err.message || "Error al precargar la estructura comercial.");
    } finally {
      setSeeding(false);
    }
  };

  // Open Add Dialog
  const handleOpenAdd = () => {
    setEditingId(null);
    const defaults: Record<string, any> = { activo: true };
    if (activeTab === "clientes" && empresas.length > 0) {
      defaults.empresa_interna_id = empresas[0].id;
    }
    if (activeTab === "sedes" && clientes.length > 0) {
      defaults.cliente_id = clientes[0].id;
      defaults.presupuesto = 0.00;
    }
    setFormValues(defaults);
    setIsModalOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setFormValues({ ...item });
    setIsModalOpen(true);
  };

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Clean up relations from values
    const payload = { ...formValues };
    delete payload.empresas_internas;
    delete payload.clientes;
    delete payload.usuario_sedes;

    try {
      const table = activeTab === "empresas" 
        ? "empresas_internas" 
        : activeTab === "clientes" 
          ? "clientes" 
          : "sedes";

      if (editingId) {
        const { error: dbError } = await supabase
          .from(table)
          .update(payload)
          .eq("id", editingId);
        if (dbError) throw dbError;
      } else {
        const { error: dbError } = await supabase
          .from(table)
          .insert([payload]);
        if (dbError) throw dbError;
      }
      setIsModalOpen(false);
      loadAllData();
    } catch (err: any) {
      console.error("Error saving structure item:", err);
      setError(err.message || "Error al guardar los cambios.");
    } finally {
      setLoading(false);
    }
  };

  // Delete item
  const handleDelete = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar este elemento?")) return;
    setLoading(true);
    setError(null);
    try {
      const table = activeTab === "empresas" 
        ? "empresas_internas" 
        : activeTab === "clientes" 
          ? "clientes" 
          : "sedes";

      const { error: dbError } = await supabase
        .from(table)
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;
      loadAllData();
    } catch (err: any) {
      console.error("Error deleting structure item:", err);
      setError(err.message || "No se puede eliminar porque tiene dependencias en otras tablas (ej. sedes ligadas a clientes).");
    } finally {
      setLoading(false);
    }
  };

  // Filter lists based on tab and query
  const getFilteredData = () => {
    const q = searchQuery.toLowerCase();
    if (activeTab === "empresas") {
      return empresas.filter(e => 
        !q || e.razon_social.toLowerCase().includes(q) || e.ruc.includes(q)
      );
    }
    if (activeTab === "clientes") {
      return clientes.filter(c => {
        const matchesSearch = !q || c.razon_social.toLowerCase().includes(q) || c.ruc.includes(q) ||
          (c.empresas_internas?.razon_social && c.empresas_internas.razon_social.toLowerCase().includes(q));
        const matchesEmpresa = !filterEmpresaInternaId || String(c.empresa_interna_id) === filterEmpresaInternaId;
        return matchesSearch && matchesEmpresa;
      });
    }
    return sedes.filter(s => {
      const matchesSearch = !q || s.nombre.toLowerCase().includes(q) || s.distrito?.toLowerCase().includes(q) ||
        (s.clientes?.razon_social && s.clientes.razon_social.toLowerCase().includes(q));
      const matchesCliente = !filterClienteId || String(s.cliente_id) === filterClienteId;
      const matchesEmpresa = !filterEmpresaInternaId || String(s.clientes?.empresa_interna_id) === filterEmpresaInternaId;
      const matchesSupervisor = !filterSupervisorId || 
        (s.usuario_sedes && s.usuario_sedes.some((us: any) => String(us.usuario_id) === filterSupervisorId));
      return matchesSearch && matchesCliente && matchesEmpresa && matchesSupervisor;
    });
  };

  const currentList = getFilteredData();

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 flex-shrink-0 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Configuración Comercial
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building className="w-8 h-8 text-blue-600" />
            Estructura Comercial
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Gestiona la jerarquía corporativa de tu organización: tus Empresas (nómina), tus Clientes (servicios) y las Sedes Operativas asignadas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {empresas.length === 0 && !loading && (
            <button
              onClick={handleSeedStructure}
              disabled={seeding}
              className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${seeding ? "animate-spin" : ""}`} />
              Precargar Demo Comercial
            </button>
          )}
          <button 
            onClick={() => {
              setParsedData(null);
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-100 active:scale-95 transition-all"
            title="Importar Clientes y Sedes desde Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar Excel
          </button>
          <button 
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Añadir {activeTab === "empresas" ? "Empresa" : activeTab === "clientes" ? "Cliente" : "Sede"}
          </button>
        </div>
      </div>

      {/* Bento Metrics Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button 
          onClick={() => setActiveTab("empresas")}
          className={`p-5 rounded-2xl border text-left flex items-center space-x-4 transition-all ${
            activeTab === "empresas" 
              ? "bg-white border-blue-500 shadow-md shadow-blue-50/50" 
              : "bg-white/60 hover:bg-white border-slate-100 shadow-sm"
          }`}
        >
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Empresas Internas</span>
            <span className="text-2xl font-black text-slate-900">{empresas.length}</span>
          </div>
        </button>
        
        <button 
          onClick={() => setActiveTab("clientes")}
          className={`p-5 rounded-2xl border text-left flex items-center space-x-4 transition-all ${
            activeTab === "clientes" 
              ? "bg-white border-blue-500 shadow-md shadow-blue-50/50" 
              : "bg-white/60 hover:bg-white border-slate-100 shadow-sm"
          }`}
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Clientes Activos</span>
            <span className="text-2xl font-black text-slate-900">{clientes.length}</span>
          </div>
        </button>

        <button 
          onClick={() => setActiveTab("sedes")}
          className={`p-5 rounded-2xl border text-left flex items-center space-x-4 transition-all ${
            activeTab === "sedes" 
              ? "bg-white border-blue-500 shadow-md shadow-blue-50/50" 
              : "bg-white/60 hover:bg-white border-slate-100 shadow-sm"
          }`}
        >
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Sedes Operativas</span>
            <span className="text-2xl font-black text-slate-900">{sedes.length}</span>
          </div>
        </button>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[400px]">
        {/* Filter & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 border-b border-slate-100 gap-4 bg-slate-50/10">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder={`Buscar en listado de ${activeTab === "empresas" ? "empresas" : activeTab === "clientes" ? "clientes" : "sedes"}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Filter by Empresa Interna for Clientes and Sedes tabs */}
            {(activeTab === "clientes" || activeTab === "sedes") && (
              <select
                value={filterEmpresaInternaId}
                onChange={(e) => setFilterEmpresaInternaId(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-600 font-semibold"
              >
                <option value="">Todas las Empresas Facturadoras</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.razon_social}</option>
                ))}
              </select>
            )}

            {/* Filter by Cliente for Sedes tab only */}
            {activeTab === "sedes" && (
              <div className="relative w-64">
                <input
                  type="text"
                  placeholder="Buscar Cliente..."
                  value={clientSearchQuery}
                  onFocus={() => setIsClientDropdownOpen(true)}
                  onChange={(e) => {
                    setClientSearchQuery(e.target.value);
                    setIsClientDropdownOpen(true);
                    if (e.target.value === "") {
                      setFilterClienteId("");
                    }
                  }}
                  className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-600 font-semibold"
                />
                
                {/* Clear button */}
                {filterClienteId && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterClienteId("");
                      setClientSearchQuery("");
                      setIsClientDropdownOpen(false);
                    }}
                    className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Floating list */}
                {isClientDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => {
                        setIsClientDropdownOpen(false);
                        const currentClient = clientes.find(c => String(c.id) === filterClienteId);
                        setClientSearchQuery(currentClient ? currentClient.razon_social : "");
                      }}
                    />
                    
                    <div className="absolute left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-20 divide-y divide-slate-50">
                      <div 
                        onClick={() => {
                          setFilterClienteId("");
                          setClientSearchQuery("");
                          setIsClientDropdownOpen(false);
                        }}
                        className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-50 cursor-pointer uppercase tracking-wider"
                      >
                        Todos los Clientes
                      </div>
                      
                      {clientes
                        .filter(c => 
                          !clientSearchQuery || 
                          c.razon_social.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                          c.ruc.includes(clientSearchQuery)
                        )
                        .map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setFilterClienteId(String(c.id));
                              setClientSearchQuery(c.razon_social);
                              setIsClientDropdownOpen(false);
                            }}
                            className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                              String(c.id) === filterClienteId 
                                ? "bg-blue-50 text-blue-700 font-bold" 
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="font-semibold">{c.razon_social}</div>
                            <div className="text-[10px] text-slate-400 font-mono">RUC: {c.ruc}</div>
                          </div>
                        ))
                      }
                      
                      {clientes.filter(c => 
                        !clientSearchQuery || 
                        c.razon_social.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                        c.ruc.includes(clientSearchQuery)
                      ).length === 0 && (
                        <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                          No se encontraron clientes
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Filter by Supervisor for Sedes tab only */}
            {activeTab === "sedes" && (
              <select
                value={filterSupervisorId}
                onChange={(e) => setFilterSupervisorId(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-600 font-semibold"
              >
                <option value="">Todos los Supervisores</option>
                {usuarios
                  .filter(u => u.roles?.codigo === "supervisor" || u.roles?.codigo === "rrhh")
                  .map((usr) => (
                    <option key={usr.id} value={String(usr.id)}>{usr.nombres} {usr.apellidos}</option>
                  ))}
              </select>
            )}
          </div>
          {error && (
            <div className="bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 max-w-md">
              <X className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-x-auto">
          {loading && currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Sincronizando con Supabase...</p>
            </div>
          ) : currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100">
                {activeTab === "empresas" ? <Building className="w-8 h-8" /> : activeTab === "clientes" ? <Users className="w-8 h-8" /> : <MapPin className="w-8 h-8" />}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-700">No hay registros</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {searchQuery ? "Intenta modificar el filtro de búsqueda." : "Crea tu primer elemento para configurar la estructura."}
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">ID</th>
                  {activeTab !== "sedes" && <th className="px-6 py-4">RUC</th>}
                  <th className="px-6 py-4">{activeTab === "sedes" ? "Nombre de Sede" : "Razón Social"}</th>
                  
                  {/* Conditionally render fields */}
                  {activeTab === "empresas" && (
                    <>
                      <th className="px-6 py-4">Representante</th>
                      <th className="px-6 py-4">Dirección Fiscal</th>
                    </>
                  )}
                  {activeTab === "clientes" && (
                    <th className="px-6 py-4">Empresa Facturadora</th>
                  )}
                  {activeTab === "sedes" && (
                    <>
                      <th className="px-6 py-4">Cliente / Proyecto</th>
                      <th className="px-6 py-4">Supervisores</th>
                      <th className="px-6 py-4">Contacto</th>
                      <th className="px-6 py-4">Presupuesto</th>
                      <th className="px-6 py-4">Ubicación</th>
                    </>
                  )}

                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">
                      {item.id}
                    </td>
                    {activeTab !== "sedes" && (
                      <td className="px-6 py-4 text-sm font-mono text-slate-700 font-semibold">
                        {item.ruc}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                      {activeTab === "sedes" ? item.nombre : item.razon_social}
                    </td>

                    {/* Columns for EMPRESAS */}
                    {activeTab === "empresas" && (
                      <>
                        <td className="px-6 py-4 text-sm text-slate-600">{item.representante_legal}</td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-mono truncate max-w-xs">{item.direccion_fiscal}</td>
                      </>
                    )}

                    {/* Columns for CLIENTES */}
                    {activeTab === "clientes" && (
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md font-semibold">
                          <Building className="w-3.5 h-3.5" />
                          {item.empresas_internas?.razon_social || "No asignado"}
                        </span>
                      </td>
                    )}

                    {/* Columns for SEDES */}
                    {activeTab === "sedes" && (
                      <>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md font-semibold">
                            <Users className="w-3.5 h-3.5" />
                            {item.clientes?.razon_social || "No asignado"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const sups = item.usuario_sedes?.map((us: any) => us.usuarios).filter(Boolean) || [];
                            if (sups.length === 0) {
                              return <span className="text-xs text-slate-400 italic">Sin supervisor</span>;
                            }
                            return (
                              <div className="flex flex-wrap gap-1.5 max-w-[180px]">
                                {sups.map((sup: any) => (
                                  <span
                                    key={sup.id}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-100"
                                    title={`@${sup.username}`}
                                  >
                                    <User className="w-2.5 h-2.5 shrink-0 text-purple-500" />
                                    {sup.nombres} {sup.apellidos.charAt(0)}.
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-700 font-medium">{item.contacto_nombre}</div>
                          {item.contacto_telefono && (
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {item.contacto_telefono}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-0.5 text-sm text-indigo-700 font-black">
                            <span className="text-xs font-bold mr-0.5">S/</span>
                            {parseFloat(item.presupuesto).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-700">{item.distrito}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]" title={item.direccion}>{item.direccion}</div>
                        </td>
                      </>
                    )}

                    {/* State column */}
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800"
                      }`}>
                        {item.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    {/* Actions column */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50/20 text-xs text-slate-500 font-medium shrink-0">
          <span>Mostrando {currentList.length} registros</span>
        </div>
      </div>

      {/* Side-over Form Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between animate-slide-in relative border-l border-slate-100">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <h3 className="font-heading text-lg font-bold text-slate-800">
                  {editingId ? "Editar" : "Añadir"} {activeTab === "empresas" ? "Empresa" : activeTab === "clientes" ? "Cliente" : "Sede"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="structForm" onSubmit={handleSave} className="space-y-4">
                
                {/* 1. Form fields for EMPRESAS */}
                {activeTab === "empresas" && (
                  <>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">RUC (11 dígitos)</label>
                      <input
                        type="text"
                        pattern="\d{11}"
                        maxLength={11}
                        required
                        value={formValues.ruc || ""}
                        onChange={(e) => setFormValues({ ...formValues, ruc: e.target.value.replace(/\D/g, "") })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-mono"
                        placeholder="Ej. 20601234567"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Razón Social</label>
                      <input
                        type="text"
                        required
                        value={formValues.razon_social || ""}
                        onChange={(e) => setFormValues({ ...formValues, razon_social: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                        placeholder="Ej. Grupo Bax Logística S.A.C."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Representante Legal</label>
                      <input
                        type="text"
                        value={formValues.representante_legal || ""}
                        onChange={(e) => setFormValues({ ...formValues, representante_legal: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                        placeholder="Nombre del representante"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Dirección Fiscal</label>
                      <input
                        type="text"
                        value={formValues.direccion_fiscal || ""}
                        onChange={(e) => setFormValues({ ...formValues, direccion_fiscal: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                        placeholder="Av., Calle, Jr. Nro..."
                      />
                    </div>
                  </>
                )}

                {/* 2. Form fields for CLIENTES */}
                {activeTab === "clientes" && (
                  <>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Empresa Interna Facturadora</label>
                      <select
                        required
                        value={formValues.empresa_interna_id || ""}
                        onChange={(e) => setFormValues({ ...formValues, empresa_interna_id: parseInt(e.target.value) })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                      >
                        {empresas.map((e) => (
                          <option key={e.id} value={e.id}>{e.razon_social}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">RUC Cliente</label>
                      <input
                        type="text"
                        pattern="\d{11}"
                        maxLength={11}
                        required
                        value={formValues.ruc || ""}
                        onChange={(e) => setFormValues({ ...formValues, ruc: e.target.value.replace(/\D/g, "") })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-mono"
                        placeholder="Ej. 20100998877"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Razón Social Cliente</label>
                      <input
                        type="text"
                        required
                        value={formValues.razon_social || ""}
                        onChange={(e) => setFormValues({ ...formValues, razon_social: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                        placeholder="Ej. Minera Las Bambas S.A."
                      />
                    </div>
                  </>
                )}

                {/* 3. Form fields for SEDES */}
                {activeTab === "sedes" && (
                  <>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cliente / Cuenta</label>
                      <select
                        required
                        value={formValues.cliente_id || ""}
                        onChange={(e) => setFormValues({ ...formValues, cliente_id: parseInt(e.target.value) })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                      >
                        {clientes.map((c) => (
                          <option key={c.id} value={c.id}>{c.razon_social}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre de la Sede</label>
                      <input
                        type="text"
                        required
                        value={formValues.nombre || ""}
                        onChange={(e) => setFormValues({ ...formValues, nombre: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                        placeholder="Ej. Sede Mina Apurímac"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Presupuesto Asignado (S/.)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={formValues.presupuesto ?? 0.00}
                          onChange={(e) => setFormValues({ ...formValues, presupuesto: parseFloat(e.target.value) || 0 })}
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-semibold text-indigo-700"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Distrito</label>
                        <input
                          type="text"
                          required
                          value={formValues.distrito || ""}
                          onChange={(e) => setFormValues({ ...formValues, distrito: e.target.value })}
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                          placeholder="Ej. San Isidro"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Dirección de Sede</label>
                      <input
                        type="text"
                        value={formValues.direccion || ""}
                        onChange={(e) => setFormValues({ ...formValues, direccion: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                        placeholder="Dirección física exacta"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre Contacto</label>
                        <input
                          type="text"
                          value={formValues.contacto_nombre || ""}
                          onChange={(e) => setFormValues({ ...formValues, contacto_nombre: e.target.value })}
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                          placeholder="Ing. de operaciones"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Teléfono Contacto</label>
                        <input
                          type="text"
                          value={formValues.contacto_telefono || ""}
                          onChange={(e) => setFormValues({ ...formValues, contacto_telefono: e.target.value })}
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                          placeholder="999888777"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* State toggle (always present) */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formValues.activo ?? true}
                    onChange={(e) => setFormValues({ ...formValues, activo: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="activo" className="text-sm font-semibold text-slate-700 select-none">
                    Elemento Activo (Habilitado para operaciones)
                  </label>
                </div>
              </form>
            </div>

            <div className="border-t border-slate-100 pt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="structForm"
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg animate-slide-in border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Importar Estructura Comercial (Excel)
              </h3>
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-5">
              <p className="text-xs text-slate-500 leading-relaxed">
                Sube un archivo Excel (.xlsx, .xls) con las hojas <strong>"Clientes"</strong> y <strong>"Sedes"</strong>. La plantilla incluye una pestaña de referencia con tus Empresas Facturadoras vigentes.
              </p>

              {/* Step 1: Download template */}
              <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100/80 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Paso 1: Obtener Plantilla</span>
                  <p className="text-[11px] text-emerald-700">Descarga la plantilla con ejemplos y empresas de referencia.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-emerald-700 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </button>
              </div>

              {/* Step 2: Upload Excel File */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Paso 2: Cargar Archivo Completo</label>
                <div className="relative border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-6 text-center hover:bg-slate-50/50 transition-all">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">Arrastra tu archivo aquí o haz clic para buscar</p>
                    <p className="text-[10px] text-slate-400">Formatos soportados: Excel (.xlsx, .xls)</p>
                  </div>
                </div>
              </div>

              {/* Step 3: Parsed Data Results / Preview / Errors */}
              {parsedData && (
                <div className="space-y-3 pt-1 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Paso 3: Validación y Vista Previa</span>
                  
                  {/* Summary of items to import */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                      <span className="text-xs font-semibold text-slate-500 block">Clientes</span>
                      <span className="text-lg font-extrabold text-slate-800">{parsedData.clientes.length}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                      <span className="text-xs font-semibold text-slate-500 block">Sedes</span>
                      <span className="text-lg font-extrabold text-slate-800">{parsedData.sedes.length}</span>
                    </div>
                  </div>

                  {/* Errors panel */}
                  {parsedData.errors.length > 0 ? (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-red-800 font-bold text-xs">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>Se encontraron {parsedData.errors.length} errores de validación:</span>
                      </div>
                      <div className="max-h-[150px] overflow-y-auto space-y-1.5 pr-1">
                        {parsedData.errors.map((err, idx) => (
                          <p key={idx} className="text-[11px] text-red-600 font-mono leading-relaxed bg-red-100/40 p-1.5 rounded border border-red-200/50">
                            {err}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-emerald-800">¡Archivo Validado Correctamente!</p>
                        <p className="text-[11px] text-emerald-700">Todos los registros son aptos para guardarse en la base de datos.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={importLoading || !parsedData || parsedData.errors.length > 0}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-sm font-semibold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {importLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                Confirmar Importación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Loading/Progress Overlay */}
      {importLoading && (
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
                    Guardando en Base de Datos...
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
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>PROGRESO</span>
                    <span>{importProgress}%</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 shadow-inner">
                  <Check className="w-10 h-10 text-emerald-600 stroke-[3.5] animate-bounce" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-heading text-xl font-bold text-slate-900">
                    ¡Importación Completada!
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Los clientes, sedes operativas y sus respectivos supervisores asignados han sido guardados con éxito en la base de datos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCloseImportOverlay}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-100 transition-all cursor-pointer"
                >
                  Aceptar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
