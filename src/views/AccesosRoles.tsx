import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { createClient } from "@supabase/supabase-js";
import { 
  Key, 
  UserPlus, 
  Mail, 
  User, 
  Lock, 
  Shield, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  Check, 
  Trash2, 
  Power,
  Search,
  MapPin
} from "lucide-react";

// Initialize a secondary Supabase client without session persistence 
// so that creating new users does not override or log out the current admin session
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "https://ezmucovctccuyfkfdbvk.supabase.co";
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

const secondaryClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

interface Role {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
}

interface Usuario {
  id: number;
  username: string;
  nombres: string;
  apellidos: string;
  correo: string;
  rol_id: number;
  activo: boolean;
  roles?: Role;
}

const colorMap: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  logistica: "bg-blue-100 text-blue-700",
  rrhh: "bg-indigo-100 text-indigo-700",
  almacen: "bg-amber-100 text-amber-700",
  supervisor: "bg-purple-100 text-purple-700",
  gerencia: "bg-slate-100 text-slate-700",
};

export function AccesosRoles() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form State
  const [formNombres, setFormNombres] = useState("");
  const [formApellidos, setFormApellidos] = useState("");
  const [formCorreo, setFormCorreo] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRolId, setFormRolId] = useState<number | "">("");

  // Sedes Assignment Modal State
  const [isSedesModalOpen, setIsSedesModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [sedesList, setSedesList] = useState<any[]>([]);
  const [assignedSedes, setAssignedSedes] = useState<number[]>([]);
  const [sedesSearchTerm, setSedesSearchTerm] = useState("");
  const [sedesLoading, setSedesLoading] = useState(false);
  const [sedesSaving, setSedesSaving] = useState(false);
  const [sedesError, setSedesError] = useState<string | null>(null);

  // Global system parameters
  const [claveAprobacion, setClaveAprobacion] = useState("");
  const [savingClave, setSavingClave] = useState(false);
  const [showClave, setShowClave] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("roles")
        .select("*")
        .order("nombre");
      
      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // 2. Fetch Usuarios with joined Roles
      const { data: usuariosData, error: usuariosError } = await supabase
        .from("usuarios")
        .select("*, roles(*)")
        .order("id", { ascending: true });

      if (usuariosError) throw usuariosError;
      setUsuarios(usuariosData || []);

      // 3. Fetch Clave de Aprobación
      try {
        const { data: paramData } = await supabase
          .from("parametros_sistema")
          .select("valor")
          .eq("clave", "clave_aprobacion_rrhh")
          .single();
        if (paramData) {
          setClaveAprobacion(paramData.valor);
        }
      } catch (paramErr) {
        console.warn("Could not load clave_aprobacion_rrhh. Table might not exist yet.", paramErr);
      }
    } catch (err: any) {
      console.error("Error loading access management data:", err);
      setError("Error al cargar la lista de usuarios y roles.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClaveAprobacion = async () => {
    if (!claveAprobacion.trim()) {
      alert("La clave de aprobación no puede estar vacía.");
      return;
    }
    setSavingClave(true);
    try {
      const { error: saveError } = await supabase
        .from("parametros_sistema")
        .upsert({ clave: "clave_aprobacion_rrhh", valor: claveAprobacion.trim(), descripcion: "Clave requerida para autorizar eliminación de personal y otras acciones críticas." });
      
      if (saveError) throw saveError;
      setSuccess("Clave de aprobación actualizada correctamente.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error saving approval key:", err);
      alert("Error al guardar la clave de aprobación: " + err.message);
    } finally {
      setSavingClave(false);
    }
  };

  const handleToggleActive = async (user: Usuario) => {
    try {
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ activo: !user.activo })
        .eq("id", user.id);

      if (updateError) throw updateError;
      
      // Update local state
      setUsuarios(usuarios.map(u => u.id === user.id ? { ...u, activo: !user.activo } : u));
      setSuccess(`Estado del usuario "${user.nombres}" actualizado con éxito.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error toggling user active status:", err);
      setError("No se pudo actualizar el estado del usuario.");
      setTimeout(() => setError(null), 4000);
    }
  };

  const handleDeleteUser = async (user: Usuario) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${user.nombres} ${user.apellidos}" de la base de datos?`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("usuarios")
        .delete()
        .eq("id", user.id);

      if (deleteError) throw deleteError;

      // Update local state
      setUsuarios(usuarios.filter(u => u.id !== user.id));
      setSuccess("Usuario eliminado de la base de datos con éxito.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error deleting user from database:", err);
      setError("No se pudo eliminar el usuario de la base de datos relacional.");
      setTimeout(() => setError(null), 4000);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formNombres || !formApellidos || !formCorreo || !formUsername || !formPassword || !formRolId) {
      setModalError("Por favor rellena todos los campos.");
      return;
    }

    if (formPassword.length < 6) {
      setModalError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setModalLoading(true);

    try {
      // 1. Check if username is already taken in the public table
      const { data: dupUsername } = await supabase
        .from("usuarios")
        .select("id")
        .eq("username", formUsername)
        .maybeSingle();

      if (dupUsername) {
        throw new Error(`El nombre de usuario "${formUsername}" ya está en uso.`);
      }

      // 2. Check if email is already taken in the public table
      const { data: dupEmail } = await supabase
        .from("usuarios")
        .select("id")
        .eq("correo", formCorreo)
        .maybeSingle();

      if (dupEmail) {
        throw new Error(`El correo electrónico "${formCorreo}" ya está registrado.`);
      }

      // 3. Register user in Supabase Auth using the secondaryClient (does not log out current admin)
      const { data: authData, error: authError } = await secondaryClient.auth.signUp({
        email: formCorreo,
        password: formPassword,
        options: {
          data: {
            nombres: formNombres,
            apellidos: formApellidos,
            username: formUsername
          }
        }
      });

      if (authError) {
        // If the email is already in Auth but not in our usuarios table, we might still insert it.
        // But normally it's cleaner to report the auth error.
        throw authError;
      }

      // 4. Insert user record in public.usuarios
      const { data: newUser, error: dbError } = await supabase
        .from("usuarios")
        .insert({
          username: formUsername,
          password_hash: "supabase_auth", // password verified by Supabase Auth
          nombres: formNombres,
          apellidos: formApellidos,
          correo: formCorreo,
          rol_id: Number(formRolId),
          activo: true
        })
        .select("*, roles(*)")
        .single();

      if (dbError) throw dbError;

      // 5. Success cleanup
      setUsuarios([...usuarios, newUser]);
      setSuccess(`Usuario "${formNombres} ${formApellidos}" registrado exitosamente.`);
      setTimeout(() => setSuccess(null), 4000);
      
      // Reset form
      setFormNombres("");
      setFormApellidos("");
      setFormCorreo("");
      setFormUsername("");
      setFormPassword("");
      setFormRolId("");
      setIsModalOpen(false);

    } catch (err: any) {
      console.error("Error creating user:", err);
      setModalError(err.message || "Error al registrar el usuario en el sistema.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenSedesModal = async (user: Usuario) => {
    setSelectedUser(user);
    setIsSedesModalOpen(true);
    setSedesLoading(true);
    setSedesError(null);
    setSedesSearchTerm("");
    setAssignedSedes([]);

    try {
      const { data: sedesData, error: sedesErr } = await supabase
        .from("sedes")
        .select(`
          id,
          nombre,
          cliente_id,
          clientes (
            id,
            razon_social
          )
        `)
        .eq("activo", true)
        .order("nombre");

      if (sedesErr) throw sedesErr;
      setSedesList(sedesData || []);

      const { data: relationData, error: relErr } = await supabase
        .from("usuario_sedes")
        .select("sede_id")
        .eq("usuario_id", user.id);

      if (relErr) throw relErr;
      setAssignedSedes(relationData?.map(r => r.sede_id) || []);

    } catch (err: any) {
      console.error("Error loading sedes for user:", err);
      setSedesError("Error al cargar las sedes operativas.");
    } finally {
      setSedesLoading(false);
    }
  };

  const handleToggleSede = (sedeId: number) => {
    if (assignedSedes.includes(sedeId)) {
      setAssignedSedes(assignedSedes.filter(id => id !== sedeId));
    } else {
      setAssignedSedes([...assignedSedes, sedeId]);
    }
  };

  const handleSaveSedes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSedesSaving(true);
    setSedesError(null);

    try {
      const { error: delErr } = await supabase
        .from("usuario_sedes")
        .delete()
        .eq("usuario_id", selectedUser.id);

      if (delErr) throw delErr;

      if (assignedSedes.length > 0) {
        const insertData = assignedSedes.map(sedeId => ({
          usuario_id: selectedUser.id,
          sede_id: sedeId
        }));

        const { error: insErr } = await supabase
          .from("usuario_sedes")
          .insert(insertData);

        if (insErr) throw insErr;
      }

      setSuccess(`Sedes operativas asignadas correctamente a "${selectedUser.nombres}".`);
      setIsSedesModalOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error saving user sedes:", err);
      setSedesError("No se pudieron guardar las asignaciones de sede.");
    } finally {
      setSedesSaving(false);
    }
  };

  const filteredSedesList = sedesList.filter(sede => {
    const search = sedesSearchTerm.toLowerCase();
    const sedeNombre = String(sede.nombre).toLowerCase();
    const clienteNombre = String(sede.clientes?.razon_social || "").toLowerCase();
    return sedeNombre.includes(search) || clienteNombre.includes(search);
  });

  // Filtered Users
  const filteredUsuarios = usuarios.filter(u => {
    const matchesSearch = 
      `${u.nombres} ${u.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.correo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "all" || u.roles?.codigo === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex flex-col h-full space-y-4 overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Sistema / Configuración
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Accesos y Roles
          </h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Añadir Usuario
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-650 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-lg flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-650 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Dashboard Mini Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500">Usuarios Registrados</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-bold text-slate-900">{usuarios.length}</span>
            <span className="text-[10px] text-slate-400">Total en base de datos</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500">Usuarios Activos</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-bold text-emerald-600">{usuarios.filter(u => u.activo).length}</span>
            <span className="text-[10px] text-slate-400">Habilitados para ingresar</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500">Roles Configurables</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-bold text-slate-900">{roles.length}</span>
            <span className="text-[10px] text-slate-400">Categorías de permisos</span>
          </div>
        </div>
      </div>

      {/* Seguridad y Aprobaciones del Sistema */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2 text-red-650 font-bold text-xs uppercase tracking-wider">
            <Lock className="w-4 h-4" />
            <span>Seguridad y Aprobaciones</span>
          </div>
          <h2 className="text-sm font-bold text-slate-800">Clave de Aprobación para Acciones Críticas</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Esta contraseña es requerida para validar la eliminación de fichas de personal y otras operaciones sensibles. 
            Cualquier colaborador que conozca este código podrá autorizar la acción.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start md:self-auto min-w-[280px]">
          <div className="relative flex-1">
            <input
              type={showClave ? "text" : "password"}
              placeholder="Cargando clave..."
              value={claveAprobacion}
              onChange={(e) => setClaveAprobacion(e.target.value)}
              className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-lg text-xs font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowClave(!showClave)}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-650"
            >
              {showClave ? (
                <span className="text-[10px] font-bold text-slate-500 select-none">Ocultar</span>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 select-none">Mostrar</span>
              )}
            </button>
          </div>
          <button
            onClick={handleSaveClaveAprobacion}
            disabled={savingClave}
            className="bg-slate-800 hover:bg-slate-900 active:scale-95 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 shrink-0"
          >
            {savingClave ? "Guardando..." : "Guardar Clave"}
          </button>
        </div>
      </div>

      {/* Filters and List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden flex-1 min-h-[400px]">
        {/* Table Search & Filters bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/30 gap-4">
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar por correo, nombre o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Filtrar por Rol:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-auto"
            >
              <option value="all">Todos los roles</option>
              {roles.map(r => (
                <option key={r.codigo} value={r.codigo}>{r.nombre}</option>
              ))}
            </select>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-55"
              title="Recargar Lista"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="flex-1 overflow-x-auto overflow-y-auto min-h-[300px]">
          {loading ? (
            <div className="flex h-full items-center justify-center p-12">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                <span className="text-xs font-semibold text-slate-500">Cargando base de datos...</span>
              </div>
            </div>
          ) : filteredUsuarios.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-400 py-12 flex-col gap-2">
              <User className="w-8 h-8 opacity-40" />
              <span className="text-xs font-medium">No se encontraron usuarios en la búsqueda.</span>
            </div>
          ) : (
            <table className="w-full text-left min-w-[800px]">
              <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Correo Corporativo</th>
                  <th className="px-6 py-4">Rol en Sistema</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsuarios.map((user) => {
                  const roleCode = user.roles?.codigo || "gerencia";
                  const roleColor = colorMap[roleCode] || colorMap.gerencia;
                  const initials = `${user.nombres.charAt(0)}${user.apellidos.charAt(0)}`.toUpperCase();

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded shrink-0 ${roleColor} flex items-center justify-center font-bold text-xs`}>
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {user.nombres} {user.apellidos}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5 font-bold uppercase tracking-wider">
                              @{user.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium font-mono">
                        {user.correo}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${roleColor}`}>
                          {user.roles?.nombre || "Gerencia"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            user.activo
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-red-100 text-red-800 hover:bg-red-200"
                          }`}
                          title="Haga clic para cambiar estado"
                        >
                          {user.activo ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(user.roles?.codigo === "supervisor" || user.roles?.codigo === "rrhh") && (
                            <button
                              onClick={() => handleOpenSedesModal(user)}
                              className="text-slate-400 hover:text-purple-600 p-1.5 rounded hover:bg-slate-105 transition-colors"
                              title="Asignar Sedes"
                            >
                              <MapPin className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleActive(user)}
                            className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${user.activo ? 'text-slate-400 hover:text-red-500' : 'text-slate-400 hover:text-emerald-500'}`}
                            title={user.activo ? "Desactivar Acceso" : "Habilitar Acceso"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-slate-100 transition-colors"
                            title="Eliminar de BD"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between text-xs text-slate-500 font-medium shrink-0">
          <span>Mostrando {filteredUsuarios.length} de {usuarios.length} usuarios</span>
        </div>
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-55">
              <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-500" />
                Registrar Nuevo Acceso
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateUser} className="flex-1 overflow-y-auto p-6 space-y-4">
              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3.5 rounded-lg flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Nombres</label>
                  <input
                    type="text"
                    required
                    placeholder="Juan"
                    value={formNombres}
                    onChange={(e) => setFormNombres(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Apellidos</label>
                  <input
                    type="text"
                    required
                    placeholder="Pérez Soto"
                    value={formApellidos}
                    onChange={(e) => setFormApellidos(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Nombre de Usuario (Username)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="jperez"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="block w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Correo Electrónico</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-450">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="jperez@grupobax.com"
                    value={formCorreo}
                    onChange={(e) => setFormCorreo(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Rol del Usuario</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-450">
                    <Shield className="w-4 h-4 text-slate-400" />
                  </span>
                  <select
                    required
                    value={formRolId}
                    onChange={(e) => setFormRolId(Number(e.target.value))}
                    className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="">Selecciona un rol...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Contraseña (Mínimo 6 caracteres)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-450">
                    <Lock className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Modal Footer actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-250 rounded-lg text-xs font-bold text-slate-650 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-55 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-1.5"
                >
                  {modalLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Registrar Usuario
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Sedes Modal */}
      {isSedesModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-650" />
                Asignar Sedes: {selectedUser.nombres} {selectedUser.apellidos}
              </h3>
              <button
                onClick={() => setIsSedesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col min-h-0">
              {sedesError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-xs p-3.5 rounded-lg flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{sedesError}</span>
                </div>
              )}

              {/* Search Box */}
              <div className="relative mb-4">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Buscar sede por nombre o cliente..."
                  value={sedesSearchTerm}
                  onChange={(e) => setSedesSearchTerm(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Select All / Deselect All */}
              <div className="flex justify-between items-center mb-3 text-[10px] text-slate-500 font-bold px-1">
                <span>SEDES COMPATIBLES ({filteredSedesList.length})</span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const allFilteredIds = filteredSedesList.map(s => s.id);
                      setAssignedSedes(Array.from(new Set([...assignedSedes, ...allFilteredIds])));
                    }}
                    className="text-purple-600 hover:text-purple-800 transition-colors uppercase"
                  >
                    Marcar Filtradas
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      const allFilteredIds = filteredSedesList.map(s => s.id);
                      setAssignedSedes(assignedSedes.filter(id => !allFilteredIds.includes(id)));
                    }}
                    className="text-slate-500 hover:text-slate-700 transition-colors uppercase"
                  >
                    Desmarcar Filtradas
                  </button>
                </div>
              </div>

              {/* Sedes List */}
              <div className="flex-1 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100 bg-slate-50/30 p-2 min-h-[250px]">
                {sedesLoading ? (
                  <div className="flex h-full items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-purple-650" />
                      <span className="text-[11px] font-semibold text-slate-500">Cargando sedes de base de datos...</span>
                    </div>
                  </div>
                ) : filteredSedesList.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No se encontraron sedes operativas.
                  </div>
                ) : (
                  filteredSedesList.map((sede) => {
                    const isChecked = assignedSedes.includes(sede.id);
                    return (
                      <label
                        key={sede.id}
                        className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white ${
                          isChecked ? "bg-purple-50/30 border border-purple-100" : "border border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSede(sede.id)}
                          className="mt-1 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div className="text-xs">
                          <p className="font-semibold text-slate-800">{sede.nombre}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Cliente: <span className="font-medium text-slate-700">{sede.clientes?.razon_social || "N/A"}</span>
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setIsSedesModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-650 hover:bg-slate-100 bg-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSedes}
                disabled={sedesSaving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-55 text-white rounded-lg text-xs font-bold shadow-lg shadow-purple-200 transition-all flex items-center gap-1.5"
              >
                {sedesSaving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Guardar Cambios
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
