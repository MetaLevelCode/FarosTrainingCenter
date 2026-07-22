import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, orderBy, writeBatch, doc } from "firebase/firestore";
import { db } from "../../config/firebase";
import NuevoMovimientoModal from "./NuevoMovimientoModal";
import GestionCategoriasModal from "./GestionCategoriasModal";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const SEED = [
  { nombre: "Planes",      tipo: "ingreso", color: "#FAFE00" },
  { nombre: "Matrículas",  tipo: "ingreso", color: "#34d399" },
  { nombre: "Eventos",     tipo: "ingreso", color: "#60a5fa" },
  { nombre: "Nómina",      tipo: "egreso",  color: "#f87171" },
  { nombre: "Servicios",   tipo: "egreso",  color: "#fb923c" },
  { nombre: "Mantenimiento", tipo: "egreso", color: "#c084fc" },
  { nombre: "Otros",       tipo: "egreso",  color: "#94a3b8" },
];

function fmt(n) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

function DonutChart({ items, total }) {
  const r = 44;
  const cx = 56;
  const cy = 56;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const segments = items.map(([cat, { monto, color }]) => {
    const pct = total > 0 ? monto / total : 0;
    const seg = { cat, monto, color, pct, offset };
    offset += pct;
    return seg;
  });

  if (total === 0) {
    return (
      <svg viewBox="0 0 112 112" className="w-28 h-28 flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={14} className="text-gray-100 dark:text-zinc-800" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 112 112" className="w-28 h-28 flex-shrink-0 -rotate-90">
      {segments.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={14}
          strokeDasharray={`${s.pct * circ} ${circ}`}
          strokeDashoffset={-s.offset * circ}
          strokeLinecap="butt"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      ))}
      {/* Hueco central */}
      <circle cx={cx} cy={cy} r={28} className="fill-white dark:fill-zinc-900" />
    </svg>
  );
}

