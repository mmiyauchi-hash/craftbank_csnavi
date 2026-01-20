import { create } from 'zustand';
import type { Checklist, ChatMessage, AnalysisResult, CustomizedMeetingPlan, MeetingVariables } from '../types';
import defaultChecklist from '../data/defaultChecklist.json';

// 簡易的なChecklist型（既存のChecklistと互換性を持たせる）
interface SimpleChecklist {
  name: string;
  description: string;
  version: string;
  categories: {
    name: string;
    items: {
      id: string;
      question: string;
      importance: 'high' | 'medium' | 'low';
      keywords: string[];
    }[];
  }[];
}

interface AppStore {
  // チェックリスト
  checklist: Checklist;
  setChecklist: (checklist: Checklist | SimpleChecklist) => void;
  loadChecklistFromJson: (json: string) => void;
  
  // 商談プラン
  meetingPlan: CustomizedMeetingPlan | null;
  meetingVariables: MeetingVariables | null;
  setMeetingPlan: (plan: CustomizedMeetingPlan | null, variables?: MeetingVariables | null) => void;
  clearMeetingPlan: () => void;
  
  // チャットメッセージ
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  
  // 分析状態
  isAnalyzing: boolean;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  
  // 最新の分析結果
  lastAnalysisResult: AnalysisResult | null;
  setLastAnalysisResult: (result: AnalysisResult | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // チェックリスト初期値
  checklist: defaultChecklist as Checklist,
  setChecklist: (checklist) => set({ checklist }),
  loadChecklistFromJson: (json) => {
    try {
      const parsed = JSON.parse(json);
      set({ checklist: parsed as Checklist });
    } catch (error) {
      console.error('チェックリストのパースに失敗しました:', error);
    }
  },
  
  // 商談プラン
  meetingPlan: null,
  meetingVariables: null,
  setMeetingPlan: (plan, variables = null) => set({ meetingPlan: plan, meetingVariables: variables }),
  clearMeetingPlan: () => set({ meetingPlan: null, meetingVariables: null }),
  
  // チャットメッセージ
  messages: [],
  addMessage: (message) => set((state) => ({
    messages: [
      ...state.messages,
      {
        ...message,
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      },
    ],
  })),
  clearMessages: () => set({ messages: [] }),
  
  // 分析状態
  isAnalyzing: false,
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  
  // 最新の分析結果
  lastAnalysisResult: null,
  setLastAnalysisResult: (result) => set({ lastAnalysisResult: result }),
}));
