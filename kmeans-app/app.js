const DEFAULT_SAMPLE_INPUT = `30
2 3
3 4
1 5
2 6
4 2
10 10
11 9
12 11
9 12
10 12
20 5
21 4
19 6
22 5
20 6
5 20
6 21
4 22
5 23
6 20
18 18
19 19
20 18
21 17
22 18
7 7
8 8
7 9
8 6
6 8
3
3 4
10 11
20 6`;

const DEFAULT_VIEWPORT = { minX: -50, maxX: 50, minY: -50, maxY: 50 };
const COLOR_SEED = 1234567;

class SeededRandom {
    constructor(seed) {
        this.seed = (Number(seed) >>> 0) || 1;
    }

    next() {
        this.seed = (1664525 * this.seed + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }

    range(min, max) {
        return min + (max - min) * this.next();
    }

    int(min, maxInclusive) {
        return Math.floor(this.range(min, maxInclusive + 1));
    }
}

const state = {
    basePoints: [],
    baseCentroids: [],
    points: [],
    centroids: [],
    colors: [],
    iteration: 0,
    shift: 0,
    phase: "Ready",
    noteTone: "success",
    running: false,
    paused: false,
    abortRequested: false,
    mode: "manual",
    clickTool: "point",
    cursorWorld: null
};

const els = {
    manualPoints: document.getElementById("manualPoints"),
    manualCentroids: document.getElementById("manualCentroids"),
    a4Input: document.getElementById("a4Input"),
    a4File: document.getElementById("a4File"),
    genProfile: document.getElementById("genProfile"),
    genPointCount: document.getElementById("genPointCount"),
    genCentroidCount: document.getElementById("genCentroidCount"),
    genSpread: document.getElementById("genSpread"),
    genNoise: document.getElementById("genNoise"),
    genWorldSize: document.getElementById("genWorldSize"),
    genSeed: document.getElementById("genSeed"),
    delayRange: document.getElementById("delayRange"),
    delayInput: document.getElementById("delayInput"),
    stopMode: document.getElementById("stopMode"),
    epsilonInput: document.getElementById("epsilonInput"),
    maxIterationsInput: document.getElementById("maxIterationsInput"),
    frameCountInput: document.getElementById("frameCountInput"),
    startBtn: document.getElementById("startBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    resetBtn: document.getElementById("resetBtn"),
    clearSceneBtn: document.getElementById("clearSceneBtn"),
    applyManualBtn: document.getElementById("applyManualBtn"),
    mirrorSceneBtn: document.getElementById("mirrorSceneBtn"),
    syncCanvasSceneBtn: document.getElementById("syncCanvasSceneBtn"),
    clearCanvasPointsBtn: document.getElementById("clearCanvasPointsBtn"),
    clearCanvasCentroidsBtn: document.getElementById("clearCanvasCentroidsBtn"),
    applyA4Btn: document.getElementById("applyA4Btn"),
    loadSampleBtn: document.getElementById("loadSampleBtn"),
    generateSceneBtn: document.getElementById("generateSceneBtn"),
    statPoints: document.getElementById("statPoints"),
    statCentroids: document.getElementById("statCentroids"),
    statIteration: document.getElementById("statIteration"),
    statPhase: document.getElementById("statPhase"),
    statShift: document.getElementById("statShift"),
    dataNote: document.getElementById("dataNote"),
    cursorLabel: document.getElementById("cursorLabel"),
    toolLabel: document.getElementById("toolLabel"),
    simCanvas: document.getElementById("simCanvas"),
    modeButtons: [...document.querySelectorAll(".mode-button")],
    modePanels: [...document.querySelectorAll(".mode-panel")],
    toolButtons: [...document.querySelectorAll(".tool-button")]
};

const ctx = els.simCanvas.getContext("2d");

class RunAbort extends Error {}

function clonePoints(points) {
    return points.map((point) => ({ x: point.x, y: point.y, cluster: point.cluster ?? -1 }));
}

function cloneCentroids(centroids) {
    return centroids.map((centroid) => ({ x: centroid.x, y: centroid.y }));
}

function formatCoordinateList(points) {
    return points
        .map((point) => `${trimNumber(point.x)} ${trimNumber(point.y)}`)
        .join("\n");
}

function trimNumber(value) {
    return Number.parseFloat(value.toFixed(4)).toString();
}

function showNote(message, tone = "success") {
    state.noteTone = tone;
    els.dataNote.textContent = message;
    els.dataNote.classList.toggle("is-error", tone === "error");
    els.dataNote.classList.toggle("is-success", tone === "success");
}

function syncNoteForPhase() {
    if (state.running) {
        showNote("Simulation is running. Pause to inspect the current state or reset to rebuild the scene.", "success");
    }
}

function parseCoordinateLines(text) {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    return lines.map((line, index) => {
        const parts = line.split(/[\s,]+/).filter(Boolean);
        if (parts.length !== 2) {
            throw new Error(`Line ${index + 1} must contain exactly two numbers.`);
        }

        const x = Number(parts[0]);
        const y = Number(parts[1]);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error(`Line ${index + 1} has an invalid coordinate.`);
        }

        return { x, y, cluster: -1 };
    });
}

function parseA4Input(text) {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) {
        throw new Error("The A4 input box is empty.");
    }

