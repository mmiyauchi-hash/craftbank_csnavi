/**
 * 案件詳細ページ
 * - 案件情報の表示・編集
 * - 録音データの一覧・管理
 * - 音声ファイルのアップロード
 * - 分析結果の閲覧
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Project, Recording, AnalysisRecord, ProjectStatus } from '../types/project';
import { PROJECT_STATUS_LABELS, RECORDING_SOURCE_LABELS } from '../types/project';
import {
  getProject,
  updateProject,
  getRecordingsByProject,
  createRecording,
  deleteRecording,
  getAnalysesByRecording,
} from '../lib/database';
import { useAppStore } from '../store/useAppStore';
import { analyzeAudioWithGemini } from '../lib/analyzeTranscript';

function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { checklist, addMessage, setIsAnalyzing, isAnalyzing } = useAppStore();

  const [project, setProject] = useState<Project | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [recordingAnalyses, setRecordingAnalyses] = useState<AnalysisRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'recordings' | 'analysis' | 'plan'>('recordings');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('draft');
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // データ読み込み
  const loadData = async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    try {
      const [projectData, recordingsData] = await Promise.all([
        getProject(projectId),
        getRecordingsByProject(projectId),
      ]);
      
      if (projectData) {
        console.log('=== 案件データ読み込み ===');
        console.log('案件名:', projectData.name);
        console.log('商談プランの有無:', !!projectData.meetingPlan);
        console.log('商談プラン詳細:', projectData.meetingPlan);
        if (projectData.meetingPlan) {
          console.log('チェックリスト項目数:', projectData.meetingPlan.checklistItems?.length || 0);
          console.log('proposalStrategy:', projectData.meetingPlan.proposalStrategy);
          console.log('conversationFlow:', projectData.meetingPlan.conversationFlow);
        }
        setProject(projectData);
        setEditName(projectData.name);
        setEditDescription(projectData.description || '');
        setEditStatus(projectData.status);
      }
      setRecordings(recordingsData);
    } catch (error) {
      console.error('データ読み込みエラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // 録音選択時に分析結果を読み込み
  useEffect(() => {
    if (selectedRecording) {
      getAnalysesByRecording(selectedRecording.id).then(setRecordingAnalyses);
    } else {
      setRecordingAnalyses([]);
    }
  }, [selectedRecording]);

  // 案件情報の保存
  const handleSaveProject = async () => {
    if (!project) return;

    try {
      await updateProject(project.id, {
        name: editName,
        description: editDescription,
        status: editStatus,
      });
      await loadData();
      setIsEditing(false);
    } catch (error) {
      console.error('案件更新エラー:', error);
    }
  };

  // 音声ファイルアップロード
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !project) return;

    // 対応フォーマットチェック
    const supportedTypes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
    if (!supportedTypes.some(type => file.type.includes(type.split('/')[1]))) {
      alert('対応していない音声フォーマットです。\n対応フォーマット: WebM, MP3, WAV, OGG, M4A');
      return;
    }

    setUploadProgress('音声ファイルを読み込み中...');

    try {
      // ファイルをBlobとして読み込み
      const audioBlob = new Blob([await file.arrayBuffer()], { type: file.type });
      
      // 音声の長さを取得
      const duration = await getAudioDuration(audioBlob);
      
      setUploadProgress('録音データを保存中...');

      // 録音データを作成
      const recording = await createRecording({
        projectId: project.id,
        name: file.name.replace(/\.[^/.]+$/, ''), // 拡張子を除去
        audioBlob,
        mimeType: file.type,
        duration: Math.round(duration),
        source: 'uploaded',
      });

      setUploadProgress(null);
      await loadData();
      setSelectedRecording(recording);
      
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('アップロードエラー:', error);
      setUploadProgress(null);
      alert('音声ファイルのアップロードに失敗しました');
    }
  };

  // 音声の長さを取得
  const getAudioDuration = (blob: Blob): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.src = URL.createObjectURL(blob);
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        resolve(audio.duration);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audio.src);
        reject(new Error('音声ファイルの読み込みに失敗しました'));
      };
    });
  };

  // 録音データの削除
  const handleDeleteRecording = async (recordingId: string) => {
    if (!confirm('この録音データを削除しますか？')) return;

    try {
      await deleteRecording(recordingId);
      if (selectedRecording?.id === recordingId) {
        setSelectedRecording(null);
      }
      await loadData();
    } catch (error) {
      console.error('録音削除エラー:', error);
    }
  };

  // 録音データの分析
  const handleAnalyzeRecording = async (recording: Recording) => {
    if (!project) return;

    setIsAnalyzing(true);
    addMessage({
      role: 'system',
      content: `📊 「${recording.name}」を分析中...`,
    });

    try {
      const result = await analyzeAudioWithGemini(recording.audioBlob, checklist);
      
      addMessage({
        role: 'assistant',
        content: '',
        analysisResult: result,
      });

      // 分析結果を閲覧するために更新
      await loadData();
      setSelectedRecording(recording);
    } catch (error) {
      console.error('分析エラー:', error);
      addMessage({
        role: 'system',
        content: `❌ 分析エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 時間フォーマット
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ファイルサイズフォーマット
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-700 mb-4">案件が見つかりません</h1>
          <Link to="/projects" className="text-blue-600 hover:underline">
            案件一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/projects"
            className="text-gray-500 hover:text-gray-700"
          >
            ← 案件一覧
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${
              project.status === 'draft' ? 'bg-gray-100 text-gray-600' :
              project.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
              project.status === 'completed' ? 'bg-green-100 text-green-600' :
              'bg-yellow-100 text-yellow-600'
            }`}>
              {PROJECT_STATUS_LABELS[project.status]}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/?projectId=${project.id}`}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            🎤 録音画面へ
          </Link>
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { key: 'recordings', label: '🎵 録音データ' },
          { key: 'analysis', label: '📊 分析結果' },
          { key: 'plan', label: '📋 商談プラン' },
          { key: 'info', label: 'ℹ️ 案件情報' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === tab.key
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.key === 'plan' && !project.meetingPlan && (
              <span className="ml-1 text-xs text-gray-400">(なし)</span>
            )}
          </button>
        ))}
      </div>

      {/* 録音データタブ */}
      {activeTab === 'recordings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側: 録音一覧 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">録音データ一覧</h2>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="audio-upload"
                />
                <label
                  htmlFor="audio-upload"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  📤 音声ファイルをアップロード
                </label>
              </div>
            </div>

            {uploadProgress && (
              <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700" />
                {uploadProgress}
              </div>
            )}

            {recordings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🎵</div>
                <p>録音データがありません</p>
                <p className="text-sm">録音画面で録音するか、音声ファイルをアップロードしてください</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recordings.map((recording) => (
                  <div
                    key={recording.id}
                    onClick={() => setSelectedRecording(recording)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedRecording?.id === recording.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{recording.name}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                          <span>⏱️ {formatDuration(recording.duration)}</span>
                          <span>📁 {formatFileSize(recording.fileSize)}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            recording.source === 'realtime'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-purple-100 text-purple-600'
                          }`}>
                            {RECORDING_SOURCE_LABELS[recording.source]}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRecording(recording.id);
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      {new Date(recording.createdAt).toLocaleString('ja-JP')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右側: 選択した録音の詳細 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            {selectedRecording ? (
              <>
                <h2 className="text-lg font-semibold mb-4">{selectedRecording.name}</h2>
                
                {/* 音声プレーヤー */}
                <div className="mb-6">
                  <audio
                    controls
                    className="w-full"
                    src={URL.createObjectURL(selectedRecording.audioBlob)}
                  />
                </div>

                {/* 情報 */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <span className="text-gray-500">録音時間:</span>
                    <span className="ml-2 font-medium">{formatDuration(selectedRecording.duration)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">ファイルサイズ:</span>
                    <span className="ml-2 font-medium">{formatFileSize(selectedRecording.fileSize)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">ソース:</span>
                    <span className="ml-2 font-medium">{RECORDING_SOURCE_LABELS[selectedRecording.source]}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">形式:</span>
                    <span className="ml-2 font-medium">{selectedRecording.mimeType}</span>
                  </div>
                </div>

                {/* 文字起こし */}
                {selectedRecording.transcript && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2">📝 文字起こし</h3>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-40 overflow-y-auto">
                      {selectedRecording.transcript}
                    </div>
                  </div>
                )}

                {/* 分析ボタン */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAnalyzeRecording(selectedRecording)}
                    disabled={isAnalyzing}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isAnalyzing
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isAnalyzing ? '⏳ 分析中...' : '📊 この録音を分析'}
                  </button>
                  <a
                    href={URL.createObjectURL(selectedRecording.audioBlob)}
                    download={`${selectedRecording.name}.${selectedRecording.mimeType.split('/')[1]}`}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    📥 ダウンロード
                  </a>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">👈</div>
                <p>録音データを選択してください</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 分析結果タブ */}
      {activeTab === 'analysis' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">📊 分析結果一覧</h2>
          
          {recordingAnalyses.length === 0 && !selectedRecording ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📊</div>
              <p>まず録音データタブで録音を選択してください</p>
            </div>
          ) : recordingAnalyses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📊</div>
              <p>この録音の分析結果はまだありません</p>
              <button
                onClick={() => selectedRecording && handleAnalyzeRecording(selectedRecording)}
                disabled={isAnalyzing}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                📊 分析を実行
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {recordingAnalyses.map((analysis) => (
                <div key={analysis.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">
                      {new Date(analysis.createdAt).toLocaleString('ja-JP')}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      analysis.result.coverageRate >= 80 ? 'bg-green-100 text-green-600' :
                      analysis.result.coverageRate >= 60 ? 'bg-yellow-100 text-yellow-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      カバー率: {analysis.result.coverageRate}%
                    </span>
                  </div>
                  
                  {/* プログレスバー */}
                  <div className="bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        analysis.result.coverageRate >= 80 ? 'bg-green-500' :
                        analysis.result.coverageRate >= 60 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${analysis.result.coverageRate}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{analysis.result.coveredItems}</div>
                      <div className="text-gray-500">聞けた項目</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-600">{analysis.result.partialItems}</div>
                      <div className="text-gray-500">部分的</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{analysis.result.missingItems}</div>
                      <div className="text-gray-500">聞けていない</div>
                    </div>
                  </div>

                  {analysis.result.recommendations.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-blue-600 hover:underline">
                        推奨事項を表示
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {analysis.result.recommendations.map((rec, i) => (
                          <li key={i} className="text-sm text-gray-700">{rec}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 商談プランタブ */}
      {activeTab === 'plan' && project && (
        project.meetingPlan && project.meetingPlan.checklistItems ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">📋 商談プラン</h2>
            <p className="text-gray-600 text-sm">
              {project.meetingPlan.checklistItems?.length || 0}項目のチェックリスト
            </p>
          </div>

          {/* タブ切り替え */}
          <div className="flex border-b border-gray-200 mb-6">
            {[
              { key: 'checklist', label: '✅ チェックリスト' },
              { key: 'questions', label: '❓ 想定質問集' },
              { key: 'flow', label: '🗣️ 話の組み立て' },
            ].map(tab => (
              <button
                key={tab.key}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  'text-blue-600 border-b-2 border-blue-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* チェックリスト */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">✅ チェックリスト</h3>
            {(project.meetingPlan.checklistItems || []).map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border-l-4 ${
                  item.importance === 'high'
                    ? 'bg-red-50 border-red-400'
                    : item.importance === 'medium'
                    ? 'bg-yellow-50 border-yellow-400'
                    : 'bg-gray-50 border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    item.importance === 'high'
                      ? 'bg-red-100 text-red-700'
                      : item.importance === 'medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {item.importance === 'high' ? '必須' : item.importance === 'medium' ? '推奨' : '任意'}
                  </span>
                  <div className="flex-1">
                    <p className="text-gray-800 font-medium">{item.question}</p>
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
                </div>
              </div>
            ))}
          </div>

          {/* 想定質問集 */}
          {project.meetingPlan.proposalStrategy && (
            <div className="mt-8 space-y-6">
              <h3 className="text-lg font-semibold">❓ 想定質問集</h3>
              
              {/* 確認ポイント */}
              <div>
                <h4 className="font-medium mb-3">🎯 刺さる提案のための確認ポイント</h4>
                <div className="space-y-3">
                  {(project.meetingPlan.proposalStrategy?.keyFeatures || []).map((feature, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="font-medium text-gray-800 mb-2">{feature.featureName}</p>
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
                        <p className="text-sm text-yellow-800">📌 確認: {feature.useCase}</p>
                      </div>
                      <p className="text-sm text-gray-600">訴求: {feature.pitch}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Q&A */}
              <div>
                <h4 className="font-medium mb-3">💬 想定質問と回答</h4>
                <div className="space-y-3">
                  {(project.meetingPlan.proposalStrategy?.potentialObjections || []).map((obj, index) => (
                    <div key={index} className="bg-white border-l-4 border-blue-400 pl-4 py-2 bg-gray-50 rounded-r">
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
            </div>
          )}

          {/* 話の組み立て */}
          {project.meetingPlan.conversationFlow && project.meetingPlan.conversationFlow.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">🗣️ 話の組み立て</h3>
              <div className="space-y-4">
                {(project.meetingPlan.conversationFlow || []).map((step, index) => (
                  <div key={step.phase} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-gray-800">{step.phaseName}</span>
                        <span className="text-xs text-gray-400">約{step.duration}分</span>
                      </div>
                      {step.objectives && step.objectives.length > 0 && (
                        <p className="text-sm text-gray-600">{step.objectives[0]}</p>
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
            </div>
          )}
        </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">商談プランがありません</h2>
              <p className="text-gray-500 mb-6">
                この案件は商談準備ページから作成されていないため、商談プランがありません。
              </p>
              <Link
                to="/prep"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📋 商談準備ページでプランを作成
              </Link>
            </div>
          </div>
        )
      )}

      {/* 案件情報タブ */}
      {activeTab === 'info' && (
        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
          {isEditing ? (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">案件名</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">説明・メモ</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(PROJECT_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveProject}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  保存
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-lg font-semibold">案件情報</h2>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-blue-600 hover:underline text-sm"
                >
                  ✏️ 編集
                </button>
              </div>
              
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-gray-500">案件名</dt>
                  <dd className="font-medium">{project.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">説明・メモ</dt>
                  <dd className="text-gray-700">{project.description || '（なし）'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">ステータス</dt>
                  <dd>{PROJECT_STATUS_LABELS[project.status]}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">作成日時</dt>
                  <dd>{new Date(project.createdAt).toLocaleString('ja-JP')}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">更新日時</dt>
                  <dd>{new Date(project.updatedAt).toLocaleString('ja-JP')}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">録音データ数</dt>
                  <dd>{project.recordingIds.length}件</dd>
                </div>
              </dl>

              {project.meetingPlan && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="font-semibold mb-2">📋 商談プラン</h3>
                  <p className="text-sm text-gray-600">
                    この案件には商談プランが設定されています。
                  </p>
                  <div className="mt-2 text-sm text-gray-500">
                    生成日時: {new Date(project.meetingPlan.generatedAt).toLocaleString('ja-JP')}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectDetailPage;
