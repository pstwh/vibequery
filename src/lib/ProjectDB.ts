import { Project, PersistedFile, PersistedView } from '../types/types';

const DB_NAME = 'VibeQueryDB';
const DB_VERSION = 3;
const FILE_STORE_NAME = 'files';
const VIEW_STORE_NAME = 'views';
const PROJECTS_KEY = 'vibequery_projects';
const ACTIVE_PROJECT_ID_KEY = 'vibequery_activeProjectId';

let db: IDBDatabase;

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (db) {
        return resolve();
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB.'));
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(FILE_STORE_NAME)) {
        const store = dbInstance.createObjectStore(FILE_STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('project_id', 'projectId', { unique: false });
      }
      if (!dbInstance.objectStoreNames.contains(VIEW_STORE_NAME)) {
        const store = dbInstance.createObjectStore(VIEW_STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
        });
        store.createIndex('project_name_idx', ['projectId', 'name'], { unique: true });
        store.createIndex('project_idx', 'projectId', { unique: false });
      }
    };
  });
};

export const getProjects = (): Record<string, Project> => {
  try {
    const projects = localStorage.getItem(PROJECTS_KEY);
    return projects ? JSON.parse(projects) : {};
  } catch (e) {
    console.error('Failed to parse projects from localStorage', e);
    return {};
  }
};

export const saveProjects = (projects: Record<string, Project>): void => {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
};

export const createProject = async (name: string): Promise<Project> => {
  const newProject: Project = {
    id: crypto.randomUUID(),
    name,
  };
  const projects = getProjects();
  projects[newProject.id] = newProject;
  saveProjects(projects);
  return newProject;
};

export const updateProject = async (projectId: string, newName: string): Promise<Project | null> => {
    const projects = getProjects();
    if (projects[projectId]) {
        projects[projectId].name = newName;
        saveProjects(projects);
        return projects[projectId];
    }
    return null;
};

export const deleteProject = (projectId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([FILE_STORE_NAME, VIEW_STORE_NAME], 'readwrite');
      
      const fileStore = transaction.objectStore(FILE_STORE_NAME);
      const fileIndex = fileStore.index('project_id');
      const fileRequest = fileIndex.openCursor(IDBKeyRange.only(projectId));
      fileRequest.onsuccess = () => {
        const cursor = fileRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      const viewStore = transaction.objectStore(VIEW_STORE_NAME);
      const viewIndex = viewStore.index('project_idx');
      const viewRequest = viewIndex.openCursor(IDBKeyRange.only(projectId));
      viewRequest.onsuccess = () => {
          const cursor = viewRequest.result;
          if (cursor) {
              cursor.delete();
              cursor.continue();
          }
      };
  
      transaction.oncomplete = () => {
        const projects = getProjects();
        delete projects[projectId];
        saveProjects(projects);
        
        const activeId = getActiveProjectId();
        if (activeId === projectId) {
            localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
        }

        localStorage.removeItem(`vibequery_history_${projectId}`);
        
        resolve();
      };
      
      transaction.onerror = (event) => {
          console.error("Delete project transaction error:", (event.target as any).error);
          reject(new Error('Failed to delete project data.'));
      };
    });
};

export const getActiveProjectId = (): string | null => {
  return localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
};

export const setActiveProjectId = (id: string): void => {
  localStorage.setItem(ACTIVE_PROJECT_ID_KEY, id);
};

export const addFileToProject = (projectId: string, file: File): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    const buffer = await file.arrayBuffer();
    const transaction = db.transaction([FILE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(FILE_STORE_NAME);
    const request = store.add({
      projectId,
      name: file.name,
      buffer,
      webkitRelativePath: file.webkitRelativePath || '',
    });

    request.onerror = () => reject(new Error('Failed to add file to DB.'));
    request.onsuccess = () => resolve();
  });
};

export const getProjectFiles = (projectId: string): Promise<PersistedFile[]> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FILE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(FILE_STORE_NAME);
    const index = store.index('project_id');
    const request = index.getAll(projectId);

    request.onerror = () => reject(new Error('Failed to retrieve project files.'));
    request.onsuccess = () => {
      const persistedFiles: PersistedFile[] = request.result.map(item => ({
        name: item.name,
        buffer: item.buffer,
        webkitRelativePath: item.webkitRelativePath,
      }));
      resolve(persistedFiles);
    };
  });
};

export const saveView = (projectId: string, view: { name: string; sql: string }): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([VIEW_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(VIEW_STORE_NAME);
        const index = store.index('project_name_idx');
        const getRequest = index.get([projectId, view.name]);

        getRequest.onsuccess = () => {
            const existing = getRequest.result;
            const record = existing ? { ...existing, sql: view.sql } : { projectId, ...view };
            const putRequest = store.put(record);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(new Error('Failed to save view.'));
        };
        getRequest.onerror = () => reject(new Error('Failed to check for existing view.'));
    });
};

export const deleteView = (projectId: string, viewName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([VIEW_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(VIEW_STORE_NAME);
        const index = store.index('project_name_idx');
        const getRequest = index.getKey([projectId, viewName]);

        getRequest.onsuccess = () => {
            const viewKey = getRequest.result;
            if (viewKey) {
                const deleteRequest = store.delete(viewKey);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () => reject(new Error('Failed to delete view.'));
            } else {
                resolve();
            }
        };
        getRequest.onerror = () => reject(new Error('Failed to find view to delete.'));
    });
};

export const getProjectViews = (projectId: string): Promise<PersistedView[]> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([VIEW_STORE_NAME], 'readonly');
        const store = transaction.objectStore(VIEW_STORE_NAME);
        const index = store.index('project_idx');
        const request = index.getAll(projectId);

        request.onerror = () => reject(new Error('Failed to retrieve project views.'));
        request.onsuccess = () => {
            resolve(request.result as PersistedView[]);
        };
    });
};

export const getQueryHistory = (projectId: string): string[] => {
    try {
        const history = localStorage.getItem(`vibequery_history_${projectId}`);
        return history ? JSON.parse(history) : [];
    } catch (e) {
        console.error('Failed to parse query history', e);
        return [];
    }
};

const MAX_HISTORY_SIZE = 50;

export const addQueryToHistory = (projectId: string, query: string): void => {
    if (!query?.trim()) return;
    const history = getQueryHistory(projectId);
    const filteredHistory = history.filter(q => q !== query);
    const newHistory = [query, ...filteredHistory];
    if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.length = MAX_HISTORY_SIZE;
    }
    localStorage.setItem(`vibequery_history_${projectId}`, JSON.stringify(newHistory));
};