    let index = 0;

    const pointCount = Number(tokens[index++]);
    if (!Number.isInteger(pointCount) || pointCount <= 0) {
        throw new Error("The first value must be a positive integer point count.");
    }

    const points = [];
    for (let i = 0; i < pointCount; i += 1) {
        const x = Number(tokens[index++]);
        const y = Number(tokens[index++]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error("Point data is incomplete or malformed.");
        }
        points.push({ x, y, cluster: -1 });
    }

    const centroidCount = Number(tokens[index++]);
    if (!Number.isInteger(centroidCount) || centroidCount <= 0) {
        throw new Error("The centroid count must be a positive integer.");
    }

    const centroids = [];
    for (let i = 0; i < centroidCount; i += 1) {
        const x = Number(tokens[index++]);
        const y = Number(tokens[index++]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error("Centroid data is incomplete or malformed.");
        }
        centroids.push({ x, y });
    }

    if (index !== tokens.length) {
        throw new Error("Extra values were found after the expected A4 format.");
    }

    return { points, centroids };
}

function generateColors(count) {
    const random = new SeededRandom(COLOR_SEED);
    const colors = [];

    for (let i = 0; i < count; i += 1) {
        colors.push({
            r: Math.floor(random.range(0, 255)),
            g: Math.floor(random.range(0, 255)),
            b: Math.floor(random.range(0, 255))
        });
    }

    return colors;
}

function shadeColor(color) {
    return {
        r: Math.round(color.r * 0.35 + 255 * 0.65),
        g: Math.round(color.g * 0.35 + 255 * 0.65),
        b: Math.round(color.b * 0.35 + 255 * 0.65)
    };
}

function distanceSquared(point, centroid) {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    return dx * dx + dy * dy;
}

function assignClusters(points, centroids) {
    if (!centroids.length) {
        for (const point of points) {
            point.cluster = -1;
        }
        return;
    }

    for (const point of points) {
        let bestDistance = Number.POSITIVE_INFINITY;
        let bestCluster = 0;

        for (let i = 0; i < centroids.length; i += 1) {
            const currentDistance = distanceSquared(point, centroids[i]);
            if (currentDistance < bestDistance) {
                bestDistance = currentDistance;
                bestCluster = i;
            }
        }

        point.cluster = bestCluster;
    }
}

function updateCentroids(points, centroids) {
    const sumX = new Array(centroids.length).fill(0);
    const sumY = new Array(centroids.length).fill(0);
    const counts = new Array(centroids.length).fill(0);

    for (const point of points) {
        if (point.cluster >= 0 && point.cluster < centroids.length) {
            sumX[point.cluster] += point.x;
            sumY[point.cluster] += point.y;
            counts[point.cluster] += 1;
        }
    }

    return centroids.map((centroid, index) => {
        if (counts[index] === 0) {
            if (!points.length) {
                return { x: centroid.x, y: centroid.y };
            }

            const fallback = points[Math.floor(Math.random() * points.length)];
            return { x: fallback.x, y: fallback.y };
        }

        return {
            x: sumX[index] / counts[index],
            y: sumY[index] / counts[index]
        };
    });
}

