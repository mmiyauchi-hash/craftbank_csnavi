/**
 * 文字起こし（Speech-to-Text）モジュール
 * 
 * アーキテクチャ:
 * 1. ブラウザのWeb Speech API（デモ/フォールバック用）
 * 2. 将来的にはWhisper（ローカル実行）を追加予定
 * 
 * ⚠️ セキュリティ:
 * - Web Speech APIはブラウザによってはGoogleサーバーに音声を送信する場合があります
 * - 本番環境ではWhisper（ローカル実行）を推奨
 */

// Web Speech API型定義
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

// グローバル型定義
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/**
 * リアルタイム音声認識クラス
 */
export class RealtimeSpeechRecognizer {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private transcript = '';
  private onTranscriptUpdate: ((text: string, isFinal: boolean) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  constructor() {
    this.initializeRecognition();
  }

  /**
   * Web Speech APIが利用可能かチェック
   */
  static isAvailable(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * 音声認識を初期化
   */
  private initializeRecognition(): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'ja-JP';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        this.transcript += finalTranscript;
        this.onTranscriptUpdate?.(this.transcript, true);
      } else if (interimTranscript) {
        this.onTranscriptUpdate?.(this.transcript + interimTranscript, false);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      this.onError?.(event.error);
      
      // 一部のエラーでは自動再起動
      if (event.error === 'network' || event.error === 'no-speech') {
        this.restart();
      }
    };

    this.recognition.onend = () => {
      // 継続的に認識する場合は再起動
      if (this.isListening) {
        this.recognition?.start();
      }
    };
  }

  /**
   * 音声認識を開始
   */
  start(
    onTranscriptUpdate: (text: string, isFinal: boolean) => void,
    onError?: (error: string) => void
  ): void {
    if (!this.recognition) {
      onError?.('Web Speech API is not available');
      return;
    }

    this.transcript = '';
    this.onTranscriptUpdate = onTranscriptUpdate;
    this.onError = onError || null;
    this.isListening = true;

    try {
      this.recognition.start();
    } catch (error) {
      // すでに開始している場合
      console.warn('Recognition already started');
    }
  }

  /**
   * 音声認識を停止
   */
  stop(): string {
    this.isListening = false;
    this.recognition?.stop();
    return this.transcript;
  }

  /**
   * 音声認識を再起動
   */
  private restart(): void {
    if (this.isListening && this.recognition) {
      try {
        this.recognition.start();
      } catch (error) {
        console.warn('Failed to restart recognition:', error);
      }
    }
  }

  /**
   * 現在の文字起こしテキストを取得
   */
  getTranscript(): string {
    return this.transcript;
  }

  /**
   * 文字起こしテキストをクリア
   */
  clearTranscript(): void {
    this.transcript = '';
  }
}

/**
 * 音声データをテキストに変換（非リアルタイム）
 * 
 * TODO: Whisper連携を実装
 * 現在はデモ用のスタブ実装
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  console.log('音声データを文字起こし中...', audioBlob.size, 'bytes');
  
  // デモ用: 実際にはWhisperを使用
  // 現在はWeb Speech APIはリアルタイムのみ対応のため、
  // 録音済みデータの文字起こしは別途Whisper連携が必要
  
  // シミュレーション用の遅延
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  // デモ用のダミーテキスト
  return `
【デモモード】
この文字起こしはデモ用のサンプルテキストです。

実際の環境では：
1. Web Speech API（リアルタイム認識）を使用するか
2. Whisper（ローカル実行）で音声ファイルを処理します

現在、${(audioBlob.size / 1024).toFixed(1)}KBの音声データが処理されました。
  `.trim();
}

/**
 * リアルタイム文字起こしのステータス
 */
export interface TranscriptionStatus {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
}

/**
 * 音声認識のシングルトンインスタンスを取得
 */
let recognizerInstance: RealtimeSpeechRecognizer | null = null;

export function getRecognizer(): RealtimeSpeechRecognizer {
  if (!recognizerInstance) {
    recognizerInstance = new RealtimeSpeechRecognizer();
  }
  return recognizerInstance;
}
