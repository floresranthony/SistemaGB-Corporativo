import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { Session } from "@supabase/supabase-js";

export interface DbUser {
  id: number;
  username: string;
  nombres: string;
  apellidos: string;
  correo: string;
  rol_id: number;
  activo: boolean;
  roles?: {
    id: number;
    codigo: string;
    nombre: string;
    descripcion: string;
  };
}

interface AuthContextType {
  session: Session | null;
  user: DbUser | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<DbUser | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*, roles(*)")
        .eq("correo", email)
        .eq("activo", true)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user profile from db:", error);
        return null;
      }
      return data as DbUser;
    } catch (e) {
      console.error("Profile fetch error:", e);
      return null;
    }
  };

  const handleSession = async (currentSession: Session | null) => {
    setSession(currentSession);
    if (currentSession?.user?.email) {
      const profile = await fetchProfile(currentSession.user.email);
      if (profile) {
        setUser(profile);
        const roleCode = profile.roles?.codigo || "admin";
        setRole(roleCode);
        localStorage.setItem("bax_role", roleCode);
      } else {
        // If they are in Auth but not in public.usuarios, sign out
        console.warn("User authenticated in Supabase but not found in 'usuarios' table. Logging out.");
        setUser(null);
        setRole(null);
        await supabase.auth.signOut();
      }
    } else {
      setUser(null);
      setRole(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    localStorage.removeItem("bax_role");
    setLoading(false);
  };

  const refreshUser = async () => {
    if (session?.user?.email) {
      const profile = await fetchProfile(session.user.email);
      if (profile) {
        setUser(profile);
        const roleCode = profile.roles?.codigo || "admin";
        setRole(roleCode);
        localStorage.setItem("bax_role", roleCode);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role,
        loading,
        signOut: handleSignOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
