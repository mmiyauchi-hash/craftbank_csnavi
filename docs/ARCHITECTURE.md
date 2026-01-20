# システムアーキテクチャ

## 1. システム構成図

```mermaid
graph TB
    subgraph "クライアント（ブラウザ）"
        A[React App<br/>Vite + TypeScript]
        B[AudioRecorder<br/>音声録音・インポート]
        C[ChatPanel<br/>分析結果表示]
        D[MeetingPrepPage<br/>商談準備画面]
        E[AdminPage<br/>チェックリスト管理]
        P[ProjectsPage / ProjectDetailPage<br/>案件一覧・詳細]
    end

    subgraph "ブラウザ内"
        F[Web Speech API<br/>リアルタイム文字起こし<br/>※一部ブラウザでクラウド送信の可能性]
        F2[transcribeAudio<br/>録音Blob用スタブ<br/>Whisperは将来実装予定]
    end

    subgraph "データ保持"
        G[メモリ（Blob）<br/>録音中の音声チャンク<br/>※案件保存時はIndexedDBへ]
    end

    subgraph "外部API（オプション）"
        H[Gemini API<br/>テキスト分析・突合判定]
    end

    subgraph "データストア（ブラウザ内）"
        I[チェックリスト<br/>JSON / Project別]
        J[商談プラン・案件<br/>IndexedDB]
        K[分析結果・録音<br/>IndexedDB]
    end

    A --> B
    A --> C
    A --> D
    A --> E
    A --> P

    B -->|音声チャンク<br/>WebM| G
    B -->|リアルタイム音声| F
    G -->|録音Blob<br/>（realtimeなし時）| F2
    F -->|文字起こしテキスト| H
    F2 -->|文字起こしテキスト| H
    H -->|分析結果| C

    D -->|生成| J
    E -->|管理| I
    P -->|案件CRUD| J
    J -->|適用| I
    I -->|突合判定| H
    H -->|保存| K

    style F fill:#FFE4B5
    style F2 fill:#90EE90
    style G fill:#FFE4B5
    style H fill:#FFB6C1
    style I fill:#E0E0E0
    style J fill:#E0E0E0
    style K fill:#E0E0E0
    style P fill:#E6F3FF
```

**凡例**:
- 🟢 緑: ローカル実行（スタブ／将来Whisper。データが外部に送信されない）
- 🟡 黄: 一時データ／注意（Web Speech APIは一部ブラウザでクラウド送信の可能性あり）
- 🔴 ピンク: 外部API（データ送信あり）

---

## 2. 音声録音→分析のシーケンス図

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Browser as ブラウザ<br/>（React App）
    participant MediaRecorder as MediaRecorder API
    participant Memory as メモリ<br/>（Blob配列）
    participant WebSpeech as Web Speech API<br/>（リアルタイム）
    participant Stub as transcribeAudio<br/>（スタブ／将来Whisper）
    participant Gemini as Gemini API<br/>（分析）
    participant ChatPanel as チャットパネル
    participant IndexedDB as IndexedDB

    User->>Browser: 1. 録音開始ボタンをクリック
    Browser->>MediaRecorder: 2. getUserMedia()でマイクアクセス
    MediaRecorder-->>Browser: 3. MediaStreamを取得
    Browser->>MediaRecorder: 4. MediaRecorder.start()
    Browser->>WebSpeech: 4b. リアルタイム文字起こし開始

    loop 録音中
        MediaRecorder->>Browser: 5. 音声データチャンク（1秒ごと）
        Browser->>Memory: 6. 音声チャンクをBlob配列に蓄積
        Browser->>Browser: 7. オーディオレベル表示
        WebSpeech-->>Browser: 7b. リアルタイム文字起こしテキスト
    end

    User->>Browser: 8. 要約開始ボタンをクリック
    Browser->>Browser: 9. 蓄積された音声チャンクを結合してBlob化

    alt リアルタイム文字起こしあり
        Browser->>Browser: 10a. リアルタイム文字起こしを採用
    else リアルタイム文字起こしなし（インポート音声等）
        Browser->>Stub: 10b. 録音Blobを渡す
        Note over Stub: 現状はデモ用スタブ（ダミー返却）<br/>将来: Whisperでローカル処理
        Stub-->>Browser: 10c. 文字起こしテキスト（スタブ時はダミー）
    end

    Browser->>Gemini: 11. 文字起こしテキスト + チェックリストを送信
    Note over Gemini: テキストデータが外部に送信される
    Gemini->>Gemini: 12. 突合判定・分析処理
    Gemini-->>Browser: 13. 分析結果（聞き漏らしリスト等）

    Browser->>ChatPanel: 14. 分析結果を表示
    opt 案件に保存する場合
        Browser->>IndexedDB: 15. 録音・分析結果を永続化
    end
    ChatPanel-->>User: 16. チャット形式で結果表示

    Note over Browser,Memory: 音声データはメモリ内（Blob）
    Note over WebSpeech: 一部ブラウザではクラウド送信の可能性あり
    Note over Stub: ローカル処理（Whisper実装時もローカル）
    Note over Gemini: クラウドAPI（データ送信あり）
