import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useTheme } from "../../context/ThemeContext";

const navItems = [
  {
    to: "/admin/usuarios",
    label: "Usuarios",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: "/admin/finanzas",
    label: "Finanzas",
    disabled: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: "/admin/planes",
    label: "Aprobación de planes",
    disabled: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: "/admin/observatorio",
    label: "Observatorio",
    disabled: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950 transition-colors duration-300">

      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-black border-r border-gray-200 dark:border-zinc-800 flex flex-col transition-colors duration-300 animate-slide-left">

        {/* Logo */}
        <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#FAFE00] rounded-full flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_rgba(250,254,0,0.4)] transition-transform duration-200 hover:scale-110 animate-pulse-faros">
              <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-900 dark:text-[#FAFE00] font-black text-sm leading-none transition-colors duration-300">Faros Training</p>
              <p className="text-gray-400 dark:text-zinc-600 text-xs mt-0.5 transition-colors duration-300">Administración</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item, i) =>
            item.disabled ? (
              <div
                key={item.to}
                className={`nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-300 dark:text-zinc-600 cursor-not-allowed stagger-${i + 1} animate-slide-left`}
              >
                {item.icon}
                <span>{item.label}</span>
                <span className="ml-auto text-xs bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-zinc-600 px-2 py-0.5 rounded-full transition-colors duration-300">Pronto</span>
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm stagger-${i + 1} animate-slide-left ${
                    isActive
                      ? "bg-[#FAFE00] text-black font-bold shadow-[0_4px_14px_rgba(250,254,0,0.3)]"
                      : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            )
          )}
        </nav>

        <div className="p-4 space-y-1 border-t border-gray-200 dark:border-zinc-800 transition-colors duration-300">
          {/* Toggle de tema */}
          <button
            onClick={toggle}
            className="nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white w-full transition-colors duration-200"
          >
            <span className="transition-transform duration-500" style={{ transform: dark ? "rotate(0deg)" : "rotate(180deg)" }}>
              {dark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </span>
            <span>{dark ? "Tema claro" : "Tema oscuro"}</span>
            <div className={`ml-auto w-10 h-5 rounded-full transition-all duration-300 relative ${dark ? "bg-zinc-700" : "bg-[#FAFE00]"}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${dark ? "left-0.5" : "left-5"}`} />
            </div>
          </button>

          {/* Cerrar sesión */}
          <button
            onClick={handleLogout}
            className="nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 w-full transition-colors duration-200 group"
          >
            <svg className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-zinc-950 transition-colors duration-300">
        <Outlet />
      </main>
    </div>
  );
}
