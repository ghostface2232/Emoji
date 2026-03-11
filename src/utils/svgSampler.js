// ── SVG path 상수 (viewBox 0-100 기준) ─────────────────

// 사과: 몸통 + 꼭지/잎 두 덩어리
export const APPLE_PATH = [
  'M20.055 82.8671C23.295 83.1571 25.345 81.1371 32.385 81.1371C39.425 81.1371 41.475 83.1571 44.715 82.8671C57.595 81.7171 72.955 45.5671 60.425 31.2471C59.715 30.4371 54.675 24.3871 47.165 23.5871C41.585 22.9971 40.215 25.8771 32.935 25.9471C25.355 26.0271 23.755 22.9371 17.895 23.5271C10.175 24.3071 5.01496 30.5371 4.33496 31.2471C-7.32504 43.4871 6.79496 81.6871 20.055 82.8671Z',
  'M45.3712 16.3999C41.6768 21.2665 35.0461 22.751 32.3951 23.1664C32.0873 20.5203 30.3911 12.7349 34.1106 7.84895C38.8054 1.65949 50.7178 1.35274 50.7178 1.35274C50.7178 1.35274 50.0694 10.2199 45.3712 16.3999Z',
];

export const HEART_PATH =
  'M44.8102 75.945C44.5302 75.945 44.2502 75.867 44.0042 75.711C41.4912 74.11 38.8402 72.315 35.6612 70.059C26.4172 63.499 18.8162 57.193 12.4232 50.776C3.70215 42.022 -0.353849 32.966 0.0241506 23.088C0.0231506 11.619 8.63815 1.76897 20.0622 0.231968C20.0792 0.229968 20.9971 0.117968 21.2481 0.0969677C21.8571 0.0459677 22.4711 0.0149673 23.0861 0.00396729C27.0901 -0.0580327 31.0462 0.710968 34.6282 2.21597C38.8442 3.98697 41.9281 6.80197 44.8111 9.65597C47.6941 6.80197 50.7771 3.98797 54.9941 2.21597C58.5761 0.710968 62.5602 -0.0540322 66.4582 0.00296784C67.1512 0.0159678 67.7652 0.0459681 68.3782 0.0979681C68.6252 0.118968 69.5422 0.229968 69.5422 0.229968C80.9742 1.76697 89.5842 11.603 89.5992 23.117C89.9682 32.983 85.9111 42.031 77.1992 50.775C70.8032 57.195 63.2012 63.502 53.9612 70.058C50.7882 72.309 48.1371 74.105 45.6191 75.709C45.3701 75.867 45.0902 75.945 44.8102 75.945Z';

export const EYE_PATH =
  'M66.7305 0C79.4648 0 89.7881 15.4508 89.7881 34.5098C89.7879 53.5685 79.4647 69.0186 66.7305 69.0186C56.5924 69.0186 47.9829 59.226 44.8936 45.6162C41.8041 59.2259 33.1956 69.0186 23.0576 69.0186C10.3234 69.0186 0.000176327 53.5685 0 34.5098C0 15.4508 10.3232 0 23.0576 0C33.1954 0 41.8039 9.79216 44.8936 23.4014C47.9831 9.79205 56.5927 0 66.7305 0Z';

export const LAPTOP_PATH = [
  'M11.51 8C11.51 5.19974 11.51 3.79961 12.0549 2.73005C12.5343 1.78924 13.2992 1.02433 14.24 0.544967C15.3096 0 16.7097 0 19.51 0H89.9318C92.7321 0 94.1322 0 95.2018 0.544967C96.1426 1.02433 96.9075 1.78924 97.3869 2.73005C97.9318 3.79961 97.9318 5.19974 97.9318 8V51.4014C97.9318 54.2016 97.9318 55.6018 97.3869 56.6713C96.9075 57.6121 96.1426 58.377 95.2018 58.8564C94.1322 59.4014 92.7321 59.4014 89.9318 59.4014H19.51C16.7097 59.4014 15.3096 59.4014 14.24 58.8564C13.2992 58.377 12.5343 57.6121 12.0549 56.6713C11.51 55.6018 11.51 54.2016 11.51 51.4014V8Z',
  'M10.1537 63.1975C11.0091 62.3856 11.4367 61.9797 11.9298 61.6898C12.367 61.4327 12.8408 61.2437 13.3348 61.1292C13.892 61 14.4817 61 15.661 61H93.7808C94.9601 61 95.5498 61 96.1069 61.1292C96.601 61.2437 97.0748 61.4327 97.512 61.6898C98.005 61.9797 98.4327 62.3856 99.2881 63.1975L102.43 66.1799C106.969 70.4873 109.238 72.641 109.418 74.4991C109.575 76.1105 108.941 77.6979 107.719 78.7589C106.309 79.9824 103.18 79.9824 96.9231 79.9824H12.5187C6.26168 79.9824 3.13317 79.9824 1.72313 78.7589C0.50035 77.6979 -0.133032 76.1105 0.0234493 74.4991C0.203895 72.641 2.47306 70.4873 7.01139 66.1799L10.1537 63.1975Z',
];

