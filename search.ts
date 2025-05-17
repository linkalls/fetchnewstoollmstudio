import { LMStudioClient } from "@lmstudio/sdk";
import { googleSearchTool ,websiteContentTool} from "./tools";
import { input } from '@inquirer/prompts';

const client = new LMStudioClient();

// モデルの読み込み
const model = await client.llm.model("qwen3-4b");

console.log("モデルの読み込み完了");
console.log("---------------------")



const searchQuery = await input({ message: 'なにについて調べたいですか？' });

// console.log(`"${searchQuery}"についてのニュースを取得します。`);
// console.log("---------------------")

// await model.complete(`${searchQuery}というものについてユーザーは調べたいようですがどのようなクエリーで検索するのが最適化を教えてください。`);


// ニュース取得と要約
await model.act(
  `${searchQuery}というものについてユーザーは調べたいようですが最適なクエリで検索してください。要約には根拠となるurlをつけてください。基本は日本語で検索してください。詳しいサイトの情報がいるならばそのサイトの内容も取得して確認してください。要約のみを出力してください`,
  [googleSearchTool,websiteContentTool],
  {
    onMessage: (message) => console.info(message.toString()),
    onFirstToken: () => console.info("応答を生成中..."),
    onToolCallRequestStart:()=> console.info("ツール呼び出しを開始します..."),
    onToolCallRequestEnd: () => console.info("ツール呼び出しが完了しました。"),
  }
);

process.exit(1);
