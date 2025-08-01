FROM node:20

# 앱 디렉토리 생성 및 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 환경 변수 설정
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

# 의존성 설치 (보안 강화 + 안정적인 방법)
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# Prisma 클라이언트 생성을 위해 prisma 스키마 먼저 복사
COPY . .

# Prisma 클라이언트 생성
RUN npx prisma generate

# 실제 서비스에 필요한 소스 복사

# 포트 노출
EXPOSE 3001

# 앱 실행
CMD ["npm", "start"]
