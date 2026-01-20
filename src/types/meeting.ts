// 商談前の変数入力に関する型定義

/**
 * 工種の種類
 */
export type ConstructionType = 
  | 'civil_engineering'    // 土木
  | 'building'             // 建築
  | 'electrical'           // 電気
  | 'plumbing'             // 設備・管工事
  | 'interior'             // 内装
  | 'painting'             // 塗装
  | 'waterproofing'        // 防水
  | 'scaffolding'          // 足場・鳶
  | 'demolition'           // 解体
  | 'landscaping'          // 造園
  | 'other';               // その他

export const CONSTRUCTION_TYPE_LABELS: Record<ConstructionType, string> = {
  civil_engineering: '土木',
  building: '建築',
  electrical: '電気',
  plumbing: '設備・管工事',
  interior: '内装',
  painting: '塗装',
  waterproofing: '防水',
  scaffolding: '足場・鳶',
  demolition: '解体',
  landscaping: '造園',
  other: 'その他',
};

/**
 * 従業員規模
 */
export type EmployeeScale = 
  | 'micro'      // 1-5人
  | 'small'      // 6-20人
  | 'medium'     // 21-50人
  | 'large'      // 51-100人
  | 'enterprise'; // 100人以上

export const EMPLOYEE_SCALE_LABELS: Record<EmployeeScale, string> = {
  micro: '1〜5人（小規模）',
  small: '6〜20人',
  medium: '21〜50人',
  large: '51〜100人',
  enterprise: '100人以上（大規模）',
};

/**
 * 売上規模
 */
export type RevenueScale = 
  | 'under_100m'     // 1億円未満
  | '100m_500m'      // 1〜5億円
  | '500m_1b'        // 5〜10億円
  | '1b_5b'          // 10〜50億円
  | 'over_5b';       // 50億円以上

export const REVENUE_SCALE_LABELS: Record<RevenueScale, string> = {
  under_100m: '1億円未満',
  '100m_500m': '1〜5億円',
  '500m_1b': '5〜10億円',
  '1b_5b': '10〜50億円',
  over_5b: '50億円以上',
};

/**
 * 元請け/下請けの比率
 */
export type ContractorType = 
  | 'prime_only'     // 元請けのみ
  | 'prime_heavy'    // 元請け中心（7割以上）
  | 'mixed'          // 混合（元請け3〜7割）
  | 'sub_heavy'      // 下請け中心（7割以上）
  | 'sub_only';      // 下請けのみ

export const CONTRACTOR_TYPE_LABELS: Record<ContractorType, string> = {
  prime_only: '元請けのみ',
  prime_heavy: '元請け中心（7割以上）',
  mixed: '混合（元請け3〜7割）',
  sub_heavy: '下請け中心（7割以上）',
  sub_only: '下請けのみ',
};

/**
 * 公共/民間の比率
 */
export type ProjectType = 
  | 'public_only'    // 公共工事のみ
  | 'public_heavy'   // 公共中心（7割以上）
  | 'mixed'          // 混合
  | 'private_heavy'  // 民間中心（7割以上）
  | 'private_only';  // 民間のみ

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  public_only: '公共工事のみ',
  public_heavy: '公共工事中心（7割以上）',
  mixed: '混合',
  private_heavy: '民間工事中心（7割以上）',
  private_only: '民間工事のみ',
};

/**
 * 外注（協力会社）の状況
 */
export type OutsourcingLevel = 
  | 'none'           // なし（自社施工のみ）
  | 'few'            // 少ない（1〜5社）
  | 'moderate'       // 中程度（6〜20社）
  | 'many';          // 多い（20社以上）

export const OUTSOURCING_LEVEL_LABELS: Record<OutsourcingLevel, string> = {
  none: 'なし（自社施工のみ）',
  few: '少ない（1〜5社）',
  moderate: '中程度（6〜20社）',
  many: '多い（20社以上）',
};

/**
 * 現在のシステム利用状況
 */
export type CurrentSystemUsage = 
  | 'paper'          // 紙・手書き中心
  | 'excel'          // Excel中心
  | 'other_system'   // 他社システム利用中
  | 'mixed';         // 混合

export const CURRENT_SYSTEM_LABELS: Record<CurrentSystemUsage, string> = {
  paper: '紙・手書き中心',
  excel: 'Excel中心',
  other_system: '他社システム利用中',
  mixed: '混合（紙+Excel+その他）',
};

/**
 * IT習熟度
 */
