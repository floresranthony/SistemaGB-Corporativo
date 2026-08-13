import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

console.log("Connecting to:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  try {
    const { data, error } = await supabase
      .from("vinculos_laborales")
      .select("*")
      .limit(1);

    if (error) {
      console.error("Error reading vinculos_laborales table:", error);
    } else {
      console.log("vinculos_laborales table sample row:", data);
      if (data && data.length > 0) {
        console.log("Columns:", Object.keys(data[0]));
      } else {
        console.log("No rows in vinculos_laborales to inspect columns.");
      }
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

checkTables();
