"use client";

import { useEffect, useRef, useState } from "react";
import FlameStrip from "@/components/FlameStrip";
import { subscribeFire } from "@/lib/fireTicker";

/*
 * Procedural WebGL fire. The shader draws the whole fill — body gradient,
 * morphing flame tongues and a flame-licked leading edge at `progress` — so
 * the fill advances left→right with a live, licking edge instead of a hard
 * CSS clip. Paused timers dim and freeze (the ticker stops feeding time).
 *
 * Fallback (no WebGL / context permanently lost / init error): the old CSS
 * gradient + FlameStrip look. Reduced motion: a single static frame.
 */

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// OCTAVES + optional TRACK are prepended per variant before compiling.
const FRAG_BODY = `
precision mediump float;
uniform float u_time;
uniform float u_progress;
uniform float u_dim;
uniform vec2 u_resolution;

const vec3 C_EMBER6 = vec3(0.878, 0.353, 0.118);
const vec3 C_EMBER5 = vec3(0.941, 0.463, 0.169);
const vec3 C_EMBER4 = vec3(0.965, 0.561, 0.302);
const vec3 C_AMBER4 = vec3(0.961, 0.725, 0.259);
const vec3 C_AMBER3 = vec3(1.0, 0.824, 0.478);
const vec3 C_CORE   = vec3(1.0, 0.957, 0.902);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

vec3 fireRamp(float h) {
  vec3 c = mix(C_EMBER6 * 0.6, C_EMBER6, smoothstep(0.0, 0.18, h));
  c = mix(c, C_EMBER5, smoothstep(0.15, 0.35, h));
  c = mix(c, C_EMBER4, smoothstep(0.32, 0.5, h));
  c = mix(c, C_AMBER4, smoothstep(0.46, 0.68, h));
  c = mix(c, C_AMBER3, smoothstep(0.62, 0.85, h));
  c = mix(c, C_CORE, smoothstep(0.8, 1.05, h));
  return c;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float t = mod(u_time, 300.0);
  vec2 p = vec2(uv.x * aspect, uv.y);

  // rising, wobbling turbulence
  float n = fbm(p * 2.6 + vec2(t * 0.25, -t * 1.05));
  float n2 = fbm(p * 5.5 + vec2(-t * 0.4, -t * 1.7));

  // flame-licked leading edge at the progress line — two widths: a soft
  // core ramp and a wider one that bleeds out into a glow halo
  float e = u_progress * 1.05 - 0.02 + (n - 0.5) * 0.14 * (0.5 + 0.5 * uv.y);
  float fillCore = smoothstep(e + 0.05, e - 0.09, uv.x);
  float fillGlow = smoothstep(e + 0.16, e - 0.22, uv.x);

#ifdef TRACK
  // soft-topped burning bar low, tall wisping tongues fading out above it
  float bar = smoothstep(0.42, 0.18, uv.y);
  float tongue = smoothstep(0.15, 0.85, n * 1.1 - (uv.y - 0.26) * 0.8) * smoothstep(1.0, 0.5, uv.y);
  float core = fillCore * max(bar * (0.8 + 0.4 * n2), tongue * (0.55 + 0.6 * n2));
  float glow = fillGlow * max(bar, tongue) * 0.55;
  float heat = core + glow * 0.6;

  // glowing ember riding the leading edge — tight core + soft bloom halo
  vec2 hot = vec2(clamp(e, 0.02, 0.98) * aspect, 0.26);
  float pulse = 0.75 + 0.25 * sin(t * 4.5);
  float dCore = length(p - hot);
  vec2 dGlow = vec2((p.x - hot.x) * 0.7, uv.y - hot.y);
  float gate = step(0.015, u_progress);
  heat += (exp(-dCore * dCore * 46.0) * 1.1 + exp(-dot(dGlow, dGlow) * 7.0) * 0.55) * pulse * gate;

  // embers drifting up off the fire, fading out before the top
  vec2 sp = vec2(p.x * 7.0, (uv.y - t * 0.5) * 6.0);
  vec2 cell = floor(sp);
  float ch = hash(cell);
  vec2 cp = fract(sp) - 0.5;
  float spark = smoothstep(0.16, 0.0, length(cp + vec2(sin(ch * 6.28 + t * 1.3) * 0.22, 0.0)));
  spark *= step(0.8, ch) * smoothstep(0.42, 0.0, abs(uv.x - e)) * smoothstep(1.05, 0.5, uv.y);
  heat += spark * 0.85;
#else
  // chip: soft licks filling the pill, hotter toward the bottom, gentle glow bleed
  float heat = fillCore * (0.55 + 0.5 * (1.0 - uv.y)) * (0.6 + 0.7 * n2);
  heat += fillCore * smoothstep(0.5, 1.0, n) * uv.y * 0.5;
  heat += fillGlow * 0.4 * (0.5 + 0.5 * n2);
#endif

  vec3 c = fireRamp(heat);
  float alpha = clamp(smoothstep(0.02, 0.22, heat), 0.0, 1.0);

  // paused: darker + desaturated
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 0.4 + 0.6 * u_dim) * (0.55 + 0.45 * u_dim);
  alpha *= 0.7 + 0.3 * u_dim;

  gl_FragColor = vec4(c * alpha, alpha);
}
`;

