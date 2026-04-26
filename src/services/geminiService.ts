import { GoogleGenAI, Type } from "@google/genai";

export interface ExtractedLead {
  name: string;
  description: string;
  products: string;
  phone: string;
  address: string;
  email: string;
}

export const extractLeads = async (niche: string, userApiKey?: string): Promise<ExtractedLead[]> => {
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("Chave de API Gemini não configurada. Por favor, adicione sua chave nas Configurações.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Use a pesquisa do Google para encontrar 10 estabelecimentos comerciais ATIVOS e REAIS no nicho ou cidade especificada: "${niche}".
  
  Extraia os seguintes campos obrigatórios de forma precisa para cada um dos 10 itens:
  - Nome exato do estabelecimento.
  - Uma descrição curta do que eles fazem.
  - Principais produtos ou serviços que oferecem.
  - Telefone comercial (formato brasileiro se aplicável).
  - Endereço completo.
  - E-mail (se encontrar, caso contrário deixe em branco).

  A resposta deve ser APENAS um array JSON válido contendo exatamente 10 objetos.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nome do estabelecimento" },
            description: { type: Type.STRING, description: "O que o estabelecimento faz" },
            products: { type: Type.STRING, description: "Quais produtos ou serviços eles oferecem" },
            phone: { type: Type.STRING, description: "Telefone de contato" },
            address: { type: Type.STRING, description: "Endereço físico" },
            email: { type: Type.STRING, description: "E-mail de contato (opcional)" },
          },
          required: ["name", "description", "products", "phone", "address"],
        },
      },
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true }
    },
  });

  try {
    const text = response.text.trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Erro ao processar leads da IA:", error);
    return [];
  }
};
