const DEFAULT_API_BASE = import.meta.env.VITE_WEB_API_BASE || '/api';
const VIRTUAL_OUTPUT_DIR = 'browser-downloads';

const fileRegistry = new Map();
const progressListeners = new Set();

let currentTaskId = null;
let currentTaskController = null;

const getElectron = () => window.electron;

const buildApiUrl = (path) => {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${DEFAULT_API_BASE}${path}`;
};

const triggerBrowserDownload = (href, suggestedName) => {
  const link = document.createElement('a');
  link.href = href;
  if (suggestedName) {
    link.download = suggestedName;
  }
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const emitProgress = (payload) => {
  progressListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.error('Progress listener failed', error);
    }
  });
};

const createBrowserFileKey = (file) => {
  const relative = file.webkitRelativePath || '';
  const sourceName = relative || file.name;
  const dotIndex = sourceName.lastIndexOf('.');
  const hasExtension = dotIndex > 0 && dotIndex < sourceName.length - 1;
  const basename = hasExtension ? sourceName.slice(0, dotIndex) : sourceName;
  const extension = hasExtension ? sourceName.slice(dotIndex) : '';
  return `${basename}__${file.lastModified || 0}__${file.size || 0}${extension}`;
};

const registerBrowserFile = (file) => {
  if (!(file instanceof File)) {
    return file;
  }

  const key = createBrowserFileKey(file);
  if (!Object.prototype.hasOwnProperty.call(file, 'path')) {
    Object.defineProperty(file, 'path', {
      configurable: true,
      enumerable: false,
      writable: false,
      value: key,
    });
  }

  fileRegistry.set(key, file);
  return file;
};

if (typeof window !== 'undefined' && typeof File !== 'undefined' && !('path' in File.prototype)) {
  Object.defineProperty(File.prototype, 'path', {
    configurable: true,
    enumerable: false,
    get() {
      const key = createBrowserFileKey(this);
      fileRegistry.set(key, this);
      return key;
    },
  });
}

const resolveBrowserFile = (fileOrPath) => {
  if (fileOrPath instanceof File) {
    return registerBrowserFile(fileOrPath);
  }
  if (typeof fileOrPath === 'string') {
    return fileRegistry.get(fileOrPath) || null;
  }
  return null;
};

const toBrowserKey = (file) => registerBrowserFile(file).path;

const createFileInput = (accept) => new Promise((resolve) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  if (accept) {
    input.accept = accept;
  }
  input.onchange = () => {
    const files = Array.from(input.files || []).map(registerBrowserFile);
    resolve(files);
  };
  input.click();
});

const filtersToAccept = (filters = []) => {
  const normalized = [];
  filters.forEach((filter) => {
    if (typeof filter === 'string') {
      normalized.push(`.${filter.replace(/^\./, '')}`);
      return;
    }
    if (Array.isArray(filter?.extensions)) {
      filter.extensions.forEach((extension) => normalized.push(`.${String(extension).replace(/^\./, '')}`));
    }
  });
  return normalized.join(',');
};

const pollTaskUntilDone = async (taskId) => {
  let lastProgress = -1;

  while (true) {
    const response = await fetch(buildApiUrl(`/tasks/${taskId}`), {
      signal: currentTaskController?.signal,
    });
    if (!response.ok) {
      throw new Error(`Task polling failed: HTTP ${response.status}`);
    }

    const task = await response.json();
    if (typeof task.progress === 'number' && task.progress !== lastProgress) {
      lastProgress = task.progress;
      emitProgress({ type: 'progress', percent: task.progress });
    }

    if (task.status === 'completed') {
      const output = task.result?.output || task.result?.outputPath;
      if (output) {
        emitProgress({ type: 'output', output, targets: [output] });
      }
      if (task.result) {
        return {
          ...task.result,
          outputDir: task.result.outputDir || output,
        };
      }
      return { success: true, output, outputPath: output, outputDir: output };
    }

    if (task.status === 'cancelled') {
      return { success: false, error: 'Cancelled' };
    }

    if (task.status === 'failed') {
      return { success: false, error: task.error || 'Conversion failed' };
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

const browserConvert = async (action, payload = {}) => {
  const file = resolveBrowserFile(payload.sourcePath);
  if (!file) {
    throw new Error('Browser mode requires a selected source file');
  }

  const formData = new FormData();
  formData.append('action', action);
  formData.append('params', JSON.stringify(payload.params || {}));
  formData.append('source', file, file.name);

  currentTaskController = new AbortController();

  const response = await fetch(buildApiUrl('/convert'), {
    method: 'POST',
    body: formData,
    signal: currentTaskController.signal,
  });

  if (!response.ok) {
    throw new Error(`Conversion request failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  currentTaskId = data.taskId;

  try {
    return await pollTaskUntilDone(currentTaskId);
  } finally {
    currentTaskId = null;
    currentTaskController = null;
  }
};