type GLState = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  uTime: WebGLUniformLocation | null;
  uProgress: WebGLUniformLocation | null;
  uDim: WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
};

// loseContext is deferred a tick so a StrictMode remount (same canvas node)
// can cancel it — restoring a deliberately-lost context is not reliable.
const pendingLose = new WeakMap<HTMLCanvasElement, ReturnType<typeof setTimeout>>();

function initGL(canvas: HTMLCanvasElement, variant: "chip" | "track"): GLState | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  }) as WebGLRenderingContext | null;
  if (!gl) return null;

  const frag =
    (variant === "track" ? "#define OCTAVES 3\n#define TRACK\n" : "#define OCTAVES 2\n") +
    FRAG_BODY;

  function compile(type: number, src: string): WebGLShader | null {
    const s = gl!.createShader(type);
    if (!s) return null;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
      if (!gl!.isContextLost()) console.error("FireCanvas shader:", gl!.getShaderInfoLog(s));
      gl!.deleteShader(s);
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  // fullscreen triangle
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  return {
    gl,
    program,
    uTime: gl.getUniformLocation(program, "u_time"),
    uProgress: gl.getUniformLocation(program, "u_progress"),
    uDim: gl.getUniformLocation(program, "u_dim"),
    uResolution: gl.getUniformLocation(program, "u_resolution"),
  };
}