function computeCentroidShift(oldCentroids, newCentroids) {
    let total = 0;

    for (let i = 0; i < oldCentroids.length; i += 1) {
        const dx = newCentroids[i].x - oldCentroids[i].x;
        const dy = newCentroids[i].y - oldCentroids[i].y;
        total += dx * dx + dy * dy;
    }

    return total;
}

function computeBounds(points, centroids) {
    if (!points.length && !centroids.length) {
        return { ...DEFAULT_VIEWPORT };
    }

    let minX = DEFAULT_VIEWPORT.minX;
    let maxX = DEFAULT_VIEWPORT.maxX;
    let minY = DEFAULT_VIEWPORT.minY;
    let maxY = DEFAULT_VIEWPORT.maxY;

    for (const point of points) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }

    for (const centroid of centroids) {
        minX = Math.min(minX, centroid.x);
        maxX = Math.max(maxX, centroid.x);
        minY = Math.min(minY, centroid.y);
        maxY = Math.max(maxY, centroid.y);
    }

    let dx = maxX - minX;
    let dy = maxY - minY;

    if (dx < 1e-6) {
        dx = 1;
    }
    if (dy < 1e-6) {
        dy = 1;
    }

    const padX = dx * 0.05;
    const padY = dy * 0.05;

    return {
        minX: minX - padX,
        maxX: maxX + padX,
        minY: minY - padY,
        maxY: maxY + padY
    };
}

function worldToScreen(point, bounds) {
    const dx = Math.max(1e-9, bounds.maxX - bounds.minX);
    const dy = Math.max(1e-9, bounds.maxY - bounds.minY);
    const sx = (point.x - bounds.minX) / dx;
    const sy = (point.y - bounds.minY) / dy;

    return {
        x: Math.round(Math.min(1, Math.max(0, sx)) * els.simCanvas.width),
        y: els.simCanvas.height - Math.round(Math.min(1, Math.max(0, sy)) * els.simCanvas.height)
    };
}

function screenToWorld(clientX, clientY) {
    const rect = els.simCanvas.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * els.simCanvas.width;
    const localY = ((clientY - rect.top) / rect.height) * els.simCanvas.height;

    const bounds = computeBounds(state.points, state.centroids);
    const dx = bounds.maxX - bounds.minX;
    const dy = bounds.maxY - bounds.minY;

    const x = bounds.minX + (localX / els.simCanvas.width) * dx;
    const y = bounds.maxY - (localY / els.simCanvas.height) * dy;

    return { x, y };
}

function drawBackground(bounds) {
    ctx.clearRect(0, 0, els.simCanvas.width, els.simCanvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, els.simCanvas.width, els.simCanvas.height);

    if (!state.centroids.length) {
        return;
    }

    const scale = 0.35;
    const shadeWidth = Math.max(1, Math.floor(els.simCanvas.width * scale));
    const shadeHeight = Math.max(1, Math.floor(els.simCanvas.height * scale));
    const imageData = ctx.createImageData(shadeWidth, shadeHeight);
    const data = imageData.data;
    const dx = bounds.maxX - bounds.minX;
    const dy = bounds.maxY - bounds.minY;

    for (let y = 0; y < shadeHeight; y += 1) {
        for (let x = 0; x < shadeWidth; x += 1) {
            const worldX = bounds.minX + (x / shadeWidth) * dx;
            const worldY = bounds.maxY - (y / shadeHeight) * dy;

            let bestIndex = 0;
            let bestDistance = Number.POSITIVE_INFINITY;

            for (let c = 0; c < state.centroids.length; c += 1) {
                const ddx = worldX - state.centroids[c].x;
                const ddy = worldY - state.centroids[c].y;
                const distance = ddx * ddx + ddy * ddy;
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIndex = c;
                }
            }

            const shade = shadeColor(state.colors[bestIndex]);
            const index = (y * shadeWidth + x) * 4;
            data[index] = shade.r;
            data[index + 1] = shade.g;
            data[index + 2] = shade.b;
            data[index + 3] = 255;
        }
    }

    const buffer = document.createElement("canvas");
    buffer.width = shadeWidth;
    buffer.height = shadeHeight;
    buffer.getContext("2d").putImageData(imageData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buffer, 0, 0, els.simCanvas.width, els.simCanvas.height);
}

