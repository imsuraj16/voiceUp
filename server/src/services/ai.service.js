const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({});

async function generateResponse(userPrompt) {
  // Send prompt with improved system instruction
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        type: "system",
        text: `
You are an AI assistant that analyzes any reported problem. 

For any input issue, your task is:
1. Assign a "severityScore" from 0 to 100 (0 = not urgent, 100 = extremely urgent).
2. Provide a "suggestedAction" — 1–2 sentences explaining exactly what the user should do to address or report the problem.

Always return strictly in this JSON format:

{
  "severityScore": number,
  "suggestedAction": string
}

Do NOT include any other commentary, explanations, or metadata. Only output the JSON.
`,
      },
      {
        type: "user",
        text: userPrompt,
      },
    ],
    config: {
      temperature: 0.7,
      topK: 5,
      topP: 0.9,
      maxOutputTokens: 400,
      safety: { category: "general", blocklist: false },
      response_format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            score: { type: "number" },
            suggestions: {
              type: "array",
              minItems: 2,
              items: { type: ["string", "object"] },
            },
          },
          required: ["score", "suggestions"],
        },
      },
    },
  });

  let output;

  try {
    // Remove any code block markers (e.g., ```json)
    const cleaned = response.text.replace(/```json|```/g, "").trim();
    output = JSON.parse(cleaned);

    // Ensure at least 2 suggestions
    if (!output.suggestions || output.suggestions.length < 2) {
      output.suggestions = output.suggestions || [];
      while (output.suggestions.length < 2) {
        output.suggestions.push("No additional suggestion provided.");
      }
    }

    // Flatten nested suggestion objects into readable strings
    output.suggestions = output.suggestions.map((s) => {
      if (typeof s === "object" && s !== null) {
        return Object.values(s).join(" "); // combine clarity, detail, actionability
      }
      return s;
    });
  } catch (e) {
    // Fallback if parsing fails
    output = {
      score: null,
      suggestions: [response.text, "No additional suggestion provided."],
    };
  }

  return output;
}

module.exports = generateResponse;
