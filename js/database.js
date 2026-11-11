const DB_NAME = 'study-planner-db', STORE = 'kv';
let dbPromise = null;
const memStore = new Map();

function safeLocalGet(key) {
  try {
    const raw = localStorage.getItem('sp_kv_' + key);
    return raw ? JSON.parse(raw) : undefined;
  } catch (e) {
    return memStore.get(key);
  }
}

function safeLocalSet(key, val) {
  memStore.set(key, val);
  try {
    localStorage.setItem('sp_kv_' + key, JSON.stringify(val));
  } catch (e) {}
}

export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise(resolve => {
      try {
        if (typeof indexedDB === 'undefined') {
          resolve(null);
          return;
        }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          try { req.result.createObjectStore(STORE); } catch (e) {}
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

export async function read(key) {
  const db = await openDB();
  if (!db) {
    const v = safeLocalGet(key);
    return v !== undefined ? v : memStore.get(key);
  }
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        if (req.result !== undefined) resolve(req.result);
        else resolve(safeLocalGet(key));
      };
      req.onerror = () => resolve(safeLocalGet(key));
    } catch (e) {
      resolve(safeLocalGet(key));
    }
  });
}

export async function write(key, val) {
  safeLocalSet(key, val);
  const db = await openDB();
  if (!db) return;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (e) {
      resolve();
    }
  });
}

export function defaultKidPerms() {
  return {
    canAdd: true,       // 默认允许添加任务，方便直接使用
    canEdit: true,      // 默认允许编辑修改任务
    canDelete: false,   // 允许删除任务
    canReport: true,    // 默认允许查看周报月报
    updatedAt: 0,
    updatedBy: '系统默认'
  };
}

export function defaultPins() {
  return {
    baobao: '1234',
    baba: '8888',
    mama: '8888',
    updatedAt: 0,
    updatedBy: '系统默认'
  };
}

export function emptyData() {
  return {
    tasks: {},
    exceptions: {},
    completions: {},
    logs: {},
    kidPerms: defaultKidPerms(),
    pins: defaultPins()
  };
}

export function validate(raw) {
  if (!raw || typeof raw !== 'object') return emptyData();
  return {
    tasks: (raw.tasks && typeof raw.tasks === 'object') ? raw.tasks : {},
    exceptions: (raw.exceptions && typeof raw.exceptions === 'object') ? raw.exceptions : {},
    completions: (raw.completions && typeof raw.completions === 'object') ? raw.completions : {},
    logs: (raw.logs && typeof raw.logs === 'object') ? raw.logs : {},
    kidPerms: (raw.kidPerms && typeof raw.kidPerms === 'object')
      ? { ...defaultKidPerms(), ...raw.kidPerms }
      : defaultKidPerms(),
    pins: (raw.pins && typeof raw.pins === 'object')
      ? { ...defaultPins(), ...raw.pins }
      : defaultPins()
  };
}