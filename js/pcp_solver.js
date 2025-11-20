let isRunning = false;
let shouldStop = false;

const tilesInput = document.getElementById('tilesInput');
const maxDepthInput = document.getElementById('maxDepth');
const minDepthInput = document.getElementById('minDepth');
const solveBtn = document.getElementById('solveBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const tilePreview = document.getElementById('tilePreview');
const resultContainer = document.getElementById('resultContainer');
const resSequence = document.getElementById('resSequence');
const resString = document.getElementById('resString');
const resLength = document.getElementById('resLength');

tilesInput.addEventListener('input', updateTilePreview);
solveBtn.addEventListener('click', startSolver);
stopBtn.addEventListener('click', stopSolver);

updateTilePreview();

function updateTilePreview() {
    const text = tilesInput.value.trim();
    tilePreview.innerHTML = '';
    if (!text) return;

    const parts = text.split(/\s+/);
    parts.forEach((part, idx) => {
        if (part.includes('/')) {
            const chip = document.createElement('div');
            chip.className = 'tile-chip';
            chip.innerHTML = `<span class="idx">${idx + 1}</span><span class="val">${part}</span>`;
            tilePreview.appendChild(chip);
        }
    });
}

function stopSolver() {
    shouldStop = true;
    statusDiv.textContent += '\nStopping...';
}

async function startSolver() {
    if (isRunning) return;

    const tilesText = tilesInput.value.trim();
    if (!tilesText) {
        alert("Please enter some tiles.");
        return;
    }

    const maxDepth = parseInt(maxDepthInput.value, 10);
    const minDepth = parseInt(minDepthInput.value, 10) || 0;

    // Parse tiles
    const ups = [];
    const downs = [];
    const rawTiles = tilesText.split(/\s+/);
    for (const t of rawTiles) {
        const parts = t.split('/');
        if (parts.length !== 2) {
            statusDiv.textContent = `Error: Invalid tile format "${t}". Expected up/down.`;
            statusDiv.className = 'error';
            return;
        }
        ups.push(parts[0]);
        downs.push(parts[1]);
    }

    isRunning = true;
    shouldStop = false;
    solveBtn.disabled = true;
    stopBtn.style.display = 'block';
    statusDiv.textContent = 'Starting solver...\n';
    statusDiv.className = '';
    resultContainer.style.display = 'none';

    try {
        const result = await solvePCP(ups, downs, maxDepth, minDepth);
        if (result.found) {
            statusDiv.textContent += `\nSolution found at depth ${result.path.length}.`;
            resultContainer.style.display = 'block';
            resSequence.textContent = result.path.join(' ');

            let upStr = "";
            for (const idx of result.path) {
                upStr += ups[idx - 1];
            }
            resString.textContent = upStr;
            resLength.textContent = upStr.length;

        } else {
            if (shouldStop) {
                statusDiv.textContent += `\nStopped by user.`;
            } else {
                statusDiv.textContent += `\nNo solution found up to depth ${maxDepth}.`;
            }
        }
    } catch (e) {
        console.error(e);
        statusDiv.textContent += `\nError: ${e.message}`;
        statusDiv.className = 'error';
    } finally {
        isRunning = false;
        solveBtn.disabled = false;
        stopBtn.style.display = 'none';
    }
}

async function solvePCP(ups, downs, maxDepth, minDepth) {
    const numTiles = ups.length;
    const tileIndices = Array.from({ length: numTiles }, (_, i) => i);

    let transTable = new Map();

    const startTime = performance.now();

    for (let limit = Math.max(1, minDepth); limit <= maxDepth; ++limit) {
        if (shouldStop) break;

        transTable.clear();


        const path = [];

        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
        statusDiv.textContent = `Searching depth ${limit}... (Time: ${elapsed}s)\n`;

        await new Promise(r => setTimeout(r, 0));

        if (await dfsLimit('=', "", limit, path, ups, downs, tileIndices, transTable, minDepth)) {
            return { found: true, path: path };
        }
    }

    return { found: false };
}

async function dfsLimit(side, suff, depthLeft, path, ups, downs, tileIndices, transTable, minDepth) {
    if (shouldStop) return false;
    if (depthLeft === 0) return false;

    if (globalNodeCounter++ % 5000 === 0) {
        const now = performance.now();
        if (now - lastYieldTime > 100) {
            await new Promise(r => setTimeout(r, 0));
            lastYieldTime = now;
            statusDiv.textContent = `Searching depth ${path.length + depthLeft}... Nodes: ${globalNodeCounter}`;
        }
    }

    for (const i of tileIndices) {
        const up = ups[i];
        const down = downs[i];

        let newUp, newDown;
        if (side === '=') {
            newUp = up;
            newDown = down;
        } else if (side === 'u') {
            newUp = suff + up;
            newDown = down;
        } else { // side === 'd'
            newUp = up;
            newDown = suff + down;
        }

        let l = 0;
        const minLen = Math.min(newUp.length, newDown.length);
        while (l < minLen && newUp[l] === newDown[l]) {
            l++;
        }

        if (l < minLen) continue;

        if (l === newUp.length && l === newDown.length) {
            path.push(i + 1);
            if (path.length >= minDepth) return true;

            if (await dfsLimit('=', "", depthLeft - 1, path, ups, downs, tileIndices, transTable, minDepth)) return true;

            if (await dfsLimit('=', "", depthLeft - 1, path, ups, downs, tileIndices, transTable, minDepth)) return true;

            path.pop();
            continue;
        }

        let newSide, newSuff;
        if (l === newUp.length) {
            newSide = 'd';
            newSuff = newDown.substring(l);
        } else {
            newSide = 'u';
            newSuff = newUp.substring(l);
        }

        const stateKey = newSide + "|" + newSuff;
        const existing = transTable.get(stateKey);
        const rem = depthLeft - 1;

        if (existing) {
            if (existing.depth >= rem && (minDepth === 0 || existing.pathLen >= path.length)) {
                continue;
            }
        }

        transTable.set(stateKey, { depth: rem, pathLen: path.length });

        path.push(i + 1);
        if (await dfsLimit(newSide, newSuff, depthLeft - 1, path, ups, downs, tileIndices, transTable, minDepth)) {
            return true;
        }
        path.pop();
    }
    return false;
}

let globalNodeCounter = 0;
let lastYieldTime = 0;
