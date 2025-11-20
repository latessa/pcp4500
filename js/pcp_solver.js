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

function getStorageMode() {
    const el = document.querySelector('input[name="storageMode"]:checked');
    return el ? el.value : 'memory';
}

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
        const storageMode = getStorageMode();
        statusDiv.textContent += `Using ${storageMode === 'disk' ? 'IndexedDB (disk-backed)' : 'in-memory'} storage for visited states.\n`;

        const result = await solvePCP(ups, downs, maxDepth, minDepth, storageMode);
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

async function solvePCP(ups, downs, maxDepth, minDepth, storageMode) {
    const numTiles = ups.length;
    const tileIndices = Array.from({ length: numTiles }, (_, i) => i);

    const transTable = await createStateStore(storageMode);

    const startTime = performance.now();

    for (let limit = Math.max(1, minDepth); limit <= maxDepth; ++limit) {
        if (shouldStop) break;

        await transTable.clear();


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
        const existing = await transTable.get(stateKey);
        const rem = depthLeft - 1;

        if (existing) {
            if (existing.depth >= rem && (minDepth === 0 || existing.pathLen >= path.length)) {
                continue;
            }
        }

        await transTable.set(stateKey, { depth: rem, pathLen: path.length });

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

// Storage abstraction for visited transitions (transTable)
async function createStateStore(mode) {
    if (mode === 'memory') return new InMemoryStateStore();
    if (!('indexedDB' in window)) {
        statusDiv.textContent += '\nIndexedDB not available; falling back to in-memory.';
        return new InMemoryStateStore();
    }

    // Create the on-disk IndexedDB store, then wrap with a small in-memory LRU cache
    const idbStore = await IndexedDBStateStore.create('pcp_solver', 'transitions');
    const DEFAULT_CACHE_SIZE = 1000; // number of entries to keep in RAM for faster lookups
    statusDiv.textContent += `Caching ${DEFAULT_CACHE_SIZE} most-recent states in memory for speed.\n`;
    return new LRUCacheStore(idbStore, DEFAULT_CACHE_SIZE);
}

/**
 * LRUCacheStore wraps a delegate async key/value store and keeps a small in-memory LRU cache
 * to reduce IndexedDB round-trips while bounding memory usage.
 * Methods: get(key) -> value | undefined, set(key, value), clear().
 */
class LRUCacheStore {
    constructor(delegate, maxEntries = 1000) {
        this.delegate = delegate;
        this.maxEntries = Math.max(1, Math.floor(maxEntries));
        // Use Map to preserve insertion order: oldest first.
        this.map = new Map();
    }
    async get(key) {
        if (this.map.has(key)) {
            const val = this.map.get(key);
            // Move to most-recent
            this.map.delete(key);
            this.map.set(key, val);
            return val;
        }
        const val = await this.delegate.get(key);
        if (val !== undefined) {
            this.map.set(key, val);
            // Evict oldest if needed
            if (this.map.size > this.maxEntries) {
                const oldestKey = this.map.keys().next().value;
                this.map.delete(oldestKey);
            }
        }
        return val;
    }
    async set(key, value) {
        // Update memory cache
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, value);
        if (this.map.size > this.maxEntries) {
            const oldestKey = this.map.keys().next().value;
            this.map.delete(oldestKey);
        }
        // Write-through to delegate (IndexedDB)
        return this.delegate.set(key, value);
    }
    async clear() {
        this.map.clear();
        return this.delegate.clear();
    }
}

class InMemoryStateStore {
    constructor() {
        this.map = new Map();
    }
    async get(key) {
        return this.map.get(key);
    }
    async set(key, value) {
        this.map.set(key, value);
    }
    async clear() {
        this.map.clear();
    }
}

class IndexedDBStateStore {
    constructor(db, storeName) {
        this.db = db;
        this.storeName = storeName;
    }
    static create(dbName, storeName) {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'key' });
                }
            };
            req.onsuccess = () => {
                resolve(new IndexedDBStateStore(req.result, storeName));
            };
            req.onerror = () => reject(req.error);
        });
    }
    _tx(mode) {
        return this.db.transaction(this.storeName, mode).objectStore(this.storeName);
    }
    async get(key) {
        return new Promise((resolve, reject) => {
            const store = this._tx('readonly');
            const req = store.get(key);
            req.onsuccess = () => {
                const rec = req.result;
                resolve(rec ? rec.value : undefined);
            };
            req.onerror = () => reject(req.error);
        });
    }
    async set(key, value) {
        return new Promise((resolve, reject) => {
            const store = this._tx('readwrite');
            const req = store.put({ key, value });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
    async clear() {
        return new Promise((resolve, reject) => {
            const store = this._tx('readwrite');
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
}
