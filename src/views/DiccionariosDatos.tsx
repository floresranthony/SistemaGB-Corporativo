import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { 
  Database, 
  Plus, 
  Trash2, 
  Edit2, 
  RefreshCw, 
  Check, 
  X, 
  Search, 
  ArrowRight,
  TrendingUp,
  FileText
} from "lucide-react";

type DictionaryType = 
  | "cargos" 
  | "tipos_documento" 
  | "tipos_trabajador" 
  | "bancos" 
  | "sistemas_pension" 
  | "regimenes_laborales" 
  | "modalidades_contrato" 
  | "ubigeo_distritos"
  | "categorias_producto"
  | "unidades_medida"
  | "proveedores"
  | "tallas";

export function DiccionariosDatos() {
  const [activeTab, setActiveTab] = useState<DictionaryType>("cargos");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // State for Form Modals / Inline Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<any | null>(null);
  
  // Dynamic Form Values
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // Seed loading states
  const [seeding, setSeeding] = useState(false);

  // Tab definitions
  const tabs: { value: DictionaryType; label: string; table: string }[] = [
    { value: "cargos", label: "Cargos", table: "cargos" },
    { value: "tipos_documento", label: "Tipos de Documento", table: "tipos_documento" },
    { value: "tipos_trabajador", label: "Tipos de Trabajador", table: "tipos_trabajador" },
    { value: "bancos", label: "Bancos", table: "bancos" },
    { value: "sistemas_pension", label: "Sistemas de Pensión", table: "sistemas_pension" },
    { value: "regimenes_laborales", label: "Regímenes Laborales", table: "regimenes_laborales" },
    { value: "modalidades_contrato", label: "Modalidades de Contrato", table: "modalidades_contrato" },
    { value: "ubigeo_distritos", label: "Ubigeo (Distritos)", table: "ubigeo_distritos" },
    { value: "categorias_producto", label: "Categorías de Producto", table: "categorias_producto" },
    { value: "unidades_medida", label: "Unidades de Medida", table: "unidades_medida" },
    { value: "proveedores", label: "Proveedores", table: "proveedores" },
    { value: "tallas", label: "Tallas de Vestimenta", table: "tallas" }
  ];

  // Load Data
  const fetchData = async (tab: DictionaryType) => {
    setLoading(true);
    setError(null);
    try {
      const { data: resData, error: dbError } = await supabase
        .from(tab)
        .select("*")
        .order(tab === "ubigeo_distritos" ? "id" : "id", { ascending: true });

      if (dbError) throw dbError;
      setData(resData || []);
    } catch (err: any) {
      console.error("Error fetching dictionary data:", err);
      setError(err.message || "Error al cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(activeTab);
    setSearchQuery("");
    setEditingId(null);
    setIsModalOpen(false);
  }, [activeTab]);

  // Seed Data function for empty tables
  const handleSeedData = async () => {
    setSeeding(true);
    setError(null);
    try {
      if (activeTab === "tipos_documento") {
        await supabase.from("tipos_documento").insert([
          { codigo: "DNI", nombre: "Documento Nacional de Identidad" },
          { codigo: "CE", nombre: "Carnet de Extranjería" },
          { codigo: "PAS", nombre: "Pasaporte" }
        ]);
      } else if (activeTab === "cargos") {
        await supabase.from("cargos").insert([
          { nombre: "Supervisor de Operaciones", activo: true },
          { nombre: "Agente de Seguridad", activo: true },
          { nombre: "Conductor Profesional", activo: true },
          { nombre: "Analista de Operaciones", activo: true }
        ]);
      } else if (activeTab === "tipos_trabajador") {
        await supabase.from("tipos_trabajador").insert([
          { nombre: "Administrativo" },
          { nombre: "Operativo" }
        ]);
      } else if (activeTab === "bancos") {
        await supabase.from("bancos").insert([
          { nombre: "BCP" },
          { nombre: "BBVA" },
          { nombre: "Interbank" },
          { nombre: "Scotiabank" },
          { nombre: "Banco de la Nación" }
        ]);
      } else if (activeTab === "sistemas_pension") {
        await supabase.from("sistemas_pension").insert([
          { nombre: "ONP", tipo: "ONP" },
          { nombre: "AFP Integra", tipo: "AFP" },
          { nombre: "AFP Prima", tipo: "AFP" },
          { nombre: "AFP Profuturo", tipo: "AFP" },
          { nombre: "AFP Habitat", tipo: "AFP" }
        ]);
      } else if (activeTab === "regimenes_laborales") {
        await supabase.from("regimenes_laborales").insert([
          { nombre: "Régimen General", dias_vacaciones: 30 },
          { nombre: "Régimen MYPE", dias_vacaciones: 15 }
        ]);
      } else if (activeTab === "modalidades_contrato") {
        await supabase.from("modalidades_contrato").insert([
          { nombre: "Plazo Indeterminado" },
          { nombre: "Plazo Fijo (Sujeto a Modalidad)" },
          { nombre: "Tiempo Parcial" }
        ]);
      } else if (activeTab === "ubigeo_distritos") {
        await supabase.from("ubigeo_distritos").insert([
          { id: "150101", departamento: "Lima", provincia: "Lima", distrito: "Lima" },
          { id: "150122", departamento: "Lima", provincia: "Lima", distrito: "Miraflores" },
          { id: "150131", departamento: "Lima", provincia: "Lima", distrito: "San Isidro" },
          { id: "150140", departamento: "Lima", provincia: "Lima", distrito: "Santiago de Surco" },
          { id: "150133", departamento: "Lima", provincia: "Lima", distrito: "San Borja" }
        ]);
      } else if (activeTab === "categorias_producto") {
        await supabase.from("categorias_producto").insert([
          { nombre: "Epps y Seguridad", descripcion: "Equipos de protección personal", activo: true },
          { nombre: "Uniformes Operarios", descripcion: "Vestimenta de trabajo de campo", activo: true },
          { nombre: "Material de Limpieza", descripcion: "Químicos e insumos de limpieza", activo: true }
        ]);
      } else if (activeTab === "unidades_medida") {
        await supabase.from("unidades_medida").insert([
          { codigo: "UND", nombre: "Unidades" },
          { codigo: "PAR", nombre: "Pares" },
          { codigo: "GAL", nombre: "Galones" }
        ]);
      } else if (activeTab === "proveedores") {
        await supabase.from("proveedores").insert([
          { ruc: "20501234567", razon_social: "Textiles del Sur S.A.C.", contacto_nombre: "Gte. Manuel Soto", contacto_telefono: "999888777", activo: true },
          { ruc: "20609876543", razon_social: "Corporación Limpieza Total S.A.", contacto_nombre: "Adm. Ana Pérez", contacto_telefono: "988777666", activo: true }
        ]);
      } else if (activeTab === "tallas") {
        await supabase.from("tallas").insert([
          { valor: "S", activo: true },
          { valor: "M", activo: true },
          { valor: "L", activo: true },
          { valor: "XL", activo: true },
          { valor: "Estándar", activo: true }
        ]);
      }
      
      await fetchData(activeTab);
    } catch (err: any) {
      console.error("Error seeding data:", err);
      setError(err.message || "Error al precargar datos.");
    } finally {
      setSeeding(false);
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingId(null);
    const defaults: Record<string, any> = {};
    if (
      activeTab === "cargos" || 
      activeTab === "categorias_producto" || 
      activeTab === "proveedores" || 
      activeTab === "tallas"
    ) {
      defaults.activo = true;
    }
    if (activeTab === "sistemas_pension") defaults.tipo = "AFP";
    if (activeTab === "regimenes_laborales") defaults.dias_vacaciones = 30;
    setFormValues(defaults);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setFormValues({ ...item });
    setIsModalOpen(true);
  };

  // Save / Update Data
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (editingId) {
        // Update
        const { error: dbError } = await supabase
          .from(activeTab)
          .update(formValues)
          .eq("id", editingId);

        if (dbError) throw dbError;
      } else {
        // Create
        const { error: dbError } = await supabase
          .from(activeTab)
          .insert([formValues]);

        if (dbError) throw dbError;
      }
      setIsModalOpen(false);
      fetchData(activeTab);
    } catch (err: any) {
      console.error("Error saving data:", err);
      setError(err.message || "Error al guardar el registro.");
    } finally {
      setLoading(false);
    }
  };

  // Delete Data
  const handleDelete = async (id: any) => {
    if (!confirm("¿Está seguro de eliminar este registro?")) return;
    setLoading(true);
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from(activeTab)
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;
      fetchData(activeTab);
    } catch (err: any) {
      console.error("Error deleting data:", err);
      setError(err.message || "Este registro no se puede eliminar porque está referenciado en otras tablas.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered data based on query
  const filteredData = data.filter((item) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    
    return Object.values(item).some((val) => 
      String(val).toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 flex-shrink-0 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Configuración / Diccionarios
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-8 h-8 text-blue-600" />
            Diccionarios de Datos
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Administra los catálogos maestros y datos estandarizados que estructuran la información del personal y logística de Grupo Bax.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.length === 0 && !loading && (
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${seeding ? "animate-spin" : ""}`} />
              Precargar Semilla
            </button>
          )}
          <button 
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Nuevo Registro
          </button>
        </div>
      </div>

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Catálogo Activo</span>
            <span className="text-lg font-bold text-slate-800">{tabs.find(t => t.value === activeTab)?.label}</span>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total de Registros</span>
            <span className="text-2xl font-bold text-slate-900">{loading ? "..." : data.length}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4 col-span-1 sm:col-span-2 lg:col-span-1">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Conexión Backend</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Supabase Activo
            </span>
          </div>
        </div>
      </div>

      {/* Main Layout Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row flex-1 overflow-hidden min-h-[500px]">
        
        {/* Left Tabs Menu */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/50 p-4 shrink-0 flex flex-col space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2 block">
            Diccionarios Disponibles
          </span>
          <div className="flex md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 scrollbar-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 shrink-0 md:shrink ${
                    isActive 
                      ? "bg-blue-50 text-blue-700 shadow-sm font-semibold" 
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span>{tab.label}</span>
                  <ArrowRight className={`w-4 h-4 transition-transform duration-200 hidden md:block ${isActive ? "translate-x-0 opacity-100" : "translate-x-[-8px] opacity-0"}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Data Table Area */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 border-b border-slate-100 gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder={`Buscar en ${tabs.find(t => t.value === activeTab)?.label.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/20 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
              />
            </div>
            {error && (
              <div className="bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 max-w-md animate-fade-in">
                <X className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-x-auto">
            {loading && data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium">Cargando catálogo maestro...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100">
                  <Database className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-700">No se encontraron registros</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {searchQuery ? "Intenta modificar el filtro de búsqueda." : "Comienza agregando un nuevo registro al diccionario."}
                  </p>
                </div>
                {!searchQuery && data.length === 0 && (
                  <button 
                    onClick={handleSeedData}
                    disabled={seeding}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold underline disabled:opacity-50"
                  >
                    Precargar datos por defecto
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">ID</th>
                    {(activeTab === "tipos_documento" || activeTab === "unidades_medida") && <th className="px-6 py-4">Código</th>}
                    {activeTab === "proveedores" && <th className="px-6 py-4">RUC</th>}
                    {activeTab === "sistemas_pension" && <th className="px-6 py-4">Tipo</th>}
                    {activeTab === "regimenes_laborales" && <th className="px-6 py-4">Días Vacaciones</th>}
                    {activeTab === "ubigeo_distritos" && (
                      <>
                        <th className="px-6 py-4">Departamento</th>
                        <th className="px-6 py-4">Provincia</th>
                      </>
                    )}
                    {activeTab === "categorias_producto" && <th className="px-6 py-4">Descripción</th>}
                    {activeTab === "proveedores" && (
                      <>
                        <th className="px-6 py-4">Contacto</th>
                        <th className="px-6 py-4">Teléfono</th>
                      </>
                    )}
                    <th className="px-6 py-4">
                      {activeTab === "tallas" ? "Talla" : 
                       activeTab === "proveedores" ? "Razón Social" : 
                       "Nombre / Valor"}
                    </th>
                    {(activeTab === "cargos" || activeTab === "categorias_producto" || activeTab === "proveedores" || activeTab === "tallas") && (
                      <th className="px-6 py-4 text-center">Estado</th>
                    )}
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-slate-500">
                        {item.id}
                      </td>
                      {(activeTab === "tipos_documento" || activeTab === "unidades_medida") && (
                        <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                          {item.codigo}
                        </td>
                      )}
                      {activeTab === "proveedores" && (
                        <td className="px-6 py-4 text-sm font-mono text-slate-700 font-semibold">
                          {item.ruc}
                        </td>
                      )}
                      {activeTab === "sistemas_pension" && (
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.tipo === "AFP" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {item.tipo}
                          </span>
                        </td>
                      )}
                      {activeTab === "regimenes_laborales" && (
                        <td className="px-6 py-4 text-sm text-slate-600 font-semibold">
                          {item.dias_vacaciones} días
                        </td>
                      )}
                      {activeTab === "ubigeo_distritos" && (
                        <>
                          <td className="px-6 py-4 text-sm text-slate-600">{item.departamento}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{item.provincia}</td>
                        </>
                      )}
                      {activeTab === "categorias_producto" && (
                        <td className="px-6 py-4 text-xs text-slate-500 truncate max-w-xs" title={item.descripcion}>
                          {item.descripcion || "Sin descripción"}
                        </td>
                      )}
                      {activeTab === "proveedores" && (
                        <>
                          <td className="px-6 py-4 text-sm text-slate-600">{item.contacto_nombre}</td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-500">{item.contacto_telefono}</td>
                        </>
                      )}
                      <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                        {item.nombre || item.distrito || item.razon_social || item.valor}
                      </td>
                      {(activeTab === "cargos" || activeTab === "categorias_producto" || activeTab === "proveedores" || activeTab === "tallas") && (
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800"
                          }`}>
                            {item.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                      )}
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
          
          <div className="p-4 border-t border-slate-100 bg-slate-50/20 text-xs text-slate-500 font-medium flex items-center justify-between shrink-0">
            <span>
              Mostrando {filteredData.length} de {data.length} registros
            </span>
          </div>
        </div>
      </div>

      {/* Slide-over Form Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between animate-slide-in relative border-l border-slate-100">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <h3 className="font-heading text-lg font-bold text-slate-800">
                  {editingId ? "Editar Registro" : "Nuevo Registro"} - {tabs.find(t => t.value === activeTab)?.label}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="dictForm" onSubmit={handleSave} className="space-y-4">
                {/* ID field for Ubigeo as primary key */}
                {activeTab === "ubigeo_distritos" && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Código Ubigeo (6 dígitos)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      disabled={editingId !== null}
                      value={formValues.id || ""}
                      onChange={(e) => setFormValues({ ...formValues, id: e.target.value })}
                      placeholder="Ej. 150101"
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400 transition-all font-mono"
                    />
                  </div>
                )}

                {/* Document Code field for document types / units */}
                {(activeTab === "tipos_documento" || activeTab === "unidades_medida") && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Código Abreviado
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      required
                      value={formValues.codigo || ""}
                      onChange={(e) => setFormValues({ ...formValues, codigo: e.target.value.toUpperCase() })}
                      placeholder="Ej. DNI, UND, PAR"
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-mono"
                    />
                  </div>
                )}

                {/* RUC for providers */}
                {activeTab === "proveedores" && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      RUC (11 dígitos)
                    </label>
                    <input
                      type="text"
                      maxLength={11}
                      required
                      value={formValues.ruc || ""}
                      onChange={(e) => setFormValues({ ...formValues, ruc: e.target.value.replace(/\D/g, "") })}
                      placeholder="Ej. 20501234567"
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-mono"
                    />
                  </div>
                )}

                {/* Description for Product Category */}
                {activeTab === "categorias_producto" && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Descripción de la Categoría
                    </label>
                    <textarea
                      value={formValues.descripcion || ""}
                      onChange={(e) => setFormValues({ ...formValues, descripcion: e.target.value })}
                      placeholder="Ej. Artículos de seguridad, insumos generales, etc."
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all h-16 resize-none"
                    />
                  </div>
                )}

                {/* Contact Name and Phone for Providers */}
                {activeTab === "proveedores" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Nombre de Contacto
                      </label>
                      <input
                        type="text"
                        value={formValues.contacto_nombre || ""}
                        onChange={(e) => setFormValues({ ...formValues, contacto_nombre: e.target.value })}
                        placeholder="Ej. Juan Pérez"
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Teléfono Contacto
                      </label>
                      <input
                        type="text"
                        value={formValues.contacto_telefono || ""}
                        onChange={(e) => setFormValues({ ...formValues, contacto_telefono: e.target.value })}
                        placeholder="Ej. 999888777"
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Pension Type field for pensions */}
                {activeTab === "sistemas_pension" && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Tipo de Entidad
                    </label>
                    <select
                      value={formValues.tipo || "AFP"}
                      onChange={(e) => setFormValues({ ...formValues, tipo: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                    >
                      <option value="AFP">AFP (Privado)</option>
                      <option value="ONP">ONP (Público)</option>
                    </select>
                  </div>
                )}

                {/* Vacation Days field for regimes */}
                {activeTab === "regimenes_laborales" && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Días de Vacaciones Anuales
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={365}
                      value={formValues.dias_vacaciones ?? 30}
                      onChange={(e) => setFormValues({ ...formValues, dias_vacaciones: parseInt(e.target.value) || 0 })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                    />
                  </div>
                )}

                {/* Ubigeo details for ubigeo_distritos */}
                {activeTab === "ubigeo_distritos" && (
                  <>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Departamento
                      </label>
                      <input
                        type="text"
                        required
                        value={formValues.departamento || ""}
                        onChange={(e) => setFormValues({ ...formValues, departamento: e.target.value })}
                        placeholder="Ej. Lima"
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Provincia
                      </label>
                      <input
                        type="text"
                        required
                        value={formValues.provincia || ""}
                        onChange={(e) => setFormValues({ ...formValues, provincia: e.target.value })}
                        placeholder="Ej. Lima"
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </>
                )}

                {/* Main Name/Value field */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {activeTab === "ubigeo_distritos" ? "Distrito" : 
                     activeTab === "tallas" ? "Valor de Talla" : 
                     activeTab === "proveedores" ? "Razón Social" :
                     "Nombre / Descripción"}
                  </label>
                  <input
                    type="text"
                    required
                    value={
                      activeTab === "ubigeo_distritos" ? (formValues.distrito || "") : 
                      activeTab === "tallas" ? (formValues.valor || "") :
                      activeTab === "proveedores" ? (formValues.razon_social || "") :
                      (formValues.nombre || "")
                    }
                    onChange={(e) => {
                      if (activeTab === "ubigeo_distritos") {
                        setFormValues({ ...formValues, distrito: e.target.value });
                      } else if (activeTab === "tallas") {
                        setFormValues({ ...formValues, valor: e.target.value });
                      } else if (activeTab === "proveedores") {
                        setFormValues({ ...formValues, razon_social: e.target.value });
                      } else {
                        setFormValues({ ...formValues, nombre: e.target.value });
                      }
                    }}
                    placeholder={
                      activeTab === "ubigeo_distritos" ? "Ej. Miraflores" : 
                      activeTab === "tallas" ? "Ej. S, M, XL, 38, 40" : 
                      activeTab === "proveedores" ? "Ej. Textiles del Sur S.A.C." :
                      "Ej. Ejecutivo, BCP, AFP Integra"
                    }
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* State/Active check for active-controlled dicts */}
                {(activeTab === "cargos" || activeTab === "categorias_producto" || activeTab === "proveedores" || activeTab === "tallas") && (
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="activo"
                      checked={formValues.activo ?? true}
                      onChange={(e) => setFormValues({ ...formValues, activo: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="activo" className="text-sm font-semibold text-slate-700 select-none">
                      Registro Habilitado (Activo)
                    </label>
                  </div>
                )}
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
                form="dictForm"
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
    </div>
  );
}
