import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from '../vendor/GLTFExporter.js';

/* ============================== palette ============================== */
const P = {
  bg: 0xb9dcff,
  skin: 0xffe3d0,
  skinShadow: 0xf5c8b0,
  hair: 0xf6b8dd,        // pastel pink
  hairDark: 0xdd8fc4,
  hairLight: 0xffd7ee,
  eyeBase: 0x3f8fe8,     // devin blue
  eyeDeep: 0x1d4f96,
  lash: 0x4a3040,
  brow: 0xc47aa8,
  mouthIn: 0x9c3d4a,
  tongue: 0xef8a95,
  blush: 0xff9db4,
  top: 0xffffff,
  collar: 0x5d83d6,
  ribbon: 0xff7fae,
  skirt: 0x8aa6ef,
  skirtDark: 0x5473c0,
  sock: 0xffffff,
  shoe: 0xf08bb4,
  shoeSole: 0xc9688f,
  outline: 0x4a3a52,
  accent: 0x8fb4ff,
};

/* ============================== helpers ============================== */
let gradientMap;
function makeGradientMap() {
  const tones = new Uint8Array([90, 150, 210, 255]);
  const tex = new THREE.DataTexture(tones, tones.length, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({color, gradientMap, ...opts});
}
function flat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({color, ...opts});
}

