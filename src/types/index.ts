// チェックリスト関連の型定義

export interface ChecklistItem {
  id: string;
  question: string;
  importance: 'high' | 'medium' | 'low';
  keywords: string[];
}

export interface ChecklistCategory {
  name: string;
  items: ChecklistItem[];
}

export interface Checklist {
  name: string;
  description: string;
  version: string;
  categories: ChecklistCategory[];
}

// 突合結果の型定義

export interface MatchResult {
  item: ChecklistItem;
  status: 'covered' | 'missing' | 'partial';
  matchedText?: string;
  confidence?: number;
}

export interface AnalysisResult {
  totalItems: number;
  coveredItems: number;
  missingItems: number;
  partialItems: number;
  coverageRate: number;
  results: MatchResult[];
  summary: string;
  recommendations: string[];
}

// チャットメッセージの型定義

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  analysisResult?: AnalysisResult;
}

// 音声録音関連の型定義

export interface RecordingState {
  isRecording: boolean;
  audioBlob: Blob | null;
  duration: number;
  audioLevel: number;
}

// アプリケーション全体の状態

export interface AppState {
  checklist: Checklist | null;
  isChecklistLoaded: boolean;
  messages: ChatMessage[];
  isAnalyzing: boolean;
  recording: RecordingState;
}

// 商談準備関連の型をre-export
export * from './meeting';

// 案件管理関連の型をre-export
export * from './project';
