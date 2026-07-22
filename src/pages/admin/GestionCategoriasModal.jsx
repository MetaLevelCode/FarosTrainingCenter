import { useState } from "react";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../config/firebase";

const COLORES = ["#FAFE00", "#34d399", "#f87171", "#60a5fa", "#c084fc", "#fb923c", "#94a3b8"];

export default function GestionCategoriasModal({ categorias, onClose, onActualizado }) {
  const [modo, setModo] = useState(null);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(COLORES[0]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const ingresos = categorias.filter((c) => c.tipo === "ingreso");
  const egresos  = categorias.filter((c) => c.tipo === "egreso");

  async function handleCrear(e) {
    e.preventDefault();
    if (!nombre.trim() || !modo) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "categorias"), { nombre: nombre.trim(), tipo: modo, color });
      setNombre(""); setModo(null);
      onActualizado();
    } finally {
      setLoading(false);
    }
  }

  async function handleEliminar(id) {
    await deleteDoc(doc(db, "categorias", id));
    setConfirmDelete(null);
    onActualizado();
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con gradiente sutil */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Categorías</h3>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{categorias.length} categorías en total</p>
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

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {[
            { label: "Ingresos", lista: ingresos, accentText: "text-emerald-500", accentBg: "bg-emerald-500/10" },
            { label: "Egresos",  lista: egresos,  accentText: "text-red-400",    accentBg: "bg-red-500/10"    },
          ].map(({ label, lista, accentText, accentBg }) => (
            <div key={label}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-black uppercase tracking-widest ${accentText}`}>{label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${accentBg} ${accentText}`}>{lista.length}</span>
              </div>

              {lista.length === 0 && (
                <p className="text-xs text-gray-300 dark:text-zinc-600 italic px-1 py-2">Sin categorías aún</p>
              )}

              <div className="space-y-2">
                {lista.map((c, i) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl group hover:border-gray-200 dark:hover:border-zinc-600 transition-all duration-200 animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: `${c.color}25` }}
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                      </div>
                      <span className="text-sm font-semibold text-gray-800 dark:text-zinc-100">{c.nombre}</span>
                    </div>

                    {confirmDelete === c.id ? (
                      <div className="flex items-center gap-2 animate-scale-in">
                        <span className="text-xs text-gray-400 dark:text-zinc-500">¿Eliminar?</span>
                        <button onClick={() => handleEliminar(c.id)} className="text-xs font-bold text-red-500 hover:text-red-400 transition-colors px-1">Sí</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors px-1">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(c.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 dark:text-zinc-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-zinc-800 p-6">
          {modo ? (
            <form onSubmit={handleCrear} className="animate-scale-in space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${modo === "ingreso" ? "bg-emerald-400" : "bg-red-400"}`} />
                <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest">
                  Nueva categoría de {modo}
                </p>
              </div>

              <input
                autoFocus
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre de la categoría"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#FAFE00] transition-all"
              />

              {/* Selector de color */}
              <div>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Color</p>
                <div className="flex gap-2">
                  {COLORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-8 h-8 rounded-lg transition-all duration-150 hover:scale-110 flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: c }}
                    >
                      {color === c && (
                        <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={loading} className="btn-faros flex-1 py-2.5 rounded-xl text-sm">
                  {loading ? "Guardando..." : "Crear categoría"}
                </button>
                <button
                  type="button"
                  onClick={() => { setModo(null); setNombre(""); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setModo("ingreso")}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:-translate-y-0.5 transition-all duration-200"
              >
                + Ingreso
              </button>
              <button
                onClick={() => setModo("egreso")}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 hover:-translate-y-0.5 transition-all duration-200"
              >
                + Egreso
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