// displaced-normal outline: clone geometry, push verts along normals
function outlineGeom(geom, thick) {
  const g = geom.clone();
  const pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i,
      pos.getX(i) + nor.getX(i) * thick,
      pos.getY(i) + nor.getY(i) * thick,
      pos.getZ(i) + nor.getZ(i) * thick);
  }
  return g;
}
function addOutline(mesh, thick = 0.55, color = P.outline) {
  const o = new THREE.Mesh(outlineGeom(mesh.geometry, thick), flat(color, {side: THREE.BackSide}));
  o.raycast = () => {};
  mesh.add(o);
  return o;
}
function mesh(geom, mat, {x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, outline = 0, oc} = {}) {
  const m = new THREE.Mesh(geom, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  if (outline) addOutline(m, outline, oc);
  return m;
}

/* tapered curved strand: cone pointing down, flattened, bent */
function strand(r0, len, flat_ = 0.45, bendX = 0, bendZ = 0, r1 = 0.0, segs = 10) {
  const g = new THREE.ConeGeometry(r0, len, 10, segs, true);
  g.translate(0, -len / 2, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = -y / len;                 // 0 top → 1 tip
    // taper toward r1 (r1<1 sharpens tip beyond cone's default point if >0 keeps blunt)
    const pinch = 1 + (r1 - 0) * t;
    pos.setX(i, pos.getX(i) * pinch + bendX * t * t);
    pos.setZ(i, pos.getZ(i) * flat_ * pinch + bendZ * t * t);
    pos.setY(i, y);
  }
  // tip shading — darken toward the tip for depth (vertex colors)
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(-pos.getY(i) / len, 0, 1);
    const d = 1 - THREE.MathUtils.smoothstep(t, 0.55, 1) * 0.32;
    colors[i * 3] = d; colors[i * 3 + 1] = d * 0.93; colors[i * 3 + 2] = d * 0.985;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ============================== eyes ============================== */
function irisTexture() {
  return canvasTex(512, 768, (c, w, h) => {
    const cx = w / 2, cy = h / 2;
    // iris base
    const grad = c.createRadialGradient(cx, cy * 0.75, 30, cx, cy, 360);
    grad.addColorStop(0, '#aee2ff');
    grad.addColorStop(0.35, '#4f9cf0');
    grad.addColorStop(0.78, '#20509e');
    grad.addColorStop(1, '#123468');
    c.fillStyle = grad;
    c.beginPath(); c.ellipse(cx, cy, 250, 372, 0, 0, Math.PI * 2); c.fill();
    // inner dark ring
    c.strokeStyle = 'rgba(12,32,74,0.85)'; c.lineWidth = 16;
    c.beginPath(); c.ellipse(cx, cy, 240, 360, 0, 0, Math.PI * 2); c.stroke();
    // pupil
    c.fillStyle = '#0d1f3d';
    c.beginPath(); c.ellipse(cx, cy - 30, 92, 150, 0, 0, Math.PI * 2); c.fill();
    // upper shadow (under lash)
    const sh = c.createLinearGradient(0, 0, 0, h * 0.62);
    sh.addColorStop(0, 'rgba(10,25,60,0.72)');
    sh.addColorStop(0.55, 'rgba(10,25,60,0.25)');
    sh.addColorStop(1, 'rgba(10,25,60,0)');
    c.fillStyle = sh;
    c.beginPath(); c.ellipse(cx, cy, 250, 372, 0, 0, Math.PI * 2); c.fill();
    // bottom light bounce
    const lb = c.createRadialGradient(cx, cy + 280, 10, cx, cy + 260, 210);
    lb.addColorStop(0, 'rgba(160,220,255,0.85)');
    lb.addColorStop(1, 'rgba(160,220,255,0)');
    c.fillStyle = lb;
    c.beginPath(); c.ellipse(cx, cy, 250, 372, 0, 0, Math.PI * 2); c.fill();
    // highlights
    c.fillStyle = 'rgba(255,255,255,0.98)';
    c.beginPath(); c.ellipse(cx - 95, cy - 165, 62, 92, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(cx + 88, cy + 60, 30, 44, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.65)';
    c.beginPath(); c.ellipse(cx + 128, cy - 60, 14, 20, 0, 0, Math.PI * 2); c.fill();
    // sparkle dust — tiny glints lower left/right
    c.fillStyle = 'rgba(220,245,255,0.85)';
    for (const [dx, dy, r] of [[-130, 120, 9], [-60, 190, 7], [120, 150, 8], [-30, 90, 5]]) {
      c.beginPath(); c.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); c.fill();
    }
  });
}
const irisTex = irisTexture();

function buildEye(side /* -1 left, +1 right (viewer) */) {
  const g = new THREE.Group();
  // sclera
  const white = mesh(new THREE.CircleGeometry(1, 48), flat(0xffffff));
  white.scale.set(6.0, 8.2, 1);
  white.position.z = -0.25;
  g.add(white);
  // iris
  const iris = mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({map: irisTex, transparent: true}));
  iris.scale.set(5.6, 7.6, 1);
  iris.position.z = 0;
  g.add(iris);
  // upper lash — bold winged line
  const lashShape = new THREE.Shape();
  lashShape.moveTo(-6.2, -0.5);
  lashShape.bezierCurveTo(-6.4, 3.8, -4.0, 7.0, 0, 7.6);
  lashShape.bezierCurveTo(4.2, 7.0, 6.2, 4.0, 6.6, 0.6);   // outer tip
  lashShape.bezierCurveTo(7.5, 0.4, 7.9, -0.5, 7.8, -1.3); // small flick
  lashShape.bezierCurveTo(6.9, -0.9, 6.3, -0.8, 5.7, -1.0);
  lashShape.bezierCurveTo(5.0, 2.8, 3.1, 5.6, 0, 6.1);
  lashShape.bezierCurveTo(-3.3, 5.6, -5.2, 2.5, -6.2, -0.5);
  const lash = mesh(new THREE.ShapeGeometry(lashShape, 24), flat(P.lash));
  lash.position.z = 0.5;
  g.add(lash);
  // lower lash hint
  const lowShape = new THREE.Shape();
  lowShape.moveTo(-5.4, -3.4);
  lowShape.bezierCurveTo(-3.0, -7.6, 3.0, -8.2, 5.6, -3.9);
  lowShape.bezierCurveTo(3.4, -7.0, -2.8, -6.5, -5.4, -3.4);
  const low = mesh(new THREE.ShapeGeometry(lowShape, 16), flat(P.skinShadow));
  low.position.z = 0.45;
  g.add(low);
  // lid crease

  // inner corner
  const corner = mesh(new THREE.CircleGeometry(0.55, 12), flat(P.skinShadow));
  corner.position.set(-side * 6.4, -1.2, 0.4);
  g.add(corner);
  g.scale.x = side;
  return g;
}

function buildBrow(side) {
  const s = new THREE.Shape();
  s.moveTo(-4.6, -0.6);
  s.bezierCurveTo(-2.0, 1.5, 2.6, 1.7, 5.0, 0.1);
  s.bezierCurveTo(2.6, 0.9, -2.0, 0.7, -4.6, -0.6);
  const m = mesh(new THREE.ShapeGeometry(s, 12), flat(P.brow));
  m.scale.x = side;
  return m;
}

function blushTexture() {
  return canvasTex(256, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, 110);
    g.addColorStop(0, 'rgba(255,122,168,0.62)');
    g.addColorStop(1, 'rgba(255,140,175,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // streaks
    c.strokeStyle = 'rgba(255,105,160,0.8)'; c.lineWidth = 7; c.lineCap = 'round';
    for (const x of [-26, 0, 26]) {
      c.beginPath();
      c.moveTo(w / 2 + x - 6, h / 2 - 22); c.lineTo(w / 2 + x + 6, h / 2 + 22);
      c.stroke();
    }
  });
}
const blushTex = blushTexture();

