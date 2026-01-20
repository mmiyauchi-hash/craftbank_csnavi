/**
 * IndexedDBを使用したローカルデータベースサービス
 * 
 * セキュリティ要件:
 * - すべてのデータはブラウザ内（ローカル）に保存
 * - サーバーへの自動送信なし
 * - 音声データ、文字起こし、分析結果をローカルで永続化
 */

import type {
  Project,
  Recording,
  AnalysisRecord,
  CreateProjectInput,
  UpdateProjectInput,
  CreateRecordingInput,
  ProjectStats,
} from '../types/project';

const DB_NAME = 'AINavigationPoCDB';
const DB_VERSION = 1;

// ストア名
const STORES = {
  PROJECTS: 'projects',
  RECORDINGS: 'recordings',
  ANALYSES: 'analyses',
} as const;

// ============================
// DB接続
// ============================

let dbInstance: IDBDatabase | null = null;

export async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Projects store
      if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
        const projectStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
        projectStore.createIndex('status', 'status', { unique: false });
        projectStore.createIndex('createdAt', 'createdAt', { unique: false });
        projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Recordings store
      if (!db.objectStoreNames.contains(STORES.RECORDINGS)) {
        const recordingStore = db.createObjectStore(STORES.RECORDINGS, { keyPath: 'id' });
        recordingStore.createIndex('projectId', 'projectId', { unique: false });
        recordingStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Analyses store
      if (!db.objectStoreNames.contains(STORES.ANALYSES)) {
        const analysisStore = db.createObjectStore(STORES.ANALYSES, { keyPath: 'id' });
        analysisStore.createIndex('recordingId', 'recordingId', { unique: false });
        analysisStore.createIndex('projectId', 'projectId', { unique: false });
        analysisStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// ============================
// ユーティリティ
// ============================

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function serializeForStorage<T>(obj: T): T {
  // DateオブジェクトをISO文字列に変換（IndexedDB用）
  return JSON.parse(JSON.stringify(obj));
}

function deserializeFromStorage<T>(obj: T): T {
  // ISO文字列をDateオブジェクトに変換（再帰的に処理）
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(item => deserializeFromStorage(item)) as T;
    }
    
    const result = { ...obj } as Record<string, unknown>;
    for (const key of Object.keys(result)) {
      const value = result[key];
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        result[key] = new Date(value);
      } else if (value && typeof value === 'object') {
        // ネストされたオブジェクトも再帰的に処理
        result[key] = deserializeFromStorage(value);
      }
    }
    return result as T;
  }
  return obj;
}

