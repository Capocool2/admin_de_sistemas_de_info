// frontend/src/components/JoystickControl.tsx
import React, { useRef, useState } from 'react';
import { X, Navigation } from 'lucide-react';

export interface JoystickVector {
  x: number; // -1 (Oeste) .. 1 (Este)
  y: number; // -1 (Sur)   .. 1 (Norte)
}

interface JoystickControlProps {
  onVectorChange: (vec: JoystickVector) => void;
  onClose: () => void;
  disabled?: boolean;
  maxSpeed: number;
}

const PAD_RADIUS = 56;
const KNOB_MAX_OFFSET = 38;

export const JoystickControl: React.FC<JoystickControlProps> = ({
  onVectorChange,
  onClose,
  disabled = false,
  maxSpeed,
}) => {
  const padRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const updateFromClientCoords = (clientX: number, clientY: number) => {
    if (!padRef.current || disabled) return;
    const rect = padRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > KNOB_MAX_OFFSET) {
      dx = (dx / dist) * KNOB_MAX_OFFSET;
      dy = (dy / dist) * KNOB_MAX_OFFSET;
    }

    setKnobPos({ x: dx, y: dy });
    // Invertimos dy en pantalla (+Y pantalla es Sur, +Y mapa es Norte)
    onVectorChange({
      x: Number((dx / KNOB_MAX_OFFSET).toFixed(3)),
      y: Number((-dy / KNOB_MAX_OFFSET).toFixed(3)),
    });
  };

  const resetKnob = () => {
    setIsDragging(false);
    setKnobPos({ x: 0, y: 0 });
    onVectorChange({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateFromClientCoords(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    e.preventDefault();
    updateFromClientCoords(e.clientX, e.clientY);
  };

  const throttlePercent = Math.round(
    Math.min(1, Math.hypot(knobPos.x, knobPos.y) / KNOB_MAX_OFFSET) * 100,
  );

  return (
    <div className="bg-slate-900/95 border border-slate-700/90 rounded-3xl p-3.5 shadow-2xl backdrop-blur-md select-none flex flex-col items-center gap-2.5">
      <div className="w-full flex items-center justify-between gap-4 px-1">
        <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5" />
          <span>Joystick Táctil</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          title="Ocultar joystick"
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Base circular del joystick */}
      <div
        ref={padRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={resetKnob}
        onPointerCancel={resetKnob}
        style={{ width: PAD_RADIUS * 2, height: PAD_RADIUS * 2 }}
        className={`relative rounded-full border-2 touch-none flex items-center justify-center transition ${
          disabled
            ? 'bg-rose-950/40 border-rose-700/60 opacity-60 cursor-not-allowed'
            : isDragging
            ? 'bg-slate-950 border-cyan-400 shadow-inner shadow-cyan-950/60'
            : 'bg-slate-950/90 border-slate-700 hover:border-cyan-500/70 cursor-grab'
        }`}
      >
        {/* Indicadores cardinales */}
        <span className="absolute top-1.5 text-[9px] font-bold text-slate-500 pointer-events-none">▲</span>
        <span className="absolute bottom-1.5 text-[9px] font-bold text-slate-500 pointer-events-none">▼</span>
        <span className="absolute left-2 text-[9px] font-bold text-slate-500 pointer-events-none">◀</span>
        <span className="absolute right-2 text-[9px] font-bold text-slate-500 pointer-events-none">▶</span>

        {/* Anillo guía interno */}
        <div className="w-12 h-12 rounded-full border border-dashed border-slate-800 pointer-events-none" />

        {/* Perilla móvil */}
        <div
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          }}
          className={`absolute w-11 h-11 rounded-full shadow-lg border-2 flex items-center justify-center pointer-events-none transition-colors ${
            disabled
              ? 'bg-rose-700 border-rose-400'
              : isDragging
              ? 'bg-cyan-500 border-white shadow-cyan-500/50'
              : 'bg-emerald-500 border-emerald-200 shadow-emerald-500/40'
          }`}
        >
          <div className="w-3 h-3 rounded-full bg-white/80" />
        </div>
      </div>

      <div className="text-[10px] font-mono text-slate-400">
        {disabled ? (
          <span className="text-rose-400 font-semibold">Motor bloqueado</span>
        ) : (
          <span>
            Potencia: <strong className="text-white">{throttlePercent}%</strong> • Máx{' '}
            <strong className="text-cyan-300">{maxSpeed} km/h</strong>
          </span>
        )}
      </div>
    </div>
  );
};

