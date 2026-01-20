import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { isGeminiAvailable } from '../lib/analyzeTranscript';
import { RealtimeSpeechRecognizer } from '../lib/speechToText';

function AdminPage() {
  const { checklist, loadChecklistFromJson } = useAppStore();
  const [jsonInput, setJsonInput] = useState('');
  const [activeTab, setActiveTab] = useState<'view' | 'edit' | 'settings'>('view');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLoadJson = () => {
    try {
      loadChecklistFromJson(jsonInput);
      setMessage({ type: 'success', text: 'チェックリストを読み込みました' });
      setJsonInput('');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'JSONのパースに失敗しました' });
    }
  };

  const handleExportJson = () => {
    const json = JSON.stringify(checklist, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'checklist.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalItems = checklist.categories.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {/* ページタイトル */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">⚙️ 管理者画面</h1>
          <p className="text-gray-500 text-sm">商談の型（チェックリスト）の管理とシステム設定</p>
        </div>

        {/* メッセージ */}
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* タブ */}
        <div className="bg-white rounded-t-lg border border-gray-200 border-b-0">
          <div className="flex gap-1 p-1">
            {[
              { key: 'view', label: '📋 チェックリスト' },
              { key: 'edit', label: '✏️ 編集・インポート' },
              { key: 'settings', label: '🔧 システム設定' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-4 py-3 font-medium text-sm transition-colors rounded-lg ${
                  activeTab === tab.key
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-b-lg border border-gray-200 p-6">
          {/* チェックリスト表示 */}
          {activeTab === 'view' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{checklist.name}</h2>
                  <p className="text-gray-500 text-sm">{checklist.description}</p>
                  <p className="text-gray-400 text-xs mt-1">バージョン: {checklist.version}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">{totalItems}</p>
                  <p className="text-gray-500 text-sm">項目数</p>
                </div>
              </div>

              <div className="space-y-6">
                {checklist.categories.map((category, catIndex) => (
                  <div key={catIndex} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 flex items-center">
                      <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-2 text-sm">
                        {category.items.length}
                      </span>
                      {category.name}
                    </h3>
                    <ul className="space-y-2">
                      {category.items.map((item) => (
                        <li key={item.id} className="flex items-start p-2 bg-gray-50 rounded">
                          <span
                            className={`inline-block w-2 h-2 rounded-full mt-2 mr-3 ${
                              item.importance === 'high'
                                ? 'bg-red-500'
                                : item.importance === 'medium'
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                          />
                          <div className="flex-1">
                            <p className="text-gray-800">{item.question}</p>
                            <p className="text-gray-400 text-xs mt-1">
                              キーワード: {item.keywords.join(', ')}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
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
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleExportJson}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  📥 JSONエクスポート
                </button>
              </div>
            </div>
          )}

          {/* 編集・インポート */}
          {activeTab === 'edit' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">チェックリストのインポート</h2>
              <p className="text-gray-600 mb-4">
                JSON形式でチェックリストをインポートできます。
              </p>

              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`{
  "name": "チェックリスト名",
  "description": "説明",
  "version": "1.0",
  "categories": [
    {
      "name": "カテゴリ名",
      "items": [
        {
          "id": "item_001",
          "question": "質問内容",
          "importance": "high",
          "keywords": ["キーワード1", "キーワード2"]
        }
      ]
    }
  ]
}`}
              />

              <div className="mt-4 flex gap-4">
                <button
                  onClick={handleLoadJson}
                  disabled={!jsonInput.trim()}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  📤 インポート
                </button>
                <button
                  onClick={() => setJsonInput(JSON.stringify(checklist, null, 2))}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  現在のチェックリストを表示
                </button>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">📝 フォーマット説明</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>
                    • <code className="bg-gray-200 px-1 rounded">name</code>: チェックリスト名
                  </li>
                  <li>
                    • <code className="bg-gray-200 px-1 rounded">description</code>: 説明
                  </li>
                  <li>
                    • <code className="bg-gray-200 px-1 rounded">categories</code>: カテゴリの配列
                  </li>
                  <li>
                    • <code className="bg-gray-200 px-1 rounded">items</code>: 各カテゴリ内の質問項目
                  </li>
                  <li>
                    • <code className="bg-gray-200 px-1 rounded">importance</code>: high / medium /
                    low
                  </li>
                  <li>
                    • <code className="bg-gray-200 px-1 rounded">keywords</code>:
                    突合に使用するキーワード
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* システム設定 */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">システム設定</h2>

              {/* API接続状態 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold mb-3">🔌 API接続状態</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">Gemini API</p>
                      <p className="text-sm text-gray-500">文字起こしテキストの分析に使用</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
                        isGeminiAvailable()
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {isGeminiAvailable() ? '✅ 接続済み' : '⚠️ 未設定（デモモード）'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">Web Speech API</p>
                      <p className="text-sm text-gray-500">リアルタイム音声認識に使用</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
                        RealtimeSpeechRecognizer.isAvailable()
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {RealtimeSpeechRecognizer.isAvailable()
                        ? '✅ 利用可能'
                        : '❌ 非対応ブラウザ'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 環境変数の設定方法 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold mb-3">🔐 環境変数の設定</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Gemini APIを使用するには、環境変数を設定してください。
                </p>
                <div className="bg-gray-800 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <p># .env ファイルを作成</p>
                  <p className="mt-2">VITE_GEMINI_API_KEY=your_api_key_here</p>
                </div>
                <p className="text-gray-500 text-xs mt-3">
                  ※ APIキーは
                  <a
                    href="https://makersuite.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline ml-1"
                  >
                    Google AI Studio
                  </a>
                  で取得できます。
                </p>
              </div>

              {/* セキュリティ情報 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold mb-3">🔒 セキュリティ情報</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>音声データはブラウザ内でローカル処理されます</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500">⚠</span>
                    <span>
                      文字起こしテキストはGemini APIに送信されます（分析のため）
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">ℹ</span>
                    <span>
                      完全にデータを外部送信しない場合は、Ollamaを使用してください
                    </span>
                  </li>
                </ul>
              </div>

              {/* バージョン情報 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold mb-3">📦 バージョン情報</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">アプリケーション</p>
                    <p className="font-medium">AI Navigation PoC v0.1.0</p>
                  </div>
                  <div>
                    <p className="text-gray-500">チェックリスト</p>
                    <p className="font-medium">{checklist.version}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
