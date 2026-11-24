/**
 * ClockDial — a circular clock used both to SET a duration and to SHOW a countdown.
 *
 * Three concentric rings live inside the clock:
 *   inner  = hours   (0–11)
 *   middle = minutes (0–59)
 *   outer  = seconds (0–59)
 *
 * Edit mode: drag (mouse/touch) on a ring to set its value, or focus a ring
 * (Tab / click its digits) and use the arrow keys, PageUp/PageDown (±5), Home/End.
 * Run mode: the rings drain as time passes and the outermost thin ring shows overall progress.
 */

import React, { useRef, useState } from "react";

export type Unit = "h" | "m" | "s";

const SIZE = 288;
const C = SIZE / 2;
const STROKE = 14;
const HIT_TOLERANCE = 13;

const RINGS: Record<Unit, { r: number; steps: number; color: string; label: string; name: string }> = {
  h: { r: 76, steps: 12, color: "#667eea", label: "hrs", name: "Hours" },
  m: { r: 100, steps: 60, color: "#8b5cf6", label: "min", name: "Minutes" },
  s: { r: 124, steps: 60, color: "#ec4899", label: "sec", name: "Seconds" },
};
const ORDER: Unit[] = ["h", "m", "s"];

export function splitSeconds(total: number) {
  const t = Math.max(0, Math.floor(total));
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

const pad = (n: number) => String(n).padStart(2, "0");

interface ClockDialProps {
  mode: "edit" | "run";
  /** edit: the selected duration; run: the remaining time — both in seconds */
  seconds: number;
  onChange?: (seconds: number) => void;
  /** run mode: fraction of the total time still remaining (1 → 0) */
  progress?: number;
  /** colour of the overall-progress ring in run mode */
  accent?: string;
  /** small text under the digits */
  caption?: string;
  /** rendered width/height in px */
  size?: number;
  disabled?: boolean;
}

export const ClockDial: React.FC<ClockDialProps> = ({
  mode,
  seconds,
  onChange,
  progress = 1,
  accent = "#667eea",
  caption,
  size = 248,
  disabled = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const ringRefs: Record<Unit, React.RefObject<SVGCircleElement>> = {
    h: useRef<SVGCircleElement>(null),
    m: useRef<SVGCircleElement>(null),
    s: useRef<SVGCircleElement>(null),
  };
  const [dragging, setDragging] = useState<Unit | null>(null);
  const [focused, setFocused] = useState<Unit | null>(null);

  const editable = mode === "edit" && !disabled && !!onChange;
  const parts = splitSeconds(seconds);

  const setUnit = (unit: Unit, value: number) => {
    const next = { ...parts, [unit]: value };
    onChange?.(next.h * 3600 + next.m * 60 + next.s);
  };

  const toLocal = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = SIZE / rect.width;
    return { x: (e.clientX - rect.left) * scale - C, y: (e.clientY - rect.top) * scale - C };
  };

  const pickRing = (x: number, y: number): Unit | null => {
    const dist = Math.hypot(x, y);
    let best: Unit | null = null;
    let bestDiff = Infinity;
    for (const unit of ORDER) {
      const diff = Math.abs(dist - RINGS[unit].r);
      if (diff < bestDiff) {
        best = unit;
        bestDiff = diff;
      }
    }
    return bestDiff <= HIT_TOLERANCE ? best : null;
  };

  const valueAt = (unit: Unit, x: number, y: number) => {
    let angle = Math.atan2(x, -y); // 0 at 12 o'clock, clockwise
    if (angle < 0) angle += 2 * Math.PI;
    const steps = RINGS[unit].steps;
    return Math.round((angle / (2 * Math.PI)) * steps) % steps;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!editable) return;
    const { x, y } = toLocal(e);
    const unit = pickRing(x, y);
    if (!unit) return;
    e.preventDefault();
    svgRef.current!.setPointerCapture(e.pointerId);
    setDragging(unit);
    ringRefs[unit].current?.focus();
    setUnit(unit, valueAt(unit, x, y));
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!editable || !dragging) return;
    const { x, y } = toLocal(e);
    setUnit(dragging, valueAt(dragging, x, y));
  };

  const endDrag = () => setDragging(null);

  const handleKeyDown = (unit: Unit, e: React.KeyboardEvent) => {
    if (!editable) return;
    const max = RINGS[unit].steps - 1;
    const deltas: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 };
    let next: number | null = null;
    if (e.key in deltas) next = Math.min(max, Math.max(0, parts[unit] + deltas[e.key]));
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = max;
    if (next === null) return;
    e.preventDefault();
    setUnit(unit, next);
  };

  const pointOnRing = (r: number, frac: number) => {
    const a = frac * 2 * Math.PI;
    return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      style={{ display: "block", margin: "0 auto", touchAction: "none", userSelect: "none", cursor: dragging ? "grabbing" : "default" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="group"
      aria-label={mode === "edit" ? "Set duration" : "Time remaining"}
    >
      {/* Clock face */}
      <circle cx={C} cy={C} r={C - 2} fill="#ffffff" stroke="#e5e7eb" strokeWidth={1} />

      {/* Outer rim: minute ticks while editing, overall progress while running */}
      {mode === "edit" ? (
        Array.from({ length: 60 }, (_, i) => {
          const major = i % 5 === 0;
          const p1 = pointOnRing(major ? 131 : 134, i / 60);
          const p2 = pointOnRing(140, i / 60);
          return (
            <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={major ? "#9ca3af" : "#d1d5db"} strokeWidth={major ? 2 : 1} strokeLinecap="round" />
          );
        })
      ) : (
        <>
          <circle cx={C} cy={C} r={137} fill="none" stroke="#eef0f6" strokeWidth={5} />
          <Arc r={137} frac={progress} color={accent} width={5} />
        </>
      )}

      {/* Hours / minutes / seconds rings */}
      {ORDER.map((unit) => {
        const ring = RINGS[unit];
        const frac = parts[unit] / ring.steps;
        const knob = pointOnRing(ring.r, frac);
        const isFocused = focused === unit && editable;
        return (
          <g key={unit}>
            <circle
              ref={ringRefs[unit]}
              cx={C}
              cy={C}
              r={ring.r}
              fill="none"
              stroke={isFocused ? ring.color : "#eef0f6"}
              strokeOpacity={isFocused ? 0.22 : 1}
              strokeWidth={STROKE}
              style={{ outline: "none", cursor: editable ? "grab" : "default" }}
              tabIndex={editable ? 0 : -1}
              role="slider"
              aria-label={ring.name}
              aria-valuemin={0}
              aria-valuemax={ring.steps - 1}
              aria-valuenow={parts[unit]}
              aria-valuetext={`${parts[unit]} ${ring.name.toLowerCase()}`}
              aria-readonly={!editable}
              onKeyDown={(e) => handleKeyDown(unit, e)}
              onFocus={() => setFocused(unit)}
              onBlur={() => setFocused((f) => (f === unit ? null : f))}
            />
            <Arc r={ring.r} frac={frac} color={ring.color} width={STROKE} animate={!dragging} />
            {editable && (
              <circle
                cx={knob.x}
                cy={knob.y}
                r={isFocused || dragging === unit ? 10 : 8}
                fill="#fff"
                stroke={ring.color}
                strokeWidth={3}
                style={{ pointerEvents: "none", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))" }}
              />
            )}
          </g>
        );
      })}

      {/* Digital read-out — each group is coloured like its ring; click to select that ring */}
      {ORDER.map((unit, i) => {
        const x = C + (i - 1) * 46;
        return (
          <g
            key={unit}
            onClick={() => editable && ringRefs[unit].current?.focus()}
            style={{ cursor: editable ? "pointer" : "default" }}
          >
            <text
              x={x}
              y={C + 4}
              textAnchor="middle"
              fontSize={30}
              fontWeight={focused === unit && editable ? 800 : 650}
              fill={RINGS[unit].color}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {pad(parts[unit])}
            </text>
            <text x={x} y={C + 22} textAnchor="middle" fontSize={10} fill="#9ca3af" letterSpacing={0.5}>
              {RINGS[unit].label}
            </text>
          </g>
        );
      })}
      <text x={C - 23} y={C + 2} textAnchor="middle" fontSize={26} fill="#9ca3af">:</text>
      <text x={C + 23} y={C + 2} textAnchor="middle" fontSize={26} fill="#9ca3af">:</text>
      {caption && (
        <text x={C} y={C + 44} textAnchor="middle" fontSize={11} fill="#6b7280">
          {caption}
        </text>
      )}
    </svg>
  );
};

const Arc: React.FC<{ r: number; frac: number; color: string; width: number; animate?: boolean }> = ({
  r,
  frac,
  color,
  width,
  animate = true,
}) => {
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, frac));
  return (
    <circle
      cx={C}
      cy={C}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={circumference}
      strokeDashoffset={circumference * (1 - clamped)}
      strokeOpacity={clamped === 0 ? 0 : 1}
      transform={`rotate(-90 ${C} ${C})`}
      style={{ pointerEvents: "none", transition: animate ? "stroke-dashoffset 0.3s ease" : "none" }}
    />
  );
};
