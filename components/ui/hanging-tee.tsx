"use client";

import * as React from "react";

const VB = "0 0 200 310";

const BODY =
  "M74,58 C86,78 114,78 126,58 C142,62 156,70 168,84 C170,90 168,96 162,102 C158,122 154,154 155,192 L156,248 C132,260 68,260 44,248 L45,192 C46,154 42,122 38,102 C32,96 30,90 32,84 C44,70 58,62 74,58 Z";
const SLEEVE_L =
  "M38,84 C26,90 14,102 10,120 C6,138 8,152 16,158 C26,162 34,154 38,142 C40,122 40,100 38,84 Z";
const SLEEVE_R =
  "M162,84 C174,90 186,102 190,120 C194,138 192,152 184,158 C174,162 166,154 162,142 C160,122 160,100 162,84 Z";
const COLLAR =
  "M74,58 C86,76 114,76 126,58 C118,50 82,50 74,58 Z";
const NECK =
  "M78,60 C88,74 112,74 122,60 C114,54 86,54 78,60 Z";
const SIDE_BODY =
  "M92,62 C90,110 94,168 92,246 C96,254 108,254 112,246 C110,168 114,110 112,62 Z";
const SIDE_SLEEVE =
  "M90,68 C84,74 78,86 76,108 C74,128 76,142 82,148 C90,152 96,146 98,134 C100,110 98,84 96,70 C94,66 92,66 90,68 Z";
const SIDE_COLLAR =
  "M94,58 C90,54 92,50 100,50 C108,50 110,54 106,58 C102,62 98,62 94,58 Z";

function mix(color: string, amount: number) {
  const keep = Math.round((1 - Math.min(1, Math.abs(amount))) * 1000) / 10;
  return `color-mix(in oklab, ${color} ${keep}%, ${amount > 0 ? "white" : "black"})`;
}

function FaceArt({
  color,
  texture,
  plate,
  plateAlign,
}: {
  color: string;
  texture?: string;
  plate?: string;
  plateAlign?: "center" | "chest";
}) {
  return (
    <div className="absolute inset-0 overflow-hidden [backface-visibility:hidden]">
      <svg viewBox={VB} preserveAspectRatio="xMidYMin meet" className="absolute inset-0 size-full overflow-visible">
        <path d={SLEEVE_L} fill={mix(color, -0.04)} />
        <path d={SLEEVE_R} fill={mix(color, -0.04)} />
        <path d={BODY} fill={color} />
        <path d={COLLAR} fill={mix(color, -0.16)} />
        <path d={NECK} fill={mix(color, -0.28)} />
        <path d={BODY} fill="none" stroke="black" strokeOpacity="0.12" strokeWidth="1.1" />
        <path d={SLEEVE_L} fill="none" stroke="black" strokeOpacity="0.14" strokeWidth="1" />
        <path d={SLEEVE_R} fill="none" stroke="black" strokeOpacity="0.14" strokeWidth="1" />
        <path d="M78,54 C68,56 54,62 40,80" fill="none" stroke="black" strokeOpacity="0.16" strokeWidth="0.8" />
        <path d="M122,54 C132,56 146,62 160,80" fill="none" stroke="black" strokeOpacity="0.16" strokeWidth="0.8" />
        <path d="M48,238 C74,248 126,248 152,238" fill="none" stroke="black" strokeOpacity="0.14" strokeWidth="1.2" />
        <path d="M56,108 C66,150 60,200 58,242" fill="none" stroke="black" strokeOpacity="0.08" strokeWidth="6" />
        <path d="M144,108 C134,150 140,200 142,242" fill="none" stroke="black" strokeOpacity="0.08" strokeWidth="6" />
        <path d="M100,86 C98,150 102,200 100,246" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="3" />
      </svg>
      {texture && (
        <span
          className="pointer-events-none absolute left-[26%] top-[21%] h-[38%] w-[48%] overflow-hidden"
          style={plateAlign === "chest" ? { left: "36%", top: "25%", height: "7%", width: "26%" } : undefined}
        >
          <img src={texture} alt="" draggable={false} className="size-full object-contain object-top" />
        </span>
      )}
      {!texture && plate && (
        <span className="pointer-events-none absolute left-[31%] top-[24%] h-[20%] w-[38%] overflow-hidden">
          <img
            src={plate}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 max-w-none"
            style={{ width: "340%", height: "340%", transform: "translate(-50%, -42%)" }}
          />
        </span>
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgb(0 0 0 / 0.28), rgb(0 0 0 / 0.06) 18%, rgb(255 255 255 / 0.1) 42%, rgb(255 255 255 / 0.04) 58%, rgb(0 0 0 / 0.1) 84%, rgb(0 0 0 / 0.3))",
          opacity: "var(--shade, 0.22)",
          mixBlendMode: "multiply",
          WebkitMaskImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${VB}'><path d='${BODY}'/><path d='${SLEEVE_L}'/><path d='${SLEEVE_R}'/></svg>`)}")`,
          maskImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${VB}'><path d='${BODY}'/><path d='${SLEEVE_L}'/><path d='${SLEEVE_R}'/></svg>`)}")`,
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }}
      />
    </div>
  );
}

