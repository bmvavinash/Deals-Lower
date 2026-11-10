const http = require('http');

/**
 * Resolve WebSocket constructor cleanly (Node 22+ built-in global.WebSocket or ws fallback)
 */
function getWebSocketClass() {
  if (typeof global.WebSocket === 'function') return global.WebSocket;
  return require('ws');
}

/**
 * Fetch JSON from Chrome DevTools HTTP endpoint (e.g. /json/list, /json/version)
 */
function fetchChromeJson(port, endpointPath, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: endpointPath, timeout: timeoutMs },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Invalid JSON from Chrome ${port}${endpointPath}: ${err.message}`));
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`Chrome port ${port}${endpointPath} timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
  });
}

async function listChromeTargets(port = 9223) {
  const targets = await fetchChromeJson(port, '/json/list', 4000);
  return Array.isArray(targets) ? targets : [];
}

/**
 * Connect directly to a Chrome CDP target WebSocket without calling Network.enable
 * (bypasses Chrome 156 + Puppeteer Network.enable hang on WebUI/background targets).
 */
async function connectCdpSocket(wsUrl, defaultTimeoutMs = 20000) {
  const WS = getWebSocketClass();
  const ws = new WS(wsUrl);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { ws.close(); } catch (_) {}
      reject(new Error(`WebSocket connect timed out after ${defaultTimeoutMs}ms`));
    }, defaultTimeoutMs);

    const onOpen = () => {
      clearTimeout(timer);
      cleanupInit();
      resolve();
    };
    const onError = (ev) => {
      clearTimeout(timer);
      cleanupInit();
      reject(new Error(ev?.message || 'WebSocket connection failed'));
    };
    const cleanupInit = () => {
      if (ws.removeEventListener) {
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
      }
    };

    if (ws.addEventListener) {
      ws.addEventListener('open', onOpen);
      ws.addEventListener('error', onError);
    } else {
      ws.once('open', onOpen);
      ws.once('error', onError);
    }
  });

  let nextId = 1;
  const pending = new Map();

  const onMessage = (ev) => {
    const raw = ev?.data !== undefined ? ev.data.toString() : ev.toString();
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }
    if (!msg.id || !pending.has(msg.id)) return;
    const entry = pending.get(msg.id);
    pending.delete(msg.id);
    clearTimeout(entry.timer);
    if (msg.error) {
      entry.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
    } else {
      entry.resolve(msg.result || {});
    }
  };

  if (ws.addEventListener) {
    ws.addEventListener('message', onMessage);
  } else {
    ws.on('message', onMessage);
  }

  const send = (method, params = {}, timeoutMs = defaultTimeoutMs) => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try {
        ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        pending.delete(id);
        clearTimeout(timer);
        reject(err);
      }
    });
  };

  const evaluate = async (fnOrExpr, ...args) => {
    const expression = typeof fnOrExpr === 'function'
      ? `(${fnOrExpr.toString()})(...${JSON.stringify(args)})`
      : String(fnOrExpr);
    const res = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      const text = res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'Script evaluation error';
      throw new Error(text);
    }
    return res.result ? res.result.value : undefined;
  };

  const getCookies = async (urls = []) => {
    const res = await send('Network.getCookies', urls.length ? { urls } : {});
    return res.cookies || [];
  };

  const navigate = async (url, waitMs = 2500) => {
    await send('Page.navigate', { url });
    if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
  };

  const bringToFront = async () => {
    await send('Page.bringToFront', {}).catch(() => {});
  };

  const captureScreenshot = async (opts = {}) => {
    const res = await send('Page.captureScreenshot', {
      format: opts.format || 'jpeg',
      quality: opts.quality || 62,
      fromSurface: true
    });
    return res.data;
  };

  const clickPoint = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };

  const pressKey = async (key) => {
    const codeMap = {
      Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 },
      ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }
    };
    const def = codeMap[key] || { key, code: key };
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...def });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...def });
  };

  const close = async () => {
    for (const [, entry] of pending.entries()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('CDP socket closed'));
    }
    pending.clear();
    try { ws.close(); } catch (_) {}
  };

  return {
    send,
    evaluate,
    getCookies,
    navigate,
    bringToFront,
    captureScreenshot,
    clickPoint,
    pressKey,
    close
  };
}

/**
 * Open a new browser tab cleanly via Browser Target.createTarget and return its page target
 */
async function createChromeTab(port = 9223, url = 'about:blank') {
  const version = await fetchChromeJson(port, '/json/version', 4000);
  if (!version?.webSocketDebuggerUrl) {
    throw new Error(`No browser webSocketDebuggerUrl on port ${port}`);
  }
  const browserCdp = await connectCdpSocket(version.webSocketDebuggerUrl, 10000);
  try {
    const created = await browserCdp.send('Target.createTarget', { url });
    const targetId = created.targetId;
    const targets = await listChromeTargets(port);
    return targets.find(t => t.id === targetId) || null;
  } finally {
    await browserCdp.close();
  }
}

module.exports = {
  fetchChromeJson,
  listChromeTargets,
  connectCdpSocket,
  createChromeTab
};
