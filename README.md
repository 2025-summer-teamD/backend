# backend

<img width="676" height="366" alt="Screenshot 2025-07-14 at 23 40 49" src="https://github.com/user-attachments/assets/b130fdac-5632-4c4d-9d04-91eeeec4140c" />

## Node.js/Express 프로젝트 초기 세팅 및 실행법

### 1. Node.js 버전 관리 (nvm 사용)

#### MacOS/Linux
```bash
nvm install 20
nvm use 20
```

#### Windows (nvm-windows)
- [nvm-windows 설치](https://github.com/coreybutler/nvm-windows/releases)
- 설치 후 명령 프롬프트에서:
```cmd
nvm install 20
nvm use 20
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 서버 실행
```bash
npm start
```

### 4. 서버 접속
- 브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

---

#### 참고
- `.nvmrc` 파일이 있으니 `nvm use`만 입력해도 자동으로 20버전 사용
- 윈도우는 nvm-windows를 사용해야 하며, 명령어는 동일
- 추가 패키지 설치 시 `npm install 패키지명` 사용
