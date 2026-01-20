import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { analyzeAudioWithGemini, RealtimeSpeechRecognizer, isGeminiAvailable } from '../lib/analyzeTranscript';
import { classifyError, formatErrorMessage, logError, handleSpeechRecognitionError } from '../lib/errorHandler';
import { createRecording, getProject, createAnalysis } from '../lib/database';
import type { Project, Recording } from '../types/project';

interface AudioRecorderProps {
  projectId?: string;
  project?: Project | null;
}

function AudioRecorder({ projectId: propProjectId, project: propProject }: AudioRecorderProps) {
  const [searchParams] = useSearchParams();
  const projectId = propProjectId || searchParams.get('projectId') || undefined;

  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // 案件関連
  const [project, setProject] = useState<Project | null>(propProject || null);
  const [savedRecording, setSavedRecording] = useState<Recording | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // リアルタイム文字起こし関連
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [realtimeTranscript, setRealtimeTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');

  // 親コンポーネントからprojectが渡されたら更新
  useEffect(() => {
    if (propProject !== undefined) {
      setProject(propProject);
    }
  }, [propProject]);

  // プロジェクトIDのみ渡された場合のフォールバック（親からprojectが渡されない場合）
  useEffect(() => {
    if (projectId && !propProject) {
      getProject(projectId).then(projectData => {
        if (projectData) {
          setProject(projectData);
          // AudioRecorderではストアの更新を行わない（親コンポーネントに任せる）
        }
      });
    } else if (!projectId && !propProject) {
      setProject(null);
    }
  }, [projectId, propProject]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognizerRef = useRef<RealtimeSpeechRecognizer | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importedAudioBlob, setImportedAudioBlob] = useState<Blob | null>(null);
  const [importedAudioName, setImportedAudioName] = useState<string>('');
  const [importedAudioDuration, setImportedAudioDuration] = useState<number>(0);

  const {
    checklist,
    addMessage,
    setIsAnalyzing,
    isAnalyzing,
    setLastAnalysisResult,
  } = useAppStore();

  // Web Speech APIが利用可能かチェック
  const isSpeechRecognitionAvailable = RealtimeSpeechRecognizer.isAvailable();

  // マイクアクセスのリクエスト
  const requestMicrophoneAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // オーディオレベルを監視するためのAudioContextを設定
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      return stream;
    } catch (err) {
      const appError = classifyError(err);
      logError(appError, 'requestMicrophoneAccess');
      setError(formatErrorMessage(appError));
      throw err;
    }
  };

  // オーディオレベルの監視
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      if (!isRecording) return;

      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average);

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }, [isRecording]);

  // リアルタイム文字起こしを開始
  const startRealtimeTranscription = useCallback(() => {
    if (!isSpeechRecognitionAvailable) {
      console.log('Web Speech API is not available');
      return;
    }

    recognizerRef.current = new RealtimeSpeechRecognizer();
    recognizerRef.current.start(
      (text, isFinal) => {
        if (isFinal) {
          setRealtimeTranscript(text);
          setInterimTranscript('');
        } else {
          setInterimTranscript(text);
        }
      },
      (errorCode) => {
        const appError = handleSpeechRecognitionError(errorCode);
        logError(appError, 'speechRecognition');
        // 音声認識エラーは軽微なのでユーザーには通知しない（ログのみ）
      }
    );
    setIsTranscribing(true);
  }, [isSpeechRecognitionAvailable]);

  // リアルタイム文字起こしを停止
  const stopRealtimeTranscription = useCallback(() => {
    if (recognizerRef.current) {
      const finalTranscript = recognizerRef.current.stop();
      setRealtimeTranscript(finalTranscript);
      recognizerRef.current = null;
    }
    setIsTranscribing(false);
    setInterimTranscript('');
  }, []);

  // 録音開始
  const startRecording = async () => {
    try {
      setError(null);
      const stream = await requestMicrophoneAccess();

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // 1秒ごとにデータを取得
      setIsRecording(true);
      setRecordingDuration(0);
      setRealtimeTranscript('');

      // 録音時間のカウント
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // オーディオレベルの監視を開始
      monitorAudioLevel();

      // リアルタイム文字起こしを開始
      startRealtimeTranscription();
    } catch (err) {
      const appError = classifyError(err);
      setError(formatErrorMessage(appError));
      setIsRecording(false);
    }
  };

  // 録音停止
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // ストリームを停止
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // AudioContextをクリーンアップ
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // アニメーションフレームをキャンセル
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // 録音時間のカウントを停止
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // リアルタイム文字起こしを停止
      stopRealtimeTranscription();

      setAudioLevel(0);
    }
  };

  // 録音データを案件に保存
  const saveRecordingToProject = async (recordingName?: string) => {
    if (!project || audioChunksRef.current.length === 0) {
      setError('保存する音声データがないか、案件が選択されていません。');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: 'audio/webm;codecs=opus',
      });

      const name = recordingName || `録音_${new Date().toLocaleString('ja-JP', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).replace(/\//g, '-').replace(' ', '_')}`;

      const recording = await createRecording({
        projectId: project.id,
        name,
        audioBlob,
        mimeType: 'audio/webm;codecs=opus',
        duration: recordingDuration,
        source: 'realtime',
        transcript: realtimeTranscript || undefined,
      });

      setSavedRecording(recording);
      setSuccessMessage(`✅ 録音を「${project.name}」に保存しました`);
      
      // 3秒後にメッセージを消す
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      const appError = classifyError(err);
      logError(appError, 'saveRecordingToProject');
      setError(formatErrorMessage(appError));
    } finally {
      setIsSaving(false);
    }
  };

  // 音声ファイルのインポート
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setError('音声ファイルのみアップロードできます。');
      return;
    }

    try {
      setError(null);
      const audioBlob = new Blob([file], { type: file.type });
      
      // 音声の長さを取得
      const audio = new Audio(URL.createObjectURL(audioBlob));
      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => {
          setImportedAudioDuration(Math.round(audio.duration));
          resolve();
        };
        audio.onerror = () => {
          console.warn('Failed to load audio metadata');
          setImportedAudioDuration(0);
          resolve();
        };
        audio.load();
      });

      setImportedAudioBlob(audioBlob);
      setImportedAudioName(file.name);
      setRealtimeTranscript(''); // インポート時は文字起こしなし
      
      // チャットにメッセージを追加
      addMessage({
        role: 'user',
        content: `📁 音声ファイルをインポートしました\nファイル名: ${file.name}\nサイズ: ${(file.size / 1024).toFixed(1)}KB\n長さ: ${formatDuration(Math.round(audio.duration))}`,
      });
    } catch (err) {
      const appError = classifyError(err);
      logError(appError, 'handleFileImport');
      setError(formatErrorMessage(appError));
    } finally {
      // ファイル入力のリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // インポートした音声を分析
  const analyzeImportedAudio = async () => {
    if (!importedAudioBlob) {
      setError('インポートされた音声ファイルがありません。');
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);

      addMessage({
        role: 'system',
        content: isGeminiAvailable()
          ? '🔍 Gemini APIで音声データを分析しています...'
          : '🔍 キーワードマッチングで分析しています...（デモモード）',
      });

      // インポートした音声を分析（文字起こしは空、後で実装可能）
      const analysisResult = await analyzeAudioWithGemini(
        importedAudioBlob,
        checklist,
        '' // インポート時は文字起こしなし
      );

      setLastAnalysisResult(analysisResult);

      addMessage({
        role: 'assistant',
        content: '',
        analysisResult,
      });

      // 案件に保存する場合は、保存処理を実行
      if (project) {
        await saveImportedRecordingToProject();
      }
    } catch (err) {
      const appError = classifyError(err);
      logError(appError, 'analyzeImportedAudio');
      setError(formatErrorMessage(appError));
      addMessage({
        role: 'system',
        content: `❌ エラー: 音声分析に失敗しました。`,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // インポートした録音を案件に保存
  const saveImportedRecordingToProject = async () => {
    if (!project || !importedAudioBlob) {
      setError('保存する音声データがないか、案件が選択されていません。');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const name = importedAudioName || `インポート_${new Date().toLocaleString('ja-JP', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).replace(/\//g, '-').replace(' ', '_')}`;

      const recording = await createRecording({
        projectId: project.id,
        name,
        audioBlob: importedAudioBlob,
        mimeType: importedAudioBlob.type,
        duration: importedAudioDuration,
        source: 'import',
        transcript: undefined,
      });

      setSavedRecording(recording);
      setSuccessMessage(`✅ 録音を「${project.name}」に保存しました`);
      
      // インポート状態をリセット
      setImportedAudioBlob(null);
      setImportedAudioName('');
      setImportedAudioDuration(0);
      
      // 3秒後にメッセージを消す
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      const appError = classifyError(err);
      logError(appError, 'saveImportedRecordingToProject');
      setError(formatErrorMessage(appError));
    } finally {
      setIsSaving(false);
    }
  };

  // 要約開始（現時点までの音声を分析）
  const startAnalysis = async () => {
    if (audioChunksRef.current.length === 0) {
      setError('❌ 分析する音声データがありません。録音を開始してください。');
      return;
    }

    try {
      setIsAnalyzing(true);

      // 現時点までの音声データを取得
      const audioBlob = new Blob(audioChunksRef.current, {
        type: 'audio/webm;codecs=opus',
      });

      // 現在のリアルタイム文字起こしを取得
      const currentTranscript = recognizerRef.current?.getTranscript() || realtimeTranscript;

      // ユーザーメッセージを追加
      addMessage({
        role: 'user',
        content: `🎤 要約開始リクエスト\n📝 録音時間: ${formatDuration(recordingDuration)}\n💾 音声データ: ${(audioBlob.size / 1024).toFixed(1)}KB\n${currentTranscript ? `📖 文字起こし: ${currentTranscript.length}文字` : ''}`,
      });

      // システムメッセージを追加
      addMessage({
        role: 'system',
        content: isGeminiAvailable() 
          ? '🔍 Gemini APIで音声データを分析しています...'
          : '🔍 キーワードマッチングで分析しています...（デモモード）',
      });

      // 分析実行
      const result = await analyzeAudioWithGemini(audioBlob, checklist, currentTranscript);

      // 結果を保存
      setLastAnalysisResult(result);

      // 分析結果をチャットに追加
      addMessage({
        role: 'assistant',
        content: '',
        analysisResult: result,
      });
    } catch (err) {
      const appError = classifyError(err);
      logError(appError, 'startAnalysis');
      setError(formatErrorMessage(appError));
      addMessage({
        role: 'system',
        content: `❌ エラー: ${appError.message}`,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 時間のフォーマット
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">🎤 音声録音</h2>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`px-2 py-1 rounded-full ${
              isGeminiAvailable()
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {isGeminiAvailable() ? '✅ API接続済み' : '⚠️ デモモード'}
          </span>
          {isSpeechRecognitionAvailable && (
            <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              🎙️ 文字起こし対応
            </span>
          )}
        </div>
      </div>

      {/* 案件連携表示 */}
      {project ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-blue-600 text-sm font-medium">📁 案件に紐付け中</span>
              <p className="font-semibold text-blue-800">{project.name}</p>
            </div>
            <Link
              to={`/projects/${project.id}`}
              className="text-blue-600 hover:underline text-sm"
            >
              案件詳細 →
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-gray-500 text-sm">📁 案件未選択</span>
              <p className="text-gray-600 text-sm">録音データは一時的に保持されます</p>
            </div>
            <Link
              to="/projects"
              className="text-blue-600 hover:underline text-sm"
            >
              案件を選択 →
            </Link>
          </div>
        </div>
      )}

      {/* 成功メッセージ */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center justify-between">
          <span>{successMessage}</span>
          {savedRecording && project && (
            <Link
              to={`/projects/${project.id}`}
              className="text-green-800 hover:underline font-medium"
            >
              案件を開く →
            </Link>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* 録音時間表示 */}
      {isRecording && (
        <div className="text-center py-4">
          <div className="text-4xl font-mono font-bold text-gray-800">
            {formatDuration(recordingDuration)}
          </div>
          <div className="text-sm text-gray-500 mt-1">録音時間</div>
        </div>
      )}

      {/* インポートした音声の情報 */}
      {importedAudioBlob && !isRecording && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-blue-800">📁 インポートした音声</h3>
            <button
              onClick={() => {
                setImportedAudioBlob(null);
                setImportedAudioName('');
                setImportedAudioDuration(0);
              }}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ✕ クリア
            </button>
          </div>
          <div className="text-sm text-blue-700 space-y-1">
            <p>ファイル名: {importedAudioName}</p>
            <p>長さ: {formatDuration(importedAudioDuration)}</p>
            <p>サイズ: {(importedAudioBlob.size / 1024).toFixed(1)} KB</p>
          </div>
          {/* 音声プレーヤー */}
          <div className="mt-3">
            <audio
              controls
              className="w-full"
              src={URL.createObjectURL(importedAudioBlob)}
            />
          </div>
        </div>
      )}

      {/* ボタン */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isRecording ? '⏹ 録音停止' : '🎤 録音開始'}
        </button>

        {/* 音声ファイルインポート */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileImport}
            className="hidden"
            id="audio-import"
          />
          <label
            htmlFor="audio-import"
            className="px-6 py-3 rounded-lg font-semibold transition-colors bg-gray-500 hover:bg-gray-600 text-white cursor-pointer inline-block"
          >
            📁 音声ファイルをインポート
          </label>
        </div>

        {importedAudioBlob ? (
          <button
            onClick={analyzeImportedAudio}
            disabled={isAnalyzing}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              !isAnalyzing
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isAnalyzing ? '⏳ 分析中...' : '📊 インポート音声を分析'}
          </button>
        ) : (
          <button
            onClick={startAnalysis}
            disabled={!isRecording || isAnalyzing}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              isRecording && !isAnalyzing
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isAnalyzing ? '⏳ 分析中...' : '📊 要約開始'}
          </button>
        )}

        {/* 案件に保存ボタン（案件選択時のみ、録音停止後に表示） */}
        {project && !isRecording && audioChunksRef.current.length > 0 && !savedRecording && (
          <button
            onClick={() => saveRecordingToProject()}
            disabled={isSaving}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              isSaving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-500 hover:bg-purple-600 text-white'
            }`}
          >
            {isSaving ? '⏳ 保存中...' : '💾 案件に保存'}
          </button>
        )}

        {isRecording && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">録音中...</span>
          </div>
        )}
      </div>

      {/* オーディオレベル表示 */}
      {isRecording && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-600">音声レベル:</span>
            <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  audioLevel > 50
                    ? 'bg-green-500'
                    : audioLevel > 20
                    ? 'bg-yellow-500'
                    : 'bg-gray-400'
                }`}
                style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* リアルタイム文字起こし表示 */}
      {isRecording && isSpeechRecognitionAvailable && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-blue-800">📝 リアルタイム文字起こし</h3>
            {isTranscribing && (
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <div className="text-gray-700 min-h-[60px] max-h-[150px] overflow-y-auto">
            {realtimeTranscript || interimTranscript ? (
              <>
                <span>{realtimeTranscript}</span>
                <span className="text-gray-400 italic">{interimTranscript}</span>
              </>
            ) : (
              <span className="text-gray-400">話し始めると文字起こしが表示されます...</span>
            )}
          </div>
        </div>
      )}

      {/* 使い方 */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">📝 使い方</h3>
        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li>「🎤 録音開始」をクリックして録音を開始</li>
          <li>会議中、任意のタイミングで「📊 要約開始」をクリック</li>
          <li>その時点までの会話内容がチェックリストと突合されます</li>
          <li>右側のチャットパネルに分析結果が表示されます</li>
        </ol>
      </div>
    </div>
  );
}

export default AudioRecorder;
