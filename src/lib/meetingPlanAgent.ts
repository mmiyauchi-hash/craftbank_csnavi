import type {
  MeetingVariables,
  CustomizedMeetingPlan,
  CustomizedChecklistItem,
  ProposalStrategy,
  ConversationFlowStep,
  ProposalFeature,
  ConstructionType,
} from '../types/meeting';

/**
 * 変数に基づいてカスタマイズされた商談プランを生成するエージェント
 * 
 * TODO: 将来的にはGemini APIを使用して動的に生成
 * 現在はルールベースで生成
 */
export async function generateMeetingPlan(
  variables: MeetingVariables
): Promise<CustomizedMeetingPlan> {
  // シミュレーション用の遅延
  await new Promise(resolve => setTimeout(resolve, 1500));

  const checklistItems = generateChecklist(variables);
  const proposalStrategy = generateProposalStrategy(variables);
  const conversationFlow = generateConversationFlow(variables);

  return {
    generatedAt: new Date(),
    variables,
    checklistItems,
    proposalStrategy,
    conversationFlow,
  };
}

/**
 * チェックリストを生成
 */
function generateChecklist(variables: MeetingVariables): CustomizedChecklistItem[] {
  const items: CustomizedChecklistItem[] = [];
  let idCounter = 1;

  // 基本情報（共通）
  items.push({
    id: `custom_${idCounter++}`,
    question: '現在の従業員数と組織構成は？',
    importance: 'high',
    category: '基本情報',
    reason: '適切なライセンス数と導入規模を把握するため',
    followUpQuestions: ['現場に出る人と事務所にいる人の比率は？', '今後の採用予定は？'],
  });

  items.push({
    id: `custom_${idCounter++}`,
    question: '年間の売上規模と案件数は？',
    importance: 'high',
    category: '基本情報',
    reason: '事業規模を把握し、最適なプランを提案するため',
    followUpQuestions: ['1案件あたりの平均単価は？', '繁忙期はいつ頃？'],
  });

  // 工種に基づく質問
  if (variables.constructionTypes.length > 0) {
    items.push({
      id: `custom_${idCounter++}`,
      question: `${getConstructionTypeText(variables.constructionTypes)}の案件が多いとのことですが、案件の種類や特徴を教えてください`,
      importance: 'high',
      category: '事業特性',
      reason: '工種に合わせた機能提案を行うため',
    });
  }

  // 元請け/下請けに基づく質問
  if (variables.contractorType === 'prime_only' || variables.contractorType === 'prime_heavy') {
    items.push({
      id: `custom_${idCounter++}`,
      question: '元請けとして、見積書や請求書のフォーマットに決まりはありますか？',
      importance: 'high',
      category: '業務フロー',
      reason: '元請け企業は独自のフォーマットを持つことが多いため',
      followUpQuestions: ['発注者への報告書類は何がありますか？'],
    });

    items.push({
      id: `custom_${idCounter++}`,
      question: '協力会社（下請け）への発注・支払い管理はどうされていますか？',
      importance: 'high',
      category: '業務フロー',
      reason: '元請けの重要な管理業務であるため',
    });
  }

  if (variables.contractorType === 'sub_only' || variables.contractorType === 'sub_heavy') {
    items.push({
      id: `custom_${idCounter++}`,
      question: '元請けからの発注書・請求フォーマットは統一されていますか？',
      importance: 'high',
      category: '業務フロー',
      reason: '下請けは元請けのフォーマットに合わせる必要があるため',
    });
  }

  // 外注状況に基づく質問
  if (variables.outsourcingLevel === 'moderate' || variables.outsourcingLevel === 'many') {
    items.push({
      id: `custom_${idCounter++}`,
      question: '協力会社の管理（発注・請求・支払い）で困っていることは？',
      importance: 'high',
      category: '課題・ニーズ',
      reason: '協力会社が多い場合、管理が複雑になるため',
      followUpQuestions: ['協力会社への支払いサイトは？', '単価表の管理方法は？'],
    });
  }

  // 現在のシステム状況に基づく質問
  if (variables.currentSystem === 'paper') {
    items.push({
      id: `custom_${idCounter++}`,
      question: '紙での管理で特に大変なことは何ですか？',
      importance: 'high',
      category: '課題・ニーズ',
      reason: 'デジタル化のメリットを具体的に訴求するため',
      followUpQuestions: ['過去のデータを探すのに困ることは？'],
    });
  } else if (variables.currentSystem === 'excel') {
    items.push({
      id: `custom_${idCounter++}`,
      question: 'Excelでの管理で限界を感じていることは？',
      importance: 'high',
      category: '課題・ニーズ',
      reason: 'Excelからの移行メリットを訴求するため',
      followUpQuestions: ['複数人での同時編集で困ったことは？', 'ファイルの管理方法は？'],
    });
  } else if (variables.currentSystem === 'other_system') {
    items.push({
      id: `custom_${idCounter++}`,
      question: '現在使用しているシステムに不満な点は？',
      importance: 'high',
      category: '課題・ニーズ',
      reason: '競合システムとの差別化ポイントを探るため',
      followUpQuestions: ['乗り換えを検討している理由は？', 'どの機能が物足りない？'],
    });
  }

  // IT習熟度に基づく質問
  if (variables.itLiteracy === 'low') {
    items.push({
      id: `custom_${idCounter++}`,
      question: 'PCやスマホを使い慣れていない方はどのくらいいますか？',
      importance: 'medium',
      category: '導入準備',
      reason: 'サポート体制と導入研修の必要性を把握するため',
      followUpQuestions: ['操作研修の時間は取れそうですか？'],
    });
  }

  // 痛みポイントに基づく質問
  variables.painPoints.forEach(painPoint => {
    const painPointQuestions = getPainPointQuestions(painPoint);
    items.push(...painPointQuestions.map((q) => ({
      ...q,
      id: `custom_${idCounter++}`,
    })));
  });

  // 緊急度に基づく質問
  if (variables.urgency === 'immediate') {
    items.push({
      id: `custom_${idCounter++}`,
      question: 'すぐに導入したい背景は何ですか？',
      importance: 'high',
      category: '導入予定',
      reason: '緊急度が高い理由を把握し、スケジュールを調整するため',
    });
  }

  // クロージングに向けた質問（共通）
  items.push({
    id: `custom_${idCounter++}`,
    question: '導入の決裁者・決定権者は誰ですか？',
    importance: 'high',
    category: '決裁プロセス',
    reason: '意思決定プロセスを把握するため',
    followUpQuestions: ['社長（決裁者）の関心事は？', '稟議は必要？'],
  });

  items.push({
    id: `custom_${idCounter++}`,
    question: 'ご予算感はありますか？',
    importance: 'high',
    category: '予算',
    reason: '適切なプランを提案するため',
  });

  items.push({
    id: `custom_${idCounter++}`,
    question: '導入希望時期はいつ頃ですか？',
    importance: 'high',
    category: '導入予定',
    reason: 'スケジュールを調整するため',
    followUpQuestions: ['決算期はいつ？'],
  });

  items.push({
    id: `custom_${idCounter++}`,
    question: '他社製品は検討されていますか？',
    importance: 'medium',
    category: '競合状況',
    reason: '差別化ポイントを訴求するため',
    followUpQuestions: ['どの会社の製品？', '比較して気になる点は？'],
  });

  items.push({
    id: `custom_${idCounter++}`,
    question: '次回のステップとして、どのような形が良いですか？',
    importance: 'high',
    category: 'ネクストアクション',
    reason: '商談を前に進めるため',
    followUpQuestions: ['トライアルに興味は？', '他の担当者への説明は必要？'],
  });

  return items;
}

