import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "./showroom.css";

const HANDLE = "hayugen-heritage-grid-t-shirt-armenian-streetwear-copy";

type Angle = "print" | "front" | "side" | "threequarter" | "collar" | "fabric";

const VIEWS: Record<Angle, { src: string; label: string; body: boolean }> = {
  print: { src: "./img/showroom/saryan-print.png", label: "Back print", body: true },
  front: { src: "./img/showroom/saryan-front.png", label: "Front logo", body: true },
  side: { src: "./img/showroom/saryan-side.png", label: "Side", body: true },
  threequarter: { src: "./img/showroom/saryan-threequarter.png", label: "Three quarter", body: true },
  fabric: { src: "./img/showroom/saryan-fabric.png", label: "Fabric", body: false },
  collar: { src: "./img/showroom/saryan-collar.png", label: "Collar and label", body: false },
};

const BODY: Angle[] = ["front", "threequarter", "side", "print"];
const LINEUP: { id: string; view: Angle | null }[] = [
  { id: "left", view: "front" },
  { id: "center", view: null },
  { id: "right", view: "side" },
];
const THUMBS: Angle[] = ["print", "front", "fabric", "side", "collar"];

function stepAngle(current: Angle, dir: 1 | -1): Angle {
  const from = BODY.includes(current) ? current : "print";
  const i = BODY.indexOf(from);
  return BODY[(i + dir + BODY.length) % BODY.length];
}

