import { LMStudioClient } from "@lmstudio/sdk";
import { googleSearchTool, websiteContentTool } from "./tools";
import { serve,type ServerWebSocket } from "bun";

const client = new LMStudioClient();

// HTMLテンプレート
const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>検索ツール</title>
  <style>
    body {
      font-family: sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #333;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .search-container {
      margin-bottom: 20px;
    }
    input[type="text"] {
      width: 70%;
      padding: 10px;
      font-size: 16px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    button {
      padding: 10px 15px;
      background-color: #0066cc;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover {
      background-color: #0055aa;
    }
    button:disabled {
      background-color: #cccccc;
      cursor: not-allowed;
    }
    #status {
      margin: 10px 0;
      padding: 10px;
      background-color: #f8f8f8;
      border-left: 4px solid #0066cc;
      display: none;
    }
    #result {
      margin-top: 20px;
      white-space: pre-wrap;
      background-color: #f8f8f8;
      padding: 15px;
      border-radius: 4px;
      line-height: 1.5;
    }
    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(0,0,0,.3);
      border-radius: 50%;
      border-top-color: #0066cc;
      animation: spin 1s ease-in-out infinite;
      margin-right: 10px;
      vertical-align: middle;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .phases {
      margin-top: 10px;
      font-size: 0.9em;
      color: #666;
    }
    .phase {
      opacity: 0.6;
      margin-right: 8px;
    }
    .phase.active {
      opacity: 1;
      font-weight: bold;
      color: #0066cc;
    }
  </style>
