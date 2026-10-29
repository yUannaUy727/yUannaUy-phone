// Bounded, cooperative export. Never stringify/parse an entire database.
(() => {
'use strict';
const LIMIT = 2048, CHUNK = 65536;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const put = (o, k, value) => Object.defineProperty(o, k, {value, enumerable:true, writable:true, configurable:true});
const clock = () => typeof performance === 'undefined' ? Date.now() : performance.now();

async function buildBlob(input, options = {}) {
    const mode = options.mode || 'compact';
    if (!['compact', 'compatible', 'yuan'].includes(mode)) throw Error('未知备份格式');
    if (options.compress !== false && typeof CompressionStream === 'undefined') throw Error('当前浏览器不支持压缩备份，请更新浏览器后再试');
    const metadata = new WeakMap(), longStrings = new Map(), active = new WeakSet();
    let deadline = clock() + 8, ticks = 0, visited = 0, processed = 0;
    let hashA = 2166136261, hashB = 5381, originalLength = 0;
    let lastProgress = 0;
    function progress(message, force = false) {
        if (force || clock() - lastProgress > 700) {
            lastProgress = clock();
            options.onProgress?.(message);
        }
    }
    async function run(iterator, sink) {
        // Message tasks let the page respond without accumulating nested-timer
        // delays. Periodic timers keep other event sources from being starved.
        // Each pass owns and closes its ports, including error paths.
        const channel = typeof MessageChannel === 'function' ? new MessageChannel() : null;
        let resume, lastTimer = clock();
        if (channel) channel.port1.onmessage = () => { const callback = resume; resume = null; callback(); };
        const pause = () => new Promise(resolve => {
            if (channel && clock() - lastTimer < 32) { resume = resolve; channel.port2.postMessage(null); }
            else { lastTimer = clock(); setTimeout(resolve, 0); }
        });
        try {
            if (options.signal?.aborted) throw Error('备份已取消');
            while (true) {
                const step = iterator.next();
                if (step.done) return step.value;
                if (options.signal?.aborted) throw Error('备份已取消');
                if (sink && step.value !== null && step.value !== undefined) await sink(step.value);
                if (clock() >= deadline) {
                    await pause();
                    deadline = clock() + 8;
                }
            }
        } finally {
            if (channel) { channel.port1.close(); channel.port2.close(); }
        }
    }
    // Hash exact JSON tokens incrementally for the existing restore checksum.
    function token(text) {
        let a = 2166136261, b = 5381;
        originalLength += text.length;
        for (let offset = 0; offset < text.length; offset += 16384) {
            const end = Math.min(text.length, offset + 16384);
            for (let i = offset; i < end; i++) {
                const c = text.charCodeAt(i);
                hashA = Math.imul(hashA ^ c, 16777619); hashB = Math.imul(hashB, 33) ^ c;
                a = Math.imul(a ^ c, 16777619); b = Math.imul(b, 33) ^ c;
            }
        }
        return {length:text.length, a:a >>> 0, b:b >>> 0};
    }
    function* longToken(text) {
        let a = 2166136261, b = 5381;
        originalLength += text.length;
        for (let offset = 0; offset < text.length; offset += 16384) {
            const end = Math.min(text.length, offset + 16384);
            for (let i = offset; i < end; i++) {
                const c = text.charCodeAt(i);
                hashA = Math.imul(hashA ^ c, 16777619); hashB = Math.imul(hashB, 33) ^ c;
                a = Math.imul(a ^ c, 16777619); b = Math.imul(b, 33) ^ c;
            }
            yield null;
        }
        return {length:text.length, a:a >>> 0, b:b >>> 0};
    }
    function mix(state, info, tag) {
        state.a = Math.imul(state.a ^ info.a ^ tag, 16777619);
        state.a = Math.imul(state.a ^ info.length, 16777619);
        state.b = Math.imul(state.b, 33) ^ info.b ^ tag;
        state.b = Math.imul(state.b, 33) ^ info.length;
    }
    function normalized(value, key) {
        if (value && (typeof value === 'object' || typeof value === 'function')) {
            if (typeof value.toJSON === 'function') value = value.toJSON(key);
            if (value instanceof Number || value instanceof String || value instanceof Boolean) value = value.valueOf();
        }
        return value;
    }
    function omitted(value) { return value === undefined || typeof value === 'function' || typeof value === 'symbol'; }
    function* snapshot(value) {
        if (++ticks % 256 === 0) yield null;
        visited++;
        if (visited % 1024 === 0) progress('正在整理备份 · ' + visited.toLocaleString() + ' 项');
        if (value === null || typeof value !== 'object') {
            const text = JSON.stringify(value);
            const info = text.length > 32768 ? (yield* longToken(text)) : token(text);
            const saved = typeof value === 'number' ? (Number.isFinite(value) ? (value === 0 ? 0 : value) : null) : value;
            info.value = saved;
            if (typeof value === 'string' && text.length >= LIMIT) longStrings.set(value, info);
            return info;
        }
        if (active.has(value)) throw Error('数据存在循环引用，无法导出');
        active.add(value);
        const array = Array.isArray(value), copy = array ? [] : {};
        const state = {a:array ? 2166136261 : 2166136262, b:array ? 5381 : 5382};
        let length = 2, count = 0;
        token(array ? '[' : '{');
        // Capture the array length/keys once; the snapshot is independent of live data.
        const keys = array ? null : Object.keys(value), total = array ? value.length : keys.length;
        for (let i = 0; i < total; i++) {
            const key = array ? i : keys[i];
            let child = normalized(value[key], String(key));
            if (omitted(child)) { if (!array) continue; child = null; }
            if (count++) { token(','); length++; }
            if (!array) {
                const keyInfo = token(JSON.stringify(key)); token(':');
                length += keyInfo.length + 1; mix(state, keyInfo, 75);
            }
            const result = yield* snapshot(child);
            if (key === '__proto__') put(copy, key, result.value);
            else copy[key] = result.value;
            length += result.length; mix(state, result, 86);
        }
        token(array ? ']' : '}');
        active.delete(value);
        const info = {length, a:state.a >>> 0, b:state.b >>> 0, value:copy};
        if (length >= LIMIT) metadata.set(copy, info);
        return info;
    }

    progress('正在整理备份…', true);
    const captured = await run(snapshot(normalized(input, '')));
    const root = captured.value;
    const originalDigest = originalLength + ':' + (hashA >>> 0) + ':' + (hashB >>> 0);
    const refs = [], seen = new Map();
    // Fingerprints only select candidates. Exact comparison prevents hash collisions
    // from ever replacing unequal data, and does not create giant JSON strings.
    function* equal(left, right) {
        if (left === right) return true;
        const pending = [{left, right, index:0, keys:null}];
        while (pending.length) {
            if (++ticks % 256 === 0) yield null;
            const frame = pending[pending.length - 1], a = frame.left, b = frame.right;
            if (!frame.keys) {
                if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
                const ak = Object.keys(a), bk = Object.keys(b);
                if (ak.length !== bk.length) return false;
                for (let i = 0; i < ak.length; i++) {
                    if (++ticks % 256 === 0) yield null;
                    if (ak[i] !== bk[i]) return false;
                }
                frame.keys = ak;
            }
            if (frame.index === frame.keys.length) { pending.pop(); continue; }
            const key = frame.keys[frame.index++], av = a[key], bv = b[key];
            if (av === bv) continue;
            if (!av || !bv || typeof av !== 'object' || typeof bv !== 'object') return false;
            pending.push({left:av, right:bv, index:0, keys:null});
        }
        return true;
    }
    const compression = options.compress === false ? new TransformStream() : new CompressionStream('gzip');
    const writer = compression.writable.getWriter();
    const blobPromise = new Response(compression.readable, {headers:{'Content-Type':'application/octet-stream'}}).blob();
    // Attach a rejection handler immediately; a failed compressor must not leave
    // an unhandled rejection while the producer is awaiting backpressure.
    blobPromise.catch(() => {});
    const encoder = new TextEncoder();
    let pieces = [], buffered = 0;
    function* flush() {
        if (!buffered) return;
        const text = pieces.join(''); pieces = []; buffered = 0;
        yield text;
    }
    function* write(text) {
        for (let offset = 0; offset < text.length;) {
            let end = Math.min(text.length, offset + CHUNK);
            // Never split a UTF-16 surrogate pair between TextEncoder calls.
            if (end < text.length && text.charCodeAt(end - 1) >= 0xd800 && text.charCodeAt(end - 1) <= 0xdbff) end--;
            const part = text.slice(offset, end); pieces.push(part); buffered += part.length; offset = end;
            if (buffered >= CHUNK) yield* flush();
        }
    }
    function* emit(value, path, deduplicate) {
        if (++ticks % 256 === 0) yield null;
        processed++;
        if (processed % 1024 === 0) progress((mode === 'compact' ? '正在去重并压缩 · ' : '正在压缩备份 · ') + Math.min(99, Math.floor(processed / visited * 100)) + '%');
        if (deduplicate && path.length && value !== null && (typeof value === 'object' || typeof value === 'string') &&
            !(typeof value === 'object' && !Array.isArray(value) && own(value, 'archives')) &&
            !(Array.isArray(value) && ['characters', 'groups'].includes(path[path.length - 1]))) {
            const info = typeof value === 'string' ? longStrings.get(value) : metadata.get(value);
            if (info) {
                const signature = info.length + ':' + info.a + ':' + info.b;
                const candidates = seen.get(signature) || [];
                for (const source of candidates) {
                    if ((yield* equal(value, source.value))) {
                        refs.push({path:path.slice(), source:source.path.slice()});
                        yield* write('null'); return;
                    }
                }
                candidates.push({value, path:path.slice()}); seen.set(signature, candidates);
            }
        }
        if (value === null || typeof value !== 'object') { yield* write(JSON.stringify(value)); return; }
        const array = Array.isArray(value); yield* write(array ? '[' : '{');
        let n = 0;
        for (const key of Object.keys(value)) {
            if (n++) yield* write(',');
            if (!array) { yield* write(JSON.stringify(key)); yield* write(':'); }
            path.push(array ? Number(key) : key);
            yield* emit(value[key], path, deduplicate);
            path.pop();
        }
        yield* write(array ? ']' : '}');
    }
    function* yuan() {
        let rows = 0, messages = 0, items = 0;
        function* row(value) { if (rows++) yield* write('\n'); yield* emit(value, [], false); }
        const keys = Object.keys(root).filter(k => !['_exportVersion', '_exportTimestamp'].includes(k));
        yield* row({type:'header', format:'ovo-stream-backup', formatRevision:1, exportVersion:'3.0', exportTimestamp:root._exportTimestamp || Date.now(), partial:false, exportTables:null, dataKeys:keys});
        for (const key of keys) {
            const value = root[key];
            if (Array.isArray(value)) {
                yield* row({type:'array-start', key});
                for (let index = 0; index < value.length; index++) {
                    const item = value[index];
                    if (['characters', 'groups'].includes(key)) {
                        const {history = [], ...rest} = item;
                        yield* row({type:'chat-start', key, chatIndex:index, value:rest}); items++;
                        for (let i = 0; i < history.length; i += 50) {
                            const chunk = history.slice(i, i + 50);
                            yield* row({type:'chat-history', key, chatIndex:index, value:chunk}); messages += chunk.length;
                        }
                        yield* row({type:'chat-end', key, chatIndex:index});
                    } else { yield* row({type:'array-item', key, index, value:item}); items++; }
                }
                yield* row({type:'array-end', key});
            } else if (value && typeof value === 'object') {
                yield* row({type:'object-start', key});
                for (const property of Object.keys(value)) { yield* row({type:'object-entry', key, property, value:value[property]}); items++; }
                yield* row({type:'object-end', key});
            } else { yield* row({type:'value', key, value}); items++; }
        }
        yield* row({type:'footer', recordCount:rows, processedItems:items, processedMessages:messages, completed:true});
    }
    function* output() {
        progress(mode === 'compact' ? '正在去重并压缩…' : '正在压缩备份…', true);
        if (mode === 'compact') {
            yield* write('{"format":' + JSON.stringify(window.UwUBackupCodec.FORMAT) + ',"originalDigest":' + JSON.stringify(originalDigest) + ',"data":');
            yield* emit(root, [], true);
            yield* write(',"refs":'); yield* emit(refs, [], false); yield* write('}');
        } else if (mode === 'yuan') yield* yuan();
        else yield* emit(root, [], false);
        yield* flush();
    }
    try {
        await run(output(), text => writer.write(encoder.encode(text)));
        await writer.close();
        const blob = await blobPromise;
        progress('备份文件已准备好', true);
        return blob;
    } catch (error) {
        await writer.abort(error).catch(() => {});
        await blobPromise.catch(() => {});
        throw error;
    } finally {
        seen.clear(); longStrings.clear(); writer.releaseLock();
    }
}
// Manual, selective and automatic backups share one memory budget.
let queue = Promise.resolve();
function createBlob(input, options = {}) {
    const result = queue.then(() => buildBlob(input, options));
    queue = result.then(() => undefined, () => undefined);
    return result;
}
window.UwUBackupExport = {createBlob};
})();
