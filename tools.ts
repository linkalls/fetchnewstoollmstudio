import { tool } from "@lmstudio/sdk";
import { extract, toHTML } from "@mizchi/readability";
import { GoogleNewsService } from "@potetotown/google_news_api";
import {
  DictionaryResult,
  OrganicResult,
  search
} from "google-sr";
import html2md from "html-to-md";
import { z } from "zod";



//* Google検索ツールの定義
export const googleSearchTool = tool({
  name: "googleSearch",
  description: "Googleで検索を行い、結果を取得する。",
  parameters: {
    query: z.string().min(1).max(100), // 検索クエリ
  },
  implementation: async ({ query }) => {
    return await search({
      query,
      // Specify the result types explicitly ([OrganicResult] is the default, but it is recommended to always specify the result type)
      resultTypes: [OrganicResult, DictionaryResult],
      // Optional: Customize the request using AxiosRequestConfig (e.g., enabling safe search)
      requestConfig: {
        params: {
          safe: "active",   // Enable "safe mode"
        },
      },
    });
  }
})


//* websiteの内容を取得するツールの定義
export const websiteContentTool = tool({
  name: "websiteContentTool",
  description: "指定したURLのウェブサイトの内容を取得し、Markdown形式で返す。",
  parameters: {
    url: z.string().min(1).max(100), // 検索クエリ
  },
  implementation: async ({ url }) => {
    const html = await fetch(url).then((res) => res.text());
    const extracted = extract(html, { charThreshold: 100 });
    // 結果を表示
    console.log(`Title: ${extracted.metadata.title}`);
    // console.log(`Author: ${extracted.byline}`);
    if (!extracted.root) {
      // process.exit(1);
      return "ウェブサイトの内容を取得できませんでした。URLが正しいか確認してください。";
    }
    const htmlContent = toHTML(extracted.root);
    const md = html2md(htmlContent);
    console.log(md);
    return {
      title: extracted.metadata.title,
      content: md, // Markdown形式のコンテンツ
      url: url, // 元のURL
    };
  }
})



// Google Newsのサービスを初期化
const newsService = new GoogleNewsService();

// ニュース取得ツールの定義
export const fetchNewsTool = tool({
  name: "fetchNews",
  description: "指定した国と言語の最新ニュースを取得する。",
  parameters: {
    country: z.string().min(2).max(2), // ISO 3166-1形式の国コード（例: 'jp'）
    // language: z.string().min(2).max(2), // ISO 639-1形式の言語コード（例: 'ja'）
    query: z.string().optional(), // 検索キーワード（オプション）
  },
  implementation: async ({ country, query }) => {
    try {
      const news = await newsService.getNews({
        country, // 国コード
        language: "ja", // 言語コード
        query, // キーワード検索（オプション）
      });

      // ニュースアイテムをフォーマットして返す
      // 最初の10個のニュースアイテムだけを返す
      return news.items.slice(0, 10).map((item) => ({
        title: item.title,
        // description: item.description,
        link: item.link,
        // pubDate: item.pubDate,
        // source: item.source,
      }));
    } catch (error) {
      console.error("Error fetching news:", error);
      throw new Error("Failed to fetch news.");
    }
  },
});