/* ============================== head ============================== */
function buildHead() {
  const head = new THREE.Group();
  head.position.set(0, 90, 0);
  head.rotation.z = 0.032;   // gentle charm tilt — hair tilts the same

  const g = new THREE.SphereGeometry(20, 80, 60);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // cranium wider than jaw
    const t = THREE.MathUtils.clamp((-y - 1) / 15, 0, 1);   // jaw taper
    x *= 1 - 0.42 * t;
    z *= 1 - 0.28 * t;
    if (z > 0) z += 1.6 * t;                                 // chin nudge
    y -= 1.2 * t;                                            // lengthen chin slightly
    // slight forehead flatten
    if (y > 10 && z > 0) z *= 0.97;
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  const skull = mesh(g, toon(P.skin), {sx: 1.12, sy: 1.06, sz: 1.04, outline: 0.5});
  head.add(skull);

  // ears
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(2.7, 20, 16), toon(P.skin),
      {x: s * 18.6, y: -2.4, z: -1.0, sy: 1.2, sz: 0.42, outline: 0.3});
    head.add(ear);
  }

  // eyes
  for (const s of [-1, 1]) {
    const eye = buildEye(s);
    eye.position.set(s * 8.8, 0.4, 19.3);
    eye.rotation.y = s * 0.30;
    eye.rotation.x = -0.07;
    eye.scale.setScalar(0.98);
    head.add(eye);
    const brow = buildBrow(-s);
    brow.position.set(s * 8.2, 12.6, 17.4);
    brow.rotation.y = s * 0.34;
    brow.rotation.z = -s * 0.06;
    head.add(brow);
    const bl = mesh(new THREE.PlaneGeometry(7.0, 3.4), new THREE.MeshBasicMaterial({map: blushTex, transparent: true, depthWrite: false}));
    bl.position.set(s * 12.9, -3.2, 18.8);
    bl.rotation.y = s * 0.6;
    head.add(bl);
  }

  // nose — tiny
  head.add(mesh(new THREE.SphereGeometry(0.27, 8, 8), flat(P.skinShadow), {x: 0, y: -4.8, z: 20.05}));

  // mouth — open smile
  const mouth = new THREE.Group();
  mouth.position.set(0, -9.2, 19.4);
  const mshape = new THREE.Shape();
  mshape.moveTo(-3.2, 0.9);
  mshape.bezierCurveTo(-3.0, -2.0, -1.6, -3.4, 0, -3.4);
  mshape.bezierCurveTo(1.6, -3.4, 3.0, -2.0, 3.2, 0.9);
  mshape.bezierCurveTo(1.6, 0.2, -1.6, 0.2, -3.2, 0.9);
  mouth.add(mesh(new THREE.ShapeGeometry(mshape, 20), flat(P.mouthIn)));
  const tshape = new THREE.Shape();
  tshape.moveTo(-2.0, -1.3);
  tshape.bezierCurveTo(-1.0, -3.0, 1.0, -3.0, 2.0, -1.3);
  tshape.bezierCurveTo(1.0, -2.1, -1.0, -2.1, -2.0, -1.3);
  const tongue = mesh(new THREE.ShapeGeometry(tshape, 16), flat(P.tongue));
  tongue.position.z = 0.15;
  mouth.add(tongue);
  mouth.rotation.x = -0.18;
  head.add(mouth);

  return head;
}

/* ============================== hair ============================== */
function hairMat() { return toon(P.hair); }
function hairMatStrand() { return toon(P.hair, {vertexColors: true}); }