function drawGrid(bounds) {
    const steps = 10;
    ctx.save();
    ctx.strokeStyle = "rgba(20, 36, 46, 0.07)";
    ctx.lineWidth = 1;

    for (let i = 1; i < steps; i += 1) {
        const t = i / steps;
        const x = Math.round(t * els.simCanvas.width);
        const y = Math.round(t * els.simCanvas.height);

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, els.simCanvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(els.simCanvas.width, y);
        ctx.stroke();
    }

    if (bounds.minX <= 0 && bounds.maxX >= 0) {
        const axisX = worldToScreen({ x: 0, y: 0 }, bounds).x;
        ctx.strokeStyle = "rgba(20, 36, 46, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(axisX, 0);
        ctx.lineTo(axisX, els.simCanvas.height);
        ctx.stroke();
    }

    if (bounds.minY <= 0 && bounds.maxY >= 0) {
        const axisY = worldToScreen({ x: 0, y: 0 }, bounds).y;
        ctx.strokeStyle = "rgba(20, 36, 46, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, axisY);
        ctx.lineTo(els.simCanvas.width, axisY);
        ctx.stroke();
    }

    ctx.fillStyle = "rgba(20, 36, 46, 0.5)";
    ctx.font = '12px "IBM Plex Mono"';
    ctx.fillText(`x: ${trimNumber(bounds.minX)} to ${trimNumber(bounds.maxX)}`, 16, els.simCanvas.height - 16);
    ctx.fillText(`y: ${trimNumber(bounds.minY)} to ${trimNumber(bounds.maxY)}`, 16, els.simCanvas.height - 32);
    ctx.restore();
}

function drawPoints(bounds) {
    const radius = state.points.length > 1200 ? 2.5 : state.points.length > 500 ? 3.2 : 4;

    for (const point of state.points) {
        const screen = worldToScreen(point, bounds);
        const color = point.cluster >= 0 ? state.colors[point.cluster] : { r: 95, g: 95, b: 95 };

        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fill();

        ctx.lineWidth = 1;
        ctx.strokeStyle = "#000000";
        ctx.stroke();
    }
}

function drawCentroids(bounds) {
    for (let i = 0; i < state.centroids.length; i += 1) {
        const screen = worldToScreen(state.centroids[i], bounds);
        const color = state.colors[i];

        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = "#000000";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fill();
    }
}

function drawOverlays(bounds) {
    ctx.save();
    ctx.fillStyle = "#111111";
    ctx.font = '700 28px "Space Grotesk"';
    ctx.fillText(`Iteration: ${state.iteration}`, 22, 40);

    ctx.font = '500 15px "IBM Plex Mono"';
    ctx.fillText(`Phase: ${state.phase}`, 22, 66);
    ctx.fillText(`Points: ${state.points.length} | Centroids: ${state.centroids.length}`, 22, 88);
    ctx.restore();

    if (state.cursorWorld) {
        const cursorText = `(${trimNumber(state.cursorWorld.x)}, ${trimNumber(state.cursorWorld.y)})`;
        ctx.font = '500 14px "IBM Plex Mono"';
        const metrics = ctx.measureText(cursorText);
        const boxWidth = metrics.width + 24;
        const boxX = els.simCanvas.width - boxWidth - 18;
        const boxY = 18;

        ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
        ctx.strokeStyle = "rgba(20, 36, 46, 0.16)";
        ctx.lineWidth = 1;
        roundRect(ctx, boxX, boxY, boxWidth, 34, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#14242e";
        ctx.fillText(cursorText, boxX + 12, boxY + 22);
    }
}

function roundRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
}

function render() {
    const bounds = computeBounds(state.points, state.centroids);
    drawBackground(bounds);
    drawGrid(bounds);
    drawPoints(bounds);
    drawCentroids(bounds);
    drawOverlays(bounds);

    els.statPoints.textContent = `${state.points.length}`;
    els.statCentroids.textContent = `${state.centroids.length}`;
    els.statIteration.textContent = `${state.iteration}`;
    els.statPhase.textContent = state.phase;
    els.statShift.textContent = state.shift.toFixed(4);
    els.cursorLabel.textContent = state.cursorWorld
        ? `Cursor: ${trimNumber(state.cursorWorld.x)}, ${trimNumber(state.cursorWorld.y)}`
        : "Cursor: --";
    els.toolLabel.textContent = `Tool: ${toolLabel(state.clickTool)}`;
}

