FROM node:20

# 앱 디렉토리 생성 및 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 앱 소스 복사
COPY . .

# 앱 실행 (필요에 따라 수정)
CMD ["npm", "start"]