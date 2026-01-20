/**
 * Gemini API連携モジュール
 * 
 * このモジュールは文字起こしテキストとチェックリストの突合判定を行います。
 * 
 * ⚠️ セキュリティ注意:
 * - 音声データ自体は送信しません（Whisperでローカル処理）
 * - 文字起こしテキストはGemini APIに送信されます
 * - 完全にデータを外部送信しない場合は、Ollama（ローカルLLM）を使用してください
 */

import type { Checklist, AnalysisResult, MatchResult } from '../types';

// Gemini API設定
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-1.5-flash';

/**
 * Gemini APIキーを取得
 */
function getApiKey(): string | null {
  return import.meta.env.VITE_GEMINI_API_KEY || null;
}

/**
 * Gemini APIが利用可能かチェック
 */
export function isGeminiAvailable(): boolean {
  return !!getApiKey();
}

/**
 * Gemini APIを使用してテキストとチェックリストを突合
 */
export async function analyzeWithGemini(
  transcript: string,
  checklist: Checklist
): Promise<AnalysisResult> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn('Gemini API key not configured, using fallback analysis');
    return fallbackAnalysis(transcript, checklist);
  }

  try {
    const prompt = buildAnalysisPrompt(transcript, checklist);
    
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('Empty response from Gemini API');
    }

    return parseGeminiResponse(responseText, checklist);
  } catch (error) {
    console.error('Gemini API error:', error);
    // フォールバックに切り替え
    return fallbackAnalysis(transcript, checklist);
  }
}

/**
 * 分析用プロンプトを構築
 */
function buildAnalysisPrompt(transcript: string, checklist: Checklist): string {
  const checklistItems = checklist.categories.flatMap((cat) =>
    cat.items.map((item, index) => `${index + 1}. [${item.importance}] ${item.question}`)
  );

  return `あなたは商談の分析アシスタントです。
以下の商談の文字起こしを分析し、チェックリストの各項目が話されたかどうかを判定してください。

## チェックリスト
${checklistItems.join('\n')}

## 商談の文字起こし
${transcript}

## 出力形式
以下のJSON形式で回答してください。説明文は不要です。

\`\`\`json
{
  "results": [
    {
      "itemIndex": 0,
      "status": "covered" | "partial" | "missing",
      "matchedText": "関連する発言を引用（任意）",
      "confidence": 0.0-1.0
    }
  ],
  "summary": "全体的な評価（日本語）",
  "recommendations": ["次に確認すべき項目1", "項目2"]
}
\`\`\`
`;
}

/**
 * Gemini APIのレスポンスをパース
 */
function parseGeminiResponse(responseText: string, checklist: Checklist): AnalysisResult {
  // JSON部分を抽出
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : responseText;

  try {
    const parsed = JSON.parse(jsonStr);
    const allItems = checklist.categories.flatMap((cat) => cat.items);

    const results: MatchResult[] = allItems.map((item, index) => {
      const resultItem = parsed.results?.find(
        (r: { itemIndex: number }) => r.itemIndex === index
      );

      return {
        item,
        status: resultItem?.status || 'missing',
        matchedText: resultItem?.matchedText,
        confidence: resultItem?.confidence,
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
      summary: parsed.summary || generateSummary(coveredItems, missingItems, partialItems, allItems.length),
      recommendations: parsed.recommendations || [],
    };
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    return fallbackAnalysis('', checklist);
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
      matchedText: keywordMatches.length > 0
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

  return `📊 **分析結果サマリー**\n\n` +
    `全体で **${total}項目** のチェックリストに対して：\n\n` +
    `✅ 聞けている項目: **${covered}項目**\n` +
    `❌ 聞けていない項目: **${missing}項目**\n` +
    `⚠️ 部分的に確認: **${partial}項目**\n\n` +
    `**カバー率: ${coverageRate}%**\n\n` +
    assessment;
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
