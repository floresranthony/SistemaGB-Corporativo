import React, { useState, useEffect, useRef } from "react";
import { supabase, getOrCreateUserForRole } from "../utils/supabase";
import { 
  Box, 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  RefreshCw, 
  Check, 
  X, 
  FolderPlus, 
  FileText,
  FileSpreadsheet,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  Info
} from "lucide-react";
import * as XLSX from "xlsx";

export function CatalogosAlmacen() {
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterUniforme, setFilterUniforme] = useState("");

  // Lookups
  const [categorias, setCategorias] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [tallas, setTallas] = useState<any[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [selectedTallas, setSelectedTallas] = useState<number[]>([]); // Tallas IDs selected for uniforms

  // Pagination States
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory, filterUniforme, pageSize]);

  // Excel Import/Export States
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState<{ created: number; updated: number; stockAdjusted: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel templates & export logic
  const handleDownloadTemplate = () => {
    const headers = [
      "SKU",
      "Nombre",
      "Descripcion",
      "Categoria",
      "Unidad Medida",
      "Proveedor Principal",
      "Precio Unitario",
      "Es Vestimenta (SI/NO)",
      "Talla",
      "Stock Actual",
      "Activo (SI/NO)"
    ];

    const exampleRow1 = [
      "UN-POLO-PIQ",
      "Polo Piqué Operario Azul",
      "Polo de algodón piqué con logo bordado",
      "Uniformes Operarios",
      "UND",
      "Textiles del Sur S.A.C.",
      "24.90",
      "SI",
      "M",
      "35",
      "SI"
    ];

    const exampleRow2 = [
      "UN-ZAP-SEG",
      "Zapatos de Seguridad Punta de Acero",
      "Zapatos reforzados antideslizantes",
      "Epps y Seguridad",
      "PAR",
      "Textiles del Sur S.A.C.",
      "89.00",
      "SI",
      "38",
      "12",
      "SI"
    ];

    const exampleRow3 = [
      "INS-DET-GAL",
      "Detergente Líquido Industrial 1G",
      "Galón de detergente concentrado para pisos",
      "Material de Limpieza",
      "GAL",
      "Corporación Limpieza Total S.A.",
      "18.50",
      "NO",
      "Estándar",
      "40",
      "SI"
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow1, exampleRow2, exampleRow3]);
    XLSX.utils.book_append_sheet(wb, ws, "Productos");

    // Reference sheets
    const refHeaders = [
      "Categorías (Nombre exacto)",
      "Unidad Medida (Código)",
      "Proveedor (Razón Social)",
      "Tallas (Valor exacto)"
    ];
    const refRows: any[][] = [];

    const maxLen = Math.max(
      categorias.length,
      unidades.length,
      proveedores.length,
      tallas.length
    );

    for (let i = 0; i < maxLen; i++) {
      refRows.push([
        categorias[i]?.nombre || "",
        unidades[i]?.codigo || "",
        proveedores[i]?.razon_social || "",
        tallas[i]?.valor || ""
      ]);
    }

    const wsRef = XLSX.utils.aoa_to_sheet([refHeaders, ...refRows]);
    XLSX.utils.book_append_sheet(wb, wsRef, "Catálogos de Referencia");

    XLSX.writeFile(wb, "plantilla_importacion_productos.xlsx");
  };

  const handleExportData = () => {
    const headers = [
      "SKU",
      "Nombre",
      "Descripcion",
      "Categoria",
      "Unidad Medida",
      "Proveedor Principal",
      "Precio Unitario",
      "Es Vestimenta (SI/NO)",
      "Talla",
      "Stock Actual",
      "Activo (SI/NO)"
    ];

    const rows: any[][] = [];

    data.forEach((p) => {
      const activeStr = p.activo ? "SI" : "NO";
      const esUniformeStr = p.es_uniforme ? "SI" : "NO";
      const catName = p.categorias_producto?.nombre || "";
      const unitCode = p.unidades_medida?.codigo || "";
      const provName = p.proveedores?.razon_social || "";
      const price = parseFloat(p.precio_unitario || 0).toFixed(2);

      if (p.producto_tallas && p.producto_tallas.length > 0) {
        p.producto_tallas.forEach((pt: any) => {
          rows.push([
            p.sku || "",
            p.nombre || "",
            p.descripcion || "",
            catName,
            unitCode,
            provName,
            price,
            esUniformeStr,
            pt.tallas?.valor || "",
            pt.stock_actual ?? 0,
            activeStr
          ]);
        });
      } else {
        rows.push([
          p.sku || "",
          p.nombre || "",
          p.descripcion || "",
          catName,
          unitCode,
          provName,
          price,
          esUniformeStr,
          p.es_uniforme ? "" : "Estándar",
          0,
          activeStr
        ]);
      }
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Productos");

    // Reference sheet too, just like the template
    const refHeaders = [
      "Categorías (Nombre exacto)",
      "Unidad Medida (Código)",
      "Proveedor (Razón Social)",
      "Tallas (Valor exacto)"
    ];
    const refRows: any[][] = [];
    const maxLen = Math.max(
      categorias.length,
      unidades.length,
      proveedores.length,
      tallas.length
    );
    for (let i = 0; i < maxLen; i++) {
      refRows.push([
        categorias[i]?.nombre || "",
        unidades[i]?.codigo || "",
        proveedores[i]?.razon_social || "",
        tallas[i]?.valor || ""
      ]);
    }
    const wsRef = XLSX.utils.aoa_to_sheet([refHeaders, ...refRows]);
    XLSX.utils.book_append_sheet(wb, wsRef, "Catálogos de Referencia");

    XLSX.writeFile(wb, "catalogo_productos_completo.xlsx");
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) return;

    setImporting(true);
    setImportErrors([]);
    setImportSuccess(null);
    setImportProgress({ current: 0, total: 0 });

    try {
      const dataBuffer = await excelFile.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: "array" });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error("El archivo Excel está vacío o no contiene hojas de datos.");
      }

      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      if (rows.length <= 1) {
        throw new Error("El archivo Excel no tiene datos. Asegúrese de llenar filas debajo de la fila de cabecera.");
      }

      const headers = rows[0] as string[];
      const headerMap: Record<string, number> = {};
      headers.forEach((h, idx) => {
        if (h) {
          headerMap[h.trim().toLowerCase()] = idx;
        }
      });

      const getColIndex = (name: string) => headerMap[name.toLowerCase()];

      const skuIdx = getColIndex("sku");
      const nombreIdx = getColIndex("nombre");
      const descIdx = getColIndex("descripcion") ?? getColIndex("descripción");
      const catIdx = getColIndex("categoria") ?? getColIndex("categoría");
      const uniIdx = getColIndex("unidad medida") ?? getColIndex("unidad de medida") ?? getColIndex("unidad");
      const provIdx = getColIndex("proveedor principal") ?? getColIndex("proveedor");
      const precioIdx = getColIndex("precio unitario") ?? getColIndex("precio");
      const uniformeIdx = getColIndex("es vestimenta (si/no)") ?? getColIndex("es uniforme (si/no)") ?? getColIndex("es uniforme");
      const tallaIdx = getColIndex("talla");
      const stockIdx = getColIndex("stock actual") ?? getColIndex("stock");
      const activoIdx = getColIndex("activo (si/no)") ?? getColIndex("activo");

      const missingHeaders = [];
      if (skuIdx === undefined) missingHeaders.push("SKU");
      if (nombreIdx === undefined) missingHeaders.push("Nombre");
      if (catIdx === undefined) missingHeaders.push("Categoría");
      if (uniIdx === undefined) missingHeaders.push("Unidad Medida");
      if (tallaIdx === undefined) missingHeaders.push("Talla");
      if (stockIdx === undefined) missingHeaders.push("Stock Actual");

      if (missingHeaders.length > 0) {
        throw new Error(`El archivo no contiene las cabeceras requeridas: ${missingHeaders.join(", ")}. Por favor, descargue y use la plantilla oficial.`);
      }

      // Load DB reference maps for strict validation
      const [catRes, uniRes, provRes, talRes] = await Promise.all([
        supabase.from("categorias_producto").select("id, nombre"),
        supabase.from("unidades_medida").select("id, codigo, nombre"),
        supabase.from("proveedores").select("id, razon_social"),
        supabase.from("tallas").select("id, valor")
      ]);

      const normalizeStr = (str: string) => 
        str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const catMap = new Map<string, number>();
      catRes.data?.forEach(c => {
        catMap.set(c.nombre.trim().toLowerCase(), c.id);
        catMap.set(normalizeStr(c.nombre), c.id);
      });

      const uniMap = new Map<string, number>();
      uniRes.data?.forEach(u => {
        uniMap.set(u.codigo.trim().toLowerCase(), u.id);
        uniMap.set(normalizeStr(u.codigo), u.id);
        if (u.nombre) {
          uniMap.set(u.nombre.trim().toLowerCase(), u.id);
          uniMap.set(normalizeStr(u.nombre), u.id);
        }
      });

      const provMap = new Map<string, number>();
      provRes.data?.forEach(p => {
        provMap.set(p.razon_social.trim().toLowerCase(), p.id);
        provMap.set(normalizeStr(p.razon_social), p.id);
      });

      let dbTallas = talRes.data || [];
      const hasEstandar = dbTallas.some(t => t.valor.trim().toLowerCase() === "estándar" || t.valor.trim().toLowerCase() === "estandar");
      if (!hasEstandar) {
        // Insert "Estándar" dynamically to DB if missing
        const { data: newTal, error: insError } = await supabase
          .from("tallas")
          .insert([{ valor: "Estándar", activo: true }])
          .select("id, valor")
          .single();
        if (!insError && newTal) {
          dbTallas.push(newTal);
        }
      }

      const tallaMap = new Map<string, number>();
      dbTallas.forEach(t => {
        tallaMap.set(t.valor.trim().toLowerCase(), t.id);
        tallaMap.set(normalizeStr(t.valor), t.id);
      });

      const errors: string[] = [];
      const validRows: any[] = [];
      const seenCombinations = new Set<string>();

      // Row-by-row validation phase
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === "")) {
          continue; // Skip empty rows
        }

        const fileRowNumber = i + 1;

        const rawSku = row[skuIdx!];
        const rawNombre = row[nombreIdx!];
        const rawCat = row[catIdx!];
        const rawUni = row[uniIdx!];
        const rawProv = provIdx !== undefined ? row[provIdx] : null;
        const rawPrecio = precioIdx !== undefined ? row[precioIdx] : 0;
        const rawUniforme = uniformeIdx !== undefined ? row[uniformeIdx] : "NO";
        const rawTalla = row[tallaIdx!];
        const rawStock = row[stockIdx!];
        const rawActivo = activoIdx !== undefined ? row[activoIdx] : "SI";

        const sku = String(rawSku || "").trim().toUpperCase();
        const nombre = String(rawNombre || "").trim();
        const catName = String(rawCat || "").trim();
        const uniCode = String(rawUni || "").trim().toUpperCase();
        const provName = rawProv ? String(rawProv).trim() : "";
        const precio = parseFloat(String(rawPrecio ?? 0)) || 0;
        const esUniforme = String(rawUniforme || "").trim().toUpperCase() === "SI" || String(rawUniforme || "").trim().toUpperCase() === "TRUE";
        const tallaVal = String(rawTalla || "").trim();
        const stockActual = parseInt(String(rawStock ?? 0), 10);
        const activo = String(rawActivo || "").trim().toUpperCase() !== "NO" && String(rawActivo || "").trim().toUpperCase() !== "FALSE";

        // Required field validation
        if (!sku) {
          errors.push(`Fila ${fileRowNumber}: El SKU está vacío.`);
          continue;
        }
        if (!nombre) {
          errors.push(`Fila ${fileRowNumber}: El Nombre del producto está vacío.`);
          continue;
        }
        if (!catName) {
          errors.push(`Fila ${fileRowNumber}: La Categoría está vacía.`);
          continue;
        }
        if (!uniCode) {
          errors.push(`Fila ${fileRowNumber}: La Unidad de Medida está vacía.`);
          continue;
        }
        if (!tallaVal) {
          errors.push(`Fila ${fileRowNumber}: La Talla está vacía.`);
          continue;
        }

        // Duplicate combination check
        const comboKey = `${sku}|||${tallaVal.toLowerCase()}`;
        if (seenCombinations.has(comboKey)) {
          errors.push(`Fila ${fileRowNumber}: Combinación duplicada de SKU '${sku}' y Talla '${tallaVal}' dentro del mismo archivo.`);
          continue;
        }
        seenCombinations.add(comboKey);

        // Validation against database lists
        const categoria_id = catMap.get(catName.toLowerCase()) || catMap.get(normalizeStr(catName));
        if (!categoria_id) {
          errors.push(`Fila ${fileRowNumber}: La Categoría '${catName}' no existe en el sistema. Consulta la pestaña 'Catálogos de Referencia'.`);
        }

        const unidad_medida_id = uniMap.get(uniCode.toLowerCase()) || uniMap.get(normalizeStr(uniCode));
        if (!unidad_medida_id) {
          errors.push(`Fila ${fileRowNumber}: La Unidad de Medida '${uniCode}' no existe en el sistema. Consulta la pestaña 'Catálogos de Referencia'.`);
        }

        let proveedor_id = null;
        if (provName) {
          proveedor_id = provMap.get(provName.toLowerCase()) || provMap.get(normalizeStr(provName)) || null;
          if (!proveedor_id) {
            errors.push(`Fila ${fileRowNumber}: El Proveedor '${provName}' no existe en el sistema. Consulta la pestaña 'Catálogos de Referencia'.`);
          }
        }

        const tallaKey = tallaVal.trim().toLowerCase();
        const tallaId = tallaMap.get(tallaKey) || tallaMap.get(normalizeStr(tallaVal));
        if (!tallaId) {
          errors.push(`Fila ${fileRowNumber}: La Talla '${tallaVal}' no existe en el sistema. Consulta la pestaña 'Catálogos de Referencia'.`);
        }

        if (isNaN(precio) || precio < 0) {
          errors.push(`Fila ${fileRowNumber}: El Precio Unitario '${rawPrecio}' es inválido.`);
        }

        if (isNaN(stockActual) || stockActual < 0) {
          errors.push(`Fila ${fileRowNumber}: El Stock Actual '${rawStock}' debe ser un número entero mayor o igual a 0.`);
        }

        const isEstandarTalla = tallaKey === "estándar" || tallaKey === "estandar";

        // Logical validation for uniform clothing vs standard materials
        if (esUniforme && isEstandarTalla) {
          errors.push(`Fila ${fileRowNumber}: El producto es Vestimenta/Uniforme, por lo tanto no debe tener la talla 'Estándar'. Elija una talla válida (S, M, L, 38, etc.).`);
        }
        if (!esUniforme && !isEstandarTalla) {
          errors.push(`Fila ${fileRowNumber}: El producto no es Vestimenta/Uniforme, por lo tanto debe tener la talla 'Estándar'.`);
        }

        if (errors.length === 0) {
          validRows.push({
            sku,
            nombre,
            descripcion: descIdx !== undefined ? String(row[descIdx] || "").trim() : "",
            categoria_id,
            unidad_medida_id,
            proveedor_id,
            precio_unitario: precio,
            es_uniforme: esUniforme,
            activo,
            tallaVal: isEstandarTalla ? "Estándar" : tallaVal,
            tallaId,
            stockActual,
            fileRowNumber
          });
        }
      }

      if (errors.length > 0) {
        setImportErrors(errors);
        setImporting(false);
        return;
      }

      const role = localStorage.getItem("bax_role") || "admin";
      const userId = await getOrCreateUserForRole(role);

      const skuGroups = new Map<string, typeof validRows>();
      validRows.forEach(r => {
        const group = skuGroups.get(r.sku) || [];
        group.push(r);
        skuGroups.set(r.sku, group);
      });

      const skus = Array.from(skuGroups.keys());
      setImportProgress({ current: 0, total: skus.length });

      let createdCount = 0;
      let updatedCount = 0;
      let stockAdjustedCount = 0;

      for (let sIndex = 0; sIndex < skus.length; sIndex++) {
        const sku = skus[sIndex];
        const groupRows = skuGroups.get(sku)!;
        const primaryRow = groupRows[0];

        const { data: existingProd, error: findError } = await supabase
          .from("productos")
          .select("id, es_uniforme, nombre")
          .eq("sku", sku)
          .maybeSingle();

        if (findError) {
          throw findError;
        }

        let productId: number;
        if (existingProd) {
          const { error: updError } = await supabase
            .from("productos")
            .update({
              nombre: primaryRow.nombre,
              descripcion: primaryRow.descripcion,
              categoria_id: primaryRow.categoria_id,
              unidad_medida_id: primaryRow.unidad_medida_id,
              proveedor_id: primaryRow.proveedor_id,
              precio_unitario: primaryRow.precio_unitario,
              es_uniforme: primaryRow.es_uniforme,
              activo: primaryRow.activo
            })
            .eq("id", existingProd.id);

          if (updError) throw updError;
          productId = existingProd.id;
          updatedCount++;
        } else {
          const { data: newProd, error: insError } = await supabase
            .from("productos")
            .insert([{
              sku: primaryRow.sku,
              nombre: primaryRow.nombre,
              descripcion: primaryRow.descripcion,
              categoria_id: primaryRow.categoria_id,
              unidad_medida_id: primaryRow.unidad_medida_id,
              proveedor_id: primaryRow.proveedor_id,
              precio_unitario: primaryRow.precio_unitario,
              es_uniforme: primaryRow.es_uniforme,
              activo: primaryRow.activo
            }])
            .select("id")
            .single();

          if (insError) throw insError;
          productId = newProd.id;
          createdCount++;
        }

        for (const row of groupRows) {
          const { tallaId, stockActual } = row;

          const { data: existingVar, error: varError } = await supabase
            .from("producto_tallas")
            .select("id, stock_actual")
            .eq("producto_id", productId)
            .eq("talla_id", tallaId)
            .maybeSingle();

          if (varError) throw varError;

          if (existingVar) {
            const currentStock = existingVar.stock_actual;
            if (currentStock !== stockActual) {
              const { error: stockUpdErr } = await supabase
                .from("producto_tallas")
                .update({ stock_actual: stockActual })
                .eq("id", existingVar.id);

              if (stockUpdErr) throw stockUpdErr;

              const { error: audErr } = await supabase
                .from("auditoria_stock")
                .insert([{
                  producto_talla_id: existingVar.id,
                  usuario_id: userId,
                  tipo_movimiento: stockActual > currentStock ? "Ingreso" : "Salida",
                  cantidad: Math.abs(stockActual - currentStock),
                  stock_previo: currentStock,
                  stock_nuevo: stockActual,
                  motivo: "Importación/Actualización masiva Excel"
                }]);

              if (audErr) throw audErr;
              stockAdjustedCount++;
            }
          } else {
            const { data: newVar, error: varInsErr } = await supabase
              .from("producto_tallas")
              .insert([{
                producto_id: productId,
                talla_id: tallaId,
                stock_actual: stockActual
              }])
              .select("id")
              .single();

            if (varInsErr) throw varInsErr;

            if (stockActual >= 0) {
              const { error: audErr } = await supabase
                .from("auditoria_stock")
                .insert([{
                  producto_talla_id: newVar.id,
                  usuario_id: userId,
                  tipo_movimiento: "Ingreso",
                  cantidad: stockActual,
                  stock_previo: 0,
                  stock_nuevo: stockActual,
                  motivo: "Importación/Actualización masiva Excel"
                }]);

              if (audErr) throw audErr;
            }
            stockAdjustedCount++;
          }
        }

        setImportProgress({ current: sIndex + 1, total: skus.length });
      }

      setImportSuccess({
        created: createdCount,
        updated: updatedCount,
        stockAdjusted: stockAdjustedCount
      });
      setExcelFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      loadProductos();
    } catch (err: any) {
      console.error("Error importing products:", err);
      setImportErrors([err.message || "Error inesperado al procesar el archivo Excel."]);
    } finally {
      setImporting(false);
    }
  };

  // Fetch Lookups
  const loadLookups = async () => {
    try {
      const [catRes, uniRes, provRes, talRes] = await Promise.all([
        supabase.from("categorias_producto").select("*").eq("activo", true).order("nombre"),
        supabase.from("unidades_medida").select("*").order("nombre"),
        supabase.from("proveedores").select("*").eq("activo", true).order("razon_social"),
        supabase.from("tallas").select("*").eq("activo", true).order("valor")
      ]);

      setCategorias(catRes.data || []);
      setUnidades(uniRes.data || []);
      setProveedores(provRes.data || []);
      setTallas(talRes.data || []);
    } catch (err) {
      console.error("Error loading warehouse lookups:", err);
    }
  };

  // Fetch Products
  const loadProductos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: prodData, error: dbError } = await supabase
        .from("productos")
        .select(`
          *,
          categorias_producto (id, nombre),
          unidades_medida (id, codigo, nombre),
          proveedores (id, razon_social),
          producto_tallas (
            id,
            talla_id,
            stock_actual,
            tallas (id, valor)
          )
        `)
        .order("nombre", { ascending: true });

      if (dbError) throw dbError;
      setData(prodData || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar los productos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLookups();
    loadProductos();
  }, []);

  // Seeding helper to populate the DB with required and demo items
  const handleSeedAlmacen = async () => {
    setSeeding(true);
    setError(null);
    try {
      // 1. Seed Roles and mock users if they don't exist
      const rolesToInsert = [
        { codigo: "admin", nombre: "Administrador", descripcion: "Control Total" },
        { codigo: "logistica", nombre: "Logística", descripcion: "Aprobación y Compras" },
        { codigo: "rrhh", nombre: "Recursos Humanos", descripcion: "Pizarra y Personal" },
        { codigo: "almacen", nombre: "Almacén", descripcion: "Stock y Despacho" },
        { codigo: "supervisor", nombre: "Supervisor Sede", descripcion: "Requerimientos" }
      ];

      for (const r of rolesToInsert) {
        const { data: existingRole } = await supabase.from("roles").select("id").eq("codigo", r.codigo).maybeSingle();
        if (!existingRole) {
          await supabase.from("roles").insert([r]);
        }
      }

      const { data: allRoles } = await supabase.from("roles").select("*");
      const findRolId = (code: string) => allRoles?.find(r => r.codigo === code)?.id || 1;

      const usersToInsert = [
        { username: "admin", password_hash: "123", nombres: "Rodrigo", apellidos: "Palacios", correo: "rodrigo@bax.pe", rol_id: findRolId("admin") },
        { username: "almacen", password_hash: "123", nombres: "Carlos", apellidos: "Gutiérrez", correo: "carlos@bax.pe", rol_id: findRolId("almacen") },
        { username: "logistica", password_hash: "123", nombres: "Elena", apellidos: "Loayza", correo: "elena@bax.pe", rol_id: findRolId("logistica") },
        { username: "rrhh", password_hash: "123", nombres: "Martina", apellidos: "Alva", correo: "martina@bax.pe", rol_id: findRolId("rrhh") },
        { username: "supervisor", password_hash: "123", nombres: "Supervisor", apellidos: "Sede", correo: "sede@bax.pe", rol_id: findRolId("supervisor") }
      ];

      for (const u of usersToInsert) {
        const { data: existingUser } = await supabase.from("usuarios").select("id").eq("username", u.username).maybeSingle();
        if (!existingUser) {
          await supabase.from("usuarios").insert([u]);
        }
      }

      // 2. Seed Categorías de Producto
      const categoriesToInsert = [
        { nombre: "Epps y Seguridad", descripcion: "Equipos de protección personal", activo: true },
        { nombre: "Uniformes Operarios", descripcion: "Vestimenta de trabajo de campo", activo: true },
        { nombre: "Material de Limpieza", descripcion: "Químicos e insumos de limpieza", activo: true }
      ];
      for (const cat of categoriesToInsert) {
        const { data: existingCat } = await supabase.from("categorias_producto").select("id").eq("nombre", cat.nombre).maybeSingle();
        if (!existingCat) {
          await supabase.from("categorias_producto").insert([cat]);
        }
      }

      // 3. Seed Unidades de Medida
      const unitsToInsert = [
        { codigo: "UND", nombre: "Unidades" },
        { codigo: "PAR", nombre: "Pares" },
        { codigo: "GAL", nombre: "Galones" }
      ];
      for (const uni of unitsToInsert) {
        const { data: existingUni } = await supabase.from("unidades_medida").select("id").eq("codigo", uni.codigo).maybeSingle();
        if (!existingUni) {
          await supabase.from("unidades_medida").insert([uni]);
        }
      }

      // 4. Seed Proveedores
      const suppliersToInsert = [
        { ruc: "20501234567", razon_social: "Textiles del Sur S.A.C.", contacto_nombre: "Gte. Manuel Soto", contacto_telefono: "999888777", activo: true },
        { ruc: "20609876543", razon_social: "Corporación Limpieza Total S.A.", contacto_nombre: "Adm. Ana Pérez", contacto_telefono: "988777666", activo: true }
      ];
      for (const sup of suppliersToInsert) {
        const { data: existingSup } = await supabase.from("proveedores").select("id").eq("ruc", sup.ruc).maybeSingle();
        if (!existingSup) {
          await supabase.from("proveedores").insert([sup]);
        }
      }

      // 5. Seed Tallas (incluyendo la Estándar)
      const tallasToInsert = [
        { valor: "S", activo: true },
        { valor: "M", activo: true },
        { valor: "L", activo: true },
        { valor: "XL", activo: true },
        { valor: "Estándar", activo: true }
      ];
      for (const tal of tallasToInsert) {
        const { data: existingTal } = await supabase.from("tallas").select("id").eq("valor", tal.valor).maybeSingle();
        if (!existingTal) {
          await supabase.from("tallas").insert([tal]);
        }
      }

      await loadLookups();
      
      // Fetch fresh IDs for insertion
      const { data: dbCats } = await supabase.from("categorias_producto").select("id, nombre");
      const { data: dbUnis } = await supabase.from("unidades_medida").select("id, codigo");
      const { data: dbSups } = await supabase.from("proveedores").select("id, razon_social");
      const { data: dbTallas } = await supabase.from("tallas").select("id, valor");

      const catEppId = dbCats?.find(c => c.nombre === "Epps y Seguridad")?.id;
      const catUniformeId = dbCats?.find(c => c.nombre === "Uniformes Operarios")?.id;
      const catLimpiezaId = dbCats?.find(c => c.nombre === "Material de Limpieza")?.id;

      const uniUndId = dbUnis?.find(u => u.codigo === "UND")?.id;
      const uniParId = dbUnis?.find(u => u.codigo === "PAR")?.id;
      const uniGalId = dbUnis?.find(u => u.codigo === "GAL")?.id;

      const supTextilId = dbSups?.find(s => s.razon_social === "Textiles del Sur S.A.C.")?.id;
      const supLimpId = dbSups?.find(s => s.razon_social === "Corporación Limpieza Total S.A.")?.id;

      const tSId = dbTallas?.find(t => t.valor === "S")?.id;
      const tMId = dbTallas?.find(t => t.valor === "M")?.id;
      const tLId = dbTallas?.find(t => t.valor === "L")?.id;
      const tEstandarId = dbTallas?.find(t => t.valor === "Estándar")?.id;

      // 6. Seed default products if none exist
      const { data: existingProds } = await supabase.from("productos").select("id").limit(1);
      if (!existingProds || existingProds.length === 0) {
        // Uniform product 1
        const { data: p1 } = await supabase.from("productos").insert([{
          sku: "UN-POLO-PIQ",
          nombre: "Polo Piqué Operario Azul",
          descripcion: "Polo de algodón piqué con logo bordado",
          categoria_id: catUniformeId,
          unidad_medida_id: uniUndId,
          proveedor_id: supTextilId,
          precio_unitario: 24.90,
          es_uniforme: true,
          activo: true
        }]).select("id").single();

        if (p1 && tSId && tMId && tLId) {
          await supabase.from("producto_tallas").insert([
            { producto_id: p1.id, talla_id: tSId, stock_actual: 15 },
            { producto_id: p1.id, talla_id: tMId, stock_actual: 35 },
            { producto_id: p1.id, talla_id: tLId, stock_actual: 8 }
          ]);
        }

        // Uniform product 2
        const { data: p2 } = await supabase.from("productos").insert([{
          sku: "UN-ZAP-SEG",
          nombre: "Zapatos de Seguridad Punta de Acero",
          descripcion: "Zapatos reforzados antideslizantes",
          categoria_id: catEppId,
          unidad_medida_id: uniParId,
          proveedor_id: supTextilId,
          precio_unitario: 89.00,
          es_uniforme: true,
          activo: true
        }]).select("id").single();

        if (p2 && tSId && tMId && tLId) {
          await supabase.from("producto_tallas").insert([
            { producto_id: p2.id, talla_id: tSId, stock_actual: 5 },
            { producto_id: p2.id, talla_id: tMId, stock_actual: 12 },
            { producto_id: p2.id, talla_id: tLId, stock_actual: 6 }
          ]);
        }

        // Non-uniform product 3
        const { data: p3 } = await supabase.from("productos").insert([{
          sku: "INS-DET-GAL",
          nombre: "Detergente Líquido Industrial 1G",
          descripcion: "Galón de detergente concentrado para pisos",
          categoria_id: catLimpiezaId,
          unidad_medida_id: uniGalId,
          proveedor_id: supLimpId,
          precio_unitario: 18.50,
          es_uniforme: false,
          activo: true
        }]).select("id").single();

        if (p3 && tEstandarId) {
          await supabase.from("producto_tallas").insert([
            { producto_id: p3.id, talla_id: tEstandarId, stock_actual: 40 }
          ]);
        }
      }

      await loadProductos();
      alert("¡Catálogos y stock demo cargados con éxito!");
    } catch (err: any) {
      console.error("Error seeding warehouse data:", err);
      alert("Error al sembrar: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  // Open Add Form
  const handleOpenAdd = () => {
    setEditingId(null);
    setSelectedTallas([]);
    setFormValues({
      sku: "",
      nombre: "",
      descripcion: "",
      categoria_id: categorias[0]?.id || "",
      unidad_medida_id: unidades[0]?.id || "",
      proveedor_id: proveedores[0]?.id || "",
      precio_unitario: 0.00,
      es_uniforme: false,
      activo: true
    });
    setIsModalOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setFormValues({ ...item });
    const configuredTallas = item.producto_tallas?.map((pt: any) => pt.talla_id) || [];
    setSelectedTallas(configuredTallas);
    setIsModalOpen(true);
  };

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = { ...formValues };
    delete payload.categorias_producto;
    delete payload.unidades_medida;
    delete payload.proveedores;
    delete payload.producto_tallas;

    try {
      let productId = editingId;

      if (editingId) {
        // Update product
        const { error: dbError } = await supabase
          .from("productos")
          .update(payload)
          .eq("id", editingId);
        if (dbError) throw dbError;
      } else {
        // Insert new product
        const { data: newProd, error: dbError } = await supabase
          .from("productos")
          .insert([payload])
          .select("id")
          .single();
        if (dbError) throw dbError;
        productId = newProd.id;
      }

      if (productId) {
        if (payload.es_uniforme) {
          // If it's a uniform, check and insert checked tallas that aren't already there
          for (const tid of selectedTallas) {
            const { data: existing } = await supabase
              .from("producto_tallas")
              .select("id")
              .eq("producto_id", productId)
              .eq("talla_id", tid)
              .maybeSingle();

            if (!existing) {
              await supabase.from("producto_tallas").insert([
                { producto_id: productId, talla_id: tid, stock_actual: 0 }
              ]);
            }
          }
        } else {
          // If not a uniform, ensure the universal talla "Estándar" is assigned
          const estTalla = tallas.find(t => t.valor === "Estándar");
          if (estTalla) {
            const { data: existing } = await supabase
              .from("producto_tallas")
              .select("id")
              .eq("producto_id", productId)
              .eq("talla_id", estTalla.id)
              .maybeSingle();

            if (!existing) {
              await supabase.from("producto_tallas").insert([
                { producto_id: productId, talla_id: estTalla.id, stock_actual: 0 }
              ]);
            }
          }
        }
      }

      setIsModalOpen(false);
      loadProductos();
    } catch (err: any) {
      console.error("Error saving product:", err);
      setError(err.message || "Error al registrar el producto.");
    } finally {
      setLoading(false);
    }
  };

  // Delete product
  const handleDelete = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar este producto del catálogo?")) return;
    setLoading(true);
    try {
      const { error: dbError } = await supabase
        .from("productos")
        .delete()
        .eq("id", id);
      if (dbError) throw dbError;
      loadProductos();
    } catch (err: any) {
      setError(err.message || "No se puede eliminar el producto porque tiene stock o movimientos registrados.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle talla selections
  const handleToggleTalla = (tid: number) => {
    if (selectedTallas.includes(tid)) {
      setSelectedTallas(selectedTallas.filter(id => id !== tid));
    } else {
      setSelectedTallas([...selectedTallas, tid]);
    }
  };

  // Filtering
  const filteredData = data.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    const matchesCat = !filterCategory || String(p.categoria_id) === filterCategory;
    const matchesUniforme = !filterUniforme || 
      (filterUniforme === "SI" && p.es_uniforme) || 
      (filterUniforme === "NO" && !p.es_uniforme);

    return matchesSearch && matchesCat && matchesUniforme;
  });

  const stats = React.useMemo(() => {
    let total = data.length;
    let uniformes = data.filter(p => p.es_uniforme).length;
    let insumos = total - uniformes;
    let activos = data.filter(p => p.activo).length;
    return { total, uniformes, insumos, activos };
  }, [data]);

  // Paginated Data
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 flex-shrink-0 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Almacén / Inventarios
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Box className="w-8 h-8 text-blue-600" />
            Catálogo Maestro
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Gestiona la lista central de productos, materiales generales y uniformes con control de variantes por tallas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.length === 0 && !loading && (
            <button
              onClick={handleSeedAlmacen}
              disabled={seeding}
              className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              <FolderPlus className={`w-4 h-4 ${seeding ? "animate-spin" : ""}`} />
              Precargar Almacén Demo
            </button>
          )}
          <button 
            onClick={() => {
              setExcelFile(null);
              setImportErrors([]);
              setImportSuccess(null);
              setIsExcelModalOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-emerald-600 border border-emerald-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar/Exportar Excel
          </button>
          <button 
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Añadir Producto
          </button>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Productos</span>
            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Uniformes</span>
            <span className="text-2xl font-black text-slate-900 text-emerald-600">{stats.uniformes}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Materiales/Insumos</span>
            <span className="text-2xl font-black text-slate-900 text-amber-600">{stats.insumos}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Habilitados</span>
            <span className="text-2xl font-black text-slate-900 text-slate-700">{stats.activos}</span>
          </div>
        </div>
      </div>

      {/* Main Table Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[400px]">
        {/* Filtering Options */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-5 border-b border-slate-100 gap-4 bg-slate-50/10">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por SKU o Nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none text-slate-600"
            >
              <option value="">Todas las Categorías</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>

            <select
              value={filterUniforme}
              onChange={(e) => setFilterUniforme(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none text-slate-600"
            >
              <option value="">Todos los Tipos</option>
              <option value="SI">Uniformes / Ropa</option>
              <option value="NO">Insumos estándar</option>
            </select>
          </div>
          {error && (
            <div className="bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-lg text-xs font-medium">
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Table list */}
        <div className="flex-1 overflow-auto max-h-[60vh] relative">
          {loading && filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Cargando catálogo maestro...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100">
                <Box className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No se encontraron productos</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">Verifica tus filtros o crea un nuevo producto en el catálogo.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4 sticky top-0 bg-slate-100 z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">SKU / Código</th>
                  <th className="px-6 py-4 sticky top-0 bg-slate-100 z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Nombre del Producto</th>
                  <th className="px-6 py-4 sticky top-0 bg-slate-100 z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Categoría</th>
                  <th className="px-6 py-4 sticky top-0 bg-slate-100 z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Unidad</th>
                  <th className="px-6 py-4 sticky top-0 bg-slate-100 z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Proveedor Principal</th>
                  <th className="px-6 py-4 sticky top-0 bg-slate-100 z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Precio Unitario</th>
                  <th className="px-6 py-4 sticky top-0 bg-slate-100 z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)] text-center">Es Uniforme</th>
                  <th className="px-6 py-4 sticky top-0 bg-slate-100 z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)] text-center">Estado</th>
                  <th className="px-6 py-4 sticky top-0 bg-slate-100 z-10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)] text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-600 font-semibold">
                      {p.sku}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-800">{p.nombre}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[200px]" title={p.descripcion}>{p.descripcion || "Sin descripción"}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {p.categorias_producto?.nombre || "General"}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500 font-bold">
                      {p.unidades_medida?.codigo || "UND"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 font-medium">
                      {p.proveedores?.razon_social || "No asignado"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-0.5 text-sm text-indigo-700 font-black">
                        <span className="text-xs font-bold mr-0.5">S/</span>
                        {parseFloat(p.precio_unitario).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        p.es_uniforme ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                      }`}>
                        {p.es_uniforme ? "Vestimenta / Tallas" : "Estándar"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        p.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800"
                      }`}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
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
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 font-medium shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>Total: <strong>{totalItems}</strong> productos registrados</span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1">
              <span>Mostrar</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="mx-1 px-1.5 py-0.5 border border-slate-200 rounded bg-white text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
              <span>por pág.</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">
              Mostrando <strong>{totalItems > 0 ? startIndex + 1 : 0} - {Math.min(startIndex + pageSize, totalItems)}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-600 font-semibold disabled:opacity-50 disabled:hover:bg-white active:scale-95 transition-all text-xs"
              >
                Ant.
              </button>
              
              {/* Render dynamic page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Show first, last, current, and pages close to current
                  return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                })
                .map((page, index, array) => {
                  const showEllipsis = index > 0 && page - array[index - 1] > 1;
                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                          currentPage === page
                            ? "bg-blue-600 text-white shadow-sm"
                            : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-600 font-semibold disabled:opacity-50 disabled:hover:bg-white active:scale-95 transition-all text-xs"
              >
                Sig.
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-slide-in border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5 shrink-0">
              <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                <Box className="w-5 h-5 text-blue-600" />
                {editingId ? "Editar Producto" : "Añadir Producto al Catálogo"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">SKU / Código Único</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. UN-POLO-PIQ"
                  value={formValues.sku || ""}
                  onChange={(e) => setFormValues({ ...formValues, sku: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre Comercial</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Polo Piqué Azul Operario"
                  value={formValues.nombre || ""}
                  onChange={(e) => setFormValues({ ...formValues, nombre: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Descripción corta</label>
                <textarea
                  placeholder="Escribe detalles del material, color, etc."
                  value={formValues.descripcion || ""}
                  onChange={(e) => setFormValues({ ...formValues, descripcion: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none h-16 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Categoría</label>
                  <select
                    required
                    value={formValues.categoria_id || ""}
                    onChange={(e) => setFormValues({ ...formValues, categoria_id: parseInt(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                  >
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Unidad de Medida</label>
                  <select
                    required
                    value={formValues.unidad_medida_id || ""}
                    onChange={(e) => setFormValues({ ...formValues, unidad_medida_id: parseInt(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                  >
                    {unidades.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre} ({u.codigo})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Proveedor Principal</label>
                  <select
                    required
                    value={formValues.proveedor_id || ""}
                    onChange={(e) => setFormValues({ ...formValues, proveedor_id: parseInt(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
                  >
                    {proveedores.map(p => (
                      <option key={p.id} value={p.id}>{p.razon_social}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Precio Unitario (S/.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formValues.precio_unitario ?? 0}
                    onChange={(e) => setFormValues({ ...formValues, precio_unitario: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="es_uniforme"
                    checked={formValues.es_uniforme || false}
                    onChange={(e) => setFormValues({ ...formValues, es_uniforme: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="es_uniforme" className="text-sm font-semibold text-slate-700 select-none">
                    Es Uniforme / Prenda (Habilitar variantes por Talla)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formValues.activo ?? true}
                    onChange={(e) => setFormValues({ ...formValues, activo: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="activo" className="text-sm font-semibold text-slate-700 select-none">
                    Producto Activo / Habilitado
                  </label>
                </div>
              </div>

              {/* Tallas Checklist (If Uniform is active) */}
              {formValues.es_uniforme && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2 pt-2 animate-fade-in">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tallas Disponibles</span>
                  <p className="text-[10px] text-slate-400">Marca las tallas en las que existirá stock de esta prenda:</p>
                  
                  <div className="flex flex-wrap gap-2 pt-1">
                    {tallas
                      .filter(t => t.valor !== "Estándar")
                      .map((t) => {
                        const isChecked = selectedTallas.includes(t.id);
                        return (
                          <button
                            type="button"
                            key={t.id}
                            onClick={() => handleToggleTalla(t.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              isChecked 
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            Talla {t.valor}
                          </button>
                        );
                      })}
                  </div>
                  {tallas.filter(t => t.valor !== "Estándar").length === 0 && (
                    <p className="text-xs text-amber-600 italic">No hay tallas configuradas en el sistema.</p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md active:scale-95 transition-all flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                  {editingId ? "Actualizar" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import / Export Modal */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl animate-slide-in border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5 shrink-0">
              <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                Operaciones Masivas con Excel
              </h3>
              <button 
                onClick={() => {
                  if (!importing) setIsExcelModalOpen(false);
                }}
                disabled={importing}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                      <Download className="w-4 h-4 text-blue-600" />
                      1. Descargar Plantilla Oficial
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Descarga una plantilla de Excel con la estructura correcta, filas de ejemplo para prendas/zapatos y un listado dinámico de las categorías, unidades, proveedores y tallas activas en el sistema.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="mt-4 inline-flex items-center justify-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors w-full"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar Plantilla (.xlsx)
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      2. Exportar Catálogo Actual
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Descarga todos los productos actualmente registrados en la base de datos desglosados por talla y con sus stocks reales. Puedes usar este archivo para actualizar precios, nombres o stocks y volverlo a importar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="mt-4 inline-flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors w-full"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar Base de Datos (.xlsx)
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-3">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  3. Importar y Actualizar Productos
                </h4>
                
                <form onSubmit={handleImportExcel} className="space-y-4">
                  <div 
                    onClick={() => {
                      if (!importing) fileInputRef.current?.click();
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                      excelFile 
                        ? "border-indigo-500 bg-indigo-50/20" 
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    } ${importing ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setExcelFile(file);
                      }}
                      accept=".xlsx, .xls"
                      className="hidden"
                    />
                    <Upload className={`w-8 h-8 ${excelFile ? "text-indigo-600 animate-bounce" : "text-slate-400"}`} />
                    {excelFile ? (
                      <div>
                        <p className="text-sm font-bold text-slate-700">{excelFile.name}</p>
                        <p className="text-xs text-slate-400">{(excelFile.size / 1024).toFixed(1)} KB - Listo para importar</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-bold text-slate-700">Arrastra aquí tu archivo Excel o haz clic para buscar</p>
                        <p className="text-xs text-slate-400">Formatos soportados: .xlsx, .xls</p>
                      </div>
                    )}
                  </div>

                  {importErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto">
                      <div className="flex items-center gap-2 text-red-800 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <span>Se encontraron errores de validación ({importErrors.length}):</span>
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-xs text-red-700">
                        {importErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {importSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1">
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                        <span>¡Importación completada con éxito!</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center pt-1 text-xs font-semibold text-slate-600">
                        <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                          <span className="block text-emerald-600 font-bold text-sm">{importSuccess.created}</span>
                          Nuevos Productos
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                          <span className="block text-blue-600 font-bold text-sm">{importSuccess.updated}</span>
                          Productos Actualizados
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                          <span className="block text-indigo-600 font-bold text-sm">{importSuccess.stockAdjusted}</span>
                          Variantes/Stocks
                        </div>
                      </div>
                    </div>
                  )}

                  {importing && (
                    <div className="space-y-2 bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                      <div className="flex justify-between items-center text-xs font-bold text-indigo-900">
                        <span className="flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Procesando base de datos...
                        </span>
                        <span>{importProgress.current} / {importProgress.total} Productos</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${importProgress.total ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
                    <button
                      type="button"
                      disabled={importing}
                      onClick={() => {
                        setExcelFile(null);
                        setImportErrors([]);
                        setImportSuccess(null);
                        setIsExcelModalOpen(false);
                      }}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      Cerrar
                    </button>
                    {excelFile && !importing && (
                      <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        Iniciar Importación
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
