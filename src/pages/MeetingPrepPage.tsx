import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  MeetingVariables,
  ConstructionType,
  EmployeeScale,
  RevenueScale,
  ContractorType,
  ProjectType,
  OutsourcingLevel,
  CurrentSystemUsage,
  ITLiteracy,
  Urgency,
  PainPoint,
  CustomizedMeetingPlan,
} from '../types/meeting';
import {
  DEFAULT_MEETING_VARIABLES,
  CONSTRUCTION_TYPE_LABELS,
  EMPLOYEE_SCALE_LABELS,
  REVENUE_SCALE_LABELS,
  CONTRACTOR_TYPE_LABELS,
  PROJECT_TYPE_LABELS,
  OUTSOURCING_LEVEL_LABELS,
  CURRENT_SYSTEM_LABELS,
  IT_LITERACY_LABELS,
  URGENCY_LABELS,
  PAIN_POINT_LABELS,
} from '../types/meeting';
import { generateMeetingPlan } from '../lib/meetingPlanAgent';
import { useAppStore } from '../store/useAppStore';
import { createProject } from '../lib/database';

function MeetingPrepPage() {
  const navigate = useNavigate();
  const { setChecklist, setMeetingPlan, clearMessages } = useAppStore();

  const [variables, setVariables] = useState<MeetingVariables>(DEFAULT_MEETING_VARIABLES);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<CustomizedMeetingPlan | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'checklist' | 'questions' | 'flow'>('input');

  // 商談プラン生成（案件作成 + 確認画面へ）
  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      const plan = await generateMeetingPlan(variables);
      
      // チェックリストを作成
      const customChecklist = {
        name: `カスタマイズ商談チェックリスト（${variables.companyName || '新規顧客'}）`,
        description: `${variables.constructionTypes.map((t) => CONSTRUCTION_TYPE_LABELS[t]).join('・')}向けカスタマイズ`,
        version: '1.0',
        categories: groupChecklistByCategory(plan.checklistItems),
      };

      // 案件を作成
      const project = await createProject({
        name: variables.companyName || '新規案件',
        description: `工種: ${variables.constructionTypes.map((t) => CONSTRUCTION_TYPE_LABELS[t]).join('・') || '未指定'}`,
        meetingVariables: variables,
        meetingPlan: plan,
        checklist: customChecklist,
      });

      // 状態を保存
      setGeneratedPlan(plan);
      setCreatedProjectId(project.id);
      setChecklist(customChecklist);
      setMeetingPlan(plan, variables);
      
      // 確認画面（チェックリストタブ）へ
      setActiveTab('checklist');
    } catch (error) {
      console.error('プラン生成エラー:', error);
      alert('商談プランの生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  // 録音画面へ遷移
  const handleStartRecording = () => {
    if (!createdProjectId) return;
    clearMessages();
    navigate(`/?projectId=${createdProjectId}`);
  };

  const updateVariable = <K extends keyof MeetingVariables>(
    key: K,
    value: MeetingVariables[K]
  ) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  };

  const toggleArrayItem = <T extends string>(key: keyof MeetingVariables, item: T) => {
    const current = variables[key] as T[];
    const updated = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    updateVariable(key, updated as MeetingVariables[typeof key]);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* ページタイトル */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📋 商談準備</h1>
        <p className="text-gray-500 text-sm">
          事前情報を入力して、カスタマイズされた商談プランを生成
        </p>
      </div>

      {/* タブ */}
      <div className="bg-white rounded-t-lg border border-gray-200 border-b-0">
        <div className="flex gap-1 p-1">
          {[
            { key: 'input', label: '📝 事前情報入力' },
            { key: 'checklist', label: '✅ チェックリスト', disabled: !generatedPlan },
            { key: 'questions', label: '❓ 想定質問集', disabled: !generatedPlan },
            { key: 'flow', label: '🗣️ 話の組み立て', disabled: !generatedPlan },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => !tab.disabled && setActiveTab(tab.key as typeof activeTab)}
              disabled={tab.disabled}
              className={`px-4 py-3 font-medium text-sm transition-colors rounded-lg ${
                activeTab === tab.key
                  ? 'bg-blue-500 text-white'
                  : tab.disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-b-lg border border-gray-200 p-6">
        {/* 事前情報入力 */}
        {activeTab === 'input' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* 会社名 */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">会社基本情報</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    会社名（任意）
                  </label>
                  <input
                    type="text"
                    value={variables.companyName || ''}
                    onChange={(e) => updateVariable('companyName', e.target.value)}
                    placeholder="例：〇〇建設株式会社"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 工種 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    工種（複数選択可）
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(CONSTRUCTION_TYPE_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => toggleArrayItem('constructionTypes', key as ConstructionType)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          variables.constructionTypes.includes(key as ConstructionType)
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 従業員規模 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    従業員規模
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(EMPLOYEE_SCALE_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => updateVariable('employeeScale', key as EmployeeScale)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          variables.employeeScale === key
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 売上規模 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    年間売上規模
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(REVENUE_SCALE_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => updateVariable('revenueScale', key as RevenueScale)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          variables.revenueScale === key
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 事業特性 */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">事業特性</h2>

              <div className="space-y-4">
                {/* 元請け/下請け */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    元請け/下請けの比率
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(CONTRACTOR_TYPE_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => updateVariable('contractorType', key as ContractorType)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          variables.contractorType === key
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 公共/民間 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    公共/民間の比率
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(PROJECT_TYPE_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => updateVariable('projectType', key as ProjectType)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          variables.projectType === key
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 外注（協力会社） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    協力会社（外注）の数
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(OUTSOURCING_LEVEL_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => updateVariable('outsourcingLevel', key as OutsourcingLevel)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          variables.outsourcingLevel === key
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 同時進行現場数 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    同時進行現場数（平均）
                  </label>
                  <input
                    type="number"
                    value={variables.concurrentProjects || ''}
                    onChange={(e) =>
                      updateVariable('concurrentProjects', parseInt(e.target.value) || undefined)
                    }
                    placeholder="例：5"
                    className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 現状 */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">現状のシステム利用状況</h2>

              <div className="space-y-4">
                {/* 現在のシステム */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    現在の業務管理方法
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(CURRENT_SYSTEM_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => updateVariable('currentSystem', key as CurrentSystemUsage)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          variables.currentSystem === key
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* IT習熟度 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    社内のIT習熟度
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(IT_LITERACY_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => updateVariable('itLiteracy', key as ITLiteracy)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          variables.itLiteracy === key
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ニーズ */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">ニーズ・導入意向</h2>

              <div className="space-y-4">
                {/* 改善したい業務 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    一番改善したい業務（複数選択可）
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(PAIN_POINT_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => toggleArrayItem('painPoints', key as PainPoint)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          variables.painPoints.includes(key as PainPoint)
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 緊急度 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    導入の緊急度
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(URGENCY_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => updateVariable('urgency', key as Urgency)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          variables.urgency === key
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 自由記述 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    その他のメモ（任意）
                  </label>
                  <textarea
                    value={variables.additionalNotes || ''}
                    onChange={(e) => updateVariable('additionalNotes', e.target.value)}
                    placeholder="例：前回の商談で〇〇の話題が出た、紹介元は△△さん、など"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 生成ボタン */}
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleGeneratePlan}
                disabled={isGenerating}
                className={`px-10 py-4 rounded-lg font-bold text-lg transition-colors ${
                  isGenerating
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                }`}
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    生成中...
                  </span>
                ) : (
                  '🚀 商談プランを生成'
                )}
              </button>
            </div>
          </div>
        )}

        {/* チェックリスト */}
        {activeTab === 'checklist' && generatedPlan && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">✅ カスタマイズチェックリスト</h2>
                <p className="text-gray-500 text-sm">
                  {generatedPlan.checklistItems.length}項目の質問リスト
                </p>
              </div>
              <button
                onClick={handleStartRecording}
                disabled={!createdProjectId}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  createdProjectId
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                🎤 録音開始
              </button>
            </div>

            <div className="space-y-4">
              {generatedPlan.checklistItems.map((item, index) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-gray-800">{item.question}</p>
                        <span
                          className={`px-2 py-1 rounded text-xs flex-shrink-0 ${
                            item.importance === 'high'
                              ? 'bg-red-100 text-red-600'
                              : item.importance === 'medium'
                              ? 'bg-yellow-100 text-yellow-600'
                              : 'bg-green-100 text-green-600'
                          }`}
                        >
                          {item.importance === 'high'
                            ? '重要'
                            : item.importance === 'medium'
                            ? '中'
                            : '低'}
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">📌 {item.reason}</p>
                      {item.followUpQuestions && item.followUpQuestions.length > 0 && (
                        <div className="mt-2">
                          <p className="text-gray-400 text-xs">深堀り質問:</p>
                          <ul className="text-gray-600 text-sm list-disc list-inside">
                            {item.followUpQuestions.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                        {item.category}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 想定質問集 */}
        {activeTab === 'questions' && generatedPlan && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* ヘッダー */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">❓ 想定質問集</h2>
                <p className="text-gray-500 text-sm">
                  以下の質問に答えられるよう準備することで、提案の成功率が高まります
                </p>
              </div>
              <button
                onClick={handleStartRecording}
                disabled={!createdProjectId}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  createdProjectId
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                🎤 録音開始
              </button>
            </div>

            {/* 刺さる提案のための確認ポイント */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                🎯 刺さる提案のための確認ポイント
                <span className="text-sm font-normal text-gray-500">
                  （これを確認できれば提案が響きます）
                </span>
              </h3>
              <div className="space-y-4">
                {generatedPlan.proposalStrategy.keyFeatures.map((feature, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 mb-1">
                          「{feature.featureName}」を提案するために
                        </h4>
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-2">
                          <p className="text-yellow-800 text-sm font-medium">
                            📌 確認すべき質問: {feature.useCase}
                          </p>
                        </div>
                        <p className="text-gray-600 text-sm">
                          <strong>訴求ポイント:</strong> {feature.pitch}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 想定される質問と回答例 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">💬 想定される質問と回答例</h3>
              <p className="text-gray-500 text-sm mb-4">
                お客様からよく聞かれる質問と、その回答例です
              </p>
              <div className="space-y-4">
                {generatedPlan.proposalStrategy.potentialObjections.map((obj, index) => (
                  <div key={index} className="border-l-4 border-blue-400 pl-4 py-2 bg-gray-50 rounded-r">
                    <p className="text-gray-700 font-medium flex items-center gap-2">
                      <span className="text-blue-500">Q.</span>
                      「{obj.objection}」
                    </p>
                    <p className="text-gray-600 text-sm mt-2 flex items-start gap-2">
                      <span className="text-green-500 font-bold">A.</span>
                      <span>{obj.response}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* アピールポイント */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">💪 アピールポイント</h3>
              <p className="text-gray-500 text-sm mb-4">
                確認ポイントをクリアしたら、これらをアピールしましょう
              </p>
              <ul className="space-y-2">
                {generatedPlan.proposalStrategy.differentiators.map((diff, index) => (
                  <li key={index} className="flex items-center gap-3 p-2 bg-green-50 rounded">
                    <span className="text-green-500 text-lg">✓</span>
                    <span className="text-gray-700">{diff}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* クロージングのポイント */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">🎬 クロージングのポイント</h3>
              <p className="text-gray-700 bg-blue-50 p-4 rounded-lg">
                {generatedPlan.proposalStrategy.closingApproach}
              </p>
            </div>
          </div>
        )}

        {/* 話の組み立て */}
        {activeTab === 'flow' && generatedPlan && (
          <div className="max-w-4xl mx-auto">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">🗣️ 商談の流れ</h2>
                <p className="text-gray-500 text-sm">
                  チェックリストと事前情報を元に最適な順序を提案
                </p>
              </div>
              <button
                onClick={handleStartRecording}
                disabled={!createdProjectId}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  createdProjectId
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                🎤 録音開始
              </button>
            </div>

            <div className="space-y-6">
              {generatedPlan.conversationFlow.map((step, index) => (
                <div key={step.phase} className="relative">
                  {/* タイムライン */}
                  {index < generatedPlan.conversationFlow.length - 1 && (
                    <div className="absolute left-6 top-14 bottom-0 w-0.5 bg-gray-200" />
                  )}

                  <div className="flex gap-4">
                    {/* フェーズアイコン */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        step.phase === 'opening'
                          ? 'bg-green-100 text-green-600'
                          : step.phase === 'discovery'
                          ? 'bg-blue-100 text-blue-600'
                          : step.phase === 'presentation'
                          ? 'bg-purple-100 text-purple-600'
                          : step.phase === 'handling'
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {step.phase === 'opening' && '👋'}
                      {step.phase === 'discovery' && '🔍'}
                      {step.phase === 'presentation' && '📊'}
                      {step.phase === 'handling' && '💬'}
                      {step.phase === 'closing' && '🤝'}
                    </div>

                    {/* コンテンツ */}
                    <div className="flex-1 pb-6 bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{step.phaseName}</h3>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                          {step.duration}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">目標:</p>
                          <ul className="space-y-1">
                            {step.objectives.map((obj, i) => (
                              <li
                                key={i}
                                className="text-gray-700 text-sm flex items-start gap-2"
                              >
                                <span className="text-blue-500">•</span>
                                {obj}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p className="text-sm text-gray-500 mb-1">ポイント:</p>
                          <ul className="space-y-1">
                            {step.keyPoints.map((point, i) => (
                              <li
                                key={i}
                                className="text-gray-600 text-sm flex items-start gap-2"
                              >
                                <span className="text-green-500">✓</span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {step.transitionPhrase && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500">移行フレーズ:</p>
                            <p className="text-gray-700 italic">「{step.transitionPhrase}」</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// チェックリストをカテゴリでグループ化
function groupChecklistByCategory(items: CustomizedMeetingPlan['checklistItems']) {
  const categoryMap = new Map<string, typeof items>();

  items.forEach((item) => {
    const existing = categoryMap.get(item.category) || [];
    existing.push(item);
    categoryMap.set(item.category, existing);
  });

  return Array.from(categoryMap.entries()).map(([name, items]) => ({
    name,
    items: items.map((item) => ({
      id: item.id,
      question: item.question,
      importance: item.importance,
      keywords: item.followUpQuestions || [],
    })),
  }));
}

export default MeetingPrepPage;
