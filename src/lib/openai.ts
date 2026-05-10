import OpenAI from "openai";

export function createOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const OCR_MODEL = process.env.OPENAI_OCR_MODEL ?? "gpt-4o";
export const INSIGHTS_MODEL = process.env.OPENAI_INSIGHTS_MODEL ?? "gpt-4o-mini";
