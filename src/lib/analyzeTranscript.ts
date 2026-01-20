/**
 * 音声分析・チェックリスト突合モジュール
 * 
 * アーキテクチャ（docs/ARCHITECTURE.md参照）:
 * 1. 音声データ → Whisper（ローカル）→ 文字起こしテキスト
 * 2. 文字起こしテキスト + チェックリスト → Gemini API → 分析結果
 * 
 * ⚠️ セキュリティ要件:
 * - 音声データ（audioBlob）はクラウドに送信しない（セキュリティ要件）
 * - 文字起こしテキストはGemini APIに送信される（分析のため）
 * - 完全にデータを外部に送信しない場合は、Ollama（ローカルLLM）を使用
 * 
 * 📄 詳細: docs/STT_API_SECURITY.md を参照
 */

import type { Checklist, AnalysisResult, MatchResult } from '../types';
import { analyzeWithGemini, isGeminiAvailable } from './geminiApi';
import { transcribeAudio, RealtimeSpeechRecognizer } from './speechToText';

/**
 * 音声データを文字起こし・分析する
 * 
 * @param audioBlob - 音声データ（WebM/MP3）
 * @param checklist - チェックリスト
 * @param realtimeTranscript - リアルタイム文字起こしのテキスト（あれば）
 */
export async function analyzeAudioWithGemini(
  audioBlob: Blob,
  checklist: Checklist,
  realtimeTranscript?: string
): Promise<AnalysisResult> {
  console.log('音声データを分析中...', audioBlob.size, 'bytes');

  // Step 1: 文字起こし
  // リアルタイム文字起こしがあればそれを使用、なければ音声ファイルを処理
  let transcript: string;
  
  if (realtimeTranscript && realtimeTranscript.trim().length > 0) {
    transcript = realtimeTranscript;
    console.log('リアルタイム文字起こしを使用:', transcript.length, '文字');
  } else {
    transcript = await transcribeAudio(audioBlob);
    console.log('音声ファイルから文字起こし:', transcript.length, '文字');
  }

  // Step 2: チェックリストとの突合分析
  if (isGeminiAvailable()) {
    console.log('Gemini APIで分析中...');
    return analyzeWithGemini(transcript, checklist);
  } else {
    console.log('フォールバック分析を使用...');
    return fallbackAnalysis(transcript, checklist);
  }
}

/**
 * テキストデータとチェックリストを突合する
 */
export async function matchTranscriptWithChecklist(
  transcript: string,
  checklist: Checklist
): Promise<AnalysisResult> {
  console.log('テキストとチェックリストを突合中...');

  if (isGeminiAvailable()) {
    return analyzeWithGemini(transcript, checklist);
  } else {
    return fallbackAnalysis(transcript, checklist);
  }
}

/**
 * フォールバック分析（キーワードベース）
 */
function fallbackAnalysis(transcript: string, checklist: Checklist): AnalysisResult {
  const allItems = checklist.categories.flatMap((cat) => cat.items);
  const transcriptLower = transcript.toLowerCase();

  const results: MatchResult[] = allItems.map((item) => {
    // キーワードマッチング
    const keywordMatches = item.keywords.filter((keyword) =>
      transcriptLower.includes(keyword.toLowerCase())
    );

    const matchRatio = keywordMatches.length / Math.max(item.keywords.length, 1);

    let status: 'covered' | 'partial' | 'missing';
    if (matchRatio >= 0.5) {
      status = 'covered';
    } else if (matchRatio > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }

    return {
      item,
      status,
      matchedText:
        keywordMatches.length > 0
          ? `キーワード「${keywordMatches.join(', ')}」を検出`
          : undefined,
      confidence: matchRatio,
    };
  });

  const coveredItems = results.filter((r) => r.status === 'covered').length;
  const missingItems = results.filter((r) => r.status === 'missing').length;
  const partialItems = results.filter((r) => r.status === 'partial').length;

  return {
    totalItems: allItems.length,
    coveredItems,
    missingItems,
    partialItems,
    coverageRate: Math.round((coveredItems / allItems.length) * 100),
    results,
    summary: generateSummary(coveredItems, missingItems, partialItems, allItems.length),
    recommendations: generateRecommendations(results),
  };
}

/**
 * サマリーを生成
 */
function generateSummary(
  covered: number,
  missing: number,
  partial: number,
  total: number
): string {
  const coverageRate = Math.round((covered / total) * 100);

  let assessment = '';
  if (coverageRate >= 80) {
    assessment = '✅ 良好なヒアリングができています！';
  } else if (coverageRate >= 60) {
    assessment = '⚠️ いくつかの重要項目が聞けていません。';
  } else {
    assessment = '❌ 多くの重要項目が聞けていません。確認が必要です。';
  }

  return (
    `📊 **分析結果サマリー**\n\n` +
    `全体で **${total}項目** のチェックリストに対して：\n\n` +
    `✅ 聞けている項目: **${covered}項目**\n` +
    `❌ 聞けていない項目: **${missing}項目**\n` +
    `⚠️ 部分的に確認: **${partial}項目**\n\n` +
    `**カバー率: ${coverageRate}%**\n\n` +
    assessment
  );
}

/**
 * 推奨事項を生成
 */
function generateRecommendations(results: MatchResult[]): string[] {
  const recommendations: string[] = [];

  // 重要度が高くて聞けていない項目
  const highPriorityMissing = results.filter(
    (r) => r.status === 'missing' && r.item.importance === 'high'
  );

  highPriorityMissing.forEach((r) => {
    recommendations.push(`🔴 【重要】${r.item.question}`);
  });

  // 中程度の重要度で聞けていない項目
  const mediumPriorityMissing = results.filter(
    (r) => r.status === 'missing' && r.item.importance === 'medium'
  );

  mediumPriorityMissing.slice(0, 3).forEach((r) => {
    recommendations.push(`🟡 ${r.item.question}`);
  });

  return recommendations;
}

// Re-export for convenience
export { RealtimeSpeechRecognizer, isGeminiAvailable };