/**
 * 提案戦略を生成
 */
function generateProposalStrategy(variables: MeetingVariables): ProposalStrategy {
  const keyFeatures: ProposalFeature[] = [];

  // 痛みポイントに基づく機能提案
  if (variables.painPoints.includes('estimation')) {
    keyFeatures.push({
      featureName: '見積作成機能',
      relevanceScore: 9,
      pitch: '過去の見積をテンプレート化し、作成時間を1/3に短縮',
      useCase: '類似案件の見積を流用して、すぐに提出可能',
    });
  }

  if (variables.painPoints.includes('cost_management')) {
    keyFeatures.push({
      featureName: '原価管理機能',
      relevanceScore: 9,
      pitch: 'リアルタイムで原価を把握し、赤字を未然に防止',
      useCase: '現場ごとの収支が一目でわかるダッシュボード',
    });
  }

  if (variables.painPoints.includes('invoicing')) {
    keyFeatures.push({
      featureName: '請求・入金管理機能',
      relevanceScore: 8,
      pitch: '請求漏れをなくし、キャッシュフローを改善',
      useCase: '請求予定一覧から、未請求の案件をすぐに発見',
    });
  }

  if (variables.painPoints.includes('attendance')) {
    keyFeatures.push({
      featureName: '勤怠管理機能',
      relevanceScore: 8,
      pitch: 'スマホで現場から打刻、集計も自動化',
      useCase: '現場に出ている職人さんも、スマホでワンタップ打刻',
    });
  }

  if (variables.painPoints.includes('subcontractor')) {
    keyFeatures.push({
      featureName: '協力会社管理機能',
      relevanceScore: 9,
      pitch: '発注・請求・支払いを一元管理',
      useCase: '協力会社ごとの発注残・支払い予定が一目でわかる',
    });
  }

  // 事業特性に基づく機能提案
  if (variables.outsourcingLevel === 'many' || variables.outsourcingLevel === 'moderate') {
    keyFeatures.push({
      featureName: '単価マスタ機能',
      relevanceScore: 7,
      pitch: '協力会社ごとの単価を管理し、見積作成を効率化',
      useCase: '過去の取引実績から、適正単価を自動提案',
    });
  }

  if (variables.contractorType === 'prime_only' || variables.contractorType === 'prime_heavy') {
    keyFeatures.push({
      featureName: '工程管理機能',
      relevanceScore: 8,
      pitch: '複数の協力会社のスケジュールを一元管理',
      useCase: 'ガントチャートで全体の進捗を把握',
    });
  }

  // IT習熟度に基づく差別化ポイント
  const differentiators: string[] = [];
  
  if (variables.itLiteracy === 'low') {
    differentiators.push('シンプルで直感的な操作性（PC苦手な方でも安心）');
    differentiators.push('充実したサポート体制（電話・チャット対応）');
    differentiators.push('導入時の操作研修を無料で実施');
  } else {
    differentiators.push('建設業に特化した豊富な機能');
    differentiators.push('他システムとのAPI連携が可能');
  }

  differentiators.push('建設業界10年以上の実績');
  differentiators.push('導入企業数1,000社以上');

  // 想定される懸念と対処法
  const potentialObjections = [
    {
      objection: '導入に時間がかかるのでは？',
      response: '最短2週間で導入可能です。既存データの移行もサポートします。',
    },
    {
      objection: '現場の職人が使いこなせるか心配',
      response: 'スマホアプリは極力シンプルに設計しています。導入研修も実施します。',
    },
  ];

  if (variables.currentSystem === 'other_system') {
    potentialObjections.push({
      objection: '今のシステムからの乗り換えが面倒',
      response: 'データ移行ツールをご用意しています。移行サポートも無料です。',
    });
  }

  if (variables.employeeScale === 'micro' || variables.employeeScale === 'small') {
    potentialObjections.push({
      objection: '小規模だとコストに見合わないのでは？',
      response: '小規模向けのライトプランがあります。必要な機能だけ選べます。',
    });
  }

  // クロージングの方針
  let closingApproach = '';
  if (variables.urgency === 'immediate') {
    closingApproach = '今すぐのご導入をご検討いただいているとのことで、来週中にトライアル環境をご用意します。';
  } else if (variables.urgency === 'within_quarter') {
    closingApproach = '3ヶ月以内の導入をご希望とのことで、まずは2週間のトライアルをお勧めします。';
  } else {
    closingApproach = '情報収集段階とのことで、まずはデモ動画とパンフレットをお送りします。ご不明点があればいつでもお問い合わせください。';
  }

  return {
    keyFeatures: keyFeatures.sort((a, b) => b.relevanceScore - a.relevanceScore),
    differentiators,
    potentialObjections,
    closingApproach,
  };
}

