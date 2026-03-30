import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Analyzes an incubator/nacedora panel image using Gemini Vision.
 * Returns temperature (°F), humidity (%), and process status.
 * GOLDEN RULE: Temperature is always extracted in °F.
 */
export async function analyzeIncubatorImage(base64Image: string, mimeType: string = 'image/jpeg') {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no está configurada.');
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analiza esta imagen del panel de control de una incubadora o nacedora industrial avícola.
    REGLA DE ORO: Extrae la temperatura SIEMPRE en grados Fahrenheit (°F). Si ves °C, conviértela multiplicando por 9/5 y sumando 32.
    
    Extrae estrictamente estos valores en formato JSON puro (sin Markdown, sin bloques de código):
    - "temperature": Número flotante en °F (temperatura principal visible en el display, Set Point o Actual)
    - "humidity": Número flotante, porcentaje de humedad relativa (%)
    - "processStatus": Estado visible como cadena: "OK", "ALARMA", "APAGADA", "CALENTANDO", etc.
    
    Si no puedes leer un valor con certeza, usa null.
    Si la máquina parece encendida y funcionando normalmente, usa "OK" como processStatus.
    
    Responde ÚNICAMENTE con el objeto JSON. Ejemplo:
    { "temperature": 99.5, "humidity": 83.2, "processStatus": "OK" }`;

    const imagePart = {
      inlineData: { data: base64Image, mimeType }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text().trim();

    console.log('[Vision Service] Gemini raw response:', responseText);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('El modelo de visión no devolvió un JSON válido. Respuesta: ' + responseText.slice(0, 100));
    }

    const data = JSON.parse(jsonMatch[0]);
    return {
      temperature: typeof data.temperature === 'number' ? data.temperature : null,
      humidity: typeof data.humidity === 'number' ? data.humidity : null,
      processStatus: String(data.processStatus || 'DESCONOCIDO')
    };
  } catch (error) {
    console.error('[Vision Service] Error procesando imagen:', error);
    throw new Error('Error en el servicio de reconocimiento de imágenes (Gemini).');
  }
}