</head>
<body>
  <h1>AI深層検索ツール</h1>
  <div class="search-container">
    <input type="text" id="query" placeholder="調べたいことを入力してください..." autofocus>
    <button id="search-btn">調査開始</button>
  </div>
  <div id="status"></div>
  <div id="result"></div>

  <script>
    const queryInput = document.getElementById('query');
    const searchBtn = document.getElementById('search-btn');
    const statusDiv = document.getElementById('status');
    const resultDiv = document.getElementById('result');
    
    let socket = null;
    let currentPhase = 0;
    const phases = [
      '要件分析',
      '最適検索クエリ決定',
      'ウェブ検索実行',
      'ソース精査',
      'コンテンツ収集',
      '重要情報抽出',
      'データ整理',
      '要約生成'
    ];
    
    // フェーズを表示するHTMLを生成
    function getPhasesHTML(currentPhase) {
      let html = '<div class="phases">';
      phases.forEach((phase, index) => {
        const className = index === currentPhase ? 'phase active' : 'phase';
        html += \`<span class="\${className}">\${phase}</span>\`;
      });
      html += '</div>';
      return html;
    }
    
    // WebSocketの接続をセットアップ
    function setupWebSocket() {
      // WebSocketの接続
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = \`\${protocol}//\${window.location.host}/ws\`;
      
      socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log('WebSocket接続が確立されました');
      };
      
      socket.onmessage = (event) => {
        try {
          // JSONメッセージかどうかを確認
          const data = JSON.parse(event.data);
          
          // フェーズ更新メッセージ
          if (data.type === 'phase_update') {
            currentPhase = data.phase;
            updateStatus();
          }
          
          // 検索完了メッセージ
          if (data.type === 'search_complete') {
            statusDiv.innerHTML = '✓ 調査完了';
            searchBtn.disabled = false;
            
            setTimeout(() => {
              statusDiv.style.display = 'none';
            }, 3000);
          }
        } catch (e) {
          // JSONでないメッセージはテキストとして扱う
          const message = event.data;
          
          // 既存のテキストに追加
          resultDiv.textContent += message;
          
          // 自動スクロール
          window.scrollTo(0, document.body.scrollHeight);
        }
      };
      
      socket.onclose = () => {
        console.log('WebSocket接続が閉じられました');
        // 再接続を試みる
        setTimeout(setupWebSocket, 3000);
      };
      
      socket.onerror = (error) => {
        console.error('WebSocketエラー:', error);
      };
    }
    
    // ステータス表示を更新
    function updateStatus() {
      statusDiv.innerHTML = \`<div class="loading"></div> 深層調査を実行中...<br>現在のステップ: \${phases[currentPhase]}\${getPhasesHTML(currentPhase)}\`;
    }
    
    // 初期接続
    setupWebSocket();
    
    // Enterキーを押したときにも検索を実行
    queryInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        searchBtn.click();
      }
    });
    
    searchBtn.addEventListener('click', async () => {
      const query = queryInput.value.trim();
      if (!query) return;
      
      // 検索ボタンを無効化
      searchBtn.disabled = true;
      
      // ステータス表示を初期化
      currentPhase = 0;
      updateStatus();
      statusDiv.style.display = 'block';
      resultDiv.textContent = '';
      
      try {
        // WebSocketが接続されているか確認
        if (socket && socket.readyState === WebSocket.OPEN) {
          // 検索クエリをWebSocketで送信
          socket.send(JSON.stringify({ type: 'search', query }));
        } else {
          throw new Error('WebSocket接続がありません。ページをリロードしてください。');
        }
      } catch (error) {
        statusDiv.innerHTML = '❌ エラーが発生しました: ' + error.message;
        console.error(error);
        searchBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
`;

// 接続情報を保持するための型定義
interface ConnectionInfo {
  ws: ServerWebSocket<unknown>;
  currentToolCall: 'search' | 'content';
}

// WebSocket接続を保持するMap
const wsConnections = new Map<string, ConnectionInfo>();

// モデルのロード
let modelPromise = client.llm.model("qwen3-4b");

// フェーズ定義
const PHASES = {
  ANALYSIS: 0,
  QUERY_GENERATION: 1,
  WEB_SEARCH: 2,
  SOURCE_EVALUATION: 3,
  CONTENT_GATHERING: 4,
  INFO_EXTRACTION: 5,
  DATA_ORGANIZATION: 6,
  SUMMARY_GENERATION: 7
};

// Bunのサーバー設定
serve({
  port: 3000,
  fetch(req, server) {
    const url = new URL(req.url);
    
    // WebSocketのアップグレードリクエスト
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) {
        return; // アップグレードされた場合は何も返さない
      }
      return new Response("WebSocketのアップグレードに失敗しました", { status: 400 });
    }
    
    // 通常のHTTPリクエスト処理
    if (url.pathname === "/") {
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }
    
    // 404エラー
    return new Response("Not Found", { status: 404 });
  },
  // WebSocketの処理
  websocket: {
    async open(ws) {
      const id = crypto.randomUUID();
      wsConnections.set(id, { 
        ws, 
        currentToolCall: 'search' // 初期値
      });
      console.log(`新しいWebSocket接続: ${id}`);
      
      // モデルのロードが完了していることを確認
      await modelPromise;
    },
    async message(ws, message) {
      try {
        const data = JSON.parse(message.toString());
        
        // 接続情報を特定
        let connectionId = '';
        let connectionInfo: ConnectionInfo | undefined;
        
        for (const [id, connInfo] of wsConnections.entries()) {
          if (connInfo.ws === ws) {
            connectionId = id;
            connectionInfo = connInfo;
            break;
          }
        }
        
        if (!connectionInfo) {
          console.error('接続情報が見つかりません');
          return;
        }
        
        if (data.type === 'search' && data.query) {
          // モデルが準備できているか確認
          const model = await modelPromise;
          
          // 検索開始メッセージを送信
          ws.send("========== 深層調査を開始します ==========\n\n");
          
          // 分析フェーズ
          ws.send(JSON.stringify({ type: 'phase_update', phase: PHASES.ANALYSIS }));
          ws.send("クエリを分析中...\n");
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // クエリ生成フェーズ
          ws.send(JSON.stringify({ type: 'phase_update', phase: PHASES.QUERY_GENERATION }));
          ws.send("最適な検索クエリを生成中...\n");
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // ウェブ検索フェーズ
          ws.send(JSON.stringify({ type: 'phase_update', phase: PHASES.WEB_SEARCH }));
          
          // LLMの呼び出し
          await model.act(
            `${data.query}というものについてユーザーは調べたいようですが最適なクエリで検索してください(できる限り翻訳しないで考えてください)。要約には根拠となるurlをつけてください。基本は日本語で検索してください。詳しいサイトの情報がいるならばそのサイトの内容も取得して確認してください。要約のみを出力してください`,
            [googleSearchTool, websiteContentTool],
            {
              onMessage: (message) => {
                const text = message.toString();
                ws.send(text);
              },
              onFirstToken: () => {
                // 分析フェーズ
                ws.send(JSON.stringify({ type: 'phase_update', phase: PHASES.DATA_ORGANIZATION }));
                ws.send("\n収集したデータを整理しています...\n\n");
              },
              onToolCallRequestStart: () => {
                if (connectionInfo!.currentToolCall === 'search') {
                  ws.send(JSON.stringify({ type: 'phase_update', phase: PHASES.WEB_SEARCH }));
                  ws.send("\n[ウェブで情報を検索中...]\n");
                } else {
                  ws.send(JSON.stringify({ type: 'phase_update', phase: PHASES.CONTENT_GATHERING }));
                  ws.send("\n[コンテンツを収集中...]\n");
                }
                
                // 次のツール呼び出しがウェブサイト内容取得の場合を考慮
                connectionInfo!.currentToolCall = connectionInfo!.currentToolCall === 'search' ? 'content' : 'search';
              },
              onToolCallRequestEnd: () => {
                ws.send(JSON.stringify({ type: 'phase_update', phase: PHASES.SOURCE_EVALUATION }));
                ws.send("[情報源の評価完了]\n\n");
              }
            }
          );
          
          // 要約生成フェーズ
          ws.send(JSON.stringify({ type: 'phase_update', phase: PHASES.SUMMARY_GENERATION }));
          ws.send("\n\n最終レポートを生成中...\n");
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // 完了メッセージを送信
          ws.send("\n\n========== 深層調査が完了しました ==========");
          
          // クライアントに完了を通知
          ws.send(JSON.stringify({ type: 'search_complete' }));
        }
      } catch (error) {
        console.error("WebSocketメッセージ処理エラー:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        ws.send(`エラーが発生しました: ${errorMessage}`);
      }
    },
    close(ws, code, message) {
      // 接続を切断する際に接続リストから削除
      for (const [id, connInfo] of wsConnections.entries()) {
        if (connInfo.ws === ws) {
          wsConnections.delete(id);
          console.log(`WebSocket接続が閉じられました: ${id}, コード: ${code}`);
          break;
        }
      }
    },
  },
  // タイムアウト時間を延長
  idleTimeout: 255
});

console.log("深層検索ツールGUIサーバーが起動しました: http://localhost:3000");
console.log("モデルを読み込み中...");

// モデルのロードが完了したらログを出力
modelPromise.then(() => {
  console.log("モデルの読み込みが完了しました。検索の準備ができました。");
});