export default function FireCanvas({
  progress,
  running,
  variant = "chip",
  className = "",
}: {
  progress: number;
  running: boolean;
  variant?: "chip" | "track";
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [glFailed, setGlFailed] = useState(false);
  const propsRef = useRef({ progress, running });
  propsRef.current = { progress, running };
  // kick() re-subscribes to the ticker if there's anything left to animate
  const kickRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let state: GLState | null = null;

    const dprCap = variant === "chip" ? 1.5 : 2;
    let displayed = propsRef.current.progress;
    let dim = propsRef.current.running ? 1 : 0.45;
    let unsub: (() => void) | null = null;
    let lastStaticTime = 10; // frozen shader time for static frames
    let disposed = false;

    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const w = Math.max(1, Math.round(canvas!.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas!.clientHeight * dpr));
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        state?.gl.viewport(0, 0, w, h);
      }
    }

    function draw(timeSec: number) {
      if (!state || state.gl.isContextLost()) return;
      const { gl } = state;
      gl.uniform1f(state.uTime, timeSec);
      gl.uniform1f(state.uProgress, displayed);
      gl.uniform1f(state.uDim, dim);
      gl.uniform2f(state.uResolution, canvas!.width, canvas!.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function settled() {
      const target = propsRef.current.progress;
      const dimTarget = propsRef.current.running ? 1 : 0.45;
      return (
        !propsRef.current.running &&
        Math.abs(target - displayed) < 0.002 &&
        Math.abs(dimTarget - dim) < 0.01
      );
    }

    function tick(timeSec: number, dt: number) {
      const target = propsRef.current.progress;
      // linear ramp: a 1 Hz tick's gap is covered in ~1 s, so the fill
      // advances continuously instead of stepping
      const gap = target - displayed;
      const speed = Math.max(Math.abs(gap), 0.004);
      displayed += Math.sign(gap) * Math.min(Math.abs(gap), dt * speed * 1.05);
      const dimTarget = propsRef.current.running ? 1 : 0.45;
      dim += (dimTarget - dim) * Math.min(1, dt * 6);
      resize();
      draw(timeSec);
      lastStaticTime = timeSec;
      if (settled()) {
        displayed = target;
        dim = dimTarget;
        draw(timeSec);
        unsub?.();
        unsub = null;
      }
    }

    function drawStatic() {
      displayed = propsRef.current.progress;
      dim = propsRef.current.running ? 1 : 0.45;
      resize();
      draw(lastStaticTime);
    }

    function kick() {
      if (disposed || !state) return;
      if (reduceMq.matches) {
        unsub?.();
        unsub = null;
        drawStatic();
        return;
      }
      if (!unsub && !settled()) unsub = subscribeFire(tick);
      // The shared ticker's rAF is fully suspended while the tab is hidden,
      // so a subscribed-but-idle canvas would otherwise be stuck showing
      // whichever frame happened to be on screen when it lost focus. Force
      // an immediate repaint whenever nothing else is about to redraw us.
      if (!unsub || document.hidden) drawStatic();
    }
    kickRef.current = kick;

    const onReduceChange = () => kick();
    reduceMq.addEventListener?.("change", onReduceChange);

    const ro = new ResizeObserver(() => {
      resize();
      if (!unsub) drawStatic();
    });
    ro.observe(canvas);

    function tryInit(): boolean {
      state = initGL(canvas!, variant);
      if (!state) return false;
      resize();
      kick();
      if (!unsub) drawStatic();
      return true;
    }

    const onLost = (e: Event) => {
      e.preventDefault();
      unsub?.();
      unsub = null;
    };
    const onRestored = () => {
      if (!disposed && !tryInit()) setGlFailed(true);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    const pending = pendingLose.get(canvas);
    if (pending != null) {
      clearTimeout(pending);
      pendingLose.delete(canvas);
    }
    if (!tryInit()) setGlFailed(true);

    return () => {
      disposed = true;
      kickRef.current = () => {};
      unsub?.();
      unsub = null;
      ro.disconnect();
      reduceMq.removeEventListener?.("change", onReduceChange);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      // Free the context promptly on a real unmount — iOS Safari caps live
      // WebGL contexts. A React StrictMode dev double-invoke tears down and
      // immediately remounts the SAME canvas node (still connected to the
      // DOM); calling getContext() again there returns the existing context,
      // so losing it here would orphan the remount. Only lose it once the
      // canvas has actually left the document.
      const ext = state?.gl.getExtension("WEBGL_lose_context");
      if (ext) {
        pendingLose.set(
          canvas,
          setTimeout(() => {
            pendingLose.delete(canvas);
            if (!canvas.isConnected) ext.loseContext();
          }, 50)
        );
      }
      state = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  // prop changes: wake the loop back up if it settled
  useEffect(() => {
    kickRef.current();
  }, [progress, running]);

  if (glFailed) {
    return (
      <div className={`fire-canvas ${className}`} aria-hidden>
        <div className="fire-fallback" style={{ width: `${Math.max(progress * 100, 5)}%` }}>
          <FlameStrip paused={!running} className="fire-fallback-flames" />
        </div>
      </div>
    );
  }

  return <canvas ref={canvasRef} className={`fire-canvas ${className}`} aria-hidden />;
}
