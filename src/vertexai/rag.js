// RAG 파이프라인 예시 (실제 구현은 벡터DB, 검색, LLM 호출 등 필요)
const { generateText } = require('./gemini25');

async function runRag(query, context) {
  // context: 검색 결과, 벡터DB 등에서 가져온 문서
  const prompt = `${context}\n\n질문: ${query}`;
  return await generateText(prompt);
}

module.exports = { runRag }; 