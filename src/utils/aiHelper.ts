/**
 * AI Helper module for calling external AI APIs
 * Supports OpenAI and Azure AI endpoints
 */

import { AISettings, AIResponse } from "../types/index";

/**
 * Generate motivational break message using AI
 */
export async function generateMotivationalMessage(
  context: {
    hoursSpent: number;
    currentTask?: string;
    timeOfDay?: "morning" | "afternoon" | "evening" | "night";
  },
  aiSettings: AISettings
): Promise<AIResponse> {
  if (!aiSettings.enabled || aiSettings.provider === "none") {
    return {
      success: false,
      error: "AI is not enabled or provider not configured",
    };
  }

  try {
    const prompt = buildMotivationalPrompt(context);
    const message = await callAI(prompt, aiSettings);
    return {
      success: true,
      message,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate insights from usage statistics
 */
export async function generateUsageInsights(
  stats: { [domain: string]: any },
  aiSettings: AISettings
): Promise<AIResponse> {
  if (!aiSettings.enabled || aiSettings.provider === "none") {
    return {
      success: false,
      error: "AI is not enabled or provider not configured",
    };
  }

  try {
    const prompt = buildStatsAnalysisPrompt(stats);
    const insights = await callAI(prompt, aiSettings);
    return {
      success: true,
      insights,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Build prompt for motivational message
 */
function buildMotivationalPrompt(context: {
  hoursSpent: number;
  currentTask?: string;
  timeOfDay?: string;
}): string {
  return `Generate a short, motivational break reminder message (1-2 sentences max) for someone who has been working for ${context.hoursSpent} hours${
    context.currentTask ? ` on ${context.currentTask}` : ""
  }${context.timeOfDay ? ` during the ${context.timeOfDay}` : ""}.
  
  The message should:
  - Be encouraging but not corny
  - Suggest a specific break activity (e.g., "stretch", "walk", "drink water")
  - Acknowledge their effort
  - Keep it under 50 characters if possible
  
  Just provide the message, no additional text.`;
}

/**
 * Build prompt for statistics analysis
 */
function buildStatsAnalysisPrompt(stats: { [domain: string]: any }): string {
  const topSites = Object.entries(stats)
    .filter(([key]) => key !== "lastUpdated")
    .sort((a, b) => (b[1].totalTime || 0) - (a[1].totalTime || 0))
    .slice(0, 5)
    .map(([domain, data]) => `${domain}: ${Math.round((data.totalTime || 0) / 1000 / 60)} minutes`)
    .join(", ");

  return `Analyze this browsing data and provide 2-3 actionable productivity insights (2-3 sentences max):
  
  Top sites: ${topSites}
  
  Provide insights about:
  - Time distribution and potential distractions
  - Productivity patterns
  - Recommendations
  
  Be specific and practical. Just provide the insights, no additional text.`;
}

/**
 * Call AI API (OpenAI or Azure)
 */
async function callAI(prompt: string, aiSettings: AISettings): Promise<string> {
  if (aiSettings.provider === "openai") {
    return callOpenAI(prompt, aiSettings);
  } else if (aiSettings.provider === "azure") {
    return callAzureAI(prompt, aiSettings);
  } else {
    throw new Error("Unsupported AI provider");
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(prompt: string, aiSettings: AISettings): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiSettings.apiKey}`,
    },
    body: JSON.stringify({
      model: aiSettings.model || "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || "Unknown error"}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

/**
 * Call Azure AI API
 */
async function callAzureAI(prompt: string, aiSettings: AISettings): Promise<string> {
  // Extract Azure endpoint from apiKey (format: https://endpoint.openai.azure.com/)
  const endpoint = aiSettings.apiKey.split("|")[0];
  const apiKey = aiSettings.apiKey.split("|")[1];

  const response = await fetch(`${endpoint}/openai/deployments/${aiSettings.model}/chat/completions?api-version=2023-05-15`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Azure AI API error: ${error.error?.message || "Unknown error"}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

/**
 * Test AI connection
 */
export async function testAIConnection(aiSettings: AISettings): Promise<AIResponse> {
  if (!aiSettings.enabled || aiSettings.provider === "none") {
    return {
      success: false,
      error: "AI is not enabled",
    };
  }

  try {
    const testPrompt = "Say 'Connection successful' in one sentence.";
    const message = await callAI(testPrompt, aiSettings);
    return {
      success: true,
      message,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}
