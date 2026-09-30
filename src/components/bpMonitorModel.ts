import type * as ThreeNS from "three";

/*
  The blood pressure monitor as a three.js object — built here, apart from
  React, so the same model is drawn in the app and can be rendered on its
  own to be looked at while it is being made.

  A white desk unit after the common upper-arm monitor: a pillowed body in
  glossy plastic with a moulding line round its face; a screen set in a
  dark frame, SYS / DIA / PULSE printed down its left; a raised blue
  START/STOP key; and the grey nylon cuff wrapped round behind with a
  metal D-ring and its tube looping off the right. No maker's name.

  The screen's figures are seven-segment digits made of bars; `setReading`
  lights them without rebuilding anything.
*/

export type Reading = {
  sys: number | null;
  dia: number | null;
  pulse: number | null;
};

export type MonitorModel = {
  group: ThreeNS.Group;
  setReading: (r: Reading) => void;
  /** Bends the cuff: rolled up, unrolled flat, looped, pumped up. */
  setCuff: (pose: CuffPose) => void;
};

/**
 * The cuff's state. `unroll` 0 is rolled up tight, 1 lying flat; `loop`
 * then curls it from flat (0) into the loop an arm goes through (1);
 * `puff` is how far it is pumped up.
 */
export type CuffPose = { unroll: number; loop: number; puff: number };

const BODY = { w: 3.0, h: 3.3, depth: 1.0, r: 0.62 };
/** The screen window, in the body's front coordinates. */
const LCD = { x: 0.39, y: 0.2, w: 1.36, h: 1.7 };
/** The table the unit stands on. */
const TABLE = -1.66;
/** The cuff: length, width, half its thickness, corner and edge rounding. */
const CUFF = { L: 6.2, W: 2.5, T: 0.12, rc: 0.45, E: 0.3 };
/** Where the cuff lies: the middle of its width, and its fixed end. */
const CUFF_X = 3.0;
const CUFF_Z = -1.0;
const INK = 0x1d2320;
const GHOST = 0xb4bdb1;

const SEGMENTS: Record<string, boolean[]> = {
  "0": [true, true, true, true, true, true, false],
  "1": [false, true, true, false, false, false, false],
  "2": [true, true, false, true, true, false, true],
  "3": [true, true, true, true, false, false, true],
  "4": [false, true, true, false, false, true, true],
  "5": [true, false, true, true, false, true, true],
  "6": [true, false, true, true, true, true, true],
  "7": [true, true, true, false, false, false, false],
  "8": [true, true, true, true, true, true, true],
  "9": [true, true, true, true, false, true, true],
  " ": [false, false, false, false, false, false, false],
};

/** How far in from the cuff's outline (x, y) lies, and where it lands. */
function cuffOutline(x: number, y: number) {
  const A = CUFF.L / 2;
  const B = CUFF.W / 2;
  const rc = CUFF.rc;
  const qx = Math.max(-(A - rc), Math.min(A - rc, x));
  const qy = Math.max(-(B - rc), Math.min(B - rc, y));
  let dx = x - qx;
  let dy = y - qy;
  const inf = Math.max(Math.abs(dx), Math.abs(dy));
  const d2 = Math.hypot(dx, dy);
  if (d2 > 0) {
    dx *= inf / d2;
    dy *= inf / d2;
  }
  const e =
    inf > 0
      ? rc - inf
      : rc + Math.min(A - rc - Math.abs(x), B - rc - Math.abs(y));
  return { x: qx + dx, y: qy + dy, e };
}

/**
 * The cuff's printing, pixel by pixel, as RGBA: the nylon's colour, a
 * darker binding round the edge with two rows of stitching, the artery
 * mark by the tube; on the lining, the hook patch at the free end that
 * fastens it. Drawn once, ahead of time, into `bp_cuff_outer.png` and
 * `bp_cuff_lining.png` — painting it on the phone as the scene opened
 * cost the opening its first second.
 */