function toolLabel(tool) {
    if (tool === "centroid") {
        return "Add Centroids";
    }
    if (tool === "erase") {
        return "Erase Nearest";
    }
    return "Add Points";
}

function syncTextareasFromBase() {
    els.manualPoints.value = formatCoordinateList(state.basePoints);
    els.manualCentroids.value = formatCoordinateList(state.baseCentroids);
}

function setBaseScene(points, centroids, noteMessage) {
    state.basePoints = clonePoints(points).map((point) => ({ ...point, cluster: -1 }));
    state.baseCentroids = cloneCentroids(centroids);
    state.colors = generateColors(state.baseCentroids.length);
    resetToBase(false);
    syncTextareasFromBase();

    if (noteMessage) {
        showNote(noteMessage, "success");
    }
}

function resetToBase(updateNote = true) {
    state.points = clonePoints(state.basePoints).map((point) => ({ ...point, cluster: -1 }));
    state.centroids = cloneCentroids(state.baseCentroids);
    state.colors = generateColors(state.centroids.length);
    state.iteration = 0;
    state.shift = 0;
    state.phase = state.centroids.length ? "Ready" : "Add centroids to begin";

    if (updateNote) {
        showNote("Scene reset to the latest input dataset.", "success");
    }

    render();
}

function setMode(mode) {
    state.mode = mode;
    for (const button of els.modeButtons) {
        button.classList.toggle("active", button.dataset.mode === mode);
    }
    for (const panel of els.modePanels) {
        panel.classList.toggle("active", panel.dataset.modePanel === mode);
    }
}

function setTool(tool) {
    state.clickTool = tool;
    for (const button of els.toolButtons) {
        button.classList.toggle("active", button.dataset.tool === tool);
    }
    render();
}

function applyManualData() {
    try {
        const points = parseCoordinateLines(els.manualPoints.value);
        const centroids = parseCoordinateLines(els.manualCentroids.value).map(({ x, y }) => ({ x, y }));
        if (!centroids.length) {
            throw new Error("Add at least one centroid before starting the simulation.");
        }
        setBaseScene(points, centroids, "Typed coordinates loaded into the simulation scene.");
    } catch (error) {
        showNote(error.message, "error");
    }
}

function mirrorCurrentScene() {
    els.manualPoints.value = formatCoordinateList(state.points);
    els.manualCentroids.value = formatCoordinateList(state.centroids);
    showNote("The current canvas scene has been mirrored into the manual text boxes.", "success");
}

function applyA4Data(text) {
    try {
        const { points, centroids } = parseA4Input(text);
        els.a4Input.value = text.trim();
        setBaseScene(points, centroids, "A4 dataset loaded successfully.");
    } catch (error) {
        showNote(error.message, "error");
    }
}

async function loadSampleFile() {
    try {
        const response = await fetch("input.txt");
        if (!response.ok) {
            throw new Error("input.txt could not be fetched in this environment.");
        }
        const text = await response.text();
        els.a4Input.value = text.trim();
        applyA4Data(text);
    } catch (error) {
        els.a4Input.value = DEFAULT_SAMPLE_INPUT;
        applyA4Data(DEFAULT_SAMPLE_INPUT);
        showNote(`Loaded the embedded sample because ${error.message}`, "success");
    }
}

function gaussian(random, mean, stdDev) {
    let u1 = 0;
    let u2 = 0;
    while (u1 === 0) {
        u1 = random.next();
    }
    while (u2 === 0) {
        u2 = random.next();
    }
    const mag = Math.sqrt(-2 * Math.log(u1));
    const z0 = mag * Math.cos(2 * Math.PI * u2);
    return mean + z0 * stdDev;
}

function profileDefaults(profile) {
    if (profile === "wide") {
        return { spreadScale: 1.9, noiseScale: 1.6, centroidOffset: 0.22 };
    }
    if (profile === "insane") {
        return { spreadScale: 3.2, noiseScale: 3.1, centroidOffset: 0.46 };
    }
    return { spreadScale: 1.0, noiseScale: 1.0, centroidOffset: 0.12 };
}