```

---

## 3. 商談準備フローのシーケンス図

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant PrepPage as 商談準備画面
    participant Agent as プラン生成エージェント<br/>（meetingPlanAgent）
    participant Store as Zustand Store
    participant Checklist as チェックリスト

    User->>PrepPage: 1. 事前情報を入力<br/>（工種、従業員規模、売上等）
    PrepPage->>PrepPage: 2. 変数を収集<br/>（MeetingVariables）
    
    User->>PrepPage: 3. 「商談プランを生成」ボタンをクリック
    PrepPage->>Agent: 4. generateMeetingPlan(variables)
    
    Agent->>Agent: 5. チェックリスト生成<br/>（変数に基づくカスタマイズ）
    Agent->>Agent: 6. 提案戦略生成<br/>（刺さりそうな機能、差別化ポイント）
    Agent->>Agent: 7. 話の組み立て生成<br/>（5フェーズのフロー）
    
    Agent-->>PrepPage: 8. CustomizedMeetingPlanを返却
    
    PrepPage->>PrepPage: 9. タブ切り替え<br/>（チェックリスト/提案戦略/話の組み立て）
    PrepPage-->>User: 10. 生成されたプランを表示
    
    User->>PrepPage: 11. 「このチェックリストを適用」ボタンをクリック
    PrepPage->>Store: 12. setChecklist(customChecklist)
    Store->>Checklist: 13. チェックリストを更新
    PrepPage->>PrepPage: 14. 録音画面に遷移
    
    Note over Agent: 現在はルールベース<br/>将来的にGemini APIで動的生成
```

---

## 4. データフロー図

```mermaid
flowchart LR
    subgraph "入力データ"
        A1[音声データ<br/>WebM / インポート]
        A2[事前情報<br/>工種・規模等]
        A3[チェックリスト<br/>JSON / Project]
    end

    subgraph "処理"
        B1[Web Speech API / スタブ<br/>文字起こし]
        B2[meetingPlanAgent<br/>プラン生成]
        B3[Gemini API<br/>突合判定]
        B4[database<br/>IndexedDB]
    end

    subgraph "出力データ"
        C1[文字起こし<br/>テキスト]
        C2[カスタマイズ<br/>チェックリスト・案件]
        C3[分析結果<br/>聞き漏らしリスト]
        C4[提案戦略<br/>話の組み立て]
        C5[案件・録音・分析<br/>IndexedDB永続化]
    end

    A1 -->|リアルタイム / Blob| B1
    B1 -->|テキスト| C1

    A2 -->|変数| B2
    B2 -->|生成| C2
    B2 -->|生成| C4

    A3 -->|突合対象| B3
    C1 -->|入力| B3
    B3 -->|判定| C3

    C2 -->|保存| B4
    A1 -->|案件保存時| B4
    C3 -->|保存| B4
    B4 -->|永続化| C5

    style B1 fill:#FFE4B5
    style B2 fill:#87CEEB
    style B3 fill:#FFB6C1
    style B4 fill:#90EE90
```

---

## 5. セキュリティ境界図

```mermaid
graph TB
    subgraph "ブラウザ内"
        subgraph "クライアント"
            A[React App]
        end

        subgraph "ローカル保持"
            B[メモリ（Blob）<br/>音声チャンク]
            C[IndexedDB<br/>案件・録音・分析]
            D[チェックリスト<br/>JSON / Project]
        end

        subgraph "注意（クラウド送信の可能性）"
            F[Web Speech API<br/>リアルタイム文字起こし]
        end
    end

    subgraph "外部API"
        E[Gemini API<br/>テキスト分析]
    end

    A -->|音声データ<br/>送信なし| B
    A -->|永続化| C
    A -->|リアルタイム音声| F
    F -->|文字起こしテキスト<br/>※一部ブラウザで外部送信の可能性| A
    A -->|文字起こしテキスト<br/>⚠️ 外部送信| E
    E -->|分析結果| A
    D -->|突合判定| E

    style A fill:#E6F3FF
    style B fill:#90EE90
    style C fill:#90EE90
    style D fill:#E0E0E0
    style F fill:#FFE4B5
    style E fill:#FFB6C1
```