export function paintCuff(lining: boolean, tw = 1024, th = 256) {
  const { L, W } = CUFF;
  const A = L / 2;
  const B = W / 2;
  const px = new Uint8Array(tw * th * 4);
  const base = lining ? [168, 174, 183] : [112, 120, 131];
  let seed = lining ? 7 : 3;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const dash = (along: number, len: number) => (along / len) % 1 < 0.62;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const u = ((x + 0.5) / tw) * L;
      const w = ((y + 0.5) / th) * W - B;
      const { e } = cuffOutline(u - A, w);
      const along = u + w + 20;
      let c = base;
      let grain = 5;
      if (e < 0.14) {
        c = lining ? [120, 127, 137] : [84, 91, 101];
      }
      if (lining && u > L - 1.95 && u < L - 0.3 && Math.abs(w) < B - 0.34) {
        c = [98, 104, 114];
        grain = 16;
        const inset = Math.min(
          u - (L - 1.95),
          L - 0.3 - u,
          B - 0.34 - Math.abs(w),
        );
        if (Math.abs(inset - 0.05) < 0.011 && dash(along, 0.07))
          c = [70, 75, 84];
      }
      // Stitching: one row holding the binding, one just inside it.
      if (Math.abs(e - 0.07) < 0.01 && dash(along, 0.06))
        c = lining ? [96, 102, 112] : [62, 68, 77];
      if (Math.abs(e - 0.2) < 0.01 && dash(along, 0.07))
        c = lining ? [128, 134, 144] : [80, 87, 97];
      // The artery mark: a pale triangle and bar by the tube.
      if (!lining) {
        const mu = u - A - 0.35;
        const mw = w + B - 0.62;
        if (
          mw > -0.12 &&
          mw < 0.12 &&
          Math.abs(mu) < 0.12 &&
          Math.abs(mu) < (mw + 0.12) * 0.55
        )
          c = [214, 219, 226];
        if (Math.abs(mu) < 0.022 && mw > 0.16 && mw < 0.62) c = [214, 219, 226];
      }
      const n = (rand() - 0.5) * grain;
      const k = (y * tw + x) * 4;
      px[k] = c[0] + n;
      px[k + 1] = c[1] + n;
      px[k + 2] = c[2] + n;
      px[k + 3] = 255;
    }
  }
  return px;
}