function generateScene() {
    const pointCount = Number(els.genPointCount.value);
    const centroidCount = Number(els.genCentroidCount.value);
    const spread = Number(els.genSpread.value);
    const noiseRatio = Number(els.genNoise.value);
    const worldSize = Number(els.genWorldSize.value);
    const seed = Number(els.genSeed.value);
    const profile = els.genProfile.value;

    if (!Number.isInteger(pointCount) || pointCount <= 0) {
        showNote("Point count must be a positive integer.", "error");
        return;
    }
    if (!Number.isInteger(centroidCount) || centroidCount <= 0) {
        showNote("Centroid count must be a positive integer.", "error");
        return;
    }
    if (!Number.isFinite(spread) || spread <= 0 || !Number.isFinite(worldSize) || worldSize <= 0) {
        showNote("Spread and world size must be positive numbers.", "error");
        return;
    }

    const random = new SeededRandom(seed);
    const profileConfig = profileDefaults(profile);
    const points = [];
    const centroids = [];
    const trueCenters = [];
    const noisePoints = Math.floor(pointCount * Math.max(0, Math.min(0.8, noiseRatio * profileConfig.noiseScale)));
    const clusterPoints = pointCount - noisePoints;
    const usableSpread = spread * profileConfig.spreadScale;

    const halfWorld = worldSize / 2;

    for (let i = 0; i < centroidCount; i += 1) {
        trueCenters.push({
            x: random.range(-halfWorld * 0.7, halfWorld * 0.7),
            y: random.range(-halfWorld * 0.7, halfWorld * 0.7)
        });
    }

    for (let i = 0; i < clusterPoints; i += 1) {
        const clusterIndex = i % centroidCount;
        const center = trueCenters[clusterIndex];
        points.push({
            x: gaussian(random, center.x, usableSpread),
            y: gaussian(random, center.y, usableSpread),
            cluster: -1
        });
    }

    for (let i = 0; i < noisePoints; i += 1) {
        points.push({
            x: random.range(-halfWorld * 1.1, halfWorld * 1.1),
            y: random.range(-halfWorld * 1.1, halfWorld * 1.1),
            cluster: -1
        });
    }

    for (let i = 0; i < centroidCount; i += 1) {
        const target = trueCenters[i];
        const offset = worldSize * profileConfig.centroidOffset;
        centroids.push({
            x: target.x + random.range(-offset, offset),
            y: target.y + random.range(-offset, offset)
        });
    }

    setBaseScene(points, centroids, `Generated a ${profile} scene with ${pointCount} points and ${centroidCount} centroids.`);
}

function nearestEntityIndex(worldPoint, entities) {
    if (!entities.length) {
        return -1;
    }

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < entities.length; i += 1) {
        const dx = worldPoint.x - entities[i].x;
        const dy = worldPoint.y - entities[i].y;
        const distance = dx * dx + dy * dy;

        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = i;
        }
    }

    return bestIndex;
}

function updateBaseFromCurrentScene(message) {
    setBaseScene(state.points, state.centroids, message);
}

function clearPointsOnly() {
    if (state.running) {
        return;
    }
    state.points = [];
    updateBaseFromCurrentScene("All points were cleared from the scene.");
}

function clearCentroidsOnly() {
    if (state.running) {
        return;
    }
    state.centroids = [];
    updateBaseFromCurrentScene("All centroids were cleared from the scene.");
}

function handleCanvasInteraction(event) {
    if (state.running) {
        return;
    }

    const worldPoint = screenToWorld(event.clientX, event.clientY);
    state.cursorWorld = worldPoint;

    if (state.clickTool === "point") {
        state.points.push({ x: worldPoint.x, y: worldPoint.y, cluster: -1 });
        updateBaseFromCurrentScene("Point added from the canvas.");
        return;
    }

    if (state.clickTool === "centroid") {
        state.centroids.push({ x: worldPoint.x, y: worldPoint.y });
        updateBaseFromCurrentScene("Centroid added from the canvas.");
        return;
    }

    const combined = state.points.length ? state.points : state.centroids;
    if (!combined.length) {
        showNote("There is nothing on the scene to erase yet.", "error");
        return;
    }

    const pointIndex = nearestEntityIndex(worldPoint, state.points);
    const centroidIndex = nearestEntityIndex(worldPoint, state.centroids);
    const pointDistance = pointIndex >= 0 ? distanceSquared(worldPoint, state.points[pointIndex]) : Number.POSITIVE_INFINITY;
    const centroidDistance = centroidIndex >= 0 ? distanceSquared(worldPoint, state.centroids[centroidIndex]) : Number.POSITIVE_INFINITY;

    if (pointDistance <= centroidDistance) {
        state.points.splice(pointIndex, 1);
        updateBaseFromCurrentScene("Nearest point erased from the canvas.");
    } else {
        state.centroids.splice(centroidIndex, 1);
        updateBaseFromCurrentScene("Nearest centroid erased from the canvas.");
    }
}

