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
    const { data: roles, error: rolesError } = await supabase
      .from("roles")
      .select("*")
      .limit(5);

    if (rolesError) {
      console.error("Error reading roles table:", rolesError);
    } else {
      console.log("Roles table works. Sample roles:", roles);
    }

    const { data: usuarios, error: usersError } = await supabase
      .from("usuarios")
      .select("*")
      .limit(5);

    if (usersError) {
      console.error("Error reading usuarios table:", usersError);
    } else {
      console.log("Usuarios table works. Sample usuarios:", usuarios);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

checkTables();