**セキュリティ境界**:
- 🟢 **ブラウザ内**: 音声データ（Blob）、IndexedDBの案件・録音・分析はブラウザ内に保持
- 🟡 **注意**: Web Speech API はブラウザ実装により音声をクラウドに送信する場合あり（Chrome 等）
- 🔴 **外部送信**: 文字起こしテキストが Gemini API に送信される

---

## 6. 完全ローカル実行アーキテクチャ（将来オプション）

**注**: 現状は未実装。Whisper・Ollama を導入する際の参照用。

```mermaid
graph TB
    subgraph "クライアント（ブラウザ）"
        A[React App]
        B[AudioRecorder]
        C[ChatPanel]
    end

    subgraph "ローカル環境（完全オフライン・将来）"
        D[Whisper<br/>音声認識]
        E[Ollama<br/>ローカルLLM]
        F[Llama 3<br/>分析モデル]
        G[一時ファイル]
    end

    subgraph "データストア"
        H[チェックリスト]
        I[分析結果]
    end

    A --> B
    B -->|音声データ| G
    G -->|ローカル処理| D
    D -->|文字起こしテキスト| E
    E -->|ローカル実行| F
    F -->|分析結果| C
    C -->|保存| I

    H -->|突合判定| F

    style D fill:#90EE90
    style E fill:#90EE90
    style F fill:#90EE90
    style G fill:#FFE4B5
    style H fill:#E0E0E0
    style I fill:#E0E0E0

    Note1[✅ 完全にデータが外部に送信されない<br/>✅ LLMの学習にも使われない<br/>✅ インターネット接続不要]
```

---

## 7. コンポーネント構成図

```mermaid
graph TB
    subgraph "Layout"
        L0[Layout]
        L0a[Header]
        L0b[Sidebar]
    end

    subgraph "Pages"
        P1[HomePage<br/>録音・分析画面]
        P2[MeetingPrepPage<br/>商談準備]
        P3[AdminPage<br/>チェックリスト管理]
        P4[ProjectsPage<br/>案件一覧]
        P5[ProjectDetailPage<br/>案件詳細]
    end

    subgraph "Components"
        C1[AudioRecorder<br/>音声録音・インポート]
        C2[ChatPanel<br/>分析結果表示]
    end

    subgraph "Store"
        S1[useAppStore<br/>Zustand]
    end

    subgraph "Lib"
        Lib1[analyzeTranscript<br/>文字起こし・分析]
        Lib2[meetingPlanAgent<br/>プラン生成]
        Lib3[database<br/>IndexedDB CRUD]
        Lib4[geminiApi<br/>Gemini突合]
        Lib5[speechToText<br/>Web Speech API / スタブ]
        Lib6[errorHandler<br/>エラー分類]
    end

    subgraph "Types"
        T1[Checklist, MeetingVariables<br/>meeting, index]
        T2[Project, Recording, AnalysisRecord<br/>project]
    end

    L0 --> L0a
    L0 --> L0b
    L0 --> P1
    L0 --> P2
    L0 --> P3
    L0 --> P4
    L0 --> P5

    P1 --> C1
    P1 --> C2
    P2 --> Lib2
    P3 --> S1
    P4 --> Lib3
    P5 --> Lib3

    C1 --> S1
    C1 --> Lib1
    C1 --> Lib5
    C1 --> Lib6
    C2 --> S1

    Lib1 --> Lib4
    Lib1 --> Lib5
    Lib1 --> T1
    Lib2 --> T2
    Lib3 --> T2
    S1 --> T1

    style P1 fill:#E6F3FF
    style P2 fill:#E6F3FF
    style P3 fill:#E6F3FF
    style P4 fill:#E6F3FF
    style P5 fill:#E6F3FF
    style C1 fill:#FFE4B5
    style C2 fill:#FFE4B5
    style S1 fill:#DDA0DD
    style Lib1 fill:#87CEEB
    style Lib2 fill:#87CEEB
    style Lib3 fill:#87CEEB
    style Lib4 fill:#87CEEB
    style Lib5 fill:#87CEEB
    style Lib6 fill:#87CEEB
    style T1 fill:#E0E0E0
    style T2 fill:#E0E0E0
```

---

## 8. 技術スタック

