import { createContext, useContext, useRef, useState } from "react";

const TransitionContext = createContext();

export function TransitionProvider({ children }) {
  const [phase, setPhase] = useState("idle"); // idle | in | out
  const callbackRef = useRef(null);

  function trigger(onPeak) {
    callbackRef.current = onPeak;
    setPhase("in");
  }

  function handleInEnd() {
    callbackRef.current?.();
    // Micro-delay para que React navegue antes de iniciar el drain
    requestAnimationFrame(() => setPhase("out"));
  }

  function handleOutEnd() {
    setPhase("idle");
  }

  return (
    <TransitionContext.Provider value={{ trigger }}>
      {children}
      {phase !== "idle" && (
        <WaveOverlay
          phase={phase}
          onInEnd={handleInEnd}
          onOutEnd={handleOutEnd}
        />
      )}
    </TransitionContext.Provider>
  );
}

export function useTransition() {
  return useContext(TransitionContext);
}

function WaveOverlay({ phase, onInEnd, onOutEnd }) {
  return (
    <div
      className={`fixed inset-0 z-[9999] ${phase === "in" ? "wave-in" : "wave-out"}`}
      onAnimationEnd={phase === "in" ? onInEnd : onOutEnd}
      style={{ willChange: "transform" }}
    >
      {/* Bloque sólido amarillo */}
      <div className="absolute inset-0 bg-[#FAFE00]" />

      {/* Ola superior — borde de entrada (aparece cuando sube) */}
      <div className="absolute -top-[58px] left-0 right-0 overflow-hidden">
        <svg
          viewBox="0 0 1440 60"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="w-full h-[60px]"
          style={{ display: "block" }}
        >
          <path
            d="M0,30 C180,60 360,0 540,30 C720,60 900,0 1080,30 C1260,60 1380,10 1440,30 L1440,60 L0,60 Z"
            fill="#FAFE00"
          />
        </svg>
      </div>

      {/* Ola inferior — borde de salida (aparece cuando drena) */}
      <div className="absolute -bottom-[58px] left-0 right-0 overflow-hidden">
        <svg
          viewBox="0 0 1440 60"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="w-full h-[60px]"
          style={{ display: "block" }}
        >
          <path
            d="M0,30 C180,0 360,60 540,30 C720,0 900,60 1080,30 C1260,0 1380,50 1440,30 L1440,0 L0,0 Z"
            fill="#FAFE00"
          />
        </svg>
      </div>

      {/* Logo centrado durante la transición */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center shadow-2xl">
            <svg className="w-7 h-7 text-[#FAFE00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <span className="text-black font-black text-lg tracking-tight">Faros Training</span>
        </div>
      </div>
    </div>
  );
}
