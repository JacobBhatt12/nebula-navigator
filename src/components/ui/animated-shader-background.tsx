import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShader = /* glsl */`
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */`
uniform float uTime;
uniform vec2  uResolution;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 5; i++) {
    v += a * gnoise(p);
    p  = rot * p * 2.0 + vec2(100.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 st = uv * 2.0 - 1.0;
  st.x *= uResolution.x / uResolution.y;

  float t = uTime * 0.12;

  // Deep space base
  vec3 col = vec3(0.008, 0.003, 0.028);

  // 35 aurora strips layered across the screen
  for (int i = 0; i < 35; i++) {
    float fi     = float(i);
    float yBand  = -0.95 + fi * 0.056;          // spread full height
    float speed  = 0.03 + fi * 0.007;
    float warpX  = fbm(vec2(st.x * 0.35 + t * speed,         t * 0.25 + fi * 0.63));
    float warpY  = fbm(vec2(st.x * 0.28 + t * speed * 0.7,   t * 0.18 + fi * 1.1));
    float band   = st.y - yBand + warpX * 0.72 + warpY * 0.38;
    float tighten = 22.0 + 14.0 * sin(fi * 0.41);
    float glow   = exp(-band * band * tighten);

    // Hue cycles through cyan → purple → magenta → violet
    float h   = fi * 0.19 + t * 0.22 + 0.4;
    vec3 aCol = vec3(
      0.25 + 0.55 * sin(h + 0.0),
      0.50 + 0.42 * sin(h + 2.09),
      0.80 + 0.20 * sin(h + 4.19)
    );

    float pulse = 0.10 + 0.06 * sin(t * 1.8 + fi * 0.73);
    col += glow * aCol * pulse;
  }

  // Nebula depth fog
  float neb  = fbm(st * 0.6 + t * 0.04);
  col += vec3(0.015, 0.002, 0.04) * (neb + 0.5) * 0.7;

  // Vignette — darken corners so UI stays readable
  float vig = 1.0 - length((uv - 0.5) * 1.55);
  col *= clamp(vig, 0.0, 1.0);

  // Slight tone-map so highlights don't blow out
  col = col / (col + 0.55);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function AnoAI() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    Object.assign(renderer.domElement.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
    });
    container.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime:       { value: 0 },
      uResolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
    };

    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
    scene.add(new THREE.Mesh(geo, mat));

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      uniforms.uResolution.value.set(w, h);
    };
    window.addEventListener('resize', onResize);

    let raf: number;
    const clock = new THREE.Clock();
    const tick  = () => {
      raf = requestAnimationFrame(tick);
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      mat.dispose();
      geo.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
  );
}
