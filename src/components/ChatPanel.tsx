import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { AnalysisResult, CustomizedMeetingPlan } from '../types';

function ChatPanel() {
  const { messages, isAnalyzing, meetingPlan, meetingVariables } = useAppStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showPlanDetails, setShowPlanDetails] = useState(true);

  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md">
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">📊 商談アシスタント</h2>
        <p className="text-gray-500 text-sm">
          {meetingPlan ? '商談プランを確認しながら録音してください' : '商談準備ページでプランを生成してください'}
        </p>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 商談プラン表示 */}
        {meetingPlan && (
          <MeetingPlanCard 
            plan={meetingPlan} 
            companyName={meetingVariables?.companyName}
            showDetails={showPlanDetails}
            onToggleDetails={() => setShowPlanDetails(!showPlanDetails)}
          />
        )}

        {/* メッセージがない場合 */}
        {messages.length === 0 && !meetingPlan && (
          <div className="text-center text-gray-400 py-8">
            <p className="text-4xl mb-2">📋</p>
            <p>商談プランがありません</p>
            <p className="text-sm">商談準備ページでプランを生成してください</p>
          </div>
        )}

        {/* メッセージ一覧 */}
        {messages.length > 0 && (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.role === 'system'
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-gray-50 text-gray-800 border border-gray-200'
                }`}
              >
                {message.role === 'assistant' && message.analysisResult && (
                  <AnalysisResultCard result={message.analysisResult} />
                )}
                {!message.analysisResult && (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
                <div
                  className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}

        {/* ローディング表示 */}
        {isAnalyzing && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="text-gray-500 ml-2">分析中...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

// 商談プランカード（タブ切り替え）
function MeetingPlanCard({ 
  plan, 
  companyName,
  showDetails,
  onToggleDetails,
}: { 
  plan: CustomizedMeetingPlan;
  companyName?: string;
  showDetails: boolean;
  onToggleDetails: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'checklist' | 'questions' | 'flow'>('checklist');

  // チェックリストをカテゴリ別にグループ化
  const groupedChecklist = plan.checklistItems.reduce((acc, item) => {
    const category = item.category || '基本情報';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof plan.checklistItems>);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <span className="text-xl">📋</span>
          <div>
            <h3 className="font-semibold text-blue-800">
              {companyName || '新規顧客'} の商談プラン
            </h3>
            <p className="text-xs text-blue-600">
              {plan.checklistItems.length}項目のチェックリスト
            </p>
          </div>
        </div>
        <button
          onClick={onToggleDetails}
          className="text-blue-600 hover:text-blue-800 text-sm px-3 py-1 rounded bg-white/50"
        >
          {showDetails ? '▼ 閉じる' : '▶ 開く'}
        </button>
      </div>

      {showDetails && (
        <>
          {/* タブ */}
          <div className="flex border-b border-blue-200 bg-white/30">
            {[
              { key: 'checklist', label: '✅ チェックリスト' },
              { key: 'questions', label: '❓ 想定質問' },
              { key: 'flow', label: '🗣️ 話の流れ' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white text-blue-700 border-b-2 border-blue-500'
                    : 'text-blue-600 hover:bg-white/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 max-h-[400px] overflow-y-auto">
            {/* チェックリスト */}
            {activeTab === 'checklist' && (
              <div className="space-y-4">
                {Object.entries(groupedChecklist).map(([category, items]) => (
                  <div key={category}>
                    <h4 className="font-medium text-blue-700 mb-2 text-sm">{category}</h4>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={`text-sm p-3 rounded-lg bg-white ${
                            item.importance === 'high'
                              ? 'border-l-4 border-red-400'
                              : item.importance === 'medium'
                              ? 'border-l-4 border-yellow-400'
                              : 'border-l-4 border-gray-300'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              item.importance === 'high'
                                ? 'bg-red-100 text-red-700'
                                : item.importance === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {item.importance === 'high' ? '必須' : item.importance === 'medium' ? '推奨' : '任意'}
                            </span>
                            <span className="text-gray-700 flex-1">{item.question}</span>
                          </div>
                          {item.followUpQuestions && item.followUpQuestions.length > 0 && (
                            <div className="mt-2 pl-3 border-l-2 border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">深掘り質問:</p>
                              <ul className="space-y-1">
                                {item.followUpQuestions.map((fq, i) => (
                                  <li key={i} className="text-xs text-gray-600">・{fq}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 想定質問 */}
            {activeTab === 'questions' && (
              <div className="space-y-4">
                {/* 確認ポイント */}
                <div>
                  <h4 className="font-medium text-blue-700 mb-2 text-sm">🎯 刺さる提案のための確認ポイント</h4>
                  <div className="space-y-2">
                    {plan.proposalStrategy.keyFeatures.map((feature, index) => (
                      <div key={index} className="bg-white p-3 rounded-lg">
                        <p className="font-medium text-gray-800 text-sm">{feature.featureName}</p>
                        <div className="bg-yellow-50 rounded p-2 mt-2">
                          <p className="text-xs text-yellow-800">📌 確認: {feature.useCase}</p>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">訴求: {feature.pitch}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Q&A */}
                <div>
                  <h4 className="font-medium text-blue-700 mb-2 text-sm">💬 想定質問と回答</h4>
                  <div className="space-y-2">
                    {plan.proposalStrategy.potentialObjections.map((obj, index) => (
                      <div key={index} className="bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <span className="text-blue-500 font-bold">Q.</span> {obj.objection}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="text-green-500 font-bold">A.</span> {obj.response}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 話の流れ */}
            {activeTab === 'flow' && (
              <div className="space-y-3">
                {plan.conversationFlow.map((step, index) => (
                  <div key={step.phase} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 bg-white p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-800 text-sm">{step.phaseName}</span>
                        <span className="text-xs text-gray-400">約{step.duration}分</span>
                      </div>
                      {step.objectives && step.objectives.length > 0 && (
                        <p className="text-xs text-gray-600">{step.objectives[0]}</p>
                      )}
                      {step.keyPoints && step.keyPoints.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {step.keyPoints.map((point, i) => (
                            <li key={i} className="text-xs text-gray-500">・{point}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AnalysisResultCard({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-4">
      {/* サマリー */}
      <div className="whitespace-pre-wrap">{result.summary}</div>

      {/* プログレスバー */}
      <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            result.coverageRate >= 80
              ? 'bg-green-500'
              : result.coverageRate >= 60
              ? 'bg-yellow-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${result.coverageRate}%` }}
        />
      </div>

      {/* 推奨事項 */}
      {result.recommendations.length > 0 && (
        <div className="mt-4">
          <h4 className="font-semibold mb-2">📋 次に確認すべき項目:</h4>
          <ul className="space-y-1">
            {result.recommendations.map((rec, index) => (
              <li key={index} className="text-sm">
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 詳細結果（折りたたみ） */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-blue-600 hover:underline">
          詳細結果を表示
        </summary>
        <div className="mt-2 space-y-2">
          {result.results.map((r, index) => (
            <div
              key={index}
              className={`p-2 rounded text-sm ${
                r.status === 'covered'
                  ? 'bg-green-50 border-l-4 border-green-500'
                  : r.status === 'partial'
                  ? 'bg-yellow-50 border-l-4 border-yellow-500'
                  : 'bg-red-50 border-l-4 border-red-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>
                  {r.status === 'covered' ? '✅' : r.status === 'partial' ? '⚠️' : '❌'}
                </span>
                <span>{r.item.question}</span>
              </div>
              {r.matchedText && (
                <p className="text-xs text-gray-500 mt-1 ml-6">{r.matchedText}</p>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

export default ChatPanel;