function buildHair() {
  const hair = new THREE.Group();
  hair.position.set(0, 90, 0);
  hair.rotation.z = 0.032;

  // scalp volume — front bottom carved into a hairline so the face stays open
  const sg = new THREE.SphereGeometry(21.6, 72, 52);
  const sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    let x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
    const r = Math.sqrt(x * x + y * y + z * z) || 1;
    const nx = x / r, ny = y / r, nz = z / r;
    // taper nape, push bulk to back
    if (ny < -0.15) { x *= 0.92; z *= 0.92; }
    z -= 0.8;
    // hairline: on the front hemisphere, lift the bottom edge above the eyes
    if (nz > 0.35 && ny < 0.42) {
      const edge = 9.5 - nx * nx * 4.5;         // hairline dips to ~5 at temples, ~9.5 center
      const lift = THREE.MathUtils.clamp((edge - y) / 9, 0, 1);
      y += (edge - y) * lift * 0.95;
      z -= lift * 2.2;                           // tuck the rim inward
    }
    sp.setXYZ(i, x, y, z);
  }
  sg.computeVertexNormals();
  const scalp = mesh(sg, hairMat(), {sx: 1.13, sy: 1.10, sz: 1.10, y: 1.5, z: -1.5, outline: 0.5, oc: P.hairDark});
  head_band(scalp);
  hair.add(scalp);

  // bangs — fan of curved locks across forehead, tips above the eyes
  const bangXs = [-14.5, -11.4, -8.2, -5, -1.8, 1.6, 4.8, 8, 11.2, 14.2];
  bangXs.forEach((bx, i) => {
    const len = 7.0 + ((i * 2) % 4) * 1.2 + Math.abs(bx) * 0.14;
    const sway = bx * 0.5;
    const b = mesh(strand(2.75, len, 0.42, sway, 3.4 + Math.abs(bx) * 0.20),
      hairMatStrand(), {x: bx, y: 15.8, z: 13.2 - Math.abs(bx) * 0.34, rx: 0.09, ry: -bx * 0.03, outline: 0.3, oc: P.hairDark});
    hair.add(b);
  });

  // temple baby-hair curls — thin sweeps hugging the upper cheek
  for (const s of [-1, 1]) {
    const curl = mesh(strand(1.15, 9.5, 0.55, s * 2.2, 1.4),
      hairMatStrand(), {x: s * 16.6, y: 9.5, z: 14.6, ry: s * 0.55, rx: 0.14, outline: 0.2, oc: P.hairDark});
    hair.add(curl);
  }

  // face-framing side locks
  for (const s of [-1, 1]) {
    const lock = mesh(strand(3.5, 28, 0.5, s * 4.5, 2.5),
      hairMatStrand(), {x: s * 18.8, y: 13, z: 8.4, ry: s * 0.42, outline: 0.35, oc: P.hairDark});
    hair.add(lock);
    const lock2 = mesh(strand(2.6, 19, 0.5, s * 3.4, 2.0),
      hairMatStrand(), {x: s * 20.2, y: 10, z: 4.6, ry: s * 0.75, outline: 0.32, oc: P.hairDark});
    hair.add(lock2);
  }

  // back hair — skull-hugging mass + long strands past the shoulders
  const back = new THREE.Group();
  const bg = new THREE.SphereGeometry(21.2, 72, 52);
  const bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    let x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    const t = THREE.MathUtils.clamp((-y + 2) / 20, 0, 1);
    x *= 1 + 0.22 * t;                    // widen toward tips
    z *= 1 - 0.30 * t;
    y -= 24 * t;                          // stretch down the back
    if (z > 0) z *= 0.25;                 // pull to the back
    z -= 2.5;
    // jagged hem — wave the bottom edge into soft points
    const th = Math.atan2(z, x);
    if (t > 0.75) y += Math.sin(th * 5 + 0.8) * 4.5 * (t - 0.75) * 4;
    bp.setXYZ(i, x, y, z);
  }
  bg.computeVertexNormals();
  const backM = mesh(bg, hairMat(), {y: 6, z: -7, sx: 1.08, outline: 0.4, oc: P.hairDark});
  back.add(backM);
  // back strands hanging over the mass
  for (const [bx, bl, bend] of [[-13, 40, -7], [-7, 44, -4], [-1, 46, -0.5], [5, 44, 3], [11, 40, 7]]) {
    back.add(mesh(strand(4.4, bl, 0.5, bend, -4), hairMatStrand(),
      {x: bx, y: -8, z: -14, outline: 0.34, oc: P.hairDark}));
  }
  hair.add(back);

  // twin tails
  for (const s of [-1, 1]) {
    const tail = new THREE.Group();
    tail.position.set(s * 24.0, 5, -4.5);
    // base puff
    tail.add(mesh(new THREE.SphereGeometry(5.4, 20, 16), hairMat(), {sy: 0.85, sz: 0.8, outline: 0.4, oc: P.hairDark}));
    const curls = [
      {x: 0, z: 0, r: 4.4, len: 48, bx: s * 16, bz: -5},
      {x: s * 3.2, z: 2.2, r: 3.4, len: 42, bx: s * 19, bz: -1},
      {x: -s * 2.8, z: -2.4, r: 3.4, len: 44, bx: s * 12, bz: -7},
    ];
    for (const c of curls) {
      tail.add(mesh(strand(c.r, c.len, 0.6, c.bx, c.bz), hairMatStrand(),
        {x: c.x, y: 1, z: c.z, outline: 0.36, oc: P.hairDark}));
    }
    // ribbon at tie
    const knot = mesh(new THREE.SphereGeometry(1.7, 12, 10), toon(P.ribbon), {y: 3.4, z: 3.4});
    tail.add(knot);
    for (const d of [-1, 1]) {
      const wing = mesh(new THREE.ConeGeometry(1.9, 4.6, 4), toon(P.ribbon),
        {x: d * 2.9, y: 3.5, z: 3.2, rz: d * 1.35, ry: d * 0.25, outline: 0.22});
      wing.scale.z = 0.55;
      tail.add(wing);
    }
    hair.add(tail);
  }

  // ahoge — signature curl on top
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 21.5, 2),
    new THREE.Vector3(1.5, 29.5, 3.5),
    new THREE.Vector3(5.4, 30.5, -1.2));
  hair.add(mesh(new THREE.TubeGeometry(curve, 16, 0.62, 8), hairMat(), {outline: 0.18, oc: P.hairDark}));

  // anime crown shine — lighter band arcing over the front-top of the hair
  const shine = new THREE.Group();
  const arc = new THREE.EllipseCurve(0, 0, 16.5, 9, Math.PI * 0.18, Math.PI * 0.82, false);
  const pts = arc.getPoints(28).map(p => new THREE.Vector3(p.x, p.y, 0));
  const shineTube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 1.35, 8, false);
  const sm = mesh(shineTube, toon(P.hairLight), {y: 12.5, z: 16.5, rx: -0.42, sz: 0.55});
  sm.material.transparent = true; sm.material.opacity = 0.9;
  shine.add(sm);
  hair.add(shine);

  return hair;
}
function head_band() {} // placeholder hook

