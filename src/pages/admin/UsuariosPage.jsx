import { useEffect, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";

const FILTROS = ["Todos", "Estudiante", "Profesor"];

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState(null);
  const btnRefs = useRef([]);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const idx = FILTROS.indexOf(filtro);
    const btn = btnRefs.current[idx];
    if (btn) setPillStyle({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [filtro]);

  // Medir posición inicial al montar
  useEffect(() => {
    const btn = btnRefs.current[0];
    if (btn) setPillStyle({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, []);

  useEffect(() => {
    async function cargar() {
      try {
        const snap = await getDocs(collection(db, "usuarios"));
        setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  const filtrados = usuarios.filter((u) => {
    const coincideTipo = filtro === "Todos" || u.Rol === filtro;
    const termino = busqueda.toLowerCase();
    const coincideBusqueda =
      !termino ||
      u.NombreCompleto?.toLowerCase().includes(termino) ||
      String(u.Documento)?.includes(termino);
    return coincideTipo && coincideBusqueda;
  });

  function telefono(u) {
    return u.Telefono || u.NumeroContacto || "—";
  }

  return (
    <div className="p-4 md:p-8 animate-fade-in-up">

      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight transition-colors duration-300">
          Usuarios
        </h2>
        <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1 transition-colors duration-300">
          {usuarios.length} usuarios registrados
        </p>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        {[
          { label: "Total", value: usuarios.length, color: "text-gray-900 dark:text-white" },
          { label: "Estudiantes", value: usuarios.filter(u => u.Rol === "Estudiante").length, color: "text-[#FAFE00]" },
          { label: "Profesores", value: usuarios.filter(u => u.Rol === "Profesor").length, color: "text-blue-400" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-3 md:p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 animate-fade-in-up stagger-${i + 1}`}
          >
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1 transition-colors duration-300">{stat.label}</p>
            <p className={`text-2xl md:text-3xl font-black ${stat.color} transition-colors duration-300`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 animate-fade-in-up stagger-4">
        <div className="relative flex-1 group">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 transition-colors duration-200 group-focus-within:text-[#FAFE00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o documento..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#FAFE00] focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-zinc-600"
          />
        </div>
        <div className="relative flex bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-1 rounded-xl transition-colors duration-300">
          {/* Pill deslizante */}
          <div
            className="absolute top-1 bottom-1 rounded-lg bg-[#FAFE00] shadow-[0_2px_10px_rgba(250,254,0,0.35)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ left: pillStyle.left, width: pillStyle.width }}
          />
          {FILTROS.map((f, i) => (
            <button
              key={f}
              ref={(el) => (btnRefs.current[i] = el)}
              onClick={() => setFiltro(f)}
              className={`relative z-10 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors duration-200 ${
                filtro === f
                  ? "text-black"
                  : "text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-white"
              }`}
            >
              {f === "Profesor" ? "Profesores" : f === "Estudiante" ? "Estudiantes" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 border-4 border-[#FAFE00] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 dark:text-zinc-600 animate-pulse">Cargando usuarios...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-24 animate-scale-in">
          <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-gray-400 dark:text-zinc-600 text-sm">No se encontraron usuarios</p>
        </div>
      ) : (
        <>
          {/* Tabla — solo desktop */}
          <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-sm transition-colors duration-300 animate-fade-in-up stagger-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                  <th className="text-left px-6 py-4 font-semibold text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Nombre</th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Rol</th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Documento</th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Teléfono</th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Clases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {filtrados.map((u, i) => (
                  <tr
                    key={u.id}
                    onClick={() => setSeleccionado(u)}
                    className="hover:bg-gray-50 dark:hover:bg-zinc-800/70 cursor-pointer transition-all duration-150 animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {u.Foto ? (
                          <img src={u.Foto} className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100 dark:ring-zinc-800 hover:ring-[#FAFE00] transition-all duration-200" alt="" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#FAFE00] flex items-center justify-center text-xs text-black font-black hover:scale-110 transition-transform duration-200">
                            {u.NombreCompleto?.[0] || "?"}
                          </div>
                        )}
                        <span className="font-semibold text-gray-900 dark:text-white">{u.NombreCompleto || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                        u.Rol === "Profesor"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "bg-[#FAFE00] text-black dark:bg-[#FAFE00]/15 dark:text-[#FAFE00]"
                      }`}>{u.Rol || "—"}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-zinc-400">{u.Documento || "—"}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-zinc-400">{telefono(u)}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-zinc-400">
                      {u.Rol === "Estudiante" ? `${u.ClasesDisponibles ?? "—"} disponibles` : `${u.ClasesDadas ?? "—"} dadas`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — solo móvil */}
          <div className="md:hidden space-y-3 animate-fade-in-up stagger-5">
            {filtrados.map((u, i) => (
              <div
                key={u.id}
                onClick={() => setSeleccionado(u)}
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all duration-150 hover:shadow-md animate-fade-in-up"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {u.Foto ? (
                  <img src={u.Foto} className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 dark:ring-zinc-700 flex-shrink-0" alt="" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#FAFE00] flex items-center justify-center text-base text-black font-black flex-shrink-0">
                    {u.NombreCompleto?.[0] || "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white truncate">{u.NombreCompleto || "—"}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{u.Documento || "—"} · {telefono(u)}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    u.Rol === "Profesor"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "bg-[#FAFE00] text-black dark:bg-[#FAFE00]/15 dark:text-[#FAFE00]"
                  }`}>{u.Rol || "—"}</span>
                  <span className="text-xs text-gray-400 dark:text-zinc-500">
                    {u.Rol === "Estudiante" ? `${u.ClasesDisponibles ?? "—"} cls` : `${u.ClasesDadas ?? "—"} dadas`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal de detalle */}
      {seleccionado && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setSeleccionado(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                {seleccionado.Foto ? (
                  <img src={seleccionado.Foto} className="w-14 h-14 rounded-full object-cover ring-4 ring-[#FAFE00]/30" alt="" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[#FAFE00] flex items-center justify-center text-xl text-black font-black shadow-[0_0_20px_rgba(250,254,0,0.3)]">
                    {seleccionado.NombreCompleto?.[0] || "?"}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white transition-colors duration-300">{seleccionado.NombreCompleto}</h3>
                  <span className={`inline-flex mt-1 px-3 py-0.5 rounded-full text-xs font-semibold ${
                    seleccionado.Rol === "Profesor"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "bg-[#FAFE00] text-black dark:bg-[#FAFE00]/15 dark:text-[#FAFE00]"
                  }`}>
                    {seleccionado.Rol || "—"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSeleccionado(null)}
                className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Campos */}
            <div className="space-y-0 rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-800 transition-colors duration-300">
              {[
                { label: "Documento", value: seleccionado.Documento },
                { label: "Teléfono", value: telefono(seleccionado) },
                ...(seleccionado.Rol === "Estudiante" ? [
                  { label: "EPS", value: seleccionado.Eps },
                  { label: "Contacto de emergencia", value: seleccionado.ContactoEmergencia },
                  { label: "Clases disponibles", value: seleccionado.ClasesDisponibles },
                  { label: "Clases recibidas", value: seleccionado.ClasesRecibidas },
                  { label: "Plan actual", value: seleccionado.PlanActual },
                ] : [
                  { label: "Clases dadas", value: seleccionado.ClasesDadas },
                ]),
              ].map(({ label, value }, i) => (
                <div
                  key={label}
                  className={`flex justify-between items-center px-4 py-3 transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-zinc-800 ${
                    i !== 0 ? "border-t border-gray-100 dark:border-zinc-800" : ""
                  }`}
                >
                  <span className="text-sm text-gray-400 dark:text-zinc-500 transition-colors duration-300">{label}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white transition-colors duration-300">{value ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
