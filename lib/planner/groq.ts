import OpenAI from "openai";

// Groq speaks the OpenAI API, so the OpenAI SDK works with a different base URL.
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const MODEL = "openai/gpt-oss-120b";

/** Ask Groq for a JSON object and parse it. Throws if the reply isn't valid JSON. */
export async function groqJson<T = Record<string, unknown>>(system: string, user: string): Promise<T> {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });
  return JSON.parse(completion.choices[0].message.content || "{}") as T;
}

export { addDays, daysBetween, todayInDhaka } from "../dates";