export function buildMonitor(
  THREE: typeof ThreeNS,
  prints: {
    face: ThreeNS.Texture;
    key: ThreeNS.Texture;
    lcd: ThreeNS.Texture;
    fabric: ThreeNS.Texture;
    /** The cuff's printing, outside and in — see `paintCuff`. */
    outer: ThreeNS.Texture;
    lining: ThreeNS.Texture;
  },
): MonitorModel {
  const group = new THREE.Group();

  const roundedRect = (w: number, h: number, r: number) => {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  const slab = (
    w: number,
    h: number,
    depth: number,
    r: number,
    bevel: number,
  ) => {
    const g = new THREE.ExtrudeGeometry(
      roundedRect(w - bevel * 2, h - bevel * 2, Math.max(0.01, r - bevel)),
      {
        depth: Math.max(0.001, depth - bevel * 2),
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 10,
        curveSegments: 32,
      },
    );
    g.translate(0, 0, -(depth - bevel * 2) / 2);
    g.computeVertexNormals();
    return g;
  };
  const add = (
    geo: ThreeNS.BufferGeometry,
    mat: ThreeNS.Material,
    at: [number, number, number] = [0, 0, 0],
    rot: [number, number, number] = [0, 0, 0],
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...at);
    m.rotation.set(...rot);
    group.add(m);
    return m;
  };

  const front = BODY.depth / 2;

  /* ---- A soft round shadow, for anything standing on the table. ---- */
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - size / 2) / (size / 2);
      const dy = (y - size / 2) / (size / 2);
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      data[(y * size + x) * 4 + 3] = Math.pow(1 - d, 2) * 255;
    }
  }
  const soft = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  soft.needsUpdate = true;
  const shadow = (opacity: number) =>
    add(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: soft,
        transparent: true,
        opacity,
        depthWrite: false,
      }),
      [0, TABLE + 0.002, 0],
      [-Math.PI / 2, 0, 0],
    );

  /* ---- The cuff. ---- */
  /*
    A padded nylon band, 6.2 long, lying on the table to the unit's right
    with its tube running back to the unit. It is one surface — a grid over
    its lining (the side that goes against the arm) and one over its outer
    face, meeting along a rounded, bound edge — so it can be bent anywhere
    along its length: rolled up as it comes out of the box, unrolled flat,
    curled into the loop an arm goes through, and swollen as it pumps up.

    Along the band `u` runs from its fixed end (by the D-ring, at the
    back) to its free end, `w` across its width, `n` through its
    thickness. Bending only turns the (u, n) plane, about the width, so
    the grid's rows stay straight across.
  */
  const { L, W, T, E } = CUFF;
  const A = L / 2;
  const B = W / 2;
  // Enough rows to bend smoothly round the loop, few enough to bend every
  // frame on a phone.
  const NU = 120;
  const NW = 24;
  const perFace = (NU + 1) * (NW + 1);
  const restU = new Float32Array(perFace);
  const restW = new Float32Array(perFace);
  const restG = new Float32Array(perFace);
  const restBy = new Float32Array(perFace);
  const uvs = new Float32Array(perFace * 4);
  // Rows and columns crowd toward the edges, where the padding rounds off.
  const spread = (k: number, n: number) =>
    Math.sin(((2 * k) / n - 1) * (Math.PI / 2));
  for (let j = 0; j <= NW; j++) {
    for (let i = 0; i <= NU; i++) {
      const k = j * (NU + 1) + i;
      const p = cuffOutline(A * spread(i, NU), B * spread(j, NW));
      const r = 1 - Math.min(p.e / E, 1);
      restU[k] = p.x + A;
      restW[k] = p.y;
      restG[k] = Math.sqrt(Math.max(0, 1 - r * r));
      restBy[k] = 1 - (p.y / B) * (p.y / B);
      uvs[k * 2] = restU[k] / L;
      uvs[k * 2 + 1] = (p.y + B) / W;
    }
  }
  uvs.copyWithin(perFace * 2, 0, perFace * 2);
  const index: number[] = [];
  for (let face = 0; face < 2; face++) {
    const o = face * perFace;
    for (let j = 0; j < NW; j++) {
      for (let i = 0; i < NU; i++) {
        const a = o + j * (NU + 1) + i;
        const b = a + 1;
        const c = a + NU + 1;
        const d = c + 1;
        if (face === 0) index.push(a, b, c, b, d, c);
        else index.push(a, c, b, b, c, d);
      }
    }
  }
  const band = new THREE.BufferGeometry();
  const pos = new Float32Array(perFace * 2 * 3);
  const nrm = new Float32Array(perFace * 2 * 3);
  band.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  band.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  band.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  band.setIndex(index);
  band.addGroup(0, NU * NW * 6, 0);
  band.addGroup(NU * NW * 6, NU * NW * 6, 1);

  /*
    Its normals, worked out once lying flat for each degree of swelling
    and then only turned with the band as it bends — the bend turns the
    surface without changing its shape across, and working them out
    afresh every frame is what a phone cannot afford.
  */
  const flatGeo = new THREE.BufferGeometry();
  const flatPos = new Float32Array(perFace * 2 * 3);
  flatGeo.setAttribute("position", new THREE.BufferAttribute(flatPos, 3));
  flatGeo.setIndex(index);
  const flatNormals = new Map<number, Float32Array>();
  const normalsFor = (puff: number) => {
    const known = flatNormals.get(puff);
    if (known != null) return known;
    const t = T * (1 + 0.9 * puff);
    const flat = 0.8 - 0.3 * puff;
    for (let face = 0; face < 2; face++) {
      const side = face === 0 ? 1 : -1;
      for (let k = 0; k < perFace; k++) {
        const o = (face * perFace + k) * 3;
        flatPos[o] = restW[k];
        flatPos[o + 1] = side * t * restG[k] * (flat + (1 - flat) * restBy[k]);
        flatPos[o + 2] = restU[k];
      }
    }
    flatGeo.computeVertexNormals();
    const n = new Float32Array(flatGeo.attributes.normal.array);
    // Where the two faces meet, one normal, so the edge reads as one
    // rounded seam rather than a crease.
    for (let j = 0; j <= NW; j++) {
      for (let i = 0; i <= NU; i++) {
        if (i !== 0 && i !== NU && j !== 0 && j !== NW) continue;
        const p = (j * (NU + 1) + i) * 3;
        const q = p + perFace * 3;
        const x = n[p] + n[q];
        const y = n[p + 1] + n[q + 1];
        const z = n[p + 2] + n[q + 2];
        const l = Math.hypot(x, y, z) || 1;
        n[p] = n[q] = x / l;
        n[p + 1] = n[q + 1] = y / l;
        n[p + 2] = n[q + 2] = z / l;
      }
    }
    flatNormals.set(puff, n);
    return n;
  };

  // Its printing — binding, stitching, the artery mark, the hook patch —
  // is drawn ahead of time into two pictures (see `paintCuff`); the weave
  // comes from the fabric picture, as a bump.
  const weave = prints.fabric;
  weave.wrapS = THREE.RepeatWrapping;
  weave.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(L * 1.7, W * 1.7);
  for (const p of [prints.outer, prints.lining]) {
    // Painted with its first row at the band's near edge, as the grid
    // counts it.
    p.flipY = false;
    p.colorSpace = THREE.SRGBColorSpace;
    p.anisotropy = 4;
  }
  const lining = new THREE.MeshPhysicalMaterial({
    map: prints.lining,
    bumpMap: weave,
    bumpScale: 0.35,
    roughness: 0.82,
    sheen: 0.45,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xdfe3e8),
  });
  const outer = new THREE.MeshPhysicalMaterial({
    map: prints.outer,
    bumpMap: weave,
    bumpScale: 0.75,
    roughness: 0.88,
    sheen: 0.7,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(0xc9cfd8),
  });
  const cuffMesh = new THREE.Mesh(band, [lining, outer]);
  group.add(cuffMesh);
  const cuffShadow = shadow(0.3);

  // The D-ring, at the fixed end, lying back on the table.
  const ringPath = new THREE.Shape();
  {
    const rw = W - 0.26;
    const rh = 0.3;
    const r = 0.2;
    ringPath.moveTo(-rw / 2 + r, 0);
    ringPath.lineTo(rw / 2 - r, 0);
    ringPath.quadraticCurveTo(rw / 2, 0, rw / 2, r);
    ringPath.lineTo(rw / 2, rh - r);
    ringPath.quadraticCurveTo(rw / 2, rh, rw / 2 - r, rh);
    ringPath.lineTo(-rw / 2 + r, rh);
    ringPath.quadraticCurveTo(-rw / 2, rh, -rw / 2, rh - r);
    ringPath.lineTo(-rw / 2, r);
    ringPath.quadraticCurveTo(-rw / 2, 0, -rw / 2 + r, 0);
  }
  add(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        ringPath
          .getSpacedPoints(180)
          .slice(0, -1)
          .map((v) => new THREE.Vector3(v.x, 0, -v.y)),
        true,
      ),
      240,
      0.045,
      16,
      true,
    ),
    new THREE.MeshPhysicalMaterial({
      color: 0xd6dade,
      metalness: 1,
      roughness: 0.16,
      clearcoat: 0.3,
    }),
    [CUFF_X, TABLE + 0.07, CUFF_Z + 0.16],
  );

  /* ---- The tube, from the unit's right side to the cuff's edge. ---- */
  const tubeMat = new THREE.MeshPhysicalMaterial({
    color: 0x9aa1a9,
    roughness: 0.3,
    clearcoat: 0.55,
    clearcoatRoughness: 0.22,
  });
  const tubeMesh = add(new THREE.BufferGeometry(), tubeMat);
  const metal = new THREE.MeshStandardMaterial({
    color: 0xc9cdd2,
    metalness: 0.85,
    roughness: 0.2,
  });
  add(
    new THREE.CylinderGeometry(0.12, 0.13, 0.2, 32),
    metal,
    [1.45, 0.55, -0.2],
    [0, 0, Math.PI / 2],
  );
  // Where it goes into the cuff: a moulded grey collar at the edge.
  const port = add(
    new THREE.CylinderGeometry(0.1, 0.13, 0.28, 28),
    new THREE.MeshPhysicalMaterial({
      color: 0x6f7680,
      roughness: 0.5,
      clearcoat: 0.3,
    }),
    [0, 0, 0],
    [0, 0, Math.PI / 2],
  );

  /** The band's spine, walked along its length for a pose. */
  const M = 300;
  const ds = L / M;
  const spineZ = new Float32Array(M + 1);
  const spineY = new Float32Array(M + 1);
  const spineA = new Float32Array(M + 1);
  // Where along the spine each point of the grid sits, found once.
  const at = new Int32Array(perFace);
  const atFrac = new Float32Array(perFace);
  for (let k = 0; k < perFace; k++) {
    const f = Math.max(0, Math.min(M - 1e-6, restU[k] / ds));
    at[k] = Math.floor(f);
    atFrac[k] = f - at[k];
  }
  let last = "";
  const tubeEnd = new THREE.Vector3(Infinity, 0, 0);
  const setCuff = (pose: CuffPose) => {
    // Swelling in fortieths: finer does not show, and each step is a set
    // of normals worked out.
    const puff = Math.round(pose.puff * 40) / 40;
    const key = `${pose.unroll.toFixed(3)}|${pose.loop.toFixed(3)}|${puff}`;
    if (key === last) return;
    last = key;
    const t = T * (1 + 0.9 * puff);
    const pitch = 2.3 * t;
    // Rolled, it winds from the free end inward; looped, it goes once
    // round and the free end tucks just inside the fixed one.
    const R = (L - 0.75) / (2 * Math.PI);
    const round = 2 * Math.PI * R;
    const s0 = pose.unroll * L;
    const bend = (s: number) => {
      if (pose.loop > 0) {
        const k = Math.min(1, Math.max(0, (s - (round - 0.9)) / 1.0));
        return pose.loop / (R - pitch * k * k * (3 - 2 * k));
      }
      if (s < s0) return 0;
      return 1 / Math.sqrt(0.13 * 0.13 + (pitch / Math.PI) * (L - s));
    };
    let a = 0;
    let z = 0;
    let y = TABLE + t;
    spineZ[0] = z;
    spineY[0] = y;
    spineA[0] = a;
    let minZ = 0;
    let maxZ = 0;
    for (let m = 1; m <= M; m++) {
      const turn = bend((m - 0.5) * ds) * ds;
      const am = a + turn / 2;
      z += Math.cos(am) * ds;
      y += Math.sin(am) * ds;
      a += turn;
      spineZ[m] = z;
      spineY[m] = y;
      spineA[m] = a;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const rest = normalsFor(puff);
    const flat = 0.8 - 0.3 * puff;
    for (let face = 0; face < 2; face++) {
      const side = face === 0 ? 1 : -1;
      for (let k = 0; k < perFace; k++) {
        const m = at[k];
        const r = atFrac[k];
        const sz = spineZ[m] + (spineZ[m + 1] - spineZ[m]) * r;
        const sy = spineY[m] + (spineY[m + 1] - spineY[m]) * r;
        const sa = spineA[m] + (spineA[m + 1] - spineA[m]) * r;
        const c = Math.cos(sa);
        const sn = Math.sin(sa);
        const n = side * t * restG[k] * (flat + (1 - flat) * restBy[k]);
        const o = (face * perFace + k) * 3;
        pos[o] = CUFF_X + restW[k];
        pos[o + 1] = sy + n * c;
        pos[o + 2] = CUFF_Z + sz - n * sn;
        // The flat normal, turned with the band.
        const ny = rest[o + 1];
        const nz = rest[o + 2];
        nrm[o] = rest[o];
        nrm[o + 1] = ny * c + nz * sn;
        nrm[o + 2] = nz * c - ny * sn;
      }
    }
    band.attributes.position.needsUpdate = true;
    band.attributes.normal.needsUpdate = true;
    band.computeBoundingSphere();

    cuffShadow.position.set(CUFF_X, TABLE + 0.003, CUFF_Z + (minZ + maxZ) / 2);
    cuffShadow.scale.set(W + 1.1, maxZ - minZ + 1.2, 1);

    // The tube's end, at the middle of the band's near edge — rebuilt only
    // when that has moved enough to see.
    const mm = M / 2;
    const end = new THREE.Vector3(
      CUFF_X - B - 0.12,
      spineY[mm],
      CUFF_Z + spineZ[mm],
    );
    port.position.copy(end);
    if (end.distanceTo(tubeEnd) < 0.006) return;
    tubeEnd.copy(end);
    const from = new THREE.Vector3(1.55, 0.55, -0.2);
    const out = new THREE.Vector3(2.05, 0.6, -0.28);
    const into = end.clone().add(new THREE.Vector3(-0.5, 0, 0));
    const sag = out
      .clone()
      .lerp(into, 0.5)
      .add(new THREE.Vector3(0.75, -0.55, 0.25));
    sag.y = Math.max(TABLE + 0.2, sag.y);
    const tip = end.clone().add(new THREE.Vector3(-0.1, 0, 0));
    tubeMesh.geometry.dispose();
    tubeMesh.geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        [from, out, sag, into, tip],
        false,
        "centripetal",
      ),
      100,
      0.075,
      14,
      false,
    );
  };
  /* ---- The body. ---- */
  add(
    slab(BODY.w, BODY.h, BODY.depth, BODY.r, 0.2),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.3,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
    }),
  );
  add(
    new THREE.PlaneGeometry(BODY.w - 0.1, BODY.h - 0.1),
    new THREE.MeshBasicMaterial({
      map: prints.face,
      transparent: true,
      depthWrite: false,
    }),
    [0, 0, front + 0.002],
  );

  /* ---- The screen. ---- */
  add(
    slab(LCD.w + 0.14, LCD.h + 0.14, 0.06, 0.1, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x3c423f, roughness: 0.5 }),
    [LCD.x, LCD.y, front - 0.01],
  );
  add(
    new THREE.PlaneGeometry(LCD.w, LCD.h),
    new THREE.MeshBasicMaterial({ color: 0xbac3b7 }),
    [LCD.x, LCD.y, front + 0.025],
  );

  // The screen's own printed icons — memory, and the heart.
  add(
    new THREE.PlaneGeometry(LCD.w, LCD.h),
    new THREE.MeshBasicMaterial({
      map: prints.lcd,
      transparent: true,
      depthWrite: false,
    }),
    [LCD.x, LCD.y, front + 0.027],
  );

  // The figures: each digit seven bars, each bar its own material so a
  // reading only recolours them.
  const figures: { mats: ThreeNS.MeshBasicMaterial[][]; places: number }[] = [];
  const figure = (y: number, h: number, places: number) => {
    const mats: ThreeNS.MeshBasicMaterial[][] = [];
    const pitch = h * 0.66;
    const w = h * 0.5;
    const t = h * 0.12;
    const bars: [number, number, number, number][] = [
      [0, h / 2 - t / 2, w - t, t],
      [w / 2 - t / 2, h / 4, t, h / 2 - t * 1.2],
      [w / 2 - t / 2, -h / 4, t, h / 2 - t * 1.2],
      [0, -h / 2 + t / 2, w - t, t],
      [-w / 2 + t / 2, -h / 4, t, h / 2 - t * 1.2],
      [-w / 2 + t / 2, h / 4, t, h / 2 - t * 1.2],
      [0, 0, w - t, t],
    ];
    const right = LCD.x + LCD.w / 2 - 0.08;
    // x' = x + 0.1·y — the lean of an LCD's figures.
    const shear = new THREE.Matrix4().set(
      1,
      0.1,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
    );
    for (let i = 0; i < places; i++) {
      const cx = right + (i - (places - 1)) * pitch - h * 0.25;
      const digit: ThreeNS.MeshBasicMaterial[] = [];
      for (const [x, by, bw, bh] of bars) {
        const mat = new THREE.MeshBasicMaterial({ color: GHOST });
        // Each bar placed in the digit, then the digit leaned: a true
        // shear, so the strokes slant smoothly rather than in steps.
        const bar = new THREE.BoxGeometry(bw, bh, 0.006);
        bar.translate(x, by, 0);
        bar.applyMatrix4(shear);
        add(bar, mat, [cx, y, front + 0.03]);
        digit.push(mat);
      }
      mats.push(digit);
    }
    figures.push({ mats, places });
  };
  figure(0.72, 0.5, 3);
  figure(0.17, 0.5, 3);
  figure(-0.38, 0.34, 3);

  /* ---- START / STOP. ---- */
  add(
    slab(1.05, 0.46, 0.14, 0.2, 0.05),
    new THREE.MeshPhysicalMaterial({
      color: 0x2447a8,
      roughness: 0.3,
      clearcoat: 0.6,
    }),
    [0, -1.18, front + 0.02],
  );
  add(
    new THREE.PlaneGeometry(0.9, 0.39),
    new THREE.MeshBasicMaterial({
      map: prints.key,
      transparent: true,
      depthWrite: false,
    }),
    [0, -1.18, front + 0.095],
  );

  /* ---- The unit's own shadow. ---- */
  const unitShadow = shadow(0.38);
  unitShadow.position.set(0.05, TABLE + 0.002, -0.1);
  unitShadow.scale.set(4.4, 2.2, 1);

  setCuff({ unroll: 1, loop: 1, puff: 0 });

  const setReading = (r: Reading) => {
    [r.sys, r.dia, r.pulse].forEach((v, f) => {
      const { mats, places } = figures[f];
      const s = v == null ? "" : String(Math.round(v));
      const text = s.padStart(places, " ").slice(-places);
      text.split("").forEach((ch, i) => {
        const on = SEGMENTS[ch] ?? SEGMENTS[" "];
        mats[i].forEach((m, k) => m.color.setHex(on[k] ? INK : GHOST));
      });
    });
  };

  return { group, setReading, setCuff };
}