export type ITLiteracy = 
  | 'low'            // 低い（PC苦手な人が多い）
  | 'moderate'       // 普通
  | 'high';          // 高い（ITに詳しい）

export const IT_LITERACY_LABELS: Record<ITLiteracy, string> = {
  low: '低い（PC苦手な人が多い）',
  moderate: '普通',
  high: '高い（ITに詳しい）',
};

/**
 * 導入の緊急度
 */
export type Urgency = 
  | 'immediate'      // すぐに導入したい
  | 'within_quarter' // 3ヶ月以内
  | 'within_half'    // 半年以内
  | 'exploring';     // 情報収集段階

export const URGENCY_LABELS: Record<Urgency, string> = {
  immediate: 'すぐに導入したい',
  within_quarter: '3ヶ月以内',
  within_half: '半年以内',
  exploring: '情報収集段階',
};

/**
 * 一番改善したい業務（複数選択可）
 */
export type PainPoint = 
  | 'estimation'     // 見積作成
  | 'invoicing'      // 請求・入金管理
  | 'cost_management'// 原価管理
  | 'attendance'     // 勤怠管理
  | 'schedule'       // 工程管理
  | 'document'       // 書類作成・管理
  | 'communication'  // 社内共有・コミュニケーション
  | 'subcontractor'; // 協力会社管理

export const PAIN_POINT_LABELS: Record<PainPoint, string> = {
  estimation: '見積作成',
  invoicing: '請求・入金管理',
  cost_management: '原価管理',
  attendance: '勤怠管理',
  schedule: '工程管理',
  document: '書類作成・管理',
  communication: '社内共有・コミュニケーション',
  subcontractor: '協力会社管理',
};

/**
 * 商談前に入力する変数
 */
export interface MeetingVariables {
  // 会社基本情報
  companyName?: string;
  constructionTypes: ConstructionType[];
  employeeScale: EmployeeScale;
  revenueScale: RevenueScale;
  
  // 事業特性
  contractorType: ContractorType;
  projectType: ProjectType;
  outsourcingLevel: OutsourcingLevel;
  concurrentProjects?: number; // 同時進行現場数
  
  // 現状
  currentSystem: CurrentSystemUsage;
  itLiteracy: ITLiteracy;
  
  // ニーズ
  painPoints: PainPoint[];
  urgency: Urgency;
  
  // 自由記述
  additionalNotes?: string;
}

/**
 * 生成されたカスタマイズ商談の型
 */
export interface CustomizedMeetingPlan {
  // メタ情報
  generatedAt: Date;
  variables: MeetingVariables;
  
  // 聞くべきことリスト
  checklistItems: CustomizedChecklistItem[];
  
  // 提案戦略
  proposalStrategy: ProposalStrategy;
  
  // 話の組み立て
  conversationFlow: ConversationFlowStep[];
}

export interface CustomizedChecklistItem {
  id: string;
  question: string;
  importance: 'high' | 'medium' | 'low';
  category: string;
  reason: string; // なぜこの質問が重要か
  followUpQuestions?: string[]; // 深堀りの質問
}

export interface ProposalStrategy {
  keyFeatures: ProposalFeature[]; // 刺さりそうな機能
  differentiators: string[]; // 競合との差別化ポイント
  potentialObjections: ObjectionHandler[]; // 想定される懸念と対処法
  closingApproach: string; // クロージングの方針
}

export interface ProposalFeature {
  featureName: string;
  relevanceScore: number; // 1-10
  pitch: string; // 訴求ポイント
  useCase: string; // 活用シーン
}

export interface ObjectionHandler {
  objection: string;
  response: string;
}

export interface ConversationFlowStep {
  phase: 'opening' | 'discovery' | 'presentation' | 'handling' | 'closing';
  phaseName: string;
  duration: string; // 目安時間
  objectives: string[];
  keyPoints: string[];
  transitionPhrase?: string; // 次のフェーズへの移行フレーズ
}

/**
 * デフォルトの変数値
 */
export const DEFAULT_MEETING_VARIABLES: MeetingVariables = {
  companyName: '',
  constructionTypes: [],
  employeeScale: 'small',
  revenueScale: '100m_500m',
  contractorType: 'mixed',
  projectType: 'mixed',
  outsourcingLevel: 'few',
  concurrentProjects: 3,
  currentSystem: 'excel',
  itLiteracy: 'moderate',
  painPoints: [],
  urgency: 'within_quarter',
  additionalNotes: '',
};
