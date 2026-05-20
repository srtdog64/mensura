import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".mensura-visual");

const PANEL_W = 360;
const PANEL_H = 260;
const PADDING = 34;
const GAP = 18;

export function createRayVisualFixtures(api) {
  const {
    normalize3,
    vec3,
    aabb,
    capsule,
    ray,
    sphere,
    rayAabbHit,
    rayCapsuleHit,
    raySphereHit,
    rayTriangleHit
  } = api;

  const aabbRay = ray(vec3(0, 0, 0), vec3(0, 0, -1));
  const aabbBox = aabb(vec3(-1, -1, -6), vec3(1, 1, -4));
  const aabbHit = rayAabbHit(aabbRay, aabbBox);

  const sphereRay = ray(vec3(-2, 0, 0), normalize3(vec3(2, 0, -5)));
  const targetSphere = sphere(vec3(0, 0, -5), 1.5);
  const sphereHit = raySphereHit(sphereRay, targetSphere);

  const triA = vec3(-1, -1, -5);
  const triB = vec3(1, -1, -5);
  const triC = vec3(0, 1, -5);
  const triangleRay = ray(vec3(0.25, 0.25, 0), vec3(0, 0, -1));
  const triangleHit = rayTriangleHit(triangleRay, triA, triB, triC);

  const targetCapsule = capsule(vec3(0, 0, -6), vec3(0, 0, -3), 0.5);
  const capsuleRay = ray(vec3(2, 0, -4.5), vec3(-1, 0, 0));
  const capsuleHit = rayCapsuleHit(capsuleRay, targetCapsule);

  const fixtures = [
    {
      id: "ray-aabb",
      title: "Ray vs AABB",
      axes: ["x", "z"],
      view: { minX: -2, maxX: 2, minY: -7, maxY: 1 },
      rayLength: 6.8,
      ray: aabbRay,
      hit: aabbHit,
      shapes: [{ kind: "aabb", value: aabbBox }],
      summary: hitSummary(aabbHit)
    },
    {
      id: "ray-sphere",
      title: "Ray vs Sphere",
      axes: ["x", "z"],
      view: { minX: -3, maxX: 3, minY: -7, maxY: 1 },
      rayLength: 7,
      ray: sphereRay,
      hit: sphereHit,
      shapes: [{ kind: "sphere", value: targetSphere }],
      summary: hitSummary(sphereHit)
    },
    {
      id: "ray-triangle",
      title: "Ray vs Triangle",
      axes: ["x", "y"],
      view: { minX: -1.8, maxX: 1.8, minY: -1.6, maxY: 1.6 },
      rayLength: 0,
      ray: triangleRay,
      hit: triangleHit,
      shapes: [{ kind: "triangle", value: [triA, triB, triC] }],
      note: "ray direction is -Z through this XY plane",
      summary: triangleHit
        ? `t=${fmt(triangleHit.distance)}, bary=(${fmt(triangleHit.barycentric.x)}, ${fmt(triangleHit.barycentric.y)}, ${fmt(triangleHit.barycentric.z)})`
        : "miss"
    },
    {
      id: "ray-capsule",
      title: "Ray vs Capsule",
      axes: ["x", "z"],
      view: { minX: -2, maxX: 3, minY: -7, maxY: -2 },
      rayLength: 4,
      ray: capsuleRay,
      hit: capsuleHit,
      shapes: [{ kind: "capsule", value: targetCapsule }],
      summary: hitSummary(capsuleHit)
    }
  ];

  return {
    generatedBy: "npm run visual:ray",
    coordinateSpace: "Mensura right-handed world, +Y up, -Z forward",
    fixtures
  };
}

