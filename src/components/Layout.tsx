import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuth } from "../utils/authContext";
import { AccesosRoles } from "../views/AccesosRoles";
import { DiccionariosDatos } from "../views/DiccionariosDatos";
import { EstructuraComercial } from "../views/EstructuraComercial";
import { PlaceholderView } from "../views/PlaceholderView";
import { DashboardRRHH } from "../views/DashboardRRHH";
import { PizarraDigital } from "../views/PizarraDigital";
import { FichasPersonal } from "../views/FichasPersonal";
import { GestionContratos } from "../views/GestionContratos";
import { ControlVacaciones } from "../views/ControlVacaciones";
import { KardexEntregas } from "../views/KardexEntregas";
import { CatalogosAlmacen } from "../views/CatalogosAlmacen.tsx";
import { InventarioUniformes } from "../views/InventarioUniformes.tsx";
import { AuditoriaStock } from "../views/AuditoriaStock.tsx";
import { MisSolicitudes } from "../views/MisSolicitudes.tsx";
import { BandejaAprobaciones } from "../views/BandejaAprobaciones.tsx";
import { DespachosEntregas } from "../views/DespachosEntregas.tsx";
import { DashboardLogistica } from "../views/DashboardLogistica.tsx";
import { Reportes } from "../views/Reportes";
import { navigationStructure } from "../navigation";

interface LayoutProps {
  children?: React.ReactNode;
}

const isPathAllowed = (path: string, currentRole: string): boolean => {
  if (currentRole === "admin" || currentRole === "gerencia") {
    return true;
  }

  for (const group of navigationStructure) {
    for (const item of group.items) {
      if (item.path === path) {
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
      }
    }
  }

  return false;
};

const getDefaultPath = (currentRole: string): string => {
  if (currentRole === "rrhh") return "/dashboards/rrhh";
  if (currentRole === "logistica") return "/dashboards/logistico";
  if (currentRole === "almacen") return "/almacen/catalogo";
  if (currentRole === "supervisor") return "/rrhh/pizarra";
  return "/config/estructura";
};

export function Layout() {
  const { role, signOut } = useAuth();
  const currentRole = role || "admin";

  const navigate = useNavigate();
  const location = useLocation();

  // Redirect root path or unallowed path to default path
  React.useEffect(() => {
    if (location.pathname === "/" || !isPathAllowed(location.pathname, currentRole)) {
      navigate(getDefaultPath(currentRole), { replace: true });
    }
  }, [location.pathname, navigate, currentRole]);

  // Cierre de sesión automático por inactividad (1 hora)
  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        signOut();
        alert("Tu sesión ha sido cerrada automáticamente por inactividad.");
      }, 3600000); // 1 hora en ms
    };

    // Eventos que demuestran actividad
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    // Inicializar el timer
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [signOut]);

  const activePath = location.pathname === "/" ? "/config/estructura" : location.pathname;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  React.useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.path) {
        navigate(customEvent.detail.path);
      }
    };
    window.addEventListener("navigate-to", handleNavigate);
    return () => window.removeEventListener("navigate-to", handleNavigate);
  }, [navigate]);

  // Helper to find the title for the mock view
  const currentViewTitle = React.useMemo(() => {
    for (const group of navigationStructure) {
      const item = group.items.find((i) => i.path === activePath);
      if (item) return item.name;
    }
    return "Vista Desconocida";
  }, [activePath]);

  // Main routing logic (Mocked for SPA without react-router)
  const renderContent = () => {
    switch (activePath) {
      case "/dashboards/rrhh":
        return <DashboardRRHH />;
      case "/rrhh/pizarra":
        return <PizarraDigital />;
      case "/rrhh/fichas":
        return <FichasPersonal />;
      case "/rrhh/contratos":
        return <GestionContratos />;
      case "/rrhh/vacaciones":
        return <ControlVacaciones />;
      case "/almacen/kardex":
        return <KardexEntregas />;
      case "/config/accesos":
        if (role === "logistica" || role === "almacen" || role === "rrhh" || role === "supervisor") {
          return (
            <div className="p-8 text-center text-slate-600 font-bold bg-white rounded-2xl border border-slate-150 shadow-sm max-w-lg mx-auto mt-12">
              ⚠️ Acceso Denegado: Tu rol de usuario no tiene autorización para ver la gestión de Accesos y Roles.
            </div>
          );
        }
        return <AccesosRoles />;
      case "/config/diccionarios":
        return <DiccionariosDatos />;
      case "/config/estructura":
        return <EstructuraComercial />;
      case "/reportes/descarga":
        return <Reportes />;
      case "/almacen/catalogo":
        return <CatalogosAlmacen />;
      case "/almacen/uniformes":
        return <InventarioUniformes />;
      case "/almacen/auditoria":
        return <AuditoriaStock />;
      case "/requerimientos/materiales":
        return <MisSolicitudes defaultTab="Materiales_y_EPP" lockTab={true} />;
      case "/requerimientos/uniformes":
        return <MisSolicitudes defaultTab="Uniformes_Almacen" lockTab={true} />;
      case "/requerimientos/solicitudes":
      case "/requerimientos/aprobaciones":
      case "/requerimientos/despachos":
        return <MisSolicitudes />;
      case "/dashboards/logistico":
        return <DashboardLogistica />;
      default:
        return <PlaceholderView title={currentViewTitle} />;
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50">
      <Sidebar
        activePath={activePath}
        onNavigate={navigate}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isCollapsed={isDesktopCollapsed}
        currentRole={currentRole}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          currentRole={currentRole}
          onMenuToggle={() => {
            if (window.innerWidth < 1024) {
              setIsMobileMenuOpen(true);
            } else {
              setIsDesktopCollapsed(!isDesktopCollapsed);
            }
          }}
        />

        <main className="flex-1 overflow-hidden p-2 sm:p-4 bg-slate-50">
          <div className="h-full w-full max-w-none mx-auto px-0.5 sm:px-1">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