/* ---- The scene, second by second. ---- */

type V3 = [number, number, number];

/** A frame of the scene: where the camera is and looks, the cuff, the screen. */
export type Shot = { cam: V3; look: V3; cuff: CuffPose; reading: Reading };

/** How long the opening takes before the measurement begins. */
export const INTRO = 3.9;
/** One measurement, pumping up to showing its result. */
export const MEASURE = 62;
/** When, after the numbers start, the result comes up on the screen. */
export const RESULT_AT = 58;

const ease = (x: number) => {
  const k = Math.max(0, Math.min(1, x));
  return k * k * (3 - 2 * k);
};
const span = (t: number, a: number, b: number) => ease((t - a) / (b - a));

/*
  The camera's path: over the cuff laid out flat on the table; round to
  watch it curl into its loop; then in close on the unit's screen, held
  still there while it measures. A smooth curve through these, not a
  stop at each.
*/
const KEYS: { t: number; cam: V3; look: V3 }[] = [
  { t: 0, cam: [8.6, 4.4, 9.6], look: [2.6, -1.4, 1.9] },
  { t: 2.4, cam: [9.4, 3.4, 9.0], look: [2.2, -0.4, -0.2] },
  { t: INTRO, cam: [1.05, 0.8, 8.6], look: [0.75, -0.2, -0.2] },
];