export const api = {
  isAvailable: () => true,

  isElectron: () => !!getElectron(),

  normalizeFiles: (files = []) => files.map(registerBrowserFile),

  resolveFile: (fileOrPath) => resolveBrowserFile(fileOrPath),

  toBrowserPath: (fileOrPath) => {
    if (typeof fileOrPath === 'string') {
      return fileOrPath;
    }
    if (fileOrPath instanceof File) {
      return toBrowserKey(fileOrPath);
    }
    return null;
  },

  convert: async (action, payload) => {
    const electron = getElectron();
    if (electron) {
      return electron.convert(action, payload);
    }
    return browserConvert(action, payload);
  },

  getVideoInfo: async (fileOrPath) => {
    const electron = getElectron();
    if (electron) {
      return api.convert('get-video-info', { filePath: fileOrPath });
    }

    const file = resolveBrowserFile(fileOrPath);
    if (!file) {
      return { success: false, message: 'File not found in browser session' };
    }

    const formData = new FormData();
    formData.append('source', file, file.name);
    const response = await fetch(buildApiUrl('/video-info'), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Video info request failed: HTTP ${response.status}`);
    }

    return response.json();
  },

  generatePreview: async (fileOrPath) => {
    const electron = getElectron();
    if (electron) {
      return electron.convert('generate-preview', {
        sourcePath: fileOrPath,
      });
    }

    const file = resolveBrowserFile(fileOrPath);
    if (!file) {
      return { success: false, message: 'File not found in browser session' };
    }

    const formData = new FormData();
    formData.append('source', file, file.name);
    const response = await fetch(buildApiUrl('/preview'), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    return response.json();
  },

  openFileDialog: async (filters) => {
    const electron = getElectron();
    if (electron) {
      return electron.openFileDialog(filters);
    }
    const files = await createFileInput(filtersToAccept(filters));
    return files.map((file) => file.path);
  },

  openDirectoryDialog: async () => {
    const electron = getElectron();
    if (electron) {
      return electron.openDirectoryDialog();
    }
    return VIRTUAL_OUTPUT_DIR;
  },

  openPath: async (path) => {
    const electron = getElectron();
    if (electron) {
      await electron.openPath(path);
      return;
    }
    if (typeof path === 'string' && (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/api/'))) {
      const href = buildApiUrl(path.replace(DEFAULT_API_BASE, ''));
      triggerBrowserDownload(href);
    }
  },

  downloadBatchResults: async (paths, archiveName = 'batch-results.zip') => {
    const electron = getElectron();
    const filteredPaths = Array.from(new Set((paths || []).filter(Boolean)));
    if (filteredPaths.length === 0) {
      return { success: false };
    }

    if (electron) {
      filteredPaths.forEach((path) => {
        electron.openPath(path);
      });
      return { success: true };
    }

    const searchParams = new URLSearchParams();
    filteredPaths.forEach((path) => {
      searchParams.append('downloadPath', path);
    });
    searchParams.set('archiveName', archiveName);

    triggerBrowserDownload(buildApiUrl(`/batch-downloads?${searchParams.toString()}`), archiveName);

    return { success: true };
  },

  openOutputDir: async () => {
    const electron = getElectron();
    if (electron?.openOutputDir) {
      await electron.openOutputDir();
    }
  },

  cancelConversion: async () => {
    const electron = getElectron();
    if (electron) {
      return electron.cancelConversion();
    }

    if (!currentTaskId) {
      return { success: false };
    }

    await fetch(buildApiUrl(`/tasks/${currentTaskId}/cancel`), {
      method: 'POST',
    });

    return { success: true };
  },

  onProgress: (callback) => {
    progressListeners.add(callback);
  },

  removeProgressListener: (callback) => {
    if (callback) {
      progressListeners.delete(callback);
      return;
    }
    progressListeners.clear();
  },
};