// ── 헬퍼: 임시 SVG DOM 생성/제거 ───────────────────────

/**
 * 하나 이상의 path 문자열로 SVG를 생성한다.
 * @param {string | string[]} pathData - 단일 문자열 또는 배열
 * @returns {{ svg: SVGSVGElement, paths: SVGPathElement[], bbox: DOMRect }}
 */
function createSVGPaths(pathData) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.appendChild(svg);

  const dList = Array.isArray(pathData) ? pathData : [pathData];
  const paths = dList.map((d) => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return p;
  });

  // 전체 bounding box 계산
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    const b = p.getBBox();
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  const bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  return { svg, paths, bbox };
}

function removeSVG(svg) {
  document.body.removeChild(svg);
}

/**
 * 원본 bbox 기준 좌표를 bounds에 맞게 변환한다 (종횡비 유지).
 * @param {{ x: number, y: number }[]} points
 * @param {{ x: number, y: number, width: number, height: number }} srcBBox
 * @param {{ x: number, y: number, width: number, height: number }} bounds
 */
function transformPoints(points, srcBBox, bounds) {
  // 종횡비 유지하며 bounds 내 중앙 정렬
  const scaleX = bounds.width / srcBBox.width;
  const scaleY = bounds.height / srcBBox.height;
  const scale = Math.min(scaleX, scaleY);
  const fitW = srcBBox.width * scale;
  const fitH = srcBBox.height * scale;
  const offX = bounds.x + (bounds.width - fitW) / 2;
  const offY = bounds.y + (bounds.height - fitH) / 2;

  return points.map((p) => ({
    x: offX + ((p.x - srcBBox.x) / srcBBox.width) * fitW,
    y: offY + ((p.y - srcBBox.y) / srcBBox.height) * fitH,
  }));
}

function createFillContext(pathData) {
  const { svg, paths, bbox } = createSVGPaths(pathData);
  const point = svg.createSVGPoint();
  const edgeSamples = [];

  for (const path of paths) {
    const length = path.getTotalLength();
    const samples = Math.max(240, Math.round(length * 2.4));
    for (let i = 0; i < samples; i++) {
      const pt = path.getPointAtLength((i / samples) * length);
      edgeSamples.push({ x: pt.x, y: pt.y });
    }
  }

  function isInside(x, y) {
    point.x = x;
    point.y = y;
    return paths.some((path) => path.isPointInFill(point));
  }

  function distToEdge(x, y) {
    let min = Infinity;
    for (const sample of edgeSamples) {
      const dx = x - sample.x;
      const dy = y - sample.y;
      const dist = Math.hypot(dx, dy);
      if (dist < min) min = dist;
    }
    return min;
  }

  return { svg, paths, bbox, isInside, distToEdge };
}

function estimateFillArea(bbox, isInside) {
  const step = Math.max(Math.min(bbox.width, bbox.height) / 120, 0.75);
  let insideCount = 0;

  for (let y = bbox.y + step * 0.5; y < bbox.y + bbox.height; y += step) {
    for (let x = bbox.x + step * 0.5; x < bbox.x + bbox.width; x += step) {
      if (isInside(x, y)) insideCount++;
    }
  }

  return insideCount * step * step;
}

