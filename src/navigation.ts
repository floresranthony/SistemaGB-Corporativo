import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Package,
  Settings,
  PieChart,
  Briefcase,
  UserSquare,
  FileText,
  Calendar,
  Inbox,
  CheckSquare,
  Truck,
  Box,
  Shirt,
  ShieldAlert,
  Building,
  Key,
  Database,
} from "lucide-react";

export const navigationStructure = [
  {
    name: "Dashboards",
    icon: LayoutDashboard,
    items: [
      {
        name: "Resumen Logístico",
        path: "/dashboards/logistico",
        icon: PieChart,
      },
      { name: "Resumen RRHH", path: "/dashboards/rrhh", icon: Briefcase },
    ],
  },
  {
    name: "Recursos Humanos",
    icon: Users,
    items: [
      { name: "Pizarra Digital", path: "/rrhh/pizarra", icon: LayoutDashboard },
      { name: "Fichas de Personal", path: "/rrhh/fichas", icon: UserSquare },
      { name: "Control de Vacaciones", path: "/rrhh/vacaciones", icon: Calendar },
    ],
  },
  {
    name: "Requerimientos",
    icon: ClipboardList,
    items: [
      {
        name: "Materiales",
        path: "/requerimientos/materiales",
        icon: Inbox,
      },
      {
        name: "Uniformes y EPP",
        path: "/requerimientos/uniformes",
        icon: Shirt,
      },
    ],
  },
  {
    name: "Almacén",
    icon: Package,
    items: [
      { name: "Catálogo Maestro", path: "/almacen/catalogo", icon: Box },
      {
        name: "Inventario de Uniformes",
        path: "/almacen/uniformes",
        icon: Shirt,
      },
      {
        name: "Kardex de Entregas",
        path: "/almacen/kardex",
        icon: FileText,
      },
      {
        name: "Auditoría de Stock",
        path: "/almacen/auditoria",
        icon: ShieldAlert,
      },
    ],
  },
  {
    name: "Reportes",
    icon: FileText,
    items: [
      {
        name: "Descarga de Reportes",
        path: "/reportes/descarga",
        icon: FileText,
      },
    ],
  },
  {
    name: "Configuración",
    icon: Settings,
    items: [
      {
        name: "Estructura Comercial",
        path: "/config/estructura",
        icon: Building,
      },
      { name: "Accesos y Roles", path: "/config/accesos", icon: Key },
      {
        name: "Diccionarios de Datos",
        path: "/config/diccionarios",
        icon: Database,
      },
    ],
  },
];
