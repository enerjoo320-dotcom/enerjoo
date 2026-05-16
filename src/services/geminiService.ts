import { Product } from "../types";

// Removed top-level import of @google/genai to ensure it's only loaded when needed
// This avoids initialization errors in environments without API keys

export interface SemanticSearchResult {
  productId: string;
  relevanceScore: number; // 0 to 1
  matchReason: string;
}

/**
 * Helper to get Gemini client or return null if not configured
 */
async function getGeminiClient(): Promise<any | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "") {
    console.warn("GEMINI_API_KEY is not defined or is empty.");
    return null;
  }
  
  try {
    const { GoogleGenAI } = await import("@google/genai");
    return new GoogleGenAI({ apiKey });
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
    return null;
  }
}

export async function performSemanticSearch(
  query: string,
  products: Product[],
  isAr: boolean
): Promise<SemanticSearchResult[]> {
  if (!query.trim()) return [];

  const ai = await getGeminiClient();
  if (!ai) {
    console.warn("Semantic search is unavailable because GEMINI_API_KEY is missing.");
    return [];
  }

  // Prepare a condensed version of products for the AI
  const productContext = products.map(p => ({
    id: p.id,
    name: isAr ? p.nameAr : p.name,
    brand: p.brand,
    category: p.category,
    power: p.power,
    efficiency: p.efficiency,
    price: p.price,
    specs: p.specs || {}
  }));

  const systemInstruction = `
    You are an expert solar energy consultant assistant for "enerjoo", a solar product comparison platform in Egypt. 
    Your task is to perform high-precision semantic search on solar products.
    
    CRITICAL SEARCH CAPABILITIES:
    1. Technical Specs: Understand power (W/kW), efficiency (%), voltage (V), and current (A).
    2. Intent Mapping: If a user asks for "home system", prioritize batteries and hybrid inverters. If "farm", prioritize high-power panels and centrifugal pumps (if available).
    3. Unit Conversions: Understand that "5k" or "5000" usually refers to 5000W or 5kW.
    4. Synonyms: 
       - Panels: "لوح", "ألواح"
       - Inverters: "محول", "عكس", "انفرتر"
       - Batteries: "بطارية", "تخزين"
       - Mounting: "هيكل", "قاعدة", "تثبيت", "شاسيه"
       - Protection: "حماية", "قاطع", "فيوز", "سيرج"
       - Combiner: "صندوق تجميع", "كومباينر"
       - Cables: "سلك", "كابل", "كابلات"
       - Connectors/Sealings/Clamps: "موصل", "وصلة", "كلبس", "ترامل"
    
    EVALUATION CRITERIA:
    - High Relevance (0.8-1.0): Product exactly matches spec (e.g., 540W panel for "540w") or matches a specific intent perfectly.
    - Medium Relevance (0.4-0.7): Product is related (e.g., a battery when searching for "storage") but not the specific model.
    - Low Relevance (0.1-0.3): Weak connection.
    
    Return a JSON array of search results, each containing:
    - productId: the ID of the matching product (as string)
    - relevanceScore: a number from 0 to 1
    - matchReason: a brief explanation in ${isAr ? 'Arabic' : 'English'} explaining WHY it matches (e.g., "This panel provides exactly 540W as requested").
  `;

  try {
    const { Type } = await import("@google/genai");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { parts: [{ text: `Query: ${query}` }] },
        { parts: [{ text: `Products: ${JSON.stringify(productContext)}` }] }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              productId: { type: Type.STRING },
              relevanceScore: { type: Type.NUMBER },
              matchReason: { type: Type.STRING }
            },
            required: ["productId", "relevanceScore", "matchReason"]
          }
        }
      }
    });

    const results = JSON.parse(response.text || "[]");
    return results;
  } catch (error) {
    console.error("Semantic Search Error:", error);
    return [];
  }
}
