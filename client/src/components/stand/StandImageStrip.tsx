import React from "react";

type StandImageStripProps = {
  src: string;
  position?: string;
  label: string;
  className?: string;
};

/** Faixa fotográfica curta para dar contexto sem competir com o conteúdo. */
export function StandImageStrip({ src, position = "center", label, className = "" }: StandImageStripProps) {
  return (
    <div className={`stand-image-strip relative overflow-hidden rounded-xl border border-white/15 ${className}`}>
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />
      <div className="absolute inset-0 bg-gradient-to-r from-[#062b2d]/90 via-[#0a3638]/58 to-[#0a3638]/10" />
      <span className="relative flex h-full items-center px-4 text-xs font-medium text-white/90 sm:px-5">{label}</span>
    </div>
  );
}

export default StandImageStrip;
