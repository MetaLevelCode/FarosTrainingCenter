import { useState } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../../config/firebase";

const inputBase = "w-full px-4 py-3 rounded-xl text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#FAFE00] focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-zinc-600";

export default function NuevoMovimientoModal({ categorias, onClose, onGuardado }) {
  const [tipo, setTipo] = useState("ingreso");
  const [monto, setMonto] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const categoriasFiltradas = categorias.filter((c) => c.tipo === tipo);
  const esIngreso = tipo === "ingreso";

  const accentColor = esIngreso ? "emerald" : "red";
  const accentHex   = esIngreso ? "#10b981" : "#ef4444";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!categoriaId) return;
    setLoading(true);
    const cat = categorias.find((c) => c.id === categoriaId);
    try {
      await addDoc(collection(db, "movimientos"), {
        tipo,
        monto: parseFloat(monto),
        categoriaId,
        categoriaNombre: cat?.nombre || "",
        categoriaColor: cat?.color || "#888",
        descripcion,
        fecha: Timestamp.fromDate(new Date(fecha + "T12:00:00")),
        creadoEn: Timestamp.now(),
        origen: "manual",
      });
      onGuardado();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banda accent */}
        <div
          className="h-1 w-full transition-colors duration-300"
          style={{ backgroundColor: accentHex }}
        />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Registrar movimiento</h3>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Completa los campos para guardar</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all duration-200 hover:rotate-90"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Toggle ingreso / egreso */}
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl mb-6">
            {[
              { t: "ingreso", label: "↑ Ingreso" },
              { t: "egreso",  label: "↓ Egreso"  },
            ].map(({ t, label }) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTipo(t); setCategoriaId(""); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-250 ${
                  tipo === t
                    ? t === "ingreso"
                      ? "bg-emerald-500 text-white shadow-[0_3px_10px_rgba(16,185,129,0.4)]"
                      : "bg-red-500 text-white shadow-[0_3px_10px_rgba(239,68,68,0.4)]"
                    : "text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Monto */}
            <div className="animate-slide-right stagger-1">
              <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Monto</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-400 font-bold text-xl select-none">$</span>
                <input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                  min="0"
                  step="any"
                  placeholder="0"
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-2xl font-black text-gray-900 dark:text-white bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 placeholder-gray-300 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#FAFE00] focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-zinc-600"
                />
              </div>
            </div>

            {/* Categoría */}
            <div className="animate-slide-right stagger-2">
              <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Categoría</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                required
                className={inputBase}
                style={{ colorScheme: "dark" }}
              >
                <option value="" className="bg-white dark:bg-zinc-800">Selecciona una categoría</option>
                {categoriasFiltradas.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-zinc-800">{c.nombre}</option>
                ))}
              </select>
            </div>

            {/* Descripción */}
            <div className="animate-slide-right stagger-3">
              <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Descripción</label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Plan mensual Santiago Guerra"
                className={inputBase}
              />
            </div>

            {/* Fecha */}
            <div className="animate-slide-right stagger-4">
              <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                className={inputBase}
                style={{ colorScheme: "dark" }}
              />
            </div>

            {/* Botón */}
            <div className="pt-1 animate-fade-in-up stagger-5">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                style={{
                  backgroundColor: accentHex,
                  boxShadow: `0 4px 16px ${accentHex}55`,
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </span>
                ) : `Registrar ${esIngreso ? "ingreso" : "egreso"}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