/* ============================== body ============================== */
function buildBody() {
  const body = new THREE.Group();

  // neck
  body.add(mesh(new THREE.CylinderGeometry(3.4, 3.8, 9, 20), toon(P.skin), {y: 66.5, outline: 0.3}));

  // torso — shirt
  const torsoPts = [
    new THREE.Vector2(12.4, 66.5), new THREE.Vector2(12.6, 62),
    new THREE.Vector2(11.6, 57), new THREE.Vector2(9.6, 52),
    new THREE.Vector2(9.2, 48), new THREE.Vector2(10.4, 44),
  ];
  const torso = mesh(new THREE.LatheGeometry(torsoPts, 40), toon(P.top));
  torso.scale.z = 0.78;
  body.add(torso);

  // sailor collar — back flap + shoulder strips
  const flap = mesh(new THREE.BoxGeometry(22, 11, 1.1), toon(P.collar),
    {y: 63.2, z: -5.6, rx: 0.24, sx: 1, outline: 0.3});
  flap.geometry = flap.geometry.toNonIndexed();
  body.add(flap);
  body.add(mesh(new THREE.BoxGeometry(22, 1.3, 1.15), toon(P.top),
    {y: 58.6, z: -7.8, rx: 0.24, outline: 0.18}));
  for (const s of [-1, 1]) {
    const strip = mesh(new THREE.BoxGeometry(7.5, 1.1, 12), toon(P.collar),
      {x: s * 9.2, y: 65.6, z: -0.6, rx: -0.35, rz: s * 0.5, outline: 0.28});
    body.add(strip);
    // chest V strips
    const v = mesh(new THREE.BoxGeometry(1.4, 12, 0.7), toon(P.collar),
      {x: s * 4.6, y: 59.4, z: 9.4, rz: s * 0.42, rx: -0.15, outline: 0.22});
    body.add(v);
  }
  // chest ribbon
  body.add(mesh(new THREE.SphereGeometry(1.7, 12, 10), toon(P.ribbon), {y: 57.2, z: 10.4}));
  for (const s of [-1, 1]) {
    const ribbonTail = mesh(new THREE.BoxGeometry(1.5, 4.4, 0.5), toon(P.ribbon),
      {x: s * 1.5, y: 52.6, z: 9.7, rz: s * 0.18, rx: -0.12, outline: 0.14});
    body.add(ribbonTail);
  }
  for (const s of [-1, 1]) {
    const tail = mesh(new THREE.ConeGeometry(1.6, 4.6, 4), toon(P.ribbon),
      {x: s * 1.15, y: 54.6, z: 10.2, rz: s * 0.5 + Math.PI, outline: 0.18});
    tail.scale.z = 0.5;
    body.add(tail);
    const wing = mesh(new THREE.ConeGeometry(1.7, 4.2, 4), toon(P.ribbon),
      {x: s * 2.5, y: 57.6, z: 10.0, rz: s * 1.5, outline: 0.18});
    wing.scale.z = 0.5;
    body.add(wing);
  }

  // puff sleeves + cuff
  for (const s of [-1, 1]) {
    body.add(mesh(new THREE.SphereGeometry(5.6, 20, 16), toon(P.top),
      {x: s * 14.8, y: 61, z: 0, sy: 0.92, sz: 0.9, outline: 0.4}));
    body.add(mesh(new THREE.CylinderGeometry(4.5, 4.9, 3.2, 20), toon(P.collar),
      {x: s * 16.4, y: 57, z: 0, rz: s * 0.35, outline: 0.3}));
  }

  // pleated skirt
  const skirtPts = [
    new THREE.Vector2(9.7, 49.5), new THREE.Vector2(11.2, 46.5),
    new THREE.Vector2(14.6, 41), new THREE.Vector2(18.6, 35.5),
    new THREE.Vector2(21.8, 31.0), new THREE.Vector2(22.4, 29.6),
  ];
  const sk = new THREE.LatheGeometry(skirtPts, 96);
  const skp = sk.attributes.position;
  for (let i = 0; i < skp.count; i++) {
    const x = skp.getX(i), y = skp.getY(i), z = skp.getZ(i);
    const th = Math.atan2(z, x);
    const hem = THREE.MathUtils.clamp((49.5 - y) / 19, 0, 1);
    const pleat = 1 + 0.04 * hem * Math.sin(th * 14);
    skp.setX(i, x * pleat);
    skp.setZ(i, z * pleat * 0.9);
    // scalloped hem
    if (y < 31.5) skp.setY(i, y + 0.16 * Math.sin(th * 14));
  }
  sk.computeVertexNormals();
  const skirt = mesh(sk, toon(P.skirt));
  body.add(skirt);


  // arms — gentle A-pose curving forward
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 16.2, 59.5, 0);
    const upper = mesh(new THREE.CapsuleGeometry(3.1, 11, 6, 14), toon(P.skin), {y: -6.6, outline: 0.32});
    arm.add(upper);
    const fore = new THREE.Group();
    fore.position.set(0, -13.2, 0);
    fore.rotation.x = -0.52; fore.rotation.z = -s * 0.22;
    fore.add(mesh(new THREE.CapsuleGeometry(2.7, 10, 6, 14), toon(P.skin), {y: -5, outline: 0.3}));
    // hand — mitten with thumb
    const hand = new THREE.Group();
    hand.position.set(0, -11.5, 0.8);
    hand.add(mesh(new THREE.SphereGeometry(2.9, 16, 12), toon(P.skin), {sy: 1.15, sz: 0.75, outline: 0.28}));
    hand.add(mesh(new THREE.SphereGeometry(1.1, 10, 8), toon(P.skin), {x: -s * 2.6, y: 0.4, z: 1.2, outline: 0.18}));
    fore.add(hand);
    arm.add(fore);
    arm.rotation.z = s * 0.30;
    arm.rotation.x = 0.10;
    body.add(arm);
  }

  // legs — slight contrapposto
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 6.4, 34, 0);
    if (s === 1) leg.rotation.z = -0.06; // right leg eases out
    leg.add(mesh(new THREE.CapsuleGeometry(4.2, 15, 6, 16), toon(P.skin), {y: -8, outline: 0.34}));
    // sock
    leg.add(mesh(new THREE.CylinderGeometry(3.5, 3.9, 14.5, 18), toon(P.sock), {y: -19.5, outline: 0.3}));
    leg.add(mesh(new THREE.TorusGeometry(3.95, 0.5, 8, 22), toon(P.accent), {y: -12.6, rx: Math.PI / 2}));
    leg.add(mesh(new THREE.TorusGeometry(3.9, 0.4, 8, 22), toon(P.lace ?? 0xffffff), {y: -13.9, rx: Math.PI / 2}));
    // shoe
    const shoe = new THREE.Group();
    shoe.position.set(0, -29.6, 1.6);
    shoe.add(mesh(new THREE.SphereGeometry(4.1, 18, 14), toon(P.shoe), {sy: 0.72, sz: 1.35, z: 0.7, outline: 0.32}));
    shoe.add(mesh(new THREE.BoxGeometry(7.6, 1.5, 10.6), toon(P.shoeSole), {y: -2.6, z: 0.6, outline: 0.2}));
    shoe.add(mesh(new THREE.TorusGeometry(2.9, 0.55, 8, 20, Math.PI), toon(P.ribbon), {y: 2.4, z: 2.9, rx: 0.5}));
    shoe.rotation.y = -s * 0.14;
    leg.add(shoe);
    body.add(leg);
  }

  return body;
}

