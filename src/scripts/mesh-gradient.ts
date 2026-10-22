import { easeInOutCubic, hexToLinear, linearToOklab, oklabToLinear, prefersReducedMotion, type Vec3 } from './color';

const STOPS = 5;

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Five colour stops drift on slow Lissajous paths through a noise-warped
// domain; weights are Gaussian so the result reads as a soft mesh gradient.
const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_col[${STOPS}];

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  float t = u_time;

  vec2 warp = vec2(
    snoise(p * 0.85 + vec2(t * 0.06, -t * 0.045)),
    snoise(p * 0.85 + vec2(-t * 0.05, t * 0.07) + 4.7)
  );
  vec2 q = p + warp * 0.3;

  vec3 col = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < ${STOPS}; i++) {
    float f = float(i);
    vec2 c = vec2(
      aspect * (0.5 + 0.46 * sin(t * (0.11 + f * 0.021) + f * 1.93)),
      0.5 + 0.44 * cos(t * (0.13 + f * 0.017) + f * 2.71)
    );
    vec2 d = q - c;
    float w = exp(-dot(d, d) * 2.6) + 0.0015;
    col += u_col[i] * w;
    total += w;
  }
  col /= total;
  col = pow(col, vec3(1.0 / 2.2));

  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * (1.5 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}`;

export interface MeshOptions {
  /** Time multiplier; 0 freezes the flow. */
  speed?: number;
  /** Render scale relative to CSS pixels — the gradient is soft, so it can be low. */
  resolution?: number;
}

function normalise(hexes: string[]): Vec3[] {
  return Array.from({ length: STOPS }, (_, i) => linearToOklab(hexToLinear(hexes[i % hexes.length])));
}

export class MeshGradient {
  private gl: WebGLRenderingContext;
  private uRes: WebGLUniformLocation | null;
  private uTime: WebGLUniformLocation | null;
  private uCol: WebGLUniformLocation | null;
  private from: Vec3[];
  private to: Vec3[];
  private current: Vec3[];
  private transitionStart = 0;
  private transitionMs = 1;
  private elapsed = Math.random() * 40;
  private last = 0;
  private raf = 0;
  private inView = false;
  private destroyed = false;
  private speed: number;
  private resolution: number;
  private observers: { disconnect(): void }[] = [];

  static create(canvas: HTMLCanvasElement, palette: string[], options: MeshOptions = {}): MeshGradient | null {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    try {
      return new MeshGradient(canvas, gl, palette, options);
    } catch (error) {
      console.warn('[mesh-gradient]', error);
      return null;
    }
  }

  private constructor(
    private canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
    palette: string[],
    options: MeshOptions,
  ) {
    this.gl = gl;
    this.speed = prefersReducedMotion() ? 0 : (options.speed ?? 1);
    this.resolution = options.resolution ?? 0.5;

    const program = gl.createProgram()!;
    for (const [type, src] of [
      [gl.VERTEX_SHADER, VERT],
      [gl.FRAGMENT_SHADER, FRAG],
    ] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.uRes = gl.getUniformLocation(program, 'u_res');
    this.uTime = gl.getUniformLocation(program, 'u_time');
    this.uCol = gl.getUniformLocation(program, 'u_col');

    this.from = normalise(palette);
    this.to = this.from;
    this.current = this.from.map((c) => [...c] as Vec3);

    const resize = new ResizeObserver(() => this.resize());
    resize.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      this.inView = entry.isIntersecting;
      this.schedule();
    });
    io.observe(canvas);
    const onVisibility = () => this.schedule();
    document.addEventListener('visibilitychange', onVisibility);
    this.observers.push(resize, io, { disconnect: () => document.removeEventListener('visibilitychange', onVisibility) });

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.destroy();
      canvas.style.opacity = '0';
    });

    // The ResizeObserver's initial callback sizes and paints the first frame,
    // so construction never forces a synchronous layout.
  }

  /** Glide to a new palette (any number of hex colours, cycled to five stops). */
  setPalette(hexes: string[], durationMs = 1800): void {
    this.from = this.current.map((c) => [...c] as Vec3);
    this.to = normalise(hexes);
    this.transitionStart = performance.now();
    this.transitionMs = Math.max(1, durationMs);
    this.schedule(true);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.observers.forEach((o) => o.disconnect());
  }

  private get transitioning(): boolean {
    return performance.now() - this.transitionStart < this.transitionMs;
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr * this.resolution));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr * this.resolution));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
    this.draw();
    this.canvas.dataset.ready = '';
  }

  private schedule(force = false): void {
    if (this.destroyed || this.raf) return;
    const active = this.inView && !document.hidden && (this.speed > 0 || this.transitioning);
    if (!active && !force) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.raf = 0;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.elapsed += dt * this.speed;
    this.draw();
    if (this.inView && !document.hidden && (this.speed > 0 || this.transitioning)) {
      this.raf = requestAnimationFrame(this.frame);
    }
  };

  private draw(): void {
    if (this.destroyed) return;
    const gl = this.gl;
    const k = easeInOutCubic(Math.min(1, (performance.now() - this.transitionStart) / this.transitionMs));
    const flat = new Float32Array(STOPS * 3);
    for (let i = 0; i < STOPS; i++) {
      for (let j = 0; j < 3; j++) this.current[i][j] = this.from[i][j] + (this.to[i][j] - this.from[i][j]) * k;
      flat.set(oklabToLinear(this.current[i]), i * 3);
    }
    gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uTime, this.elapsed);
    gl.uniform3fv(this.uCol, flat);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
