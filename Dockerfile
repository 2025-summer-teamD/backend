FROM node:20

# 앱 디렉토리 생성 및 설정
WORKDIR /app

# package.json과 package-lock.json만 복사
COPY package*.json ./

# production 환경에서는 devDependencies를 설치하지 않음
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
RUN if [ "$NODE_ENV" = "production" ]; then npm install --omit=dev; else npm install; fi

# 실제 서비스에 필요한 소스만 복사
COPY src ./src
COPY prisma ./prisma
RUN npx prisma generate

RUN npx prisma generate

# 앱 실행 (필요에 따라 수정)
CMD ["npm", "start"]