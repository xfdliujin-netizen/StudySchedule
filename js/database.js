const DB_NAME = 'study-planner-db', STORE = 'kv';
let dbPromise;

export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export async function read(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function write(key, val) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function defaultKidPerms() {
  return {
    canAdd: false,      // 允许添加任务
    canEdit: false,     // 允许编辑修改任务
    canDelete: false,   // 允许删除任务
    canReport: false,   // 允许查看周报月报
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