function syncControlState() {
    const editingDisabled = state.running;

    els.applyManualBtn.disabled = editingDisabled;
    els.mirrorSceneBtn.disabled = false;
    els.syncCanvasSceneBtn.disabled = editingDisabled;
    els.clearCanvasPointsBtn.disabled = editingDisabled;
    els.clearCanvasCentroidsBtn.disabled = editingDisabled;
    els.applyA4Btn.disabled = editingDisabled;
    els.loadSampleBtn.disabled = editingDisabled;
    els.a4File.disabled = editingDisabled;
    els.generateSceneBtn.disabled = editingDisabled;

    for (const button of els.modeButtons) {
        button.disabled = editingDisabled;
    }
    for (const button of els.toolButtons) {
        button.disabled = editingDisabled;
    }

    els.startBtn.disabled = state.running;
    els.pauseBtn.disabled = !state.running;
    els.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
}

function getRunConfig() {
    return {
        delay: Math.max(20, Number(els.delayInput.value)),
        epsilon: Math.max(0, Number(els.epsilonInput.value)),
        maxIterations: Math.max(1, Number(els.maxIterationsInput.value)),
        stopMode: els.stopMode.value,
        frames: Math.max(2, Number(els.frameCountInput.value))
    };
}

function validateSceneBeforeRun() {
    if (!state.basePoints.length) {
        showNote("Add at least one point before starting the simulation.", "error");
        return false;
    }
    if (!state.baseCentroids.length) {
        showNote("Add at least one centroid before starting the simulation.", "error");
        return false;
    }
    return true;
}

function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForPlayback(ms) {
    let remaining = ms;
    while (remaining > 0) {
        if (state.abortRequested) {
            throw new RunAbort("Simulation aborted.");
        }
        if (state.paused) {
            await sleep(40);
            continue;
        }

        const slice = Math.min(24, remaining);
        await sleep(slice);
        remaining -= slice;
    }
}

async function animateCentroidMove(fromCentroids, toCentroids, config) {
    for (let frame = 1; frame <= config.frames; frame += 1) {
        const t = frame / config.frames;
        state.centroids = fromCentroids.map((centroid, index) => ({
            x: centroid.x * (1 - t) + toCentroids[index].x * t,
            y: centroid.y * (1 - t) + toCentroids[index].y * t
        }));
        state.phase = "Moving centroids";
        render();
        await waitForPlayback(Math.max(1, Math.round(config.delay / config.frames)));
    }
}

async function startSimulation() {
    if (state.running || !validateSceneBeforeRun()) {
        return;
    }

    const config = getRunConfig();

    resetToBase(false);
    state.running = true;
    state.paused = false;
    state.abortRequested = false;
    syncControlState();
    syncNoteForPhase();

    try {
        while (!state.abortRequested) {
            const oldCentroids = cloneCentroids(state.centroids);

            assignClusters(state.points, state.centroids);
            state.phase = "Assigning points";
            render();
            await waitForPlayback(config.delay);

            const newCentroids = updateCentroids(state.points, state.centroids);
            await animateCentroidMove(state.centroids, newCentroids, config);

            state.centroids = newCentroids;
            assignClusters(state.points, state.centroids);
            state.shift = computeCentroidShift(oldCentroids, state.centroids);
            state.iteration += 1;
            state.phase = "Settled";
            render();

            if (config.stopMode === "max" && state.iteration >= config.maxIterations) {
                state.phase = "Reached max iterations";
                showNote(`Simulation stopped after ${state.iteration} iterations.`, "success");
                break;
            }

            if (config.stopMode === "epsilon" && state.shift < config.epsilon) {
                state.phase = "Converged";
                showNote(`Simulation converged in ${state.iteration} iterations with shift ${state.shift.toFixed(4)}.`, "success");
                break;
            }
        }
    } catch (error) {
        if (!(error instanceof RunAbort)) {
            console.error(error);
            showNote("The simulation stopped because of an unexpected runtime error.", "error");
        }
    } finally {
        state.running = false;
        state.paused = false;
        state.abortRequested = false;
        syncControlState();
        render();
    }
}

