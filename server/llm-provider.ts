/**
 * LLM Provider - Suporta múltiplos providers de LLM
 * 
 * Configuração via variáveis de ambiente:
 *   LLM_PROVIDER=azure_openai | gemini | manus (default: manus)
 *   
 *   Para Azure OpenAI:
 *     AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
 *     AZURE_OPENAI_API_KEY=<chave>
 *     AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini (ou gpt-4o)
 *     AZURE_OPENAI_API_VERSION=2024-08-01-preview
 *   
 *   Para Gemini (Google AI):
 *     GEMINI_API_KEY=<chave do ai.google.dev>
 *   
 *   Para Manus (built-in, funciona apenas no hosting Manus):
 *     Usa BUILT_IN_FORGE_API_KEY e BUILT_IN_FORGE_API_URL automaticamente
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: string;
}

// Azure OpenAI
async function callAzureOpenAI(messages: LLMMessage[], maxTokens: number): Promise<LLMResponse> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";

  if (!endpoint || !apiKey) {
    throw new Error("Azure OpenAI não configurado. Defina AZURE_OPENAI_ENDPOINT e AZURE_OPENAI_API_KEY.");
  }

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages,
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure OpenAI erro: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;
  return {
    content: data.choices?.[0]?.message?.content || "",
    provider: "azure_openai",
  };
}

// Google Gemini (direct API, sem Manus)
async function callGeminiDirect(messages: LLMMessage[], maxTokens: number): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini não configurado. Defina GEMINI_API_KEY (obter em ai.google.dev).");
  }

  // Convert messages to Gemini format
  const systemInstruction = messages.find(m => m.role === "system")?.content || "";
  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini erro: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    provider: "gemini",
  };
}

// Manus built-in (funciona apenas no hosting Manus)
async function callManusLLM(messages: LLMMessage[], maxTokens: number): Promise<LLMResponse> {
  const { invokeLLM } = await import("./_core/llm");
  const response = await invokeLLM({
    model: "gemini-3-flash-preview",
    messages,
    max_tokens: maxTokens,
  } as any);

  return {
    content: String(response.choices?.[0]?.message?.content || ""),
    provider: "manus",
  };
}

/**
 * Chama o LLM configurado via LLM_PROVIDER.
 * Prioridade: azure_openai > gemini > manus (fallback)
 */
export async function callLLM(messages: LLMMessage[], maxTokens: number = 16384): Promise<LLMResponse> {
  const provider = (process.env.LLM_PROVIDER || "auto").toLowerCase();

  // Explicit provider selection
  if (provider === "azure_openai") {
    return callAzureOpenAI(messages, maxTokens);
  }
  if (provider === "gemini") {
    return callGeminiDirect(messages, maxTokens);
  }
  if (provider === "manus") {
    return callManusLLM(messages, maxTokens);
  }

  // Auto-detect: try Azure first, then Gemini, then Manus
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) {
    try {
      return await callAzureOpenAI(messages, maxTokens);
    } catch (e) {
      console.warn("Azure OpenAI falhou, tentando alternativa:", (e as Error).message);
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      return await callGeminiDirect(messages, maxTokens);
    } catch (e) {
      console.warn("Gemini falhou, tentando Manus:", (e as Error).message);
    }
  }

  // Fallback to Manus built-in
  return callManusLLM(messages, maxTokens);
}
