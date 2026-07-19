import React, { useState, useEffect, useRef } from "react";
import { Bell, Shield, Menu, LogOut, AlertTriangle, FileText, Clock, Check, Info } from "lucide-react";
import { useAuth } from "../utils/authContext";
import { supabase } from "../utils/supabase";

interface TopbarProps {
  onMenuToggle: () => void;
  currentRole: string;
}

export function Topbar({ onMenuToggle, currentRole }: TopbarProps) {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [rrhhAlerts, setRrhhAlerts] = useState({
    contratosVencidos: 0,
    contratosPorVencer: 0,
    emosVencidos: 0,
    emosPorVencer: 0,
  });
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Roles meta definitions
  const rolesList = [
    { value: "admin", label: "Administrador", color: "text-red-700 bg-red-50 border-red-200" },
    { value: "logistica", label: "Logística", color: "text-blue-700 bg-blue-50 border-blue-200" },
    { value: "rrhh", label: "Recursos Humanos", color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
    { value: "almacen", label: "Almacén", color: "text-amber-700 bg-amber-50 border-amber-200" },
    { value: "supervisor", label: "Supervisor", color: "text-purple-700 bg-purple-50 border-purple-200" },
    { value: "gerencia", label: "Gerencia (Lectura)", color: "text-slate-700 bg-slate-50 border-slate-200" },
  ];

  const currentRoleMeta = rolesList.find(r => r.value === currentRole) || rolesList[0];

  const initials = user
    ? `${user.nombres.charAt(0)}${user.apellidos.charAt(0)}`.toUpperCase()
    : "??";
  
  const fullName = user ? `${user.nombres} ${user.apellidos}` : "Usuario";

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch RRHH contract/EMO calculations
  const fetchRRHHAlerts = async () => {
    try {
      const { data: personasData, error } = await supabase
        .from("personas")
        .select(`
          id,
          nombres,
          apellidos,
          fecha_ultimo_emo,
          vinculos_laborales (
            id,
            estado,
            contratos (
              id,
              fecha_fin,
              estado
            )
          )
        `);

      if (error || !personasData) return;

      let contratosVencidos = 0;
      let contratosPorVencer = 0;
      let emosVencidos = 0;
      let emosPorVencer = 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      personasData.forEach((p: any) => {
        const activeVincs = p.vinculos_laborales?.filter((v: any) => v.estado === "Activo") || [];
        
        if (activeVincs.length > 0) {
          // 1. Contratos
          activeVincs.forEach((v: any) => {
            const activeContract = v.contratos?.find((c: any) => c.estado === "Vigente");
            if (activeContract && activeContract.fecha_fin) {
              const end = new Date(activeContract.fecha_fin);
              const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays < 0) {
                contratosVencidos++;
              } else if (diffDays <= 30) {
                contratosPorVencer++;
              }
            }
          });

          // 2. EMOs
          if (p.fecha_ultimo_emo) {
            const emoDate = new Date(p.fecha_ultimo_emo);
            const expiryDate = new Date(emoDate.setFullYear(emoDate.getFullYear() + 1));
            const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
              emosVencidos++;
            } else if (diffDays <= 30) {
              emosPorVencer++;
            }
          } else {
            emosVencidos++; // Sin EMO cuenta como vencido
          }
        }
      });

      setRrhhAlerts({
        contratosVencidos,
        contratosPorVencer,
        emosVencidos,
        emosPorVencer,
      });
    } catch (err) {
      console.error("Error calculating RRHH alerts:", err);
    }
  };

  // Fetch event notifications from Supabase
  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from("notificaciones")
        .select("*")
        .order("creado_en", { ascending: false })
        .limit(20);

      if (currentRole !== "admin") {
        if (currentRole === "logistica" || currentRole === "almacen") {
          query = query.or(`rol_destinatario.eq.${currentRole},usuario_id.eq.${user.id}`);
        } else {
          query = query.eq("usuario_id", user.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  // Setup queries & realtime subscriptions
  useEffect(() => {
    if (!user) return;

    // Load initial data
    loadNotifications();
    if (currentRole === "rrhh" || currentRole === "admin") {
      fetchRRHHAlerts();
    }

    // Subscribe to realtime changes in notifications table
    const channel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificaciones" },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentRole]);

  // Click handlers
  const handleMarkAllRead = async () => {
    if (notifications.length === 0) return;
    try {
      const unreadIds = notifications.filter(n => !n.leido).map(n => n.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from("notificaciones")
        .update({ leido: true })
        .in("id", unreadIds);

      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, leido: true })));
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.leido) {
        const { error } = await supabase
          .from("notificaciones")
          .update({ leido: true })
          .eq("id", notif.id);

        if (error) throw error;
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, leido: true } : n));
      }

      setIsOpen(false);

      if (notif.link) {
        window.dispatchEvent(new CustomEvent("navigate-to", { detail: { path: notif.link } }));
      }
    } catch (err) {
      console.error("Error handling notification click:", err);
    }
  };

  const handleRRHHAlertClick = (alertType: string) => {
    setIsOpen(false);
    // Redirigir al módulo de gestión de contratos
    window.dispatchEvent(new CustomEvent("navigate-to", { detail: { path: "/rrhh/contratos" } }));
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return `Hace ${diffDays} d`;
  };

  // Compute total unread badges count
  const isRRHHOrAdmin = currentRole === "rrhh" || currentRole === "admin";
  const rrhhCount = isRRHHOrAdmin 
    ? ((rrhhAlerts.contratosVencidos > 0 ? 1 : 0) + 
       (rrhhAlerts.contratosPorVencer > 0 ? 1 : 0) + 
       (rrhhAlerts.emosVencidos > 0 ? 1 : 0) + 
       (rrhhAlerts.emosPorVencer > 0 ? 1 : 0))
    : 0;
  const eventUnreadCount = notifications.filter(n => !n.leido).length;
  const totalUnread = eventUnreadCount + rrhhCount;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 flex-shrink-0 z-25 sticky top-0">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-full focus:outline-none"
          onClick={onMenuToggle}
        >
          <span className="sr-only">Alternar menú</span>
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Role Switcher & Profile */}
      <div className="flex items-center gap-4">
        {/* Simple role badge for all users */}
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span className={`text-xs font-bold border rounded-lg px-2.5 py-1.5 ${currentRoleMeta.color}`}>
            {currentRoleMeta.label}
          </span>
        </div>

        {/* Campanita de Notificaciones */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors block focus:outline-none ${isOpen ? 'bg-slate-50 text-blue-600' : ''}`}
          >
            <Bell className="w-5 h-5" />
            {totalUnread > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-red-600 text-[10px] font-bold text-white rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                {totalUnread}
              </span>
            )}
          </button>

          {/* Panel Desplegable (Popover) */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-100 z-30 py-2 max-h-[500px] overflow-hidden flex flex-col">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  Notificaciones
                  {totalUnread > 0 && (
                    <span className="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {totalUnread} nuevas
                    </span>
                  )}
                </span>
                {eventUnreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Marcar todo leído
                  </button>
                )}
              </div>

              {/* Contenido con Scroll */}
              <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
                
                {/* 1. Alertas de RRHH */}
                {isRRHHOrAdmin && (
                  <div className="bg-indigo-50/40 p-2.5 space-y-1">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block px-1.5 mb-1.5">
                      ALERTAS DE PERSONAL (RRHH)
                    </span>
                    
                    {rrhhAlerts.contratosVencidos > 0 && (
                      <div 
                        onClick={() => handleRRHHAlertClick("contratosVencidos")}
                        className="flex items-center gap-3 p-2 bg-red-50 hover:bg-red-100/75 rounded-lg border border-red-100 cursor-pointer transition-colors text-xs text-red-700 font-medium"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="flex-1">Tiene <strong>{rrhhAlerts.contratosVencidos}</strong> contratos vencidos.</span>
                      </div>
                    )}

                    {rrhhAlerts.contratosPorVencer > 0 && (
                      <div 
                        onClick={() => handleRRHHAlertClick("contratosPorVencer")}
                        className="flex items-center gap-3 p-2 bg-amber-50 hover:bg-amber-100/75 rounded-lg border border-amber-100 cursor-pointer transition-colors text-xs text-amber-800 font-medium"
                      >
                        <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="flex-1">Tiene <strong>{rrhhAlerts.contratosPorVencer}</strong> contratos por vencer (&le; 30 días).</span>
                      </div>
                    )}

                    {rrhhAlerts.emosVencidos > 0 && (
                      <div 
                        onClick={() => handleRRHHAlertClick("emosVencidos")}
                        className="flex items-center gap-3 p-2 bg-red-50 hover:bg-red-100/75 rounded-lg border border-red-100 cursor-pointer transition-colors text-xs text-red-700 font-medium"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="flex-1">Tiene <strong>{rrhhAlerts.emosVencidos}</strong> exámenes médicos (EMO) vencidos.</span>
                      </div>
                    )}

                    {rrhhAlerts.emosPorVencer > 0 && (
                      <div 
                        onClick={() => handleRRHHAlertClick("emosPorVencer")}
                        className="flex items-center gap-3 p-2 bg-amber-50 hover:bg-amber-100/75 rounded-lg border border-amber-100 cursor-pointer transition-colors text-xs text-amber-800 font-medium"
                      >
                        <Info className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="flex-1">Tiene <strong>{rrhhAlerts.emosPorVencer}</strong> EMOs por vencer (&le; 30 días).</span>
                      </div>
                    )}

                    {rrhhCount === 0 && (
                      <p className="text-[11px] text-slate-500 text-center py-2">
                        Todo al día. No hay alertas de contratos ni EMOs.
                      </p>
                    )}
                  </div>
                )}

                {/* 2. Lista de notificaciones de eventos */}
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 flex gap-3 hover:bg-slate-50 cursor-pointer transition-colors ${!notif.leido ? 'bg-blue-50/30' : ''}`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {notif.tipo === 'nuevo_requerimiento' ? (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                            REQ
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold">
                            EST
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs ${!notif.leido ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                            {notif.titulo}
                          </p>
                          <span className="text-[9px] text-slate-400 flex items-center gap-1 shrink-0">
                            <Clock className="w-2.5 h-2.5" />
                            {formatTimeAgo(notif.creado_en)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal">
                          {notif.mensaje}
                        </p>
                      </div>
                      {!notif.leido && (
                        <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0 self-center"></div>
                      )}
                    </div>
                  ))
                ) : (
                  (!isRRHHOrAdmin || rrhhCount === 0) && (
                    <div className="px-4 py-8 text-center text-slate-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-500" />
                      <p className="text-xs">No tienes notificaciones pendientes</p>
                    </div>
                  )
                )}

              </div>
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-slate-200 mx-0 sm:mx-2 hidden md:block"></div>

        <div className="flex items-center gap-3 group">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-800 leading-none group-hover:text-blue-600 transition-colors">
              {fullName}
            </p>
            <p className="text-[10px] text-slate-500 leading-none mt-1">
              Grupo Bax S.A.C.
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold font-heading">
            {initials}
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200 mx-0 sm:mx-1"></div>

        <button
          onClick={signOut}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
          title="Cerrar Sesión"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="hidden xs:inline">Cerrar Sesión</span>
        </button>
      </div>
    </header>
  );
}