/* ============================== scene ============================== */
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || (params.get('view') ?? '');
const W = innerWidth, H = innerHeight;

const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(P.bg);

gradientMap = makeGradientMap();

const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 2000);

const char = new THREE.Group();
char.add(buildHead());
char.add(buildHair());
char.add(buildBody());
scene.add(char);

// ambient sparkles — tiny additive star sprites floating around her
const sparkTex = canvasTex(64, 64, (c, w, h) => {
  c.translate(w / 2, h / 2);
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.beginPath();
  c.moveTo(0, -26); c.quadraticCurveTo(2.5, -2.5, 26, 0); c.quadraticCurveTo(2.5, 2.5, 0, 26);
  c.quadraticCurveTo(-2.5, 2.5, -26, 0); c.quadraticCurveTo(-2.5, -2.5, 0, -26);
  c.fill();
});
const sparkMat = new THREE.SpriteMaterial({map: sparkTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8});
const heartTex = canvasTex(64, 64, (c, w, h) => {
  c.translate(w / 2, h / 2); c.fillStyle = 'rgba(255,170,205,0.9)';
  c.beginPath(); c.moveTo(0, 16);
  c.bezierCurveTo(-22, -4, -12, -22, 0, -10);
  c.bezierCurveTo(12, -22, 22, -4, 0, 16); c.fill();
});
const heartMat = new THREE.SpriteMaterial({map: heartTex, depthWrite: false, transparent: true, opacity: 0.85});
const sparks = new THREE.Group();
[[-46, 96, 14, 4.2], [44, 108, 4, 3.4], [-34, 44, 22, 2.6], [38, 38, 16, 3.0],
 [0, 128, -6, 4.6], [-52, 70, -8, 2.8], [50, 74, -14, 2.4], [20, 116, 20, 2.2],
 [-18, 34, 26, 2.0], [56, 96, 8, 2.6]].forEach(([x, y, z, s], i) => {
  const sp = new THREE.Sprite(sparkMat.clone());
  sp.position.set(x, y, z); sp.scale.setScalar(s);
  sp.userData.ph = i * 1.7;
  sparks.add(sp);
});
[[-40, 82, 20, 5], [46, 60, 18, 4.4], [-58, 108, 6, 4.8]].forEach(([x, y, z, s], i) => {
  const sp = new THREE.Sprite(heartMat.clone());
  sp.position.set(x, y, z); sp.scale.setScalar(s);
  sp.userData.ph = i * 2.3 + 0.9;
  sparks.add(sp);
});
scene.add(sparks);

// ground: soft contact shadow + disc
const shadowTex = canvasTex(256, 256, (c, w, h) => {
  const g = c.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, 120);
  g.addColorStop(0, 'rgba(40,70,120,0.30)');
  g.addColorStop(0.7, 'rgba(40,70,120,0.10)');
  g.addColorStop(1, 'rgba(40,70,120,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
});
scene.add(mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false}), {y: 0.05, rx: -Math.PI / 2}));
const discShadow = new THREE.Mesh(new THREE.CircleGeometry(42, 48), new THREE.ShadowMaterial({opacity: 0.10}));
discShadow.rotation.x = -Math.PI / 2;
discShadow.position.y = 0.02;
discShadow.receiveShadow = true;
scene.add(discShadow);

// lights
scene.add(new THREE.HemisphereLight(0xeaf4ff, 0xffd9e8, 0.85));
const key = new THREE.DirectionalLight(0xffffff, 1.35);
key.position.set(55, 130, 90);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -70;
key.shadow.camera.right = key.shadow.camera.top = 70;
key.shadow.bias = -0.0004;
scene.add(key);
const rim = new THREE.DirectionalLight(0xbcd9ff, 0.85);
rim.position.set(-70, 90, -90);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffe6f0, 0.4);
fill.position.set(-60, 40, 80);
scene.add(fill);

// name credit overlay — on for showcase shots, and always in the shared viewer
if (params.has('credit') || location.pathname.endsWith('/viewer/')) {
  const c = document.createElement('canvas');
  c.width = W; c.height = 110;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, W, 110);
  x.fillStyle = '#fff'; x.font = '700 52px system-ui';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('devin · threejs · animegirl', W / 2, 55);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(2, 2 * 110 / W),
    new THREE.MeshBasicMaterial({map: t, transparent: false, depthTest: false}));
  bar.renderOrder = 999;
  bar.position.set(0, -1 + 110 / H, 0);
  const hud = new THREE.Scene();
  const hudCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  hud.add(bar);
  window.__hud = {hud, hudCam};
}

const views = {
  front: {p: [0, 62, 196], t: [0, 60, 0]},
  threequarter: {p: [132, 74, 158], t: [0, 58, 0]},
  side: {p: [196, 62, 0], t: [0, 60, 0]},
  back: {p: [0, 66, -196], t: [0, 58, 0]},
  closeup: {p: [6, 94, 62], t: [0, 90, 0]},
  full: {p: [64, 66, 214], t: [0, 57, 0]},
};
function setView(name) {
  const v = views[name] || views.threequarter;
  camera.position.set(...v.p);
  camera.lookAt(...v.t);
  controls?.target.set(...v.t);
  controls?.update();
}

const controls = params.has('still') || SHOT ? null : new OrbitControls(camera, renderer.domElement);
setView(SHOT || 'threequarter');
if (controls) controls.enableDamping = true;

char.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

let frames = 0;
function animate() {
  requestAnimationFrame(animate);
  controls?.update();
  // gentle idle: hair sway + breathing
  const t = performance.now() / 1000;
  if (!window.__frozen) {
    char.rotation.y = params.has('spin') ? t * 0.6 : Math.sin(t * 0.5) * 0.02;
    char.position.y = Math.sin(t * 1.6) * 0.35;
  }
  sparks.children.forEach((sp, i) => {
    const ph = sp.userData.ph;
    sp.material.opacity = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.8 + ph));
    sp.position.y += Math.sin(t * 0.9 + ph) * 0.02;
    sp.material.rotation = t * 0.4 + ph;
  });
  renderer.render(scene, camera);
  if (window.__hud) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(window.__hud.hud, window.__hud.hudCam); renderer.autoClear = true; }
  if (++frames === 4) window.__ready = true;
}
animate();

window.__studio = {
  setView,
  renderSpin: (angle) => { window.__frozen = true; char.position.y = 0; char.rotation.y = angle; renderer.render(scene, camera); if (window.__hud) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(window.__hud.hud, window.__hud.hudCam); renderer.autoClear = true; } },
  getMetrics: () => ({meshes: (() => {let n = 0; char.traverse(o => {if (o.isMesh) n++}); return n})()}),
  exportGLB: () => new Promise(res => {
    new GLTFExporter().parse(char, b => {
      const u8 = new Uint8Array(b);
      let bin = ''; const CH = 0x8000;
      for (let i = 0; i < u8.length; i += CH) bin += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
      res(btoa(bin));
    }, e => res('ERR:' + e), {binary: true});
  }),
};
document.querySelector('.loading').style.display = 'none';
