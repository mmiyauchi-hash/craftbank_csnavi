/**
 * 案件管理・録音データ・分析結果の型定義
 */

import type { MeetingVariables, CustomizedMeetingPlan } from './meeting';
import type { AnalysisResult, Checklist } from './index';

// ============================
// 案件（Project）
// ============================

export interface Project {
  id: string;
  name: string;                     // 案件名（会社名など）
  description?: string;             // 備考
  status: ProjectStatus;            // 案件ステータス
  createdAt: Date;
  updatedAt: Date;
  
  // 商談準備で入力した変数
  meetingVariables?: MeetingVariables;
  
  // 生成された商談プラン
  meetingPlan?: CustomizedMeetingPlan;
  
  // 適用されたチェックリスト
  checklist?: Checklist;
  
  // 紐づく録音データのID一覧
  recordingIds: string[];
}

export type ProjectStatus = 
  | 'draft'         // 下書き（商談前）
  | 'in_progress'   // 進行中
  | 'completed'     // 完了
  | 'archived';     // アーカイブ

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: '準備中',
  in_progress: '進行中',
  completed: '完了',
  archived: 'アーカイブ',
};

// ============================
// 録音データ（Recording）
// ============================

export interface Recording {
  id: string;
  projectId: string;               // 紐づく案件ID
  name: string;                     // 録音名（例：第1回商談、フォローアップ等）
  createdAt: Date;
  duration: number;                 // 録音時間（秒）
  
  // 音声データ（Blobとして保存）
  audioBlob: Blob;
  mimeType: string;                 // 'audio/webm', 'audio/mp3', etc.
  fileSize: number;                 // ファイルサイズ（bytes）
  
  // ソース
  source: RecordingSource;
  
  // 文字起こし結果
  transcript?: string;
  transcribedAt?: Date;
  
  // 分析結果（複数回分析可能）
  analysisIds: string[];
}

export type RecordingSource = 
  | 'realtime'      // リアルタイム録音
  | 'uploaded';     // ファイルアップロード

export const RECORDING_SOURCE_LABELS: Record<RecordingSource, string> = {
  realtime: 'リアルタイム録音',
  uploaded: 'ファイルアップロード',
};

// ============================
// 分析結果（AnalysisRecord）
// ============================

export interface AnalysisRecord {
  id: string;
  recordingId: string;             // 紐づく録音ID
  projectId: string;               // 紐づく案件ID
  createdAt: Date;
  
  // 分析に使用したチェックリスト
  checklistSnapshot: Checklist;
  
  // 分析結果
  result: AnalysisResult;
  
  // 分析時点の文字起こしテキスト
  transcriptSnapshot: string;
}

// ============================
// DB操作用のインターフェース
// ============================

export interface ProjectWithRecordings extends Project {
  recordings: Recording[];
}

export interface RecordingWithAnalyses extends Recording {
  analyses: AnalysisRecord[];
}

// ============================
// フォーム用の型
// ============================

export interface CreateProjectInput {
  name: string;
  description?: string;
  meetingVariables?: MeetingVariables;
  meetingPlan?: CustomizedMeetingPlan;
  checklist?: Checklist;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  meetingVariables?: MeetingVariables;
  meetingPlan?: CustomizedMeetingPlan;
  checklist?: Checklist;
  recordingIds?: string[];
}

export interface CreateRecordingInput {
  projectId: string;
  name: string;
  audioBlob: Blob;
  mimeType: string;
  duration: number;
  source: RecordingSource;
  transcript?: string;
}

// ============================
// 統計情報
// ============================

export interface ProjectStats {
  totalProjects: number;
  projectsByStatus: Record<ProjectStatus, number>;
  totalRecordings: number;
  totalAnalyses: number;
  totalRecordingDuration: number;  // 秒
}
