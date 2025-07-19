import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 기본 캐릭터 이미지 파일을 생성하는 함수
 */
export const createDefaultImage = () => {
  const uploadDir = path.join(__dirname, '../../uploads');
  const defaultImagePath = path.join(uploadDir, 'default-character.png');
  
  // 기본 이미지가 없으면 생성
  if (!fs.existsSync(defaultImagePath)) {
    // 간단한 SVG 이미지를 PNG로 변환하여 기본 이미지 생성
    const svgContent = `
      <svg width="300" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="400" fill="#4F46E5"/>
        <text x="150" y="200" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle">
          Character Image
        </text>
        <circle cx="150" cy="120" r="40" fill="white" opacity="0.3"/>
      </svg>
    `;
    
    // SVG를 파일로 저장 (실제로는 PNG로 변환하는 것이 좋지만, 일단 SVG로)
    fs.writeFileSync(defaultImagePath.replace('.png', '.svg'), svgContent);
    console.log('📁 기본 캐릭터 이미지가 생성되었습니다:', defaultImagePath.replace('.png', '.svg'));
  }
};

export default createDefaultImage; 