
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const suggestFailureReason = async (checkpointLabel: string, stage: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The following factory QC checkpoint failed during the ${stage} stage: "${checkpointLabel}". Provide a concise, professional, 1-sentence reason why this might have failed for a quality report.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reason: { type: Type.STRING }
          },
          required: ["reason"]
        }
      }
    });

    const data = JSON.parse(response.text || '{"reason": "Mechanical defect detected."}');
    return data.reason;
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return "Unknown defect; further investigation required.";
  }
};