async function stopSimulation(resetAfterStop = false) {
    if (!state.running) {
        if (resetAfterStop) {
            resetToBase();
        }
        return;
    }

    state.abortRequested = true;
    while (state.running) {
        await sleep(20);
    }

    if (resetAfterStop) {
        resetToBase();
    }
}

function clearEverything() {
    state.basePoints = [];
    state.baseCentroids = [];
    state.points = [];
    state.centroids = [];
    state.colors = [];
    state.iteration = 0;
    state.shift = 0;
    state.phase = "Empty scene";
    syncTextareasFromBase();
    render();
    showNote("Scene cleared. Add points and centroids to begin again.", "success");
}

function wireEvents() {
    els.applyManualBtn.addEventListener("click", applyManualData);
    els.mirrorSceneBtn.addEventListener("click", mirrorCurrentScene);
    els.syncCanvasSceneBtn.addEventListener("click", () => {
        updateBaseFromCurrentScene("Current canvas scene saved as the active dataset.");
    });
    els.clearCanvasPointsBtn.addEventListener("click", clearPointsOnly);
    els.clearCanvasCentroidsBtn.addEventListener("click", clearCentroidsOnly);
    els.applyA4Btn.addEventListener("click", () => applyA4Data(els.a4Input.value));
    els.loadSampleBtn.addEventListener("click", () => {
        void loadSampleFile();
    });
    els.generateSceneBtn.addEventListener("click", generateScene);

    els.startBtn.addEventListener("click", () => {
        void startSimulation();
    });
    els.pauseBtn.addEventListener("click", () => {
        if (!state.running) {
            return;
        }
        state.paused = !state.paused;
        syncControlState();
        render();
        showNote(state.paused ? "Simulation paused." : "Simulation resumed.", "success");
    });
    els.resetBtn.addEventListener("click", () => {
        void stopSimulation(true);
    });
    els.clearSceneBtn.addEventListener("click", () => {
        void stopSimulation(false).then(clearEverything);
    });

    els.modeButtons.forEach((button) => {
        button.addEventListener("click", () => setMode(button.dataset.mode));
    });

    els.toolButtons.forEach((button) => {
        button.addEventListener("click", () => setTool(button.dataset.tool));
    });

    els.delayRange.addEventListener("input", () => {
        els.delayInput.value = els.delayRange.value;
    });
    els.delayInput.addEventListener("input", () => {
        const clamped = Math.max(20, Math.min(900, Number(els.delayInput.value) || 20));
        els.delayInput.value = clamped;
        els.delayRange.value = clamped;
    });

    els.a4File.addEventListener("change", async (event) => {
        const [file] = event.target.files || [];
        if (!file) {
            return;
        }

        try {
            const text = await file.text();
            els.a4Input.value = text.trim();
            applyA4Data(text);
        } catch (error) {
            showNote("The selected file could not be read.", "error");
        }
    });

    els.simCanvas.addEventListener("mousemove", (event) => {
        state.cursorWorld = screenToWorld(event.clientX, event.clientY);
        render();
    });
    els.simCanvas.addEventListener("mouseleave", () => {
        state.cursorWorld = null;
        render();
    });
    els.simCanvas.addEventListener("click", handleCanvasInteraction);
}

function initialize() {
    els.a4Input.value = DEFAULT_SAMPLE_INPUT;
    const sample = parseA4Input(DEFAULT_SAMPLE_INPUT);
    state.basePoints = sample.points;
    state.baseCentroids = sample.centroids;
    state.colors = generateColors(sample.centroids.length);
    syncTextareasFromBase();
    resetToBase(false);
    setMode("manual");
    setTool("point");
    syncControlState();
    render();
}

wireEvents();
initialize();
