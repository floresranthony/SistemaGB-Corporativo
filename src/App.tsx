import { HashRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "./utils/authContext";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-slate-400 font-heading font-medium animate-pulse text-xs">
            Cargando Sistema Bax...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AuthProvider>
  );
}
