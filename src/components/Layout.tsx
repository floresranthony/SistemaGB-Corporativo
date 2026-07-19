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

export function Layout() {
  const { role } = useAuth();
  const currentRole = role || "admin";

  const navigate = useNavigate();
  const location = useLocation();

  // Redirect root path to default path
  React.useEffect(() => {
    if (location.pathname === "/") {
      navigate("/config/estructura", { replace: true });
    }
  }, [location.pathname, navigate]);

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