function path(t: number, pick: (k: (typeof KEYS)[number]) => V3): V3 {
  if (t <= KEYS[0].t) return pick(KEYS[0]);
  const n = KEYS.length - 1;
  if (t >= KEYS[n].t) return pick(KEYS[n]);
  let i = 0;
  while (KEYS[i + 1].t < t) i++;
  const k0 = KEYS[Math.max(0, i - 1)];
  const k1 = KEYS[i];
  const k2 = KEYS[i + 1];
  const k3 = KEYS[Math.min(n, i + 2)];
  const h = k2.t - k1.t;
  const s = (t - k1.t) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  // Catmull-Rom tangents over uneven times; none at the two ends, so it
  // eases out of the first shot and settles on the last.
  const out: V3 = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const p1 = pick(k1)[c];
    const p2 = pick(k2)[c];
    const m1 = i === 0 ? 0 : ((p2 - pick(k0)[c]) / (k2.t - k0.t)) * h;
    const m2 = i + 1 === n ? 0 : ((pick(k3)[c] - p1) / (k3.t - k1.t)) * h;
    out[c] =
      (2 * s3 - 3 * s2 + 1) * p1 +
      (s3 - 2 * s2 + s) * m1 +
      (-2 * s3 + 3 * s2) * p2 +
      (s3 - s2) * m2;
  }
  return out;
}

