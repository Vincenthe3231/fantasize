import { type RefObject, useEffect } from 'react';

type XY = { x: number; y: number };

const CONFIG = {
  friction: 0.5,
  trails: 20,
  size: 50,
  dampening: 0.25,
  tension: 0.98,
} as const;

class Oscillator {
  phase: number;
  readonly frequency = 0.0015;
  readonly amplitude = 85;
  readonly offset = 285;

  constructor() {
    this.phase = Math.random() * 2 * Math.PI;
  }

  update(): number {
    this.phase += this.frequency;
    return this.offset + Math.sin(this.phase) * this.amplitude;
  }
}

class Point {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
}

class TrailLine {
  readonly spring: number;
  readonly friction: number;
  readonly nodes: Point[];

  constructor(spring: number, pos: XY) {
    this.spring = spring;
    this.friction = CONFIG.friction + 0.01 * Math.random() - 0.002;
    this.nodes = [];
    for (let i = 0; i < CONFIG.size; i++) {
      const p = new Point();
      p.x = pos.x;
      p.y = pos.y;
      this.nodes.push(p);
    }
  }

  update(pos: XY): void {
    let e = this.spring;
    const nodes = this.nodes;
    const head = nodes[0];
    if (!head) return;
    head.vx += (pos.x - head.x) * e;
    head.vy += (pos.y - head.y) * e;
    for (let i = 0; i < nodes.length; i++) {
      const t = nodes[i];
      if (i > 0) {
        const prev = nodes[i - 1];
        t.vx += (prev.x - t.x) * e;
        t.vy += (prev.y - t.y) * e;
        t.vx += prev.vx * CONFIG.dampening;
        t.vy += prev.vy * CONFIG.dampening;
      }
      t.vx *= this.friction;
      t.vy *= this.friction;
      t.x += t.vx;
      t.y += t.vy;
      e *= CONFIG.tension;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const pts = this.nodes;
    if (pts.length < 3) return;
    let midX = pts[0].x;
    let midY = pts[0].y;
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    const limit = pts.length - 2;
    let a = 1;
    for (; a < limit; a++) {
      const e = pts[a];
      const t = pts[a + 1];
      midX = 0.5 * (e.x + t.x);
      midY = 0.5 * (e.y + t.y);
      ctx.quadraticCurveTo(e.x, e.y, midX, midY);
    }
    const e = pts[a];
    const t = pts[a + 1];
    if (e && t) {
      ctx.quadraticCurveTo(e.x, e.y, t.x, t.y);
    }
    ctx.stroke();
  }
}

/**
 * Full-viewport pointer trail overlay. Pass a ref to a fixed, pointer-events-none canvas.
 * Starts the animation loop after the first pointer move (matches classic trail demos).
 */
export function useCanvasCursor(canvasRef: RefObject<HTMLCanvasElement | null>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = false;
    let rafId = 0;
    const pos: XY = { x: 0, y: 0 };
    let lines: TrailLine[] = [];
    const hue = new Oscillator();

    const setPosFromClient = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      pos.x = clientX - rect.left;
      pos.y = clientY - rect.top;
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const initLines = () => {
      lines = [];
      for (let i = 0; i < CONFIG.trails; i++) {
        lines.push(new TrailLine(0.4 + (i / CONFIG.trails) * 0.025, pos));
      }
    };

    const render = () => {
      if (!running) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `hsla(${Math.round(hue.update())},50%,50%,0.2)`;
      ctx.lineWidth = 1;
      for (const line of lines) {
        line.update(pos);
        line.draw(ctx);
      }
      rafId = window.requestAnimationFrame(render);
    };

    const onMouseMove = (e: MouseEvent) => {
      setPosFromClient(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        e.preventDefault();
        setPosFromClient(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        setPosFromClient(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const activate = (clientX: number, clientY: number) => {
      document.removeEventListener('mousemove', onFirstMouseMove);
      document.removeEventListener('touchstart', onFirstTouchStart);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchstart', onTouchStart);
      setPosFromClient(clientX, clientY);
      initLines();
      running = true;
      render();
    };

    function onFirstMouseMove(e: MouseEvent) {
      activate(e.clientX, e.clientY);
    }

    function onFirstTouchStart(e: TouchEvent) {
      if (e.touches.length === 1) {
        activate(e.touches[0].clientX, e.touches[0].clientY);
      }
    }

    resize();
    document.addEventListener('mousemove', onFirstMouseMove);
    document.addEventListener('touchstart', onFirstTouchStart, { passive: true });
    window.addEventListener('resize', resize);

    return () => {
      running = false;
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onFirstMouseMove);
      document.removeEventListener('touchstart', onFirstTouchStart);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef, enabled]);
}