function hashNoise(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function generatePackedCandidates(context, spacing, options = {}) {
  const {
    bbox,
    isInside,
    distToEdge,
  } = context;
  const {
    jitterRatio = 0.18,
    edgeInsetRatio = 0.24,
    rowOffsetJitter = 0.18,
    scoreFn = null,
  } = options;

  const rowHeight = spacing * Math.sqrt(3) / 2;
  const edgeInset = spacing * edgeInsetRatio;
  const candidates = [];
  let row = 0;

  for (let y = bbox.y + rowHeight * 0.55; y <= bbox.y + bbox.height - rowHeight * 0.2; y += rowHeight, row++) {
    const rowDrift = (hashNoise(row * 11.3, spacing * 0.17) - 0.5) * spacing * rowOffsetJitter;
    const offsetX = (row % 2) * (spacing / 2) + rowDrift;

    for (let x = bbox.x + spacing * 0.55 + offsetX; x <= bbox.x + bbox.width - spacing * 0.2; x += spacing) {
      const jitterX = (hashNoise(x, y) - 0.5) * spacing * jitterRatio;
      const jitterY = (hashNoise(y + 19.19, x + 7.73) - 0.5) * rowHeight * jitterRatio * 1.2;
      const px = x + jitterX;
      const py = y + jitterY;

      if (!isInside(px, py)) continue;

      const edgeDist = distToEdge(px, py);
      if (edgeDist < edgeInset) continue;

      candidates.push({
        x: px,
        y: py,
        anchorX: px,
        anchorY: py,
        edgeDist,
        noise: hashNoise(px + 3.1, py + 1.7),
        score: scoreFn ? scoreFn({ x: px, y: py, edgeDist }) : 0,
      });
    }
  }

  return candidates;
}

function selectPackedSubset(candidates, count, spacing) {
  if (candidates.length <= count) {
    return candidates.slice();
  }

  const ordered = candidates
    .slice()
    .sort((a, b) => (
      b.edgeDist + b.noise * spacing * 0.2 + b.score * spacing -
      (a.edgeDist + a.noise * spacing * 0.2 + a.score * spacing)
    ));
  const selected = [];
  let minDist = spacing * 0.74;

  while (selected.length < count && minDist > spacing * 0.42) {
    for (let i = 0; i < ordered.length; i++) {
      if (selected.length >= count) break;

      const candidate = ordered[i];
      let blocked = false;

      for (let j = 0; j < selected.length; j++) {
        const dx = candidate.x - selected[j].x;
        const dy = candidate.y - selected[j].y;
        if (dx * dx + dy * dy < minDist * minDist) {
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        selected.push(candidate);
      }
    }

    minDist *= 0.94;
  }

  if (selected.length < count) {
    for (let i = 0; i < ordered.length && selected.length < count; i++) {
      if (!selected.includes(ordered[i])) {
        selected.push(ordered[i]);
      }
    }
  }

  return selected.slice(0, count);
}

function relaxPackedPoints(points, context, spacing, options = {}) {
  const {
    isInside,
    distToEdge,
  } = context;
  const {
    iterations = 5,
    edgeInsetRatio = 0.24,
  } = options;

  const minEdge = spacing * edgeInsetRatio * 0.8;
  let relaxed = points.map((point) => ({ ...point }));

  for (let iter = 0; iter < iterations; iter++) {
    relaxed = relaxed.map((point, index) => {
      let fx = (point.anchorX - point.x) * 0.035;
      let fy = (point.anchorY - point.y) * 0.035;

      for (let j = 0; j < relaxed.length; j++) {
        if (j === index) continue;

        const other = relaxed[j];
        const dx = point.x - other.x;
        const dy = point.y - other.y;
        const distSq = dx * dx + dy * dy;

        if (distSq === 0 || distSq > spacing * spacing) continue;

        const dist = Math.sqrt(distSq);
        const overlap = spacing - dist;
        const nx = dist > 0.0001 ? dx / dist : Math.cos((index + 1) * 1.618);
        const ny = dist > 0.0001 ? dy / dist : Math.sin((index + 1) * 1.618);

        fx += nx * overlap * 0.22;
        fy += ny * overlap * 0.22;
      }

      const nextX = point.x + fx;
      const nextY = point.y + fy;

      if (isInside(nextX, nextY) && distToEdge(nextX, nextY) >= minEdge) {
        return { ...point, x: nextX, y: nextY };
      }

      if (isInside(point.anchorX, point.anchorY) && distToEdge(point.anchorX, point.anchorY) >= minEdge) {
        return { ...point, x: point.anchorX, y: point.anchorY };
      }

      return point;
    });
  }

  return relaxed;
}

// ── 1. 외곽선 균등 샘플링 ───────────────────────────────

/**
 * SVG path 외곽선을 따라 numPoints개의 균등 분포 좌표를 추출한다.
 * @param {string | string[]} pathData
 * @param {number} numPoints
 * @param {{ x: number, y: number, width: number, height: number }} bounds
 * @returns {{ x: number, y: number }[]}
 */
export function samplePointsFromPath(pathData, numPoints, bounds) {
  const { svg, paths, bbox } = createSVGPaths(pathData);

  // 각 path의 길이 비율에 따라 포인트 수 배분
  const lengths = paths.map((p) => p.getTotalLength());
  const totalLength = lengths.reduce((a, b) => a + b, 0);

  const raw = [];
  for (let pi = 0; pi < paths.length; pi++) {
    const count = Math.round((lengths[pi] / totalLength) * numPoints);
    const step = lengths[pi] / count;
    for (let i = 0; i < count; i++) {
      const pt = paths[pi].getPointAtLength(i * step);
      raw.push({ x: pt.x, y: pt.y });
    }
  }

  removeSVG(svg);
  return transformPoints(raw, bbox, bounds);
}

// ── 2. 내부 채우기 샘플링 ───────────────────────────────

/**
 * SVG path 내부를 채우는 점 분포를 생성한다.
 * rejection sampling + 간소화된 Poisson 최소 거리 + 외곽 밀도 바이어스.
 *
 * @param {string | string[]} pathData
 * @param {number} numPoints
 * @param {{ x: number, y: number, width: number, height: number }} bounds
 * @param {{ minDist?: number, densityBias?: number }} [options]
 * @returns {{ x: number, y: number }[]}
 */
export function samplePointsFromFill(pathData, numPoints, bounds, options = {}) {
  const { minDist = 0, densityBias = 0, inset = 0 } = options;
  const { svg, paths, bbox } = createSVGPaths(pathData);

  // 외곽 경계 포인트 (밀도 바이어스 + inset 체크 겸용)
  const edgeSamples = [];
  for (const p of paths) {
    const len = p.getTotalLength();
    const n = 300;
    for (let i = 0; i < n; i++) {
      const pt = p.getPointAtLength((i / n) * len);
      edgeSamples.push({ x: pt.x, y: pt.y });
    }
  }

  /** 어느 path이든 내부이면 true */
  function isInside(x, y) {
    const pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return paths.some((p) => p.isPointInFill(pt));
  }

  /** 가장 가까운 외곽까지의 거리 */
  function distToEdge(x, y) {
    let min = Infinity;
    for (const ep of edgeSamples) {
      const d = Math.hypot(x - ep.x, y - ep.y);
      if (d < min) min = d;
    }
    return min;
  }

  const raw = [];
  const maxAttempts = numPoints * 80;
  let attempts = 0;

  while (raw.length < numPoints && attempts < maxAttempts) {
    attempts++;

    const cx = bbox.x + Math.random() * bbox.width;
    const cy = bbox.y + Math.random() * bbox.height;

    if (!isInside(cx, cy)) continue;

    const edgeDist = distToEdge(cx, cy);

    // inset: 외곽에서 최소 이만큼 안쪽이어야 함 (삐져나감 방지)
    if (inset > 0 && edgeDist < inset) continue;

    // 외곽 밀도 바이어스: 외곽에 가까울수록 accept, 안쪽일수록 reject 확률↑
    if (densityBias > 0) {
      const maxDist = Math.min(bbox.width, bbox.height) * 0.4;
      const normalized = Math.min(edgeDist / maxDist, 1); // 0=외곽, 1=중심부
      // normalized^0.5로 외곽 선호도를 부드럽게
      if (Math.random() < Math.pow(normalized, 0.5) * densityBias) continue;
    }

    // 최소 거리 필터
    if (minDist > 0) {
      const tooClose = raw.some((p) => Math.hypot(cx - p.x, cy - p.y) < minDist);
      if (tooClose) continue;
    }

    raw.push({ x: cx, y: cy });
  }

  removeSVG(svg);
  return transformPoints(raw, bbox, bounds);
}

/**
 * SVG 내부를 조밀하게 채우되, 완전히 기계적인 격자로 보이지 않도록
 * 약한 jitter + local relaxation을 거친 패킹 포인트를 만든다.
 *
 * @param {string | string[]} pathData
 * @param {number} numPoints
 * @param {{ x: number, y: number, width: number, height: number }} bounds
 * @param {{ jitterRatio?: number, edgeInsetRatio?: number, relaxIterations?: number }} [options]
 * @returns {{ x: number, y: number }[]}
 */
export function samplePackedPointsFromFill(pathData, numPoints, bounds, options = {}) {
  const context = createFillContext(pathData);
  const { svg, bbox, isInside } = context;
  const {
    jitterRatio = 0.18,
    edgeInsetRatio = 0.24,
    relaxIterations = 5,
    spacingScale = 1,
    rowOffsetJitter = 0.18,
    scoreFn = null,
  } = options;

  const fillArea = estimateFillArea(bbox, isInside);
  const packingDensity = Math.sqrt(3) / 2;
  const baseSpacing = Math.sqrt(fillArea / (Math.max(numPoints, 1) * packingDensity));

  let low = baseSpacing * 0.72;
  let high = baseSpacing * 1.28;
  let chosen = generatePackedCandidates(context, low, {
    jitterRatio,
    edgeInsetRatio,
    rowOffsetJitter,
    scoreFn,
  });

  for (let i = 0; i < 10; i++) {
    const mid = (low + high) * 0.5;
    const candidates = generatePackedCandidates(context, mid, {
      jitterRatio,
      edgeInsetRatio,
      rowOffsetJitter,
      scoreFn,
    });

    if (candidates.length >= numPoints) {
      chosen = candidates;
      low = mid;
    } else {
      high = mid;
    }
  }

  while (chosen.length < numPoints) {
    low *= 0.94;
    chosen = generatePackedCandidates(context, low, {
      jitterRatio,
      edgeInsetRatio,
      rowOffsetJitter,
      scoreFn,
    });
  }

  const denseSpacing = low * spacingScale;
  const denseCandidates = generatePackedCandidates(context, denseSpacing, {
    jitterRatio,
    edgeInsetRatio,
    rowOffsetJitter,
    scoreFn,
  });
  const selected = selectPackedSubset(denseCandidates, numPoints, denseSpacing);
  const relaxed = relaxPackedPoints(selected, context, denseSpacing, {
    iterations: relaxIterations,
    edgeInsetRatio,
  });

  removeSVG(svg);

  const sorted = relaxed
    .map(({ x, y }) => ({ x, y }))
    .sort((a, b) => {
      const rowGap = denseSpacing * 0.6;
      if (Math.abs(a.y - b.y) > rowGap) return a.y - b.y;
      return a.x - b.x;
    });

  return transformPoints(sorted, bbox, bounds);
}

// ── 3. 육각형 격자 채우기 ────────────────────────────────

/**
 * SVG path 내부를 육각형 격자(hexagonal grid)로 빈틈없이 채운다.
 * #2 레퍼런스처럼 균일하고 촘촘한 배치를 만든다.
 *
 * @param {string | string[]} pathData
 * @param {number} cellSize - 격자 간격 (이모지 크기에 맞춤)
 * @param {{ x: number, y: number, width: number, height: number }} bounds
 * @returns {{ x: number, y: number }[]}
 */
export function sampleHexGrid(pathData, cellSize, bounds) {
  const { svg, paths, bbox } = createSVGPaths(pathData);

  const rowH = cellSize * Math.sqrt(3) / 2; // 육각형 행 간격
  const raw = [];
  let row = 0;

  for (let y = bbox.y; y <= bbox.y + bbox.height; y += rowH, row++) {
    const offsetX = (row % 2) * (cellSize / 2); // 짝수/홀수 행 오프셋
    for (let x = bbox.x + offsetX; x <= bbox.x + bbox.width; x += cellSize) {
      // path 내부 판정
      const pt = svg.createSVGPoint();
      pt.x = x;
      pt.y = y;
      if (paths.some((p) => p.isPointInFill(pt))) {
        raw.push({ x, y });
      }
    }
  }

  removeSVG(svg);
  return transformPoints(raw, bbox, bounds);
}

// ── 4. 원형 분포 (galaxy 등) ────────────────────────────

/**
 * 원형 영역 내부에 균일 분포 좌표를 생성한다.
 * @param {number} cx - 중심 X
 * @param {number} cy - 중심 Y
 * @param {number} radius
 * @param {number} count
 * @returns {{ x: number, y: number }[]}
 */
export function samplePointsInCircle(cx, cy, radius, count) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = radius * Math.sqrt(Math.random()); // sqrt로 균일 분포
    points.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  }
  return points;
}
