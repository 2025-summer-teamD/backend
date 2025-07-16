// 임시 저장소 (메모리 배열)
const personas = [];
let nextId = 1;

function createCustomPersonaService({ name, image_url, is_public, prompt, description }) {
  const persona = {
    id: nextId++,
    name,
    image_url,
    is_public,
    prompt,
    description,
    createdAt: new Date().toISOString(),
  };
  personas.push(persona);
  return persona;
}

module.exports = { createCustomPersonaService };
