import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ ERROR: VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no están definidos en el archivo .env.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Get CLI arguments or fallback to defaults
const email = process.argv[2] || "admin@grupobax.com";
const password = process.argv[3] || "admin123456";

async function main() {
  console.log("=================================================");
  console.log("🛠️  Creando Usuario Super Administrador en Supabase");
  console.log("=================================================");
  console.log(`Email de destino: ${email}`);
  console.log(`Contraseña: ${password}`);
  console.log("-------------------------------------------------");

  try {
    // 1. Verificar o Crear el Rol 'admin'
    console.log("🔍 Verificando rol 'admin'...");
    let { data: role, error: roleError } = await supabase
      .from("roles")
      .select("*")
      .eq("codigo", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("❌ Error al consultar roles:", roleError);
      process.exit(1);
    }

    let roleId: number;

    if (!role) {
      console.log("➕ Rol 'admin' no encontrado. Creándolo...");
      const { data: newRole, error: insertRoleError } = await supabase
        .from("roles")
        .insert({
          codigo: "admin",
          nombre: "Administrador",
          descripcion: "Super Administrador del Sistema con acceso total"
        })
        .select("*")
        .single();

      if (insertRoleError) {
        console.error("❌ Error al insertar el rol 'admin':", insertRoleError);
        process.exit(1);
      }
      role = newRole;
      console.log("✅ Rol 'admin' creado con éxito.");
    } else {
      console.log(`✅ Rol 'admin' ya existe (ID: ${role.id}).`);
    }
    roleId = role.id;

    // 2. Registrar el usuario en Supabase Auth
    console.log("\n🔑 Registrando credenciales en Supabase Auth...");
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          nombres: "Super",
          apellidos: "Admin",
          username: "admin"
        }
      }
    });

    if (authError) {
      console.warn("⚠️ Advertencia al registrar credenciales en Supabase Auth:", authError.message);
      console.log("Continuando con la inserción/actualización en la base de datos relacional...");
    } else {
      console.log("✅ Credenciales de Auth registradas/solicitadas con éxito.");
      if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
        console.log("⚠️ Nota: Supabase indica que este email ya estaba registrado.");
      }
    }

    // 3. Crear el registro en la tabla relacional 'usuarios'
    console.log("\n👤 Creando registro en la tabla relacional 'usuarios'...");
    
    // Verificar si ya existe en la base de datos por correo
    let { data: existingDbUser, error: checkUserError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("correo", email)
      .maybeSingle();

    if (checkUserError) {
      console.error("❌ Error al verificar usuario por correo:", checkUserError);
      process.exit(1);
    }

    if (!existingDbUser) {
      // Verificar si ya existe por username 'admin'
      const { data: userByUsername, error: checkUsernameError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("username", "admin")
        .maybeSingle();

      if (checkUsernameError) {
        console.error("❌ Error al verificar usuario por username:", checkUsernameError);
        process.exit(1);
      }

      if (userByUsername) {
        console.log(`🔄 Encontrado usuario existente con username 'admin'. Actualizando correo a '${email}' y rol a 'admin'...`);
        const { data: updatedUser, error: updateError } = await supabase
          .from("usuarios")
          .update({
            correo: email,
            rol_id: roleId,
            activo: true
          })
          .eq("id", userByUsername.id)
          .select("*")
          .single();

        if (updateError) {
          console.error("❌ Error al actualizar el usuario existente:", updateError);
          process.exit(1);
        }
        existingDbUser = updatedUser;
        console.log("✅ Usuario actualizado con éxito.");
      }
    }

    if (existingDbUser) {
      console.log(`✅ El registro de usuario para ${email} ya existe en la tabla 'usuarios' (ID: ${existingDbUser.id}).`);
      
      // Actualizar el rol si es necesario
      if (existingDbUser.rol_id !== roleId) {
        console.log(`🔄 Actualizando rol del usuario existente a 'admin' (ID: ${roleId})...`);
        const { error: updateError } = await supabase
          .from("usuarios")
          .update({ rol_id: roleId })
          .eq("id", existingDbUser.id);
        
        if (updateError) {
          console.error("❌ Error al actualizar rol del usuario:", updateError);
        } else {
          console.log("✅ Rol actualizado con éxito.");
        }
      }
    } else {
      const { data: newDbUser, error: insertUserError } = await supabase
        .from("usuarios")
        .insert({
          username: "admin",
          password_hash: "supabase_auth", // Marcador de posición
          nombres: "Super",
          apellidos: "Admin",
          correo: email,
          rol_id: roleId,
          activo: true
        })
        .select("*")
        .single();

      if (insertUserError) {
        console.error("❌ Error al crear registro en la tabla 'usuarios':", insertUserError);
        process.exit(1);
      }

      console.log(`✅ Registro de usuario creado con éxito en la tabla 'usuarios' (ID: ${newDbUser.id}).`);
    }

    console.log("\n=================================================");
    console.log("🚀 CONFIGURACIÓN COMPLETADA CON ÉXITO");
    console.log("=================================================");
    console.log("💡 Recuerda desactivar la confirmación de correo en");
    console.log("   Supabase: Auth -> Providers -> Email -> Confirm email: OFF");
    console.log("   para poder loguearte inmediatamente sin verificar.");
    console.log("=================================================");

  } catch (err) {
    console.error("❌ Ocurrió un error inesperado:", err);
  }
}

main();