```mermaid
graph LR
    subgraph "フロントエンド"
        A1[React 19]
        A2[TypeScript]
        A3[Vite 7]
        A4[TailwindCSS 4]
        A5[React Router 7]
        A6[Zustand]
    end

    subgraph "音声処理"
        B1[MediaRecorder API]
        B2[Web Audio API]
    end

    subgraph "音声認識（現状）"
        D1[Web Speech API<br/>リアルタイム]
        D2[transcribeAudio スタブ<br/>録音Blob用]
    end

    subgraph "データ"
        DB1[IndexedDB<br/>案件・録音・分析]
    end

    subgraph "LLM"
        E1[Gemini API<br/>分析用]
        E2[Ollama<br/>ローカルLLM<br/>将来オプション]
    end

    subgraph "将来"
        C1[Node / Whisper<br/>バックエンド]
    end

    A1 --> A2
    A2 --> A3
    A3 --> A4
    A4 --> A5
    A5 --> A6

    A1 --> B1
    B1 --> B2
    A1 --> D1
    A1 --> D2
    A1 --> DB1

    D1 --> E1
    D2 --> E1
    D2 -.->|Whisper実装時| C1

    E1 --> A1
    E2 -.->|オプション| A1

    style D1 fill:#FFE4B5
    style D2 fill:#90EE90
    style DB1 fill:#90EE90
    style E1 fill:#FFB6C1
    style E2 fill:#90EE90
```

---

## 9. デプロイメント構成

**現状**: Vite ビルドによる SPA。静的ホスティング（例: Nginx, Vercel, GitHub Pages）で配信。バックエンド・Whisper サーバーは未実装。データはブラウザの IndexedDB に保持。

**将来想定**:

```mermaid
graph TB
    subgraph "開発環境（現状）"
        D1[Vite Dev Server<br/>SPA]
    end

    subgraph "本番環境（想定）"
        P1[Webサーバー<br/>Nginx / 静的ホスト]
        P2[アプリケーションサーバー<br/>Node.js 将来]
        P3[Whisperサービス<br/>Docker 将来]
        P4[ファイルストレージ<br/>将来]
    end

    subgraph "外部サービス"
        E1[Gemini API<br/>オプション]
    end

    D1 --> E1
    P1 --> P2
    P2 --> P3
    P2 --> P4
    P2 --> E1

    style D1 fill:#E6F3FF
    style P1 fill:#FFE4B5
    style P2 fill:#FFE4B5
    style P3 fill:#90EE90
    style P4 fill:#E0E0E0
    style E1 fill:#FFB6C1
```

---

## 10. エラーハンドリングフロー

```mermaid
flowchart TD
    Start[処理開始] --> Check1{マイクアクセス<br/>可能？}
    Check1 -->|No| Error1[エラー表示<br/>マイク許可を促す]
    Check1 -->|Yes| Record[録音開始]
    
    Record --> Check2{録音中<br/>エラー発生？}
    Check2 -->|Yes| Error2[エラー表示<br/>録音を停止]
    Check2 -->|No| Stop[録音停止]
    
    Stop --> Check3{音声データ<br/>存在？}
    Check3 -->|No| Error3[エラー表示<br/>データなし]
    Check3 -->|Yes| Whisper[文字起こし<br/>Web Speech API／スタブ]
    
    Whisper --> Check4{文字起こし<br/>成功？}
    Check4 -->|No| Error4[エラー表示<br/>再試行を促す]
    Check4 -->|Yes| Gemini[Gemini API送信]
    
    Gemini --> Check5{API呼び出し<br/>成功？}
    Check5 -->|No| Error5[エラー表示<br/>ネットワークエラー]
    Check5 -->|Yes| Success[分析結果表示]
    
    Error1 --> End
    Error2 --> End
    Error3 --> End
    Error4 --> End
    Error5 --> End
    Success --> End[処理完了]

    style Error1 fill:#FFB6C1
    style Error2 fill:#FFB6C1
    style Error3 fill:#FFB6C1
    style Error4 fill:#FFB6C1
    style Error5 fill:#FFB6C1
    style Success fill:#90EE90
```

---

## まとめ

### 主要な特徴

1. **ブラウザ内完結**: 音声はメモリ（Blob）で保持。案件・録音・分析は IndexedDB に永続化（バックエンド不要）
2. **モジュラー設計**: 各コンポーネントが独立。案件（Project）を軸に商談準備・録音・分析を一貫して管理
3. **セキュリティ境界**: 音声の保持場所、Web Speech API の扱い、Gemini API 送信を明確に区別
4. **拡張性**: Whisper（ローカル）・Ollama 等の将来実装を見据えた設計。Gemini 不可時はキーワードマッチでフォールバック

### セキュリティ考慮事項

- ✅ **音声データ**: メモリ（Blob）／IndexedDB。バックエンドや Whisper サーバーは現状なし（将来は Whisper でローカル処理を推奨）
- 🟡 **Web Speech API**: リアルタイム文字起こし。一部ブラウザ（Chrome 等）では音声をクラウドに送信する可能性あり
- ⚠️ **文字起こしテキスト**: Gemini API に送信（突合分析のため）
- 🔒 **完全ローカル実行**: Ollama + Llama 3（将来オプション）。Whisper 実装により音声もローカル処理可能