export function renderRayVisualSvg(data) {
  const width = PANEL_W * 2 + GAP + PADDING * 2;
  const height = PANEL_H * 2 + GAP + PADDING * 2;
  const panels = data.fixtures.map((fixture, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = PADDING + col * (PANEL_W + GAP);
    const y = PADDING + row * (PANEL_H + GAP);
    return renderPanel(fixture, x, y);
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mensura ray hit visual fixtures">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 8 4 L 0 8 z" fill="#2563eb"/>
    </marker>
    <style>
      text { font-family: Inter, Segoe UI, Arial, sans-serif; fill: #172033; }
      .panel { fill: #f8fafc; stroke: #cbd5e1; stroke-width: 1; }
      .grid { stroke: #e2e8f0; stroke-width: 1; }
      .axis { stroke: #94a3b8; stroke-width: 1.2; }
      .ray { stroke: #2563eb; stroke-width: 2.5; marker-end: url(#arrow); }
      .miss-ray { stroke: #64748b; stroke-width: 2; stroke-dasharray: 6 5; marker-end: url(#arrow); }
      .shape { fill: rgba(20, 184, 166, 0.16); stroke: #0f766e; stroke-width: 2; }
      .hit { fill: #ef4444; stroke: white; stroke-width: 2; }
      .origin { fill: #2563eb; stroke: white; stroke-width: 2; }
      .label { font-size: 13px; font-weight: 700; }
      .small { font-size: 11px; fill: #475569; }
      .mono { font-size: 11px; font-family: Consolas, monospace; fill: #334155; }
    </style>
  </defs>
${panels}
</svg>`;
}

export function renderRayVisual2dHtml(data) {
  const svg = renderRayVisualSvg(data);
  const rows = data.fixtures.map((fixture) => `
      <tr>
        <td>${escapeHtml(fixture.title)}</td>
        <td>${escapeHtml(fixture.axes.join("/").toUpperCase())}</td>
        <td><code>${escapeHtml(fixture.summary)}</code></td>
      </tr>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mensura Ray Visual Fixtures</title>
  <style>${baseCss()} svg { max-width: 100%; height: auto; display: block; border: 1px solid #e2e8f0; }</style>
</head>
<body>
<main>
  <h1>Mensura Ray Visual Fixtures</h1>
  <p>Generated by <code>npm run visual:ray</code>. This is a dependency-free eye-check artifact; automated correctness remains in Vitest.</p>
${svg}
  <table>
    <thead><tr><th>Fixture</th><th>Projection</th><th>Hit data</th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>
</main>
</body>
</html>`;
}

export function renderRayVisual3dHtml(data) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mensura Ray 3D Visual Fixtures</title>
  <style>
    ${baseCss()}
    .stage { display: grid; grid-template-columns: 1fr 280px; gap: 16px; align-items: start; }
    canvas { width: 100%; aspect-ratio: 16 / 10; border: 1px solid #cbd5e1; background: #f8fafc; display: block; }
    .panel { border: 1px solid #e2e8f0; padding: 12px; background: #fff; }
    .active { color: #0f766e; font-weight: 700; }
    @media (max-width: 820px) { .stage { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<main>
  <h1>Mensura Ray 3D Visual Fixtures</h1>
  <p>Drag the canvas to orbit. The red point and table values are generated from the same fixture manifest that Vitest checks against Mensura ray APIs.</p>
  <div class="stage">
    <canvas id="scene" width="960" height="600"></canvas>
    <div class="panel">
      <label for="fixture">Fixture</label>
      <select id="fixture"></select>
      <table>
        <tbody>
          <tr><th>Hit</th><td><code id="hit"></code></td></tr>
          <tr><th>Origin</th><td><code id="origin"></code></td></tr>
          <tr><th>Direction</th><td><code id="direction"></code></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</main>
<script id="ray-fixture-data" type="application/json">${escapeScriptJson(stableStringify(data))}</script>
<script>
const data = JSON.parse(document.getElementById("ray-fixture-data").textContent);
const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const select = document.getElementById("fixture");
let fixtureIndex = 0;
let yaw = -0.55;
let pitch = 0.35;
let dragging = false;
let lastX = 0;
let lastY = 0;

for (let i = 0; i < data.fixtures.length; i++) {
  const option = document.createElement("option");
  option.value = String(i);
  option.textContent = data.fixtures[i].title;
  select.appendChild(option);
}
select.addEventListener("change", () => {
  fixtureIndex = Number(select.value);
  draw();
});
canvas.addEventListener("pointerdown", (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  yaw += (event.clientX - lastX) * 0.008;
  pitch = Math.max(-1.25, Math.min(1.25, pitch + (event.clientY - lastY) * 0.008));
  lastX = event.clientX;
  lastY = event.clientY;
  draw();
});
canvas.addEventListener("pointerup", () => { dragging = false; });

function draw() {
  const fixture = data.fixtures[fixtureIndex];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  for (const shape of fixture.shapes) drawShape(shape);
  drawRay(fixture);
  drawHitGuide(fixture);
  drawPoint(fixture.ray.origin, "#2563eb", 5);
  if (fixture.hit) drawPoint(fixture.hit.point, "#ef4444", 6);
  drawText(fixture);
}

function drawGrid() {
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i++) {
    line({ x: -8, y: 0, z: i }, { x: 8, y: 0, z: i });
    line({ x: i, y: 0, z: -8 }, { x: i, y: 0, z: 8 });
  }
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  line({ x: -8, y: 0, z: 0 }, { x: 8, y: 0, z: 0 });
  line({ x: 0, y: 0, z: -8 }, { x: 0, y: 0, z: 8 });
}

function drawShape(shape) {
  ctx.strokeStyle = "#0f766e";
  ctx.fillStyle = "rgba(20, 184, 166, 0.10)";
  ctx.lineWidth = 2;
  if (shape.kind === "aabb") drawAabb(shape.value);
  if (shape.kind === "sphere") drawSphere(shape.value);
  if (shape.kind === "triangle") drawTriangle(shape.value);
  if (shape.kind === "capsule") drawCapsule(shape.value);
}

function drawAabb(box) {
  const mn = box.min, mx = box.max;
  const p = [
    { x: mn.x, y: mn.y, z: mn.z }, { x: mx.x, y: mn.y, z: mn.z },
    { x: mx.x, y: mx.y, z: mn.z }, { x: mn.x, y: mx.y, z: mn.z },
    { x: mn.x, y: mn.y, z: mx.z }, { x: mx.x, y: mn.y, z: mx.z },
    { x: mx.x, y: mx.y, z: mx.z }, { x: mn.x, y: mx.y, z: mx.z }
  ];
  [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a,b]) => line(p[a], p[b]));
}

function drawSphere(s) {
  const steps = 48;
  for (const plane of ["xy", "xz", "yz"]) {
    let prev = null;
    for (let i = 0; i <= steps; i++) {
      const t = Math.PI * 2 * i / steps;
      const p = { x: s.center.x, y: s.center.y, z: s.center.z };
      if (plane.includes("x")) p.x += Math.cos(t) * s.radius;
      if (plane.includes("y")) p.y += Math.sin(t) * s.radius;
      if (plane === "xz") p.z += Math.sin(t) * s.radius;
      if (plane === "yz") p.z += Math.cos(t) * s.radius;
      if (prev) line(prev, p);
      prev = p;
    }
  }
}

function drawTriangle(points) {
  line(points[0], points[1]);
  line(points[1], points[2]);
  line(points[2], points[0]);
}

function drawCapsule(cap) {
  line(cap.point0, cap.point1);
  drawSphere({ center: cap.point0, radius: cap.radius });
  drawSphere({ center: cap.point1, radius: cap.radius });
}

function drawRay(fixture) {
  const start = fixture.ray.origin;
  const end = fixture.hit
    ? fixture.hit.point
    : add(start, scale(fixture.ray.direction, fixture.rayLength || 6));
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 3;
  line(start, end);
  if (fixture.hit) {
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    line(end, add(end, scale(fixture.hit.normal || { x: 0, y: 1, z: 0 }, 0.5)));
  }
}

function drawHitGuide(fixture) {
  if (!fixture.hit) return;
  for (const shape of fixture.shapes) {
    if (shape.kind === "sphere") {
      drawCenterToHit(shape.value.center, fixture.hit.point);
    }
    if (shape.kind === "capsule") {
      const closest = closestPointOnSegment(shape.value.point0, shape.value.point1, fixture.hit.point);
      drawCenterToHit(closest, fixture.hit.point);
    }
  }
}

function drawCenterToHit(center, hitPoint) {
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 1.75;
  line(center, hitPoint);
  ctx.restore();
  drawPoint(center, "#f97316", 4);
}

function closestPointOnSegment(a, b, p) {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ap = { x: p.x - a.x, y: p.y - a.y, z: p.z - a.z };
  const denom = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  const rawT = denom === 0 ? 0 : (ap.x * ab.x + ap.y * ab.y + ap.z * ab.z) / denom;
  const t = Math.max(0, Math.min(1, rawT));
  return {
    x: a.x + ab.x * t,
    y: a.y + ab.y * t,
    z: a.z + ab.z * t
  };
}

function drawPoint(point, color, radius) {
  const p = project(point);
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawText(fixture) {
  document.getElementById("hit").textContent = fixture.summary;
  document.getElementById("origin").textContent = formatVec(fixture.ray.origin);
  document.getElementById("direction").textContent = formatVec(fixture.ray.direction);
  ctx.fillStyle = "#172033";
  ctx.font = "700 18px Inter, Segoe UI, Arial";
  ctx.fillText(fixture.title, 20, 30);
}

function line(a, b) {
  const pa = project(a);
  const pb = project(b);
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
}

function project(p) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = p.x * cy - p.z * sy;
  const z1 = p.x * sy + p.z * cy;
  const y1 = p.y * cp - z1 * sp;
  const z2 = p.y * sp + z1 * cp;
  const scale = 74 * (1 / (1 + (z2 + 6) * 0.045));
  return {
    x: canvas.width * 0.5 + x1 * scale,
    y: canvas.height * 0.54 - y1 * scale
  };
}

function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale(a, k) { return { x: a.x * k, y: a.y * k, z: a.z * k }; }
function formatVec(v) { return "(" + f(v.x) + ", " + f(v.y) + ", " + f(v.z) + ")"; }
function f(v) { return Number.isInteger(v) ? String(v) : v.toFixed(3); }

draw();
</script>
</body>
</html>`;
}

export function stableStringify(value) {
  return JSON.stringify(sortForJson(value), null, 2);
}

async function main() {
  const [{ normalize3, vec3 }, { aabb, capsule, ray, sphere }, query] = await Promise.all([
    import("../dist/core/index.js"),
    import("../dist/geometry/index.js"),
    import("../dist/query/index.js")
  ]);

  const data = createRayVisualFixtures({
    normalize3,
    vec3,
    aabb,
    capsule,
    ray,
    sphere,
    rayAabbHit: query.rayAabbHit,
    rayCapsuleHit: query.rayCapsuleHit,
    raySphereHit: query.raySphereHit,
    rayTriangleHit: query.rayTriangleHit
  });

  const svgPath = path.join(outDir, "ray-fixtures.svg");
  const htmlPath = path.join(outDir, "ray-fixtures.html");
  const html3dPath = path.join(outDir, "ray-fixtures-3d.html");
  const manifestPath = path.join(outDir, "ray-fixtures.json");

  await mkdir(outDir, { recursive: true });
  await writeFile(svgPath, renderRayVisualSvg(data), "utf8");
  await writeFile(htmlPath, renderRayVisual2dHtml(data), "utf8");
  await writeFile(html3dPath, renderRayVisual3dHtml(data), "utf8");
  await writeFile(manifestPath, `${stableStringify(data)}\n`, "utf8");

  console.log(`Ray visual fixtures written:
- ${path.relative(root, svgPath)}
- ${path.relative(root, htmlPath)}
- ${path.relative(root, html3dPath)}
- ${path.relative(root, manifestPath)}`);
}

function renderPanel(fixture, x, y) {
  const project = makeProject(fixture.view, x, y);
  const content = [
    `<rect class="panel" x="${x}" y="${y}" width="${PANEL_W}" height="${PANEL_H}" rx="6"/>`,
    ...renderGrid(project, fixture.view, x, y),
    ...fixture.shapes.flatMap((shape) => renderShape2d(shape, fixture, project)),
    renderRay2d(fixture, project),
    renderPoint2d(project, fixture.axes, fixture.ray.origin, "origin", 4.5),
    fixture.hit ? renderPoint2d(project, fixture.axes, fixture.hit.point, "hit", 5) : "",
    `<text class="label" x="${x + 14}" y="${y + 22}">${escapeXml(fixture.title)}</text>`,
    `<text class="mono" x="${x + 14}" y="${y + PANEL_H - 30}">${escapeXml(fixture.summary)}</text>`,
    fixture.note ? `<text class="small" x="${x + 14}" y="${y + PANEL_H - 12}">${escapeXml(fixture.note)}</text>` : ""
  ];
  return `<g>${content.filter(Boolean).join("\n")}</g>`;
}

function renderGrid(project, view, x, y) {
  const lines = [];
  for (let gx = Math.ceil(view.minX); gx <= Math.floor(view.maxX); gx++) {
    const p0 = project({ x: gx, y: view.minY });
    const p1 = project({ x: gx, y: view.maxY });
    lines.push(`<line class="${gx === 0 ? "axis" : "grid"}" x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}"/>`);
  }
  for (let gy = Math.ceil(view.minY); gy <= Math.floor(view.maxY); gy++) {
    const p0 = project({ x: view.minX, y: gy });
    const p1 = project({ x: view.maxX, y: gy });
    lines.push(`<line class="${gy === 0 ? "axis" : "grid"}" x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}"/>`);
  }
  lines.push(`<text class="small" x="${x + PANEL_W - 42}" y="${y + PANEL_H - 10}">+${escapeXml("X")}</text>`);
  return lines;
}

function renderShape2d(shape, fixture, project) {
  if (shape.kind === "aabb") {
    const min = project(toPanelPoint(shape.value.min, fixture.axes));
    const max = project(toPanelPoint(shape.value.max, fixture.axes));
    const x = Math.min(min.x, max.x);
    const y = Math.min(min.y, max.y);
    return [`<rect class="shape" x="${x}" y="${y}" width="${Math.abs(max.x - min.x)}" height="${Math.abs(max.y - min.y)}"/>`];
  }

  if (shape.kind === "sphere") {
    const s = shape.value;
    const center = project(toPanelPoint(s.center, fixture.axes));
    const rx = Math.abs(project({ x: getAxis(s.center, fixture.axes[0]) + s.radius, y: getAxis(s.center, fixture.axes[1]) }).x - center.x);
    const ry = Math.abs(project({ x: getAxis(s.center, fixture.axes[0]), y: getAxis(s.center, fixture.axes[1]) + s.radius }).y - center.y);
    return [`<ellipse class="shape" cx="${center.x}" cy="${center.y}" rx="${rx}" ry="${ry}"/>`];
  }

  if (shape.kind === "triangle") {
    const points = shape.value.map((p) => {
      const q = project(toPanelPoint(p, fixture.axes));
      return `${q.x},${q.y}`;
    }).join(" ");
    return [`<polygon class="shape" points="${points}"/>`];
  }

  if (shape.kind === "capsule") {
    const cap = shape.value;
    const p0 = project(toPanelPoint(cap.point0, fixture.axes));
    const p1 = project(toPanelPoint(cap.point1, fixture.axes));
    const radiusPoint = project({
      x: getAxis(cap.point0, fixture.axes[0]) + cap.radius,
      y: getAxis(cap.point0, fixture.axes[1])
    });
    const strokeWidth = Math.max(2, Math.abs(radiusPoint.x - p0.x) * 2);
    return [
      `<line x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}" stroke="#0f766e" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.28"/>`,
      `<line x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}" stroke="#0f766e" stroke-width="2"/>`
    ];
  }

  return [];
}

function renderRay2d(fixture, project) {
  const origin = toPanelPoint(fixture.ray.origin, fixture.axes);
  const dir = toPanelPoint(fixture.ray.direction, fixture.axes);
  const start = project(origin);
  const end = project({
    x: origin.x + dir.x * fixture.rayLength,
    y: origin.y + dir.y * fixture.rayLength
  });
  if (fixture.rayLength === 0) {
    return `<circle class="miss-ray" cx="${start.x}" cy="${start.y}" r="12" fill="none"/>`;
  }
  return `<line class="${fixture.hit ? "ray" : "miss-ray"}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"/>`;
}

function renderPoint2d(project, axes, value, className, radius) {
  const p = project(toPanelPoint(value, axes));
  return `<circle class="${className}" cx="${p.x}" cy="${p.y}" r="${radius}"/>`;
}

function makeProject(view, panelX, panelY) {
  const innerX = panelX + 30;
  const innerY = panelY + 38;
  const innerW = PANEL_W - 58;
  const innerH = PANEL_H - 76;
  return ({ x, y }) => ({
    x: innerX + ((x - view.minX) / (view.maxX - view.minX)) * innerW,
    y: innerY + (1 - ((y - view.minY) / (view.maxY - view.minY))) * innerH
  });
}

function toPanelPoint(value, axes) {
  return {
    x: getAxis(value, axes[0]),
    y: getAxis(value, axes[1])
  };
}

function getAxis(value, axis) {
  return value[axis];
}

function hitSummary(hit) {
  if (!hit) return "miss";
  return `t=${fmt(hit.distance)}, p=(${fmt(hit.point.x)}, ${fmt(hit.point.y)}, ${fmt(hit.point.z)})`;
}

function fmt(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function baseCss() {
  return `
    body { margin: 24px; font-family: Inter, Segoe UI, Arial, sans-serif; color: #172033; background: #ffffff; }
    main { max-width: 980px; margin: 0 auto; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { color: #475569; line-height: 1.45; }
    table { border-collapse: collapse; width: 100%; margin-top: 18px; font-size: 14px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    th { color: #334155; background: #f8fafc; }
    code { font-family: Consolas, monospace; }
  `;
}

function sortForJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortForJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortForJson(value[key])]));
  }
  return value;
}

function escapeScriptJson(value) {
  return value.replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
}

function escapeHtml(value) {
  return escapeXml(value).replaceAll('"', "&quot;");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