/**
 * 話の組み立てを生成
 */
function generateConversationFlow(variables: MeetingVariables): ConversationFlowStep[] {
  return [
    {
      phase: 'opening',
      phaseName: 'オープニング',
      duration: '5分',
      objectives: [
        'アイスブレイクで場を和ませる',
        '本日の流れを説明する',
        '顧客の期待値を確認する',
      ],
      keyPoints: [
        '自己紹介は簡潔に',
        '相手の時間を確認（「今日は○○分くらいでよろしいですか？」）',
        '本日のゴールを共有（「今日は御社の状況をお聞きし、最適なプランをご提案できればと思います」）',
      ],
      transitionPhrase: 'では早速ですが、現在の業務状況についてお聞かせください',
    },
    {
      phase: 'discovery',
      phaseName: 'ヒアリング（課題発見）',
      duration: '20分',
      objectives: [
        '現状の業務フローを把握する',
        '課題・痛みポイントを深堀りする',
        '導入の意思決定要因を探る',
      ],
      keyPoints: [
        `工種（${getConstructionTypeText(variables.constructionTypes)}）に関連する質問を中心に`,
        '「なぜ？」「具体的には？」で深堀り',
        '課題を言語化して確認（「つまり○○でお困りなんですね」）',
        variables.currentSystem === 'other_system' 
          ? '現システムの不満点を詳しく聞く' 
          : '現在の運用の手間を具体的に聞く',
      ],
      transitionPhrase: 'ありがとうございます。お話を伺って、いくつかご提案できそうな機能がありますのでご紹介させてください',
    },
    {
      phase: 'presentation',
      phaseName: 'プレゼン（提案）',
      duration: '15分',
      objectives: [
        '課題に対する解決策を提示する',
        'CBOの強みを訴求する',
        '導入イメージを具体化する',
      ],
      keyPoints: [
        '聞いた課題に対して「だから○○機能が有効です」と紐付ける',
        variables.painPoints.length > 0 
          ? `特に${variables.painPoints.slice(0, 2).join('、')}に関する機能を重点的に説明` 
          : '基本機能をバランスよく説明',
        'デモは実際の画面を見せながら',
        '「御社の場合だと、こういう使い方ができます」と具体例を出す',
      ],
      transitionPhrase: 'ここまでで何かご質問はありますか？',
    },
    {
      phase: 'handling',
      phaseName: '質疑応答（懸念払拭）',
      duration: '10分',
      objectives: [
        '疑問点・懸念点を解消する',
        '意思決定の障壁を取り除く',
      ],
      keyPoints: [
        '質問には即答、分からないことは「確認してご連絡します」',
        variables.itLiteracy === 'low' 
          ? '「操作が簡単」「サポート体制」を強調' 
          : '「カスタマイズ性」「API連携」を強調',
        '価格の質問には「詳細はお見積りしますが、○○円〜です」',
      ],
      transitionPhrase: '他にご不明点がなければ、今後の進め方についてお話しさせてください',
    },
    {
      phase: 'closing',
      phaseName: 'クロージング',
      duration: '10分',
      objectives: [
        '次のアクションを明確にする',
        'スケジュールを確定する',
      ],
      keyPoints: [
        variables.urgency === 'immediate' || variables.urgency === 'within_quarter'
          ? 'トライアルを提案（「まずは2週間、無料でお試しいただけます」）'
          : '資料送付と次回打ち合わせの設定',
        '決裁者への説明が必要か確認',
        '次回の日程を仮押さえ',
        'お礼とフォローアップの予告',
      ],
    },
  ];
}