function BarraChart({ movimientos }) {
  const hoy = new Date();
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1);
    return { label: MESES[d.getMonth()].slice(0, 3), year: d.getFullYear(), month: d.getMonth() };
  });

  const datos = meses.map(({ label, year, month }) => {
    const del = movimientos.filter((m) => {
      const f = m.fecha?.toDate?.() || new Date(m.fecha);
      return f.getFullYear() === year && f.getMonth() === month;
    });
    return {
      label,
      ingresos: del.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0),
      egresos:  del.filter((m) => m.tipo === "egreso").reduce((s, m) => s + m.monto, 0),
    };
  });

  const max = Math.max(...datos.flatMap((d) => [d.ingresos, d.egresos]), 1);
  const H = 120;

  return (
    <svg viewBox={`0 0 ${datos.length * 80} ${H + 32}`} className="w-full" preserveAspectRatio="none">
      {datos.map((d, i) => {
        const x = i * 80 + 8;
        const hI = (d.ingresos / max) * H;
        const hE = (d.egresos / max) * H;
        return (
          <g key={i}>
            {/* Barra ingresos */}
            <rect x={x} y={H - hI} width={28} height={hI} rx={4} fill="#FAFE00" opacity="0.9" />
            {/* Barra egresos */}
            <rect x={x + 32} y={H - hE} width={28} height={hE} rx={4} fill="#71717a" opacity="0.5" />
            {/* Label mes */}
            <text x={x + 28} y={H + 20} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.5">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function FinanzasPage() {
  const hoy = new Date();
  const [mesActual, setMesActual] = useState({ year: hoy.getFullYear(), month: hoy.getMonth() });
  const [movimientos, setMovimientos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalCats, setModalCats] = useState(false);

  const cargarCategorias = useCallback(async () => {
    const snap = await getDocs(collection(db, "categorias"));
    if (snap.empty) {
      const batch = writeBatch(db);
      SEED.forEach((s) => batch.set(doc(collection(db, "categorias")), s));
      await batch.commit();
      const snap2 = await getDocs(collection(db, "categorias"));
      setCategorias(snap2.docs.map((d) => ({ id: d.id, ...d.data() })));
    } else {
      setCategorias(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
  }, []);

  const cargarMovimientos = useCallback(async () => {
    const q = query(collection(db, "movimientos"), orderBy("fecha", "desc"));
    const snap = await getDocs(q);
    setMovimientos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, []);

  useEffect(() => {
    async function init() {
      await Promise.all([cargarCategorias(), cargarMovimientos()]);
      setLoading(false);
    }
    init();
  }, [cargarCategorias, cargarMovimientos]);

  function cambiarMes(delta) {
    setMesActual((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const delMes = movimientos.filter((m) => {
    const f = m.fecha?.toDate?.() || new Date(m.fecha);
    return f.getFullYear() === mesActual.year && f.getMonth() === mesActual.month;
  });

  const totalIngresos = delMes.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
  const totalEgresos  = delMes.filter((m) => m.tipo === "egreso").reduce((s, m) => s + m.monto, 0);
  const balance = totalIngresos - totalEgresos;

  // Agrupar por fecha
  const grupos = delMes.reduce((acc, m) => {
    const f = m.fecha?.toDate?.() || new Date(m.fecha);
    const key = f.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-8 animate-fade-in-up">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 md:mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Finanzas</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">{movimientos.length} movimientos registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalCats(true)}
            className="p-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all duration-200 hover:scale-105"
            title="Gestionar categorías"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => setModalNuevo(true)}
            className="btn-faros flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Registrar
          </button>
        </div>
      </div>

      {/* Selector de mes */}
      <div className="flex items-center gap-4 mb-6 animate-fade-in-up stagger-1">
        <button onClick={() => cambiarMes(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white transition-all duration-200 hover:scale-110">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h3 className="text-base font-bold text-gray-900 dark:text-white min-w-[160px] text-center">
          {MESES[mesActual.month]} {mesActual.year}
        </h3>
        <button onClick={() => cambiarMes(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white transition-all duration-200 hover:scale-110">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
        {[
          {
            label: "Ingresos", value: totalIngresos, icon: "↑",
            iconBg: "bg-emerald-100 dark:bg-emerald-500/20",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            valueColor: "text-emerald-600 dark:text-emerald-400",
            border: "border-gray-200 dark:border-zinc-800",
          },
          {
            label: "Egresos", value: totalEgresos, icon: "↓",
            iconBg: "bg-red-100 dark:bg-red-500/20",
            iconColor: "text-red-500 dark:text-red-400",
            valueColor: "text-red-500 dark:text-red-400",
            border: "border-gray-200 dark:border-zinc-800",
          },
          {
            label: "Balance", value: balance, icon: "⚖",
            iconBg: balance >= 0 ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-red-100 dark:bg-red-500/20",
            iconColor: balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
            valueColor: balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
            border: balance >= 0 ? "border-emerald-200 dark:border-emerald-800/50" : "border-red-200 dark:border-red-800/50",
          },
        ].map((s, i) => (
          <div key={s.label} className={`bg-white dark:bg-zinc-900 border ${s.border} rounded-2xl p-3 md:p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 animate-fade-in-up stagger-${i + 2}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest hidden sm:block">{s.label}</p>
              <div className={`w-7 h-7 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                <span className={`text-sm font-bold ${s.iconColor}`}>{s.icon}</span>
              </div>
            </div>
            <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest sm:hidden mb-1">{s.label}</p>
            <p className={`text-base md:text-lg font-black ${s.valueColor} leading-none`}>{fmt(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Lista de movimientos */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#FAFE00] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : Object.keys(grupos).length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-4xl mb-3">💸</p>
          <p className="text-gray-400 dark:text-zinc-500 text-sm font-medium">Sin movimientos este mes</p>
          <button onClick={() => setModalNuevo(true)} className="mt-4 text-sm text-[#b8bc00] dark:text-[#FAFE00] font-semibold hover:underline">
            Registrar el primero
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grupos).map(([fecha, items]) => (
            <div key={fecha} className="animate-fade-in-up">
              <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-3 capitalize">{fecha}</p>
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                {items.map((m, i) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-zinc-800 ${
                      i !== 0 ? "border-t border-gray-50 dark:border-zinc-800" : ""
                    }`}
                  >
                    {/* Icono tipo */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                      m.tipo === "ingreso"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400"
                    }`}>
                      {m.tipo === "ingreso" ? "↑" : "↓"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: m.categoriaColor || "#888" }}
                        />
                        <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500">{m.categoriaNombre}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {m.descripcion || "Sin descripción"}
                      </p>
                    </div>

                    {/* Monto */}
                    <p className={`text-base font-black flex-shrink-0 ${
                      m.tipo === "ingreso" ? "text-emerald-500" : "text-red-400"
                    }`}>
                      {m.tipo === "egreso" ? "−" : "+"}{fmt(m.monto)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Breakdown por categoría con donas */}
      {delMes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-fade-in-up">
          {[
            { label: "En qué ingresó", tipo: "ingreso", total: totalIngresos, textAccent: "text-emerald-600 dark:text-emerald-400" },
            { label: "En qué se gastó", tipo: "egreso",  total: totalEgresos,  textAccent: "text-red-500 dark:text-red-400" },
          ].map(({ label, tipo, total, textAccent }) => {
            const porCat = delMes
              .filter((m) => m.tipo === tipo)
              .reduce((acc, m) => {
                const k = m.categoriaNombre || "Sin categoría";
                if (!acc[k]) acc[k] = { monto: 0, color: m.categoriaColor || "#888" };
                acc[k].monto += m.monto;
                return acc;
              }, {});
            const items = Object.entries(porCat).sort((a, b) => b[1].monto - a[1].monto);

            return (
              <div key={tipo} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5">
                <p className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-4">{label}</p>
                {items.length === 0 ? (
                  <p className="text-sm text-gray-300 dark:text-zinc-600 italic">Sin movimientos</p>
                ) : (
                  <div className="flex gap-5 items-start">
                    <DonutChart items={items} total={total} />
                    <div className="flex-1 space-y-2.5 min-w-0">
                      {items.map(([cat, { monto, color }], i) => {
                        const pct = total > 0 ? Math.round((monto / total) * 100) : 0;
                        return (
                          <div key={cat} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-xs font-semibold text-gray-700 dark:text-zinc-200 truncate">{cat}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                <span className={`text-xs font-bold ${textAccent}`}>{pct}%</span>
                              </div>
                            </div>
                            <p className="text-xs font-black text-gray-900 dark:text-white pl-3.5">{fmt(monto)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Gráfica de barras colapsable */}
      <details className="mb-6 animate-fade-in-up group">
        <summary className="flex items-center justify-between cursor-pointer bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl px-5 py-4 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors duration-200 list-none select-none">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#FAFE00] inline-block" />
              <span className="w-3 h-3 rounded-sm bg-zinc-400 inline-block opacity-50" />
            </div>
            <p className="text-sm font-bold text-gray-700 dark:text-white">Historial — últimos 6 meses</p>
          </div>
          <svg className="w-4 h-4 text-gray-400 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="bg-white dark:bg-zinc-900 border border-t-0 border-gray-200 dark:border-zinc-800 rounded-b-2xl px-5 pb-5 pt-3 text-gray-900 dark:text-white">
          <BarraChart movimientos={movimientos} />
        </div>
      </details>

      {modalNuevo && (
        <NuevoMovimientoModal
          categorias={categorias}
          onClose={() => setModalNuevo(false)}
          onGuardado={cargarMovimientos}
        />
      )}

      {modalCats && (
        <GestionCategoriasModal
          categorias={categorias}
          onClose={() => setModalCats(false)}
          onActualizado={cargarCategorias}
        />
      )}
    </div>
  );
}