function SideArt({ color }: { color: string }) {
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMin meet" className="absolute inset-0 size-full overflow-visible [backface-visibility:hidden]">
      <path d={SIDE_SLEEVE} fill={mix(color, -0.06)} />
      <path d={SIDE_BODY} fill={color} />
      <path d={SIDE_COLLAR} fill={mix(color, -0.18)} />
      <path d={SIDE_SLEEVE} fill="none" stroke="black" strokeOpacity="0.16" strokeWidth="1" />
      <path d={SIDE_BODY} fill="none" stroke="black" strokeOpacity="0.12" strokeWidth="1" />
      <path d="M88,120 C86,168 90,210 88,244" fill="none" stroke="black" strokeOpacity="0.1" strokeWidth="4" />
      <path d="M108,80 C110,140 106,200 108,244" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="2.4" />
      <path d="M80,146 C90,152 104,152 114,148" fill="none" stroke="black" strokeOpacity="0.2" strokeWidth="2" />
      <path d="M94,248 C98,254 106,254 110,248" fill="none" stroke="black" strokeOpacity="0.16" strokeWidth="2.2" />
    </svg>
  );
}

function HangerChrome({ uid }: { uid: string }) {
  return (
    <defs>
      <linearGradient id={`${uid}-chrome`} x1="96" x2="108" y1="0" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#8a8a8a" />
        <stop offset="0.35" stopColor="#fff" />
        <stop offset="0.72" stopColor="#5c5c5c" />
        <stop offset="1" stopColor="#c8c8c8" />
      </linearGradient>
    </defs>
  );
}

function HangerBar({ material, uid }: { material: "wood" | "matte"; uid: string }) {
  const bar = material === "wood" ? "#8a5a32" : "#1a1a1a";
  const hi = material === "wood" ? "rgb(255 255 255 / 0.28)" : "rgb(255 255 255 / 0.16)";
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMin meet" className="pointer-events-none absolute inset-0 size-full overflow-visible">
      <HangerChrome uid={uid} />
      <path d="M100,40 L34,74" fill="none" stroke="black" strokeOpacity="0.2" strokeWidth="9" strokeLinecap="round" transform="translate(0.8 1.6)" />
      <path d="M100,40 L166,74" fill="none" stroke="black" strokeOpacity="0.2" strokeWidth="9" strokeLinecap="round" transform="translate(0.8 1.6)" />
      <path d="M100,40 L34,74" fill="none" stroke={bar} strokeWidth="7.4" strokeLinecap="round" />
      <path d="M100,40 L166,74" fill="none" stroke={bar} strokeWidth="7.4" strokeLinecap="round" />
      <path d="M100,38 L38,70" fill="none" stroke={hi} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M100,38 L162,70" fill="none" stroke={hi} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M32,72 C30,76 34,80 40,76" fill={bar} />
      <path d="M168,72 C170,76 166,80 160,76" fill={bar} />
    </svg>
  );
}

function HangerHook({ uid }: { uid: string }) {
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMin meet" className="pointer-events-none absolute inset-0 z-20 size-full overflow-visible">
      <HangerChrome uid={`${uid}-hook`} />
      <path d="M100,4 C100,-5 111,-6 112,4 C112,10 107,14 100,20 L100,42" fill="none" stroke="black" strokeOpacity="0.28" strokeWidth="4.2" strokeLinecap="round" transform="translate(0.7 0.8)" />
      <path d="M100,4 C100,-5 111,-6 112,4 C112,10 107,14 100,20 L100,42" fill="none" stroke={`url(#${uid}-hook-chrome)`} strokeWidth="3.1" strokeLinecap="round" />
      <path d="M100,6 C100,-2 108,-2.4 108.6,4 C108.6,8 105,12 100,16" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="0.7" strokeLinecap="round" />
      <rect x="96.4" y="32" width="7.2" height="12" rx="2" fill={`url(#${uid}-hook-chrome)`} />
      <rect x="97.4" y="33.2" width="2" height="8" rx="1" fill="white" fillOpacity="0.45" />
    </svg>
  );
}

export function HangingTee({
  color,
  printTexture,
  chestTexture,
  printImage,
  hanger = "matte",
  className,
}: {
  color: string;
  printTexture?: string;
  chestTexture?: string;
  printImage?: string;
  hanger?: "wood" | "matte" | "none";
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, "");
  return (
    <div className={`absolute inset-0 [transform-style:preserve-3d] ${className ?? ""}`}>
      {hanger !== "none" && (
        <div className="absolute inset-0 [transform:translateZ(-2px)]">
          <HangerBar material={hanger} uid={uid} />
        </div>
      )}
      <div className="absolute inset-0 origin-top [transform:skewX(var(--drape,0deg))] [transform-style:preserve-3d]">
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:translateZ(7px)]">
          <FaceArt color={color} texture={printTexture} plate={printImage} />
        </div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)_translateZ(7px)]">
          <FaceArt color={color} texture={chestTexture} plateAlign="chest" />
        </div>
        <div data-face-side className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(90deg)_translateZ(4px)]">
          <SideArt color={color} />
        </div>
        <div data-face-side className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(-90deg)_translateZ(4px)]">
          <SideArt color={color} />
        </div>
      </div>
      {hanger !== "none" && (
        <div className="absolute inset-0 [transform:translateZ(14px)]">
          <HangerHook uid={uid} />
        </div>
      )}
    </div>
  );
}

export const HANGING_TEE_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${VB}'><path d='${BODY}'/><path d='${SLEEVE_L}'/><path d='${SLEEVE_R}'/></svg>`,
)}")`;
