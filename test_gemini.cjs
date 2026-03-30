const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
  const genAI = new GoogleGenerativeAI('AIzaSyDm6v8Ud-Kc_C3KnSrkOlLvebno7Mg_Jok');
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent('Cual es el resultado de 2+2? responde solo el numero.');
    console.log('Gemini Result:', result.response.text());
  } catch (e) {
    console.error('Gemini Error:', e.message);
  }
}

testGemini();
