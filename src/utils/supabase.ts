import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "https://ezmucovctccuyfkfdbvk.supabase.co";
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getOrCreateUserForRole(role: string): Promise<number> {
  try {
    // 1. Check if the actual logged-in user matches this role
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      const { data: dbUser, error: dbUserErr } = await supabase
        .from("usuarios")
        .select("*, roles(codigo)")
        .eq("correo", session.user.email)
        .eq("activo", true)
        .maybeSingle();

      if (!dbUserErr && dbUser && dbUser.roles?.codigo === role) {
        return dbUser.id;
      }
    }

    // 2. Fallback to check or create the mock role
    const { data: dbRole, error: roleGetErr } = await supabase
      .from("roles")
      .select("id")
      .eq("codigo", role)
      .maybeSingle();

    if (roleGetErr) {
      console.error("Error fetching role:", roleGetErr);
    }

    let roleId: number;
    if (!dbRole) {
      const { data: newRole, error: roleInsErr } = await supabase
        .from("roles")
        .insert({
          codigo: role,
          nombre: role.toUpperCase(),
          descripcion: `Rol auto-generado para ${role}`,
        })
        .select("id")
        .single();

      if (roleInsErr) {
        throw roleInsErr;
      }
      roleId = newRole.id;
    } else {
      roleId = dbRole.id;
    }

    // 2. Check or create the user
    const { data: dbUser, error: userGetErr } = await supabase
      .from("usuarios")
      .select("id")
      .eq("username", role)
      .maybeSingle();

    if (userGetErr) {
      console.error("Error fetching user:", userGetErr);
    }

    if (!dbUser) {
      const { data: newUser, error: userInsErr } = await supabase
        .from("usuarios")
        .insert({
          username: role,
          password_hash: "mocked",
          nombres: "Usuario",
          apellidos: role.charAt(0).toUpperCase() + role.slice(1),
          correo: `${role}@grupobax.com`,
          rol_id: roleId,
          activo: true,
        })
        .select("id")
        .single();

      if (userInsErr) {
        throw userInsErr;
      }
      return newUser.id;
    }

    return dbUser.id;
  } catch (err) {
    console.error("Error resolving user for role:", err);
    throw err;
  }
}

