import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../config/firebase";
import { useTransition } from "../context/TransitionContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { trigger } = useTransition();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      trigger(() => navigate("/admin/usuarios"));
    } catch {
      setError("Correo o contraseña incorrectos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 overflow-hidden relative">

      {/* Fondo decorativo animado */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-120px] left-[-120px] w-96 h-96 bg-[#FAFE00]/8 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-80px] right-[-80px] w-80 h-80 bg-[#FAFE00]/5 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FAFE00]/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="w-20 h-20 bg-[#FAFE00] rounded-full flex items-center justify-center mx-auto mb-5 animate-float animate-pulse-faros shadow-[0_0_40px_rgba(250,254,0,0.3)]">
            <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-[#FAFE00] tracking-tight drop-shadow-[0_0_20px_rgba(250,254,0,0.4)]">
            Faros Training
          </h1>
          <p className="text-zinc-500 text-sm mt-2 tracking-widest uppercase">Panel de Administración</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8 shadow-2xl animate-fade-in-up [animation-delay:0.1s]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="animate-slide-right stagger-1">
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Correo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#FAFE00] focus:border-transparent transition-all duration-200 hover:border-zinc-600"
                placeholder="admin@faros.com"
              />
            </div>

            <div className="animate-slide-right stagger-2">
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#FAFE00] focus:border-transparent transition-all duration-200 hover:border-zinc-600"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="animate-scale-in text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div className="animate-fade-in-up stagger-3 pt-1">
              <button type="submit" disabled={loading} className="btn-faros w-full py-3 rounded-xl text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Iniciando sesión...
                  </span>
                ) : "Ingresar"}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-zinc-700 text-xs mt-6 animate-fade-in [animation-delay:0.4s]">
          Centro Acuático Faros Training © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
