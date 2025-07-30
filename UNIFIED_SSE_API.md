# 🎯 통합 SSE 채팅 API

## 📋 개요

이제 **하나의 API 엔드포인트**로 1대1 채팅과 그룹 채팅을 모두 처리할 수 있습니다!
백엔드에서 자동으로 채팅방 타입을 감지하고 적절한 처리 방식을 선택합니다.

## 🎛️ API 엔드포인트

```http
POST /api/chat/rooms/:roomId/send
```

### 🔧 요청 형식

```javascript
// 헤더
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer YOUR_CLERK_JWT_TOKEN'
}

// 바디
{
  "message": "안녕하세요!",
  "sender": "user_id_123",
  "userName": "사용자이름"
}
```

### 📤 응답 형식 (SSE)

모든 응답은 **Server-Sent Events (SSE)** 형식으로 전송됩니다:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Access-Control-Allow-Origin: *
```

#### 📨 이벤트 타입들

**1. 사용자 메시지 확인**
```json
{
  "type": "user_message",
  "content": "안녕하세요!",
  "sender": "사용자이름",
  "senderId": "user_id_123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**2. AI 응답 (1대1 채팅)**
```json
{
  "type": "text_chunk",
  "content": "안녕하세요! 오늘 기분이 어떠신가요?"
}
```

**3. AI 응답 (그룹 채팅)**
```json
{
  "type": "ai_response",
  "content": "안녕하세요! 반갑습니다!",
  "aiName": "AI캐릭터이름",
  "aiId": "persona_id_456",
  "personaId": 456,
  "timestamp": "2024-01-15T10:30:05.000Z"
}
```

**4. 친밀도 업데이트**
```json
{
  "type": "exp_updated",
  "personaId": 456,
  "personaName": "AI캐릭터이름",
  "newExp": 120,
  "newLevel": 2,
  "expIncrease": 10,
  "userId": "user_id_123"
}
```

**5. 완료 신호**
```json
{
  "type": "complete"
}
```

**6. 에러**
```json
{
  "type": "error",
  "message": "채팅방을 찾을 수 없습니다."
}
```

**7. 타임아웃 (그룹 채팅만)**
```json
{
  "type": "timeout",
  "message": "AI 응답 대기 시간이 초과되었습니다."
}
```

## 🔄 처리 방식

### 🤖 1대1 채팅
1. 채팅방 타입 자동 감지 (1대1)
2. 사용자 메시지 DB 저장
3. **직접 AI 응답 생성** (BullMQ 없음)
4. AI 응답 DB 저장
5. 친밀도 업데이트
6. 모든 결과를 SSE로 실시간 전송

### 👥 그룹 채팅
1. 채팅방 타입 자동 감지 (그룹)
2. 사용자 메시지 DB 저장
3. **BullMQ 워커에 작업 전달**
4. Redis Pub/Sub으로 워커 결과 대기
5. 워커의 AI 응답을 SSE로 실시간 전송

## 🎯 프론트엔드 사용법

### ✅ 단일 함수로 모든 채팅 처리

```javascript
/**
 * 통합 채팅 메시지 전송
 * - 1대1/그룹 구분 없이 사용 가능
 * - 자동으로 적절한 처리 방식 선택
 */
const sendMessage = async (roomId, message, userName, authToken) => {
  try {
    const response = await fetch(`/api/chat/rooms/${roomId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        message,
        sender: userId,
        userName
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response; // SSE 스트림 반환
    
  } catch (error) {
    console.error('메시지 전송 실패:', error);
    throw error;
  }
};

// 🎉 사용법 (타입 구분 불필요!)
const response = await sendMessage(roomId, "안녕하세요!", userName, authToken);
handleSSEStream(response);
```

### 📡 SSE 스트림 처리

```javascript
const handleSSEStream = (response) => {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  const readStream = async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              console.log('✅ SSE 스트림 완료');
              return;
            }
            
            try {
              const eventData = JSON.parse(data);
              handleSSEEvent(eventData);
            } catch (e) {
              // JSON 파싱 실패 무시
            }
          }
        }
      }
    } catch (error) {
      console.error('SSE 스트림 읽기 실패:', error);
    }
  };
  
  readStream();
};

const handleSSEEvent = (eventData) => {
  switch (eventData.type) {
    case 'user_message':
      console.log('📤 사용자 메시지:', eventData.content);
      // 사용자 메시지를 UI에 추가
      break;
      
    case 'text_chunk':
      console.log('🤖 AI 응답 (1대1):', eventData.content);
      // AI 응답을 UI에 추가
      break;
      
    case 'ai_response':
      console.log('🤖 AI 응답 (그룹):', eventData.content);
      // AI 응답을 UI에 추가
      break;
      
    case 'exp_updated':
      console.log('⭐ 친밀도 업데이트:', eventData);
      // 친밀도 UI 업데이트
      break;
      
    case 'complete':
      console.log('✅ 모든 AI 응답 완료');
      // 로딩 상태 해제
      break;
      
    case 'error':
      console.error('❌ 에러:', eventData.message);
      // 에러 메시지 표시
      break;
      
    case 'timeout':
      console.warn('⏰ 타임아웃:', eventData.message);
      // 타임아웃 메시지 표시
      break;
  }
};
```

## 🎊 장점

### 🚀 개발자 경험 개선
- **하나의 API**만 기억하면 됨
- **타입 구분 불필요** (자동 감지)
- **일관된 SSE 응답** 형식

### 🔧 백엔드 아키텍처
- **기존 로직 재사용** (중복 제거)
- **확장성** (새로운 채팅 타입 추가 용이)
- **유지보수성** 향상

### 📱 프론트엔드 단순화
- **복잡한 분기 로직 제거**
- **일관된 에러 처리**
- **코드 재사용성** 향상

## 🔄 마이그레이션

### 기존 API에서 새 API로 변경

```javascript
// ❌ 기존: 복잡한 분기 처리
if (isOneOnOne) {
  await fetch(`/api/chat/rooms/${roomId}/sse`, { ... });
} else {
  await fetch(`/api/chat/rooms/${roomId}/group-sse`, { ... });
}

// ✅ 새로운: 단일 API
await fetch(`/api/chat/rooms/${roomId}/send`, { ... });
```

## 📚 호환성

- **기존 API 유지**: `/sse`, `/group-sse` 엔드포인트는 그대로 유지
- **점진적 마이그레이션**: 새 API로 서서히 변경 가능
- **동일한 SSE 형식**: 기존 SSE 처리 코드 재사용 가능

---

이제 프론트엔드에서는 **하나의 API만 사용**하면 됩니다! 🎉 