/**
 * One measurement, `t` seconds in: a zero; the cuff pumping up and the
 * pressure climbing; the slow release, the pressure falling; then the
 * result, held.
 */
function measureAt(
  t: number,
  result: Reading,
): { reading: Reading; puff: number } {
  // As long as a real one takes — a minute: about 20 s pumping up, half
  // a minute letting down, then the result.
  const zero = 2;
  const pumped = 24;
  const done = RESULT_AT;
  if (t < zero) return { reading: { sys: 0, dia: null, pulse: null }, puff: 0 };
  if (t < pumped) {
    const k = (t - zero) / (pumped - zero);
    // Quick at first, slower as the cuff tightens, with the pump's beat.
    const p = 185 * (1 - Math.pow(1 - k, 1.7)) + Math.sin(t * 9) * 0.8;
    return {
      reading: { sys: Math.max(0, Math.round(p)), dia: null, pulse: null },
      puff: p / 185,
    };
  }
  if (t < done) {
    // Let down in steps of a few mmHg, as the valve lets it.
    const k = (t - pumped) / (done - pumped);
    const p = 185 - 125 * k;
    const stepped = Math.round(p / 3) * 3;
    return {
      reading: { sys: stepped, dia: null, pulse: null },
      puff: p / 185,
    };
  }
  return {
    reading: result,
    puff: Math.max(0, 0.32 * (1 - (t - done) / 0.8)),
  };
}

/**
 * How long, on measuring again, the camera takes to draw back from the
 * screen while the cuff comes off and lies flat again — before the scene
 * runs from its start as it did the first time.
 */
export const AGAIN = 1.5;

/**
 * The scene `t` seconds after it first appears — or, `again`, after the
 * carer asked to measure again, from where the last one ended.
 */
export function sceneAt(
  t: number,
  result: Reading = { sys: 128, dia: 82, pulse: 74 },
  again = false,
): Shot {
  if (again) {
    if (t < AGAIN) {
      const k = ease(t / AGAIN);
      const a = KEYS[KEYS.length - 1];
      const b = KEYS[0];
      const mix = (p: V3, q: V3): V3 => [
        p[0] + (q[0] - p[0]) * k,
        p[1] + (q[1] - p[1]) * k,
        p[2] + (q[2] - p[2]) * k,
      ];
      return {
        cam: mix(a.cam, b.cam),
        look: mix(a.look, b.look),
        // Unwrapped, it lies back down flat.
        cuff: { unroll: 1, loop: 1 - ease(t / (AGAIN * 0.85)), puff: 0 },
        reading: { sys: null, dia: null, pulse: null },
      };
    }
    t -= AGAIN;
  }
  const cuff: CuffPose = {
    // It starts laid out flat, and curls into its loop.
    unroll: 1,
    loop: span(t, 0.5, 2.1),
    puff: 0,
  };
  let reading: Reading = { sys: null, dia: null, pulse: null };
  const cam = path(t, (k) => k.cam);
  const look = path(t, (k) => k.look);
  // The screen stays dark until the camera has settled on the unit; only
  // then does the measurement start.
  if (t >= INTRO) {
    const m = measureAt((t - INTRO) % MEASURE, result);
    reading = m.reading;
    cuff.puff = m.puff;
  }
  return { cam, look, cuff, reading };
}