// ============================
// Project CRUD
// ============================

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const db = await openDatabase();
  const now = new Date();
  
  const project: Project = {
    id: generateId(),
    name: input.name,
    description: input.description,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    meetingVariables: input.meetingVariables,
    meetingPlan: input.meetingPlan,
    checklist: input.checklist,
    recordingIds: [],
  };

  console.log('案件作成:', {
    name: project.name,
    hasMeetingPlan: !!project.meetingPlan,
    meetingPlan: project.meetingPlan,
  });

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PROJECTS, 'readwrite');
    const store = tx.objectStore(STORES.PROJECTS);
    const request = store.add(serializeForStorage(project));

    request.onsuccess = () => {
      console.log('案件保存成功:', project.id);
      resolve(project);
    };
    request.onerror = () => {
      console.error('案件保存エラー:', request.error);
      reject(request.error);
    };
  });
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PROJECTS, 'readonly');
    const store = tx.objectStore(STORES.PROJECTS);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? deserializeFromStorage(result) : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PROJECTS, 'readonly');
    const store = tx.objectStore(STORES.PROJECTS);
    const index = store.index('updatedAt');
    const request = index.openCursor(null, 'prev'); // 更新日時の降順

    const projects: Project[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        projects.push(deserializeFromStorage(cursor.value));
        cursor.continue();
      } else {
        resolve(projects);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project | null> {
  const db = await openDatabase();
  const existing = await getProject(id);
  
  if (!existing) {
    return null;
  }

  const updated: Project = {
    ...existing,
    ...input,
    updatedAt: new Date(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PROJECTS, 'readwrite');
    const store = tx.objectStore(STORES.PROJECTS);
    const request = store.put(serializeForStorage(updated));

    request.onsuccess = () => resolve(updated);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProject(id: string): Promise<boolean> {
  const db = await openDatabase();

  // 紐づく録音と分析も削除
  const recordings = await getRecordingsByProject(id);
  for (const recording of recordings) {
    await deleteRecording(recording.id);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PROJECTS, 'readwrite');
    const store = tx.objectStore(STORES.PROJECTS);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// ============================
// Recording CRUD
// ============================

export async function createRecording(input: CreateRecordingInput): Promise<Recording> {
  const db = await openDatabase();
  const now = new Date();
  
  const recording: Recording = {
    id: generateId(),
    projectId: input.projectId,
    name: input.name,
    createdAt: now,
    duration: input.duration,
    audioBlob: input.audioBlob,
    mimeType: input.mimeType,
    fileSize: input.audioBlob.size,
    source: input.source,
    transcript: input.transcript,
    transcribedAt: input.transcript ? now : undefined,
    analysisIds: [],
  };

  // Projectに録音IDを追加
  const project = await getProject(input.projectId);
  if (project) {
    await updateProject(input.projectId, {
      ...project,
      recordingIds: [...project.recordingIds, recording.id],
    });
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.RECORDINGS, 'readwrite');
    const store = tx.objectStore(STORES.RECORDINGS);
    const request = store.add(serializeForStorage(recording));

    request.onsuccess = () => resolve(recording);
    request.onerror = () => reject(request.error);
  });
}

export async function getRecording(id: string): Promise<Recording | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.RECORDINGS, 'readonly');
    const store = tx.objectStore(STORES.RECORDINGS);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? deserializeFromStorage(result) : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getRecordingsByProject(projectId: string): Promise<Recording[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.RECORDINGS, 'readonly');
    const store = tx.objectStore(STORES.RECORDINGS);
    const index = store.index('projectId');
    const request = index.getAll(projectId);

    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.map(deserializeFromStorage));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateRecordingTranscript(id: string, transcript: string): Promise<Recording | null> {
  const db = await openDatabase();
  const existing = await getRecording(id);
  
  if (!existing) {
    return null;
  }

  const updated: Recording = {
    ...existing,
    transcript,
    transcribedAt: new Date(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.RECORDINGS, 'readwrite');
    const store = tx.objectStore(STORES.RECORDINGS);
    const request = store.put(serializeForStorage(updated));

    request.onsuccess = () => resolve(updated);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecording(id: string): Promise<boolean> {
  const db = await openDatabase();

  // 紐づく分析も削除
  const analyses = await getAnalysesByRecording(id);
  for (const analysis of analyses) {
    await deleteAnalysis(analysis.id);
  }

  // Projectから録音IDを削除
  const recording = await getRecording(id);
  if (recording) {
    const project = await getProject(recording.projectId);
    if (project) {
      await updateProject(recording.projectId, {
        recordingIds: project.recordingIds.filter(rid => rid !== id),
      });
    }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.RECORDINGS, 'readwrite');
    const store = tx.objectStore(STORES.RECORDINGS);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// ============================
// Analysis CRUD
// ============================

export async function createAnalysis(
  recordingId: string,
  projectId: string,
  checklistSnapshot: Recording['transcript'] extends string ? any : never,
  result: any,
  transcriptSnapshot: string
): Promise<AnalysisRecord> {
  const db = await openDatabase();
  const now = new Date();
  
  const analysis: AnalysisRecord = {
    id: generateId(),
    recordingId,
    projectId,
    createdAt: now,
    checklistSnapshot,
    result,
    transcriptSnapshot,
  };

  // Recordingに分析IDを追加
  const recording = await getRecording(recordingId);
  if (recording) {
    const tx = db.transaction(STORES.RECORDINGS, 'readwrite');
    const store = tx.objectStore(STORES.RECORDINGS);
    store.put(serializeForStorage({
      ...recording,
      analysisIds: [...recording.analysisIds, analysis.id],
    }));
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ANALYSES, 'readwrite');
    const store = tx.objectStore(STORES.ANALYSES);
    const request = store.add(serializeForStorage(analysis));

    request.onsuccess = () => resolve(analysis);
    request.onerror = () => reject(request.error);
  });
}

export async function getAnalysis(id: string): Promise<AnalysisRecord | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ANALYSES, 'readonly');
    const store = tx.objectStore(STORES.ANALYSES);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? deserializeFromStorage(result) : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAnalysesByRecording(recordingId: string): Promise<AnalysisRecord[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ANALYSES, 'readonly');
    const store = tx.objectStore(STORES.ANALYSES);
    const index = store.index('recordingId');
    const request = index.getAll(recordingId);

    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.map(deserializeFromStorage));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAnalysesByProject(projectId: string): Promise<AnalysisRecord[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ANALYSES, 'readonly');
    const store = tx.objectStore(STORES.ANALYSES);
    const index = store.index('projectId');
    const request = index.getAll(projectId);

    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.map(deserializeFromStorage));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAnalysis(id: string): Promise<boolean> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ANALYSES, 'readwrite');
    const store = tx.objectStore(STORES.ANALYSES);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// ============================
// 統計
// ============================

export async function getProjectStats(): Promise<ProjectStats> {
  const projects = await getAllProjects();
  
  const projectsByStatus: Record<string, number> = {
    draft: 0,
    in_progress: 0,
    completed: 0,
    archived: 0,
  };
  
  let totalRecordings = 0;
  let totalAnalyses = 0;
  let totalRecordingDuration = 0;

  for (const project of projects) {
    projectsByStatus[project.status]++;
    
    const recordings = await getRecordingsByProject(project.id);
    totalRecordings += recordings.length;
    
    for (const recording of recordings) {
      totalRecordingDuration += recording.duration;
      const analyses = await getAnalysesByRecording(recording.id);
      totalAnalyses += analyses.length;
    }
  }

  return {
    totalProjects: projects.length,
    projectsByStatus: projectsByStatus as Record<any, number>,
    totalRecordings,
    totalAnalyses,
    totalRecordingDuration,
  };
}

// ============================
// データエクスポート/インポート
// ============================

export async function exportAllData(): Promise<{
  projects: Project[];
  recordings: Omit<Recording, 'audioBlob'>[];
  analyses: AnalysisRecord[];
}> {
  const projects = await getAllProjects();
  const allRecordings: Omit<Recording, 'audioBlob'>[] = [];
  const allAnalyses: AnalysisRecord[] = [];

  for (const project of projects) {
    const recordings = await getRecordingsByProject(project.id);
    for (const recording of recordings) {
      // audioBlobは除外（大きすぎる）
      const { audioBlob, ...recordingWithoutBlob } = recording;
      allRecordings.push(recordingWithoutBlob);
      
      const analyses = await getAnalysesByRecording(recording.id);
      allAnalyses.push(...analyses);
    }
  }

  return {
    projects,
    recordings: allRecordings,
    analyses: allAnalyses,
  };
}

// ============================
// DB全削除（開発用）
// ============================

export async function clearAllData(): Promise<void> {
  const db = await openDatabase();

  const stores = [STORES.PROJECTS, STORES.RECORDINGS, STORES.ANALYSES];
  
  for (const storeName of stores) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
