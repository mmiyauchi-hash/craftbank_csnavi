/**
 * エラーハンドリングサービス
 * 
 * アプリケーション全体のエラーを統一的に処理します。
 */

export type ErrorType = 
  | 'MICROPHONE_ACCESS_DENIED'
  | 'MICROPHONE_NOT_FOUND'
  | 'RECORDING_ERROR'
  | 'SPEECH_RECOGNITION_ERROR'
  | 'ANALYSIS_ERROR'
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'UNKNOWN_ERROR';

export interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
  recoverable: boolean;
  action?: string;
}

/**
 * エラーを分類してAppErrorに変換
 */
export function classifyError(error: unknown): AppError {
  if (error instanceof DOMException) {
    return handleDOMException(error);
  }
  
  if (error instanceof TypeError) {
    return {
      type: 'NETWORK_ERROR',
      message: 'ネットワークエラーが発生しました',
      details: error.message,
      recoverable: true,
      action: 'インターネット接続を確認してください',
    };
  }
  
  if (error instanceof Error) {
    // APIエラーの場合
    if (error.message.includes('API')) {
      return {
        type: 'API_ERROR',
        message: 'APIエラーが発生しました',
        details: error.message,
        recoverable: true,
        action: 'しばらく待ってから再試行してください',
      };
    }
    
    return {
      type: 'UNKNOWN_ERROR',
      message: 'エラーが発生しました',
      details: error.message,
      recoverable: true,
    };
  }
  
  return {
    type: 'UNKNOWN_ERROR',
    message: '予期しないエラーが発生しました',
    details: String(error),
    recoverable: false,
  };
}

/**
 * DOMExceptionを処理
 */
function handleDOMException(error: DOMException): AppError {
  switch (error.name) {
    case 'NotAllowedError':
      return {
        type: 'MICROPHONE_ACCESS_DENIED',
        message: 'マイクへのアクセスが拒否されました',
        details: 'ブラウザの設定でマイクのアクセスを許可してください',
        recoverable: true,
        action: 'ブラウザの設定 → プライバシーとセキュリティ → サイトの設定 → マイク',
      };
    
    case 'NotFoundError':
      return {
        type: 'MICROPHONE_NOT_FOUND',
        message: 'マイクが見つかりません',
        details: 'マイクが接続されていることを確認してください',
        recoverable: true,
        action: 'マイクを接続して再度お試しください',
      };
    
    case 'NotReadableError':
      return {
        type: 'RECORDING_ERROR',
        message: 'マイクを使用できません',
        details: '他のアプリケーションがマイクを使用している可能性があります',
        recoverable: true,
        action: '他のアプリケーションを終了してから再度お試しください',
      };
    
    case 'AbortError':
      return {
        type: 'RECORDING_ERROR',
        message: '録音が中断されました',
        recoverable: true,
      };
    
    default:
      return {
        type: 'UNKNOWN_ERROR',
        message: 'エラーが発生しました',
        details: `${error.name}: ${error.message}`,
        recoverable: true,
      };
  }
}

/**
 * 音声認識エラーを処理
 */
export function handleSpeechRecognitionError(errorCode: string): AppError {
  const errorMap: Record<string, AppError> = {
    'no-speech': {
      type: 'SPEECH_RECOGNITION_ERROR',
      message: '音声が検出されませんでした',
      details: 'マイクに向かって話してください',
      recoverable: true,
    },
    'audio-capture': {
      type: 'MICROPHONE_NOT_FOUND',
      message: 'マイクが検出できません',
      details: 'マイクが正しく接続されているか確認してください',
      recoverable: true,
    },
    'not-allowed': {
      type: 'MICROPHONE_ACCESS_DENIED',
      message: 'マイクへのアクセスが拒否されました',
      details: 'ブラウザの設定でマイクへのアクセスを許可してください',
      recoverable: true,
    },
    'network': {
      type: 'NETWORK_ERROR',
      message: 'ネットワークエラーが発生しました',
      details: 'インターネット接続を確認してください',
      recoverable: true,
    },
    'service-not-allowed': {
      type: 'SPEECH_RECOGNITION_ERROR',
      message: '音声認識サービスが利用できません',
      details: 'ブラウザの設定を確認してください',
      recoverable: false,
    },
    'bad-grammar': {
      type: 'SPEECH_RECOGNITION_ERROR',
      message: '音声認識の文法エラー',
      recoverable: true,
    },
    'language-not-supported': {
      type: 'SPEECH_RECOGNITION_ERROR',
      message: '選択された言語はサポートされていません',
      recoverable: false,
    },
  };

  return errorMap[errorCode] || {
    type: 'SPEECH_RECOGNITION_ERROR',
    message: '音声認識エラーが発生しました',
    details: errorCode,
    recoverable: true,
  };
}

/**
 * ユーザーにわかりやすいエラーメッセージを生成
 */
export function formatErrorMessage(error: AppError): string {
  let message = `❌ ${error.message}`;
  
  if (error.details) {
    message += `\n\n📝 詳細: ${error.details}`;
  }
  
  if (error.action) {
    message += `\n\n💡 対処法: ${error.action}`;
  }
  
  if (!error.recoverable) {
    message += '\n\n⚠️ このエラーは自動復旧できません。ページを再読み込みしてください。';
  }
  
  return message;
}

/**
 * コンソールにエラーをログ出力
 */
export function logError(error: AppError, context?: string): void {
  console.group(`🔴 Error: ${error.type}`);
  console.error('Message:', error.message);
  if (error.details) console.error('Details:', error.details);
  if (context) console.error('Context:', context);
  console.groupEnd();
}
