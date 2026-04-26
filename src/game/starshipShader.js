import * as THREE from 'three';

const VERT = /* glsl */`
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

const FRAG = /* glsl */`
uniform float iTime;
uniform vec2  iResolution;
uniform sampler2D iChannel0;

void main() {
  vec2 r = iResolution.xy;
  vec2 p = (gl_FragCoord.xy * 2.0 - r) / r.y * mat2(3.,4.,4.,-3.) / 1e2;

  vec4 S = vec4(0.0);
  vec4 C = vec4(1.,2.,3.,0.);
  vec4 W;

  float t = iTime;
  float T = 0.1 * t + p.y;

  for (float i = 0.; i < 50.; i += 1.) {
    S += (cos(W = sin(i) * C) + 1.)
         * exp(sin(i + i * T))
         / length(max(p,
             p / vec2(2.0, texture2D(iChannel0, p / exp(W.x) + vec2(i, t) / 8.).r * 40.0)
           )) / 1e4;
    p += 0.02 * cos(i * (C.xz + 8.0 + i) + T + T);
  }

  // Remap to brand palette: #34e8eb (cyan) and #ae34eb (purple)
  vec3 raw  = tanh((S * S).rgb);
  vec3 cyan = vec3(0.204, 0.910, 0.922);
  vec3 purp = vec3(0.682, 0.204, 0.922);
  float blend = raw.r / (raw.r + raw.g + 0.001);
  float lum   = length(raw);
  gl_FragColor = vec4(mix(cyan, purp, clamp(blend, 0.0, 1.0)) * lum * 1.8, 1.0);
}
`;

export function startShaderBackground(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Static noise texture for iChannel0
  const SIZE = 256;
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 256) | 0;
  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    precision: 'highp',
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      iTime:       { value: 0 },
      iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      iChannel0:   { value: tex },
    },
    depthWrite: false,
    depthTest:  false,
  });

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  const onResize = () => {
    const W = window.innerWidth, H = window.innerHeight;
    renderer.setSize(W, H);
    material.uniforms.iResolution.value.set(W, H);
  };
  window.addEventListener('resize', onResize);

  const start = performance.now();
  let animId;
  const tick = () => {
    animId = requestAnimationFrame(tick);
    material.uniforms.iTime.value = (performance.now() - start) / 1000;
    renderer.render(scene, camera);
  };
  tick();

  return () => {
    cancelAnimationFrame(animId);
    window.removeEventListener('resize', onResize);
    material.dispose();
    tex.dispose();
    renderer.dispose();
  };
}
