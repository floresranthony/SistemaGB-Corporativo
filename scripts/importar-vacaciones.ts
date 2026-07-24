import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ ERROR: VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no están definidos en el archivo .env.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Date parser helper, identical to the application's parsing logic
const parseExcelDate = (val: any): string | null => {
  if (!val) return null;
  
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, "0");
    const dd = String(val.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  
  const num = Number(val);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  
  const str = String(val).trim();
  
  // DD-MM-YYYY or DD/MM/YYYY
  const dmyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  const matchDmy = str.match(dmyRegex);
  if (matchDmy) {
    const day = parseInt(matchDmy[1], 10);
    const month = parseInt(matchDmy[2], 10) - 1;
    const year = parseInt(matchDmy[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
  const matchYmd = str.match(ymdRegex);
  if (matchYmd) {
    const year = parseInt(matchYmd[1], 10);
    const month = parseInt(matchYmd[2], 10) - 1;
    const day = parseInt(matchYmd[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  
  return null;
};

const formatDMY = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

// String normalization to facilitate matching names/surnames and headers
const normalizeText = (str: string): string => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents/diacritics
    .toLowerCase()
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();
};

async function main() {
  const excelFilePath = process.argv[2];
  if (!excelFilePath) {
    console.error("❌ ERROR: Debes proporcionar la ruta del archivo Excel.");
    console.log("Uso: npx tsx scripts/importar-vacaciones.ts <ruta_al_excel.xlsx>");
    process.exit(1);
  }

  const absolutePath = path.resolve(excelFilePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ ERROR: El archivo no existe en la ruta: ${absolutePath}`);
    process.exit(1);
  }

  console.log("==================================================");
  console.log("⚡  IMPORTADOR MASIVO DE VACACIONES DESDE EXCEL");
  console.log("==================================================");
  console.log(`📂 Archivo: ${absolutePath}`);
  console.log("--------------------------------------------------");

  try {
    // 1. Load Excel File
    console.log("⏳ Leyendo archivo Excel...");
    const workbook = XLSX.readFile(absolutePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (jsonData.length < 2) {
      console.error("❌ El archivo Excel no contiene suficientes filas de datos.");
      process.exit(1);
    }

    // Find the header row dynamically
    let headerRowIndex = -1;
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (Array.isArray(row)) {
        const rowStr = row.map(cell => normalizeText(String(cell || "")));
        // Identify header row by key columns
        if (
          rowStr.some(h => h.includes("compania")) &&
          rowStr.some(h => h.includes("nombres")) &&
          rowStr.some(h => h.includes("salida"))
        ) {
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      console.error("❌ ERROR: No se pudo identificar la fila de cabecera en el Excel.");
      console.log("Asegúrate de que el archivo contenga las columnas obligatorias como 'COMPAÑÍA', 'Nombres', 'Fecha de Salida de Vacaciones', etc.");
      process.exit(1);
    }

    console.log(`📌 Cabecera detectada en la fila ${headerRowIndex + 1} del Excel.`);
    const rawHeaders = jsonData[headerRowIndex];
    const normalizedHeaders = rawHeaders.map((cell: any) => normalizeText(String(cell || "")));

    // Find column indexes
    const compIdx = normalizedHeaders.findIndex(h => h.includes("compania"));
    const apPaternoIdx = normalizedHeaders.findIndex(h => h.includes("apellido paterno"));
    const apMaternoIdx = normalizedHeaders.findIndex(h => h.includes("apellido materno"));
    const nombresIdx = normalizedHeaders.findIndex(h => h.includes("nombres"));
    const inicioPeriodoIdx = normalizedHeaders.findIndex(h => h.includes("inicio de periodo") || h.includes("inicio del periodo") || h.includes("inicio periodo"));
    const finPeriodoIdx = normalizedHeaders.findIndex(h => h.includes("fin de periodo") || h.includes("fin del periodo") || h.includes("fin periodo"));
    const salidaIdx = normalizedHeaders.findIndex(h => h.includes("salida de vacaciones") || h.includes("salida"));
    const retornoIdx = normalizedHeaders.findIndex(h => h.includes("retorno de vacaciones") || h.includes("retorno"));
    const diasIdx = normalizedHeaders.findIndex(h => h.includes("dias"));

    if (apPaternoIdx === -1 || apMaternoIdx === -1 || nombresIdx === -1 || salidaIdx === -1 || retornoIdx === -1) {
      console.error("❌ ERROR: Faltan columnas requeridas en el archivo Excel.");
      console.log(`Columnas detectadas: ${rawHeaders.join(" | ")}`);
      console.log("Requeridos mínimos: 'Apellido Paterno', 'Apellido Materno', 'Nombres', 'Fecha de Salida de Vacaciones', 'Fecha de Retorno de Vacaciones'");
      process.exit(1);
    }

    // 2. Fetch all personas with their employment contracts (vinculos)
    console.log("⏳ Consultando colaboradores de la base de datos...");
    const { data: dbPersonas, error: dbError } = await supabase
      .from("personas")
      .select(`
        id,
        nombres,
        apellidos,
        numero_documento,
        vinculos_laborales (
          id,
          estado,
          empresa_interna_id,
          empresas_internas ( razon_social ),
          sedes ( nombre )
        )
      `);

    if (dbError || !dbPersonas) {
      console.error("❌ Error al consultar colaboradores en la base de datos:", dbError);
      process.exit(1);
    }

    console.log(`✅ Se cargaron ${dbPersonas.length} colaboradores de la base de datos.`);

    const insertRows: any[] = [];
    const skippedRows: any[] = [];

    // 3. Process each Excel row
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === "")) {
        continue;
      }

      const rowNumber = i + 1;
      const compVal = compIdx !== -1 ? String(row[compIdx] || "").trim() : "";
      const apPaterno = String(row[apPaternoIdx] || "").trim();
      const apMaterno = String(row[apMaternoIdx] || "").trim();
      const nombresVal = String(row[nombresIdx] || "").trim();
      
      const fullApellidos = `${apPaterno} ${apMaterno}`.trim();
      
      if (!apPaterno || !nombresVal) {
        skippedRows.push({
          row: rowNumber,
          error: "Falta Apellido Paterno o Nombres en el registro."
        });
        continue;
      }

      // Find person by matching name and surnames (accent and case insensitive)
      const cleanApellidos = normalizeText(fullApellidos);
      const cleanNombres = normalizeText(nombresVal);

      const matches = dbPersonas.filter(p => {
        return normalizeText(p.apellidos) === cleanApellidos && normalizeText(p.nombres) === cleanNombres;
      });

      if (matches.length === 0) {
        skippedRows.push({
          row: rowNumber,
          collaborator: `${fullApellidos}, ${nombresVal}`,
          error: "Colaborador no encontrado en la base de datos."
        });
        continue;
      }

      if (matches.length > 1) {
        skippedRows.push({
          row: rowNumber,
          collaborator: `${fullApellidos}, ${nombresVal}`,
          error: `Se encontraron múltiples colaboradores con el mismo nombre (DNI: ${matches.map(m => m.numero_documento).join(", ")}).`
        });
        continue;
      }

      const persona = matches[0];
      const activeVinculo = persona.vinculos_laborales?.find((v: any) => v.estado === "Activo");

      if (!activeVinculo) {
        skippedRows.push({
          row: rowNumber,
          collaborator: `${persona.apellidos}, ${persona.nombres} (DNI: ${persona.numero_documento})`,
          error: "El colaborador no cuenta con un contrato laboral ACTIVO."
        });
        continue;
      }

      // Parse Dates
      const rawSalida = row[salidaIdx];
      const rawRetorno = row[retornoIdx];
      
      const parsedSalida = parseExcelDate(rawSalida);
      const parsedRetorno = parseExcelDate(rawRetorno);

      if (!parsedSalida || !parsedRetorno) {
        skippedRows.push({
          row: rowNumber,
          collaborator: `${persona.apellidos}, ${persona.nombres}`,
          error: `Fechas inválidas: Salida='${rawSalida || ""}', Retorno='${rawRetorno || ""}'. Formato esperado: DD-MM-YYYY.`
        });
        continue;
      }

      // Calculate calendar days
      let dias = diasIdx !== -1 ? parseInt(row[diasIdx]) : NaN;
      if (isNaN(dias)) {
        const start = new Date(parsedSalida);
        const end = new Date(parsedRetorno);
        const diffTime = end.getTime() - start.getTime();
        dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }

      if (dias <= 0) {
        skippedRows.push({
          row: rowNumber,
          collaborator: `${persona.apellidos}, ${persona.nombres}`,
          error: `Los días de vacaciones calculados (${dias}) son inválidos (La fecha de salida debe ser anterior o igual a la de retorno).`
        });
        continue;
      }

      // Construct notes with Annual Vacation Period if available
      let notas = "";
      if (inicioPeriodoIdx !== -1 && finPeriodoIdx !== -1) {
        const inicioP = parseExcelDate(row[inicioPeriodoIdx]);
        const finP = parseExcelDate(row[finPeriodoIdx]);
        if (inicioP && finP) {
          notas = `Periodo vacacional: ${formatDMY(inicioP)} al ${formatDMY(finP)}.`;
        }
      }
      
      // Store payload
      insertRows.push({
        rowNumber,
        collaborator: `${persona.apellidos}, ${persona.nombres} (DNI: ${persona.numero_documento})`,
        payload: {
          vinculo_laboral_id: activeVinculo.id,
          fecha_inicio: parsedSalida,
          fecha_fin: parsedRetorno,
          dias_calendario: dias,
          notas: notas || "Carga masiva Excel"
        }
      });
    }

    console.log(`\n📊 ANÁLISIS DEL EXCEL COMPLETADO:`);
    console.log(`- Listos para insertar: ${insertRows.length} registros.`);
    console.log(`- Omitidos con error: ${skippedRows.length} registros.`);

    if (skippedRows.length > 0) {
      console.log("\n⚠️ DETALLE DE REGISTROS CON ERRORES (Omitidos):");
      skippedRows.forEach(sr => {
        console.log(`  • Fila ${sr.row} [${sr.collaborator || "Datos incompletos"}]: ${sr.error}`);
      });
    }

    if (insertRows.length === 0) {
      console.log("\n❌ No hay registros válidos para insertar. Proceso terminado sin cambios.");
      process.exit(0);
    }

    // 4. Perform insertions
    console.log("\n⏳ Insertando registros en 'vacaciones_historico'...");
    
    // Perform insertions in batches of 50 to optimize network calls
    const batchSize = 50;
    let successfulInserts = 0;
    
    for (let i = 0; i < insertRows.length; i += batchSize) {
      const batch = insertRows.slice(i, i + batchSize);
      const payloads = batch.map(b => b.payload);
      
      const { data, error: insertError } = await supabase
        .from("vacaciones_historico")
        .insert(payloads)
        .select("id");

      if (insertError) {
        console.error(`❌ Error insertando lote del índice ${i} al ${i + batch.length - 1}:`, insertError.message);
        // Print individual details to help debug
        batch.forEach(item => {
          console.log(`    Falló: ${item.collaborator} (${item.payload.fecha_inicio} al ${item.payload.fecha_fin})`);
        });
      } else {
        successfulInserts += data ? data.length : batch.length;
        console.log(`  ✓ Insertado lote de ${batch.length} registros (${successfulInserts}/${insertRows.length})...`);
      }
    }

    console.log("\n==================================================");
    console.log(`🎉 PROCESO FINALIZADO CON ÉXITO`);
    console.log(`- Registros procesados: ${insertRows.length + skippedRows.length}`);
    console.log(`- Registros insertados correctamente: ${successfulInserts}`);
    console.log(`- Registros omitidos con error: ${skippedRows.length}`);
    console.log("==================================================");

  } catch (err: any) {
    console.error("❌ Ocurrió un error inesperado al procesar el Excel:", err);
  }
}

main();
