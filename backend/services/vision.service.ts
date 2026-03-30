import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function analyzeIncubatorImage(base64Image: string, mimeType: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no está configurada.');
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analiza detalladamente esta imagen que corresponde al panel de control digital o físico de una incubadora o nacedora industrial.
    Extrae estrictamente los siguientes valores obligatorios en formato JSON sin Markdown (solo el objeto JSON literal):
    - "temperature": Número flotante (en grados °F o °C, lo que figure como principal, generalmente Set Point o Actual).
    - "humidity": Número flotante que representa la humedad relativa (%).
    - "processStatus": Cadena corta indicando el estado visible (ej. "OK", "ALARMA", "APAGADA", "CALENTANDO", etc). Si no puedes determinar el estado con certeza pero ves que está encendida y funcionando, pon "OK".
    
    Si por algún motivo no puedes ver un valor, extrae \`null\` para ese campo.
    Asegúrate de responder UNICAMENTE con el objeto JSON válido.
    Ejemplo esperado:
    { "temperature": 99.5, "humidity": 83.2, "processStatus": "OK" }`;

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();

    console.log('[Vision Service] Gemini raw response:', responseText);

    // Extraer y parsear el JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('El modelo de visión no devolvió un JSON válido.');
    }

    const data = JSON.parse(jsonMatch[0]);
    return {
      temperature: data.temperature || null,
      humidity: data.humidity || null,
      processStatus: data.processStatus || 'DESCONOCIDO'
    };
  } catch (error) {
    console.error('[Vision Service] Error procesando imagen con Gemini:', error);
    throw new Error('Error en el servicio de reconocimiento de imágenes.');
  }
}
