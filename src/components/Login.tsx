import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { motion } from "motion/react";
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, KeyRound } from "lucide-react";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState<number>(0);

  useEffect(() => {
    const checkLockout = () => {
      const lockoutUntilStr = localStorage.getItem("bax_lockout_until");
      if (lockoutUntilStr) {
        const lockoutUntil = parseInt(lockoutUntilStr, 10);
        const now = Date.now();
        if (lockoutUntil > now) {
          const secondsLeft = Math.ceil((lockoutUntil - now) / 1000);
          setLockoutTimeLeft(secondsLeft);
          const minutes = Math.floor(secondsLeft / 60);
          const seconds = secondsLeft % 60;
          setError(
            `Demasiados intentos fallidos. Por favor, espera ${minutes}:${seconds < 10 ? "0" : ""}${seconds} minutos antes de volver a intentar.`
          );
        } else {
          localStorage.removeItem("bax_lockout_until");
          localStorage.removeItem("bax_failed_attempts");
          setLockoutTimeLeft(0);
          setError(null);
        }
      } else {
        setLockoutTimeLeft(0);
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const lockoutUntilStr = localStorage.getItem("bax_lockout_until");
    if (lockoutUntilStr) {
      const lockoutUntil = parseInt(lockoutUntilStr, 10);
      if (lockoutUntil > Date.now()) {
        setError("Inicio de sesión bloqueado temporalmente.");
        return;
      }
    }

    if (!email || !password) {
      setError("Por favor, introduce tu correo y contraseña.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        const currentAttempts = parseInt(localStorage.getItem("bax_failed_attempts") || "0", 10) + 1;
        
        if (currentAttempts >= 5) {
          const lockoutUntil = Date.now() + 30 * 60 * 1000;
          localStorage.setItem("bax_failed_attempts", currentAttempts.toString());
          localStorage.setItem("bax_lockout_until", lockoutUntil.toString());
          setLockoutTimeLeft(30 * 60);
          setError("Demasiados intentos fallidos. Has sido bloqueado por 30 minutos.");
        } else {
          localStorage.setItem("bax_failed_attempts", currentAttempts.toString());
          const remaining = 5 - currentAttempts;
          if (signInError.message === "Invalid login credentials") {
            setError(`Credenciales incorrectas. Te quedan ${remaining} intento${remaining === 1 ? "" : "s"}.`);
          } else {
            setError(`${signInError.message} (Te quedan ${remaining} intento${remaining === 1 ? "" : "s"})`);
          }
        }
      } else {
        localStorage.removeItem("bax_failed_attempts");
        localStorage.removeItem("bax_lockout_until");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError("Ocurrió un error inesperado al iniciar sesión.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans p-4">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        {/* Left Side: Brand & Presentation */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left text-white px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2.5 bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded-full text-blue-400 text-xs font-bold tracking-wide uppercase"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Acceso Corporativo
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-3"
          >
            <h1 className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Plataforma Web <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Grupo Bax S.A.C.
              </span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base font-medium max-w-md mx-auto lg:mx-0">
              Sistema unificado de administración corporativa para la gestión de personal, logística y almacenes logísticos.
            </p>
          </motion.div>
        </div>

        {/* Right Side: Glassmorphic Login Form */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
          className="lg:col-span-6 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden"
        >
          <div className="space-y-2 mb-8">
            <h2 className="font-heading text-2xl font-bold text-white tracking-tight">Iniciar Sesión</h2>
            <p className="text-xs text-slate-400 font-medium">Ingresa tus credenciales corporativas para continuar</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 text-red-200 text-xs p-3.5 rounded-lg mb-6 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-slate-300 tracking-wide">
                Correo Electrónico
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  disabled={lockoutTimeLeft > 0}
                  placeholder="ejemplo@grupobax.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/80 transition-all font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-bold text-slate-300 tracking-wide">
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={lockoutTimeLeft > 0}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/80 transition-all font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={isLoading || lockoutTimeLeft > 0}
              className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white py-3 px-4 rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Ingresar al Sistema
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