// ヘルパー関数
function getConstructionTypeText(types: ConstructionType[]): string {
  const labels: Record<ConstructionType, string> = {
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
  
  if (types.length === 0) return '建設業';
  return types.map(t => labels[t]).join('・');
}

function getPainPointQuestions(painPoint: string): Omit<CustomizedChecklistItem, 'id'>[] {
  const questions: Record<string, Omit<CustomizedChecklistItem, 'id'>[]> = {
    estimation: [
      {
        question: '見積書の作成にどのくらい時間がかかっていますか？',
        importance: 'high',
        category: '見積作成',
        reason: '改善効果を数値化するため',
        followUpQuestions: ['見積の修正頻度は？', '過去の見積の流用はしていますか？'],
      },
    ],
    invoicing: [
      {
        question: '請求漏れや入金遅延で困ったことはありますか？',
        importance: 'high',
        category: '請求管理',
        reason: '課題の深刻度を把握するため',
      },
    ],
    cost_management: [
      {
        question: '案件ごとの粗利はリアルタイムで把握できていますか？',
        importance: 'high',
        category: '原価管理',
        reason: '原価管理の現状を把握するため',
        followUpQuestions: ['赤字案件はどのくらいの頻度で発生？', '原価超過に気づくタイミングは？'],
      },
    ],
    attendance: [
      {
        question: '勤怠管理はどのようにされていますか？',
        importance: 'high',
        category: '勤怠管理',
        reason: '現状の運用を把握するため',
        followUpQuestions: ['現場からの報告方法は？', '集計作業にかかる時間は？'],
      },
    ],
    schedule: [
      {
        question: '工程管理はどのようにされていますか？',
        importance: 'high',
        category: '工程管理',
        reason: '現状の運用を把握するため',
        followUpQuestions: ['遅延が発生した時の対応は？', '協力会社とのスケジュール共有方法は？'],
      },
    ],
    document: [
      {
        question: '書類作成で一番手間がかかっているのは？',
        importance: 'medium',
        category: '書類管理',
        reason: '自動化できる業務を特定するため',
      },
    ],
    communication: [
      {
        question: '社内での情報共有はどうされていますか？',
        importance: 'medium',
        category: 'コミュニケーション',
        reason: '現状の共有方法を把握するため',
        followUpQuestions: ['伝達漏れで困ったことは？'],
      },
    ],
    subcontractor: [
      {
        question: '協力会社への発注・支払い管理で困っていることは？',
        importance: 'high',
        category: '協力会社管理',
        reason: '管理の複雑さを把握するため',
        followUpQuestions: ['単価の管理方法は？', '支払い条件の確認方法は？'],
      },
    ],
  };

  return questions[painPoint] || [];
}
