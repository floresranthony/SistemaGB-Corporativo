import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, X, Factory } from "lucide-react";
import { navigationStructure } from "../navigation";
import { classNames } from "../utils";

interface SidebarProps {
  activePath: string;
  onNavigate: (path: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  currentRole?: string;
}

export function Sidebar({
  activePath,
  onNavigate,
  isOpen,
  onClose,
  isCollapsed = false,
  currentRole = "admin",
}: SidebarProps) {
  // Store expanded state for the groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  // Filtered navigation based on current role
  const filteredNavigation = React.useMemo(() => {
    if (currentRole === "admin" || currentRole === "gerencia") {
      return navigationStructure;
    }

    return navigationStructure
      .map((group) => {
        const filteredItems = group.items.filter((item) => {
          // Logistica permissions
          if (currentRole === "logistica") {
            if (group.name === "Dashboards" && item.path !== "/dashboards/logistico") return false;
            if (group.name === "Recursos Humanos") return false;
            if (group.name === "Configuración" && item.path === "/config/accesos") return false;
            return true;
          }

          // RRHH permissions
          if (currentRole === "rrhh") {
            if (group.name === "Dashboards" && item.path !== "/dashboards/rrhh" && item.path !== "/dashboards/logistico") return false;
            if (group.name === "Requerimientos" && item.path !== "/requerimientos/uniformes") return false;
            if (group.name === "Almacén") return false;
            if (group.name === "Configuración" && item.path !== "/config/diccionarios") return false;
            return true;
          }

          // Almacen permissions
          if (currentRole === "almacen") {
            if (group.name === "Dashboards" && item.path !== "/dashboards/logistico") return false;
            if (group.name === "Recursos Humanos") return false;
            if (group.name === "Requerimientos" && item.path !== "/requerimientos/uniformes") return false;
            if (group.name === "Reportes") return false;
            if (group.name === "Configuración") return false;
            return true;
          }

          // Supervisor permissions
          if (currentRole === "supervisor") {
            if (group.name === "Dashboards" && item.path !== "/dashboards/logistico") return false;
            if (group.name === "Recursos Humanos" && item.path !== "/rrhh/pizarra") return false;
            if (group.name === "Almacén") return false;
            if (group.name === "Reportes") return false;
            if (group.name === "Configuración" && item.path !== "/config/estructura") return false;
            return true;
          }

          return true;
        });

        return { ...group, items: filteredItems };
      })
      .filter((group) => group.items.length > 0);
  }, [currentRole]);

  // Auto-expand group that contains the active path
  useEffect(() => {
    filteredNavigation.forEach((group) => {
      const hasActive = group.items.some((item) => item.path === activePath);
      if (hasActive) {
        setExpandedGroups((prev) => ({ ...prev, [group.name]: true }));
      }
    });
  }, [activePath, filteredNavigation]);

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const navContent = (
    <div
      className={classNames(
        "flex flex-col h-full bg-white border-r border-slate-200 flex-shrink-0 relative z-20 transition-all duration-300",
        isCollapsed ? "w-20" : "w-64",
      )}
    >
      <div
        className={classNames(
          "p-6 flex items-center border-b border-slate-100 shrink-0",
          isCollapsed ? "justify-center" : "justify-between",
        )}
      >
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Grupo Bax Logo"
            className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-200"
          />
          {!isCollapsed && (
            <span className="font-heading text-xl font-extrabold text-slate-800 tracking-tight">
              GRUPO BAX
            </span>
          )}
        </div>
        {!isCollapsed && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 -mr-2 text-slate-500 hover:bg-slate-100 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-x-hidden overflow-y-auto py-4 px-2 space-y-2 scrollbar-thin">
        {filteredNavigation.map((group) => {
          const isExpanded = expandedGroups[group.name];
          const hasActiveItemInGroup = group.items.some(
            (i) => i.path === activePath,
          );

          return (
            <div
              key={group.name}
              className="mb-1"
              title={isCollapsed ? group.name : undefined}
            >
              <button
                onClick={() => toggleGroup(group.name)}
                className={classNames(
                  "w-full flex items-center px-4 py-2 text-sm font-medium rounded-sm transition-colors",
                  isCollapsed ? "justify-center py-3" : "justify-between",
                  hasActiveItemInGroup
                    ? "bg-[#eff6ff] text-[#2563eb] border-r-[3px] border-[#2563eb]"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <div className="flex items-center gap-3">
                  <group.icon className="h-5 w-5" />
                  {!isCollapsed && <span>{group.name}</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown
                    className={classNames(
                      "h-3 w-3 transition-transform duration-200",
                      isExpanded ? "rotate-180" : "",
                    )}
                  />
                )}
              </button>

              {/* Sub-items block */}
              <AnimatePresence initial={false}>
                {isExpanded && !isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pl-11 py-1 space-y-1">
                      {group.items.map((item) => {
                        const isActive = activePath === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => {
                              if (window.innerWidth < 1024) onClose();
                            }}
                            className={classNames(
                              "text-xs py-1.5 cursor-pointer transition-colors block select-none",
                              isActive
                                ? "text-blue-600 font-semibold"
                                : "text-slate-500 hover:text-blue-600",
                            )}
                          >
                            {item.path === "/dashboards/logistico"
                              ? (currentRole === "supervisor"
                                  ? "Mis Pedidos"
                                  : (currentRole === "rrhh" || currentRole === "almacen"
                                      ? "Pedidos de Uniformes"
                                      : item.name))
                              : item.name}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden cursor-pointer"
          />
        )}
      </AnimatePresence>

      <div
        className={classNames(
          "fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-full shrink-0 h-full",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {navContent}
      </div>
    </>
  );
}
