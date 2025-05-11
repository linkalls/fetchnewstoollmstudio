import { tool } from "@lmstudio/sdk";
import { GoogleNewsService } from "@potetotown/google_news_api";
import { z } from "zod";

// Google Newsのサービスを初期化
const newsService = new GoogleNewsService();

// ニュース取得ツールの定義
export const fetchNewsTool = tool({
  name: "fetchNews",
  description: "指定した国と言語の最新ニュースを取得する。",
  parameters: {
    country: z.string().min(2).max(2), // ISO 3166-1形式の国コード（例: 'jp'）
    language: z.string().min(2).max(2), // ISO 639-1形式の言語コード（例: 'ja'）
    query: z.string().optional(), // 検索キーワード（オプション）
  },
  implementation: async ({ country, language, query }) => {
    try {
      const news = await newsService.getNews({
        country, // 国コード
        language, // 言語コード
        query, // キーワード検索（オプション）
      });

      // ニュースアイテムをフォーマットして返す
      // 最初の10個のニュースアイテムだけを返す
      return news.items.slice(0, 10).map((item) => ({
        title: item.title,
        description: item.description,
        // link: item.link,
        // pubDate: item.pubDate,
        // source: item.source,
      }));
    } catch (error) {
      console.error("Error fetching news:", error);
      throw new Error("Failed to fetch news.");
    }
  },
});