export default function Showroom() {
  const [angle, setAngle] = useState<Angle>("print");
  const [inspect, setInspect] = useState(false);
  const [zoom, setZoom] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ on: false, x: 0, acc: 0, vel: 0, pinch: 0 });
  const reduce = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);

  const display = VIEWS[angle];

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const reset = () => {
      setAngle("print");
      setZoom(1);
    };

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest(".hayugen-showroom-turn, a")) return;
      drag.current.on = true;
      drag.current.x = e.clientX;
      drag.current.acc = 0;
      drag.current.vel = 0;
      el.setPointerCapture(e.pointerId);
      setInspect(true);
    };

    const onMove = (e: PointerEvent) => {
      if (!drag.current.on) return;
      const dx = e.clientX - drag.current.x;
      drag.current.x = e.clientX;
      drag.current.acc += dx;
      drag.current.vel = dx;
      if (Math.abs(drag.current.acc) > 56) {
        setAngle((cur) => stepAngle(cur, drag.current.acc > 0 ? 1 : -1));
        drag.current.acc = 0;
      }
    };

    const onUp = () => {
      drag.current.on = false;
      if (reduce) return;
      const tick = () => {
        if (Math.abs(drag.current.vel) < 0.4) return;
        drag.current.acc += drag.current.vel;
        drag.current.vel *= 0.9;
        if (Math.abs(drag.current.acc) > 56) {
          setAngle((cur) => stepAngle(cur, drag.current.acc > 0 ? 1 : -1));
          drag.current.acc = 0;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      if (!inspect) return;
      e.preventDefault();
      setZoom((z) => Math.min(1.45, Math.max(1, z + (e.deltaY < 0 ? 0.06 : -0.06))));
    };

    const onDbl = () => reset();

    const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        drag.current.pinch = dist(e.touches[0], e.touches[1]);
        setInspect(true);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !drag.current.pinch) return;
      e.preventDefault();
      const next = dist(e.touches[0], e.touches[1]);
      const ratio = next / drag.current.pinch;
      drag.current.pinch = next;
      setZoom((z) => Math.min(1.45, Math.max(1, z * ratio)));
    };
    const onTouchEnd = () => {
      drag.current.pinch = 0;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDbl);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDbl);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [inspect, reduce]);

  const pick = (next: Angle, fromRail = false) => {
    setAngle(next);
    setInspect(true);
    if (fromRail && BODY.includes(next)) setZoom(1);
  };

  return (
    <section className="hayugen-showroom" data-slot="showroom" aria-labelledby="showroom-title">
      <div className="hayugen-showroom-noise" aria-hidden />
      <div className="hayugen-showroom-sun" aria-hidden />
      <div className="hayugen-showroom-floor" aria-hidden />
      <div className="hayugen-showroom-ring" aria-hidden>
        <svg viewBox="0 0 800 180" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="show-glow" x="-40%" y="-80%" width="180%" height="260%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <ellipse cx="400" cy="78" rx="310" ry="52" fill="none" stroke="rgb(255 244 220 / 0.92)" strokeWidth="3.2" filter="url(#show-glow)" />
          <ellipse cx="400" cy="78" rx="310" ry="52" fill="none" stroke="rgb(255 255 255 / 0.35)" strokeWidth="1" />
        </svg>
      </div>
      <div className="hayugen-showroom-layout">
        <div className="hayugen-showroom-copy">
          <p className="hayugen-showroom-kicker">Signature T-shirt</p>
          <h2 id="showroom-title">Saryan</h2>
          <p>A statement piece that carries our roots forward. Culture, art, and modern streetwear — in one.</p>
          <a href={`./product.html?handle=${HANDLE}`}>Explore the T-shirt <span aria-hidden>→</span></a>
        </div>

        <div className="hayugen-showroom-stage" ref={stageRef}>
          <div className="hayugen-showroom-rail" aria-hidden />
          <div className="hayugen-showroom-lineup" role="list">
            {LINEUP.map((slot) => {
              const focused = slot.id === "center";
              const view = focused ? angle : (slot.view as Angle);
              const recede = inspect && !focused;
              return (
                <button
                  key={slot.id}
                  type="button"
                  role="listitem"
                  className="hayugen-showroom-slot"
                  data-state={focused ? "focus" : recede ? (slot.id === "left" ? "aside-left" : "aside-right") : "idle"}
                  aria-pressed={focused}
                  aria-label={focused ? `Saryan beige T-shirt, ${VIEWS[view].label.toLowerCase()}` : `${VIEWS[view].label}. Show this view.`}
                  onClick={() => pick(focused ? stepAngle(angle, 1) : view, true)}
                >
                  <span
                    className="hayugen-showroom-viewer"
                    data-zoomed={focused && zoom > 1 ? "true" : "false"}
                    style={{ "--zoom": String(zoom) } as CSSProperties}
                  >
                    <img
                      src={VIEWS[view].src}
                      alt={`Saryan beige T-shirt, ${VIEWS[view].label.toLowerCase()}`}
                      width={240}
                      height={360}
                      draggable={false}
                    />
                  </span>
                  <span className="hayugen-showroom-contact" aria-hidden />
                </button>
              );
            })}
          </div>

          <div className="hayugen-showroom-turn">
            <button type="button" aria-label="Previous angle" onClick={() => pick(stepAngle(angle, -1))}>
              ‹
            </button>
            <i aria-hidden />
            <span>360°</span>
            <i aria-hidden />
            <button type="button" aria-label="Next angle" onClick={() => pick(stepAngle(angle, 1))}>
              ›
            </button>
          </div>
          <div className="hayugen-showroom-dots" aria-hidden>
            {BODY.map((id) => (
              <span key={id} data-on={angle === id ? "true" : "false"} />
            ))}
          </div>
        </div>

        <div className="hayugen-showroom-thumbs" aria-label="Product details">
          {THUMBS.map((id) => (
            <button
              key={id}
              type="button"
              aria-label={VIEWS[id].label}
              aria-current={angle === id ? true : undefined}
              onClick={() => pick(id)}
            >
              <img src={VIEWS[id].src} alt="" width={80} height={80} />
            </button>
          ))}
        </div>
      </div>

      <figure className="hayugen-showroom-stone">
        <img src="./img/showroom/stone.png" alt="Sculptural stone marked HAYUGEN Maison" width="266" height="167" />
      </figure>
      <figure className="hayugen-showroom-rug">
        <img src="./img/showroom/rug.jpg" alt="" width="430" height="67" />
      </figure>
    </section>
  );
}
