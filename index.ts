import { LMStudioClient } from "@lmstudio/sdk";
import { fetchNewsTool } from "./tools";

const client = new LMStudioClient();

// モデルの読み込み
const model = await client.llm.model("qwen3-1.7b");

console.log("モデルの読み込み完了");
console.log("---------------------")

// ニュース取得と要約
await model.act(
  "最新のHololiveのニュースを要約してください。",
  [fetchNewsTool],
  {
    onMessage: (message) => console.info(message.toString()),
  }
);

process.exit(1);
