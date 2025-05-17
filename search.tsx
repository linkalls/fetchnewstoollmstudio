import {
  LLM,
  LMStudioClient
} from "@lmstudio/sdk"; // Added LLMModel, Message types
import { Box, Newline, render, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import React, { useEffect, useState } from 'react';
import { googleSearchTool } from "./tools"; // Assuming tools.ts is in the same directory
const client = new LMStudioClient();

// Helper to ensure the model is initialized only once
let modelPromise: Promise<LLM> | null = null;

const getModel = (): Promise<LLM> => {
  if (!modelPromise) {
    // Specify the model identifier you want to load
    modelPromise = client.llm.model("qwen3-1.7b");
  }
  return modelPromise;
};

const SearchApp = () => {
  const { exit } = useApp();
  const [currentStatus, setCurrentStatus] = useState("モデルを読み込んでいます...");
  const [loadedModel, setLoadedModel] = useState<LLM | null>(null);

  const [inputValue, setInputValue] = useState(''); // For TextInput component
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null); // Stores the query after user submission

  const [llmMessages, setLlmMessages] = useState<string[]>([]);
  // Defines the different stages of the application
  const [currentStep, setCurrentStep] = useState<'LOADING_MODEL' | 'AWAITING_INPUT' | 'OPTIMIZING_QUERY' | 'SEARCHING' | 'FINAL_MESSAGES' | 'EXITING'>('LOADING_MODEL');
  const [hasEncounteredError, setHasEncounteredError] = useState(false);

  // Effect 1: Load the Language Model
  useEffect(() => {
    if (currentStep === 'LOADING_MODEL') {
      getModel()
        .then(modelInstance => {
          setLoadedModel(modelInstance);
          setCurrentStatus("モデルの読み込み完了。\n---------------------");
          setCurrentStep('AWAITING_INPUT');
        })
        .catch(err => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setCurrentStatus(`モデルの読み込みに失敗しました: ${errorMessage}`);
          setLlmMessages(prev => [...prev, `エラー: モデルの読み込みに失敗 - ${errorMessage}`]);
          setHasEncounteredError(true);
          setCurrentStep('EXITING'); // Proceed to exit on critical failure
        });
    }
  }, [currentStep]); // Rerun when currentStep changes

  // Effect 2: Handle Query Optimization (after input submission)
  useEffect(() => {
    if (currentStep === 'OPTIMIZING_QUERY' && loadedModel && submittedQuery) {
      setCurrentStatus(`"${submittedQuery}"について最適な検索クエリを生成中...`);
      const processQueryOptimization = async () => {
        try {
          // This step matches the original script where model.complete is called,
          // but its direct output isn't explicitly used in the next model.act prompt.
          const completeStream = await loadedModel.complete(
            `${submittedQuery}というものについてユーザーは調べたいようですがどのようなクエリーで検索するのが最適化を教えてください。`
          );
          // Consume the stream (as the original script implies an action)
          // let optimizationResponse = "最適化提案: "; // If you want to capture the response
          for await (const _chunk of completeStream) {
            // optimizationResponse += chunk;
          }
          // setLlmMessages(prev => [...prev, optimizationResponse]); // Optionally display this
          setCurrentStep('SEARCHING'); // Move to the next step
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          setCurrentStatus(`クエリ最適化中にエラーが発生しました: ${errorMessage}`);
          setLlmMessages(prev => [...prev, `エラー: クエリ最適化 - ${errorMessage}`]);
          setHasEncounteredError(true);
          setCurrentStep('FINAL_MESSAGES'); // Show messages and then exit
        }
      };
      processQueryOptimization();
    }
  }, [currentStep, loadedModel, submittedQuery]);

  // Effect 3: Perform Search using the tool
  useEffect(() => {
    if (currentStep === 'SEARCHING' && loadedModel && submittedQuery) {
      setCurrentStatus(`"${submittedQuery}"について検索を実行中...`);
      const performSearch = async () => {
        try {
          await loadedModel.act(
            // The prompt asks the LLM to use an optimal query internally with the tool
            `${submittedQuery}というものについてユーザーは調べたいようですが最適なクエリで検索してください。要約には根拠となるurlをつけてください。基本は日本語で検索してください`,
            [googleSearchTool], // The tool to be used
            {
              onMessage: (message) => { // message is type Message from @lmstudio/sdk
                setLlmMessages(prev => [...prev, message.toString()]);
              },
            }
          );
          setCurrentStatus("検索と要約が完了しました。");
          setCurrentStep('FINAL_MESSAGES');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          setCurrentStatus(`検索中にエラーが発生しました: ${errorMessage}`);
          setLlmMessages(prev => [...prev, `エラー: 検索 - ${errorMessage}`]);
          setHasEncounteredError(true);
          setCurrentStep('FINAL_MESSAGES');
        }
      };
      performSearch();
    }
  }, [currentStep, loadedModel, submittedQuery]);

  // Effect 4: Handle application exit
  useEffect(() => {
    if (currentStep === 'EXITING' || currentStep === 'FINAL_MESSAGES') {
      let exitMessage = "";
      const baseDelay = 3000; // 3 seconds to read final messages
      let actualDelay = baseDelay;

      if (currentStep === 'FINAL_MESSAGES') {
        exitMessage = hasEncounteredError ?
          `処理中にエラーが発生しました。${baseDelay / 1000}秒後に終了します。` :
          `処理が完了しました。${baseDelay / 1000}秒後に終了します。`;
      } else if (currentStep === 'EXITING') { // Critical error, shorter delay
        actualDelay = 1000; // 1 second for critical errors
        exitMessage = `重大なエラーが発生したため、${actualDelay / 1000}秒後に終了します。`;
        if (!hasEncounteredError) setHasEncounteredError(true); // Ensure error status
      }

      // Add the exit message to display, ensuring it's not duplicated
      if (exitMessage && !llmMessages.some(msg => msg.includes("秒後に終了します。"))) {
        setLlmMessages(prev => [...prev, exitMessage]);
      }

      const timer = setTimeout(() => {
        // Exit with an error object if problems occurred (results in non-zero exit code)
        exit(hasEncounteredError ? new Error("処理中にエラーが発生しました。") : undefined);
      }, actualDelay);
      return () => clearTimeout(timer); // Cleanup timer on unmount or re-run
    }
  }, [currentStep, exit, llmMessages, hasEncounteredError]);

  // Handler for submitting the search query from TextInput
  const handleSubmitQuery = (query: string) => {
    const trimmedQuery = query.trim();
    if (trimmedQuery && currentStep === 'AWAITING_INPUT') {
      setSubmittedQuery(trimmedQuery);
      setInputValue(''); // Clear the input field
      setCurrentStatus(`"${trimmedQuery}" の処理を開始します...`);
      setCurrentStep('OPTIMIZING_QUERY');
    } else if (!trimmedQuery && currentStep === 'AWAITING_INPUT') {
      setCurrentStatus("検索クエリを入力してください。再度入力をお願いします。");
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text>{currentStatus}</Text>
      <Newline />

      {currentStep === 'AWAITING_INPUT' && (
        <Box>
          <Box marginRight={1}>
            <Text>なにについて調べたいですか？:</Text>
          </Box>
          <TextInput
            value={inputValue}
            onChange={setInputValue} // Update input value as user types
            onSubmit={handleSubmitQuery} // Handle submission on Enter
            placeholder="検索語句を入力してEnter..."
          />
        </Box>
      )}

      {llmMessages.length > 0 && (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="cyan" padding={1}>
          <Text bold>--- LLMの応答 ---</Text>
          {llmMessages.map((msg, index) => (
            <React.Fragment key={index}>
              <Text>{msg}</Text>
            </React.Fragment>
          ))}
        </Box>
      )}
    </Box>
  );
};

// Render the Ink application
render(<SearchApp />);
