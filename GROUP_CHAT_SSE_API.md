# 그룹 채팅 SSE API 가이드

이 문서는 그룹 채팅에서 SSE(Server-Sent Events) 방식을 사용한 실시간 AI 응답 API 사용법을 설명합니다.

## 🏗️ 시스템 아키텍처

```
프론트엔드 → HTTP POST → 백엔드 → BullMQ 큐 → Worker 처리 → Redis Pub/Sub → SSE 응답
```

### 기존 방식과의 차이점

| 구분 | 기존 (WebSocket) | 새로운 방식 (SSE) |
|------|-----------------|------------------|
| **1대1 채팅** | SSE 방식 | SSE 방식 (변경 없음) |
| **그룹 채팅** | WebSocket + BullMQ | HTTP/SSE + BullMQ |
| **프론트엔드 복잡도** | WebSocket 연결 관리 필요 | 단순한 HTTP 요청 |
| **백엔드 처리** | WebSocket 이벤트 | BullMQ + Redis Pub/Sub |
| **확장성** | 제한적 | 더 나은 확장성 |

## 📡 API 엔드포인트

### 그룹 채팅 SSE 스트리밍

```http
POST /api/chat/rooms/{roomId}/group-sse
Content-Type: application/json
Authorization: Bearer {token}

{
  "message": "안녕하세요!",
  "sender": "user_123",
  "userName": "김민정"
}
```

**응답 (SSE 스트림):**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type": "user_message", "content": "안녕하세요!", "sender": "김민정", "senderId": "user_123", "timestamp": "2025-01-18T10:30:00Z"}

data: {"type": "ai_response", "content": "안녕하세요! 반가워요!", "aiName": "AI캐릭터1", "aiId": "1", "personaId": 1, "timestamp": "2025-01-18T10:30:05Z"}

data: {"type": "ai_response", "content": "오늘 날씨가 좋네요!", "aiName": "AI캐릭터2", "aiId": "2", "personaId": 2, "timestamp": "2025-01-18T10:30:06Z"}

data: {"type": "exp_updated", "personaId": 1, "personaName": "AI캐릭터1", "newExp": 150, "newLevel": 2, "expIncrease": 5, "userId": "user_123"}

data: {"type": "exp_updated", "personaId": 2, "personaName": "AI캐릭터2", "newExp": 200, "newLevel": 3, "expIncrease": 5, "userId": "user_123"}

data: {"type": "complete", "message": "모든 AI 응답이 완료되었습니다.", "timestamp": "2025-01-18T10:30:10Z"}

data: [DONE]
```

## 🔧 프론트엔드 구현

### React 컴포넌트 예시

```jsx
import React, { useState, useEffect, useRef } from 'react';

const GroupChatSSE = ({ roomId, userId, userName, authToken }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [friendships, setFriendships] = useState({});
  const eventSourceRef = useRef(null);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const messageData = {
      message: inputMessage,
      sender: userId,
      userName: userName
    };

    setIsLoading(true);
    
    try {
      // 사용자 메시지를 즉시 화면에 표시
      const userMessage = {
        id: Date.now(),
        type: 'user_message',
        content: inputMessage,
        sender: userName,
        senderId: userId,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');

      // SSE 요청 시작
      const response = await fetch(`/api/chat/rooms/${roomId}/group-sse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // SSE 스트림 처리
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6); // 'data: ' 제거
                
                if (data === '[DONE]') {
                  setIsLoading(false);
                  return;
                }

                try {
                  const messageData = JSON.parse(data);
                  handleSSEMessage(messageData);
                } catch (e) {
                  console.warn('JSON 파싱 실패:', data);
                }
              }
            }
          }
        } catch (error) {
          console.error('스트림 처리 오류:', error);
          setIsLoading(false);
        }
      };

      await processStream();

    } catch (error) {
      console.error('메시지 전송 실패:', error);
      setIsLoading(false);
      alert('메시지 전송에 실패했습니다.');
    }
  };

  const handleSSEMessage = (data) => {
    switch (data.type) {
      case 'user_message':
        // 사용자 메시지는 이미 화면에 표시했으므로 무시
        break;

      case 'ai_response':
        const aiMessage = {
          id: `ai-${data.personaId}-${Date.now()}`,
          type: 'ai_response',
          content: data.content,
          aiName: data.aiName,
          aiId: data.aiId,
          personaId: data.personaId,
          timestamp: data.timestamp,
          senderType: 'ai'
        };
        setMessages(prev => [...prev, aiMessage]);
        break;

      case 'exp_updated':
        setFriendships(prev => ({
          ...prev,
          [data.personaId]: {
            ...prev[data.personaId],
            exp: data.newExp,
            friendship: data.newLevel,
            name: data.personaName
          }
        }));
        
        // 친밀도 증가 알림 표시
        showExpNotification(data);
        break;

      case 'complete':
        console.log('모든 AI 응답 완료:', data.message);
        setIsLoading(false);
        break;

      case 'timeout':
        console.warn('AI 응답 타임아웃:', data.message);
        setIsLoading(false);
        break;

      case 'error':
        console.error('AI 응답 에러:', data.message);
        setIsLoading(false);
        break;

      default:
        console.log('알 수 없는 메시지 타입:', data);
    }
  };

  const showExpNotification = (data) => {
    // 친밀도 증가 알림 UI 구현
    const notification = document.createElement('div');
    notification.className = 'exp-notification';
    notification.innerHTML = `
      <div class="exp-content">
        <strong>${data.personaName}</strong>과의 친밀도가 증가했습니다!
        <br>+${data.expIncrease} EXP (Lv.${data.newLevel})
      </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="group-chat-container">
      {/* 친밀도 표시 */}
      <div className="friendship-bar">
        {Object.values(friendships).map(friendship => (
          <div key={friendship.personaId} className="friendship-item">
            <div className="friendship-name">{friendship.name}</div>
            <div className="friendship-level">Lv.{friendship.friendship}</div>
            <div className="friendship-exp-bar">
              <div 
                className="friendship-exp-fill" 
                style={{ width: `${(friendship.exp % 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 메시지 목록 */}
      <div className="messages-container">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.senderType || 'user'}`}>
            {message.type === 'ai_response' && (
              <div className="ai-info">
                <span className="ai-name">{message.aiName}</span>
              </div>
            )}
            <div className="message-content">{message.content}</div>
            <div className="message-time">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="loading-indicator">
            <div className="loading-dots">AI가 응답을 생성하고 있습니다...</div>
          </div>
        )}
      </div>

      {/* 메시지 입력 */}
      <div className="message-input">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="메시지를 입력하세요..."
          disabled={isLoading}
          rows={2}
        />
        <button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()}>
          {isLoading ? '전송 중...' : '전송'}
        </button>
      </div>
    </div>
  );
};

export default GroupChatSSE;
```

### Vue.js 컴포넌트 예시

```vue
<template>
  <div class="group-chat-container">
    <!-- 친밀도 표시 -->
    <div class="friendship-bar">
      <div v-for="friendship in Object.values(friendships)" :key="friendship.personaId" class="friendship-item">
        <div class="friendship-name">{{ friendship.name }}</div>
        <div class="friendship-level">Lv.{{ friendship.friendship }}</div>
        <div class="friendship-exp-bar">
          <div class="friendship-exp-fill" :style="{ width: `${(friendship.exp % 100)}%` }"></div>
        </div>
      </div>
    </div>

    <!-- 메시지 목록 -->
    <div class="messages-container">
      <div v-for="message in messages" :key="message.id" :class="`message ${message.senderType || 'user'}`">
        <div v-if="message.type === 'ai_response'" class="ai-info">
          <span class="ai-name">{{ message.aiName }}</span>
        </div>
        <div class="message-content">{{ message.content }}</div>
        <div class="message-time">{{ formatTime(message.timestamp) }}</div>
      </div>
      
      <div v-if="isLoading" class="loading-indicator">
        <div class="loading-dots">AI가 응답을 생성하고 있습니다...</div>
      </div>
    </div>

    <!-- 메시지 입력 -->
    <div class="message-input">
      <textarea
        v-model="inputMessage"
        @keypress="handleKeyPress"
        placeholder="메시지를 입력하세요..."
        :disabled="isLoading"
        rows="2"
      ></textarea>
      <button @click="sendMessage" :disabled="isLoading || !inputMessage.trim()">
        {{ isLoading ? '전송 중...' : '전송' }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GroupChatSSE',
  props: {
    roomId: { type: String, required: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    authToken: { type: String, required: true }
  },
  data() {
    return {
      messages: [],
      inputMessage: '',
      isLoading: false,
      friendships: {}
    };
  },
  methods: {
    async sendMessage() {
      if (!this.inputMessage.trim() || this.isLoading) return;

      const messageData = {
        message: this.inputMessage,
        sender: this.userId,
        userName: this.userName
      };

      this.isLoading = true;
      
      try {
        // 사용자 메시지를 즉시 화면에 표시
        const userMessage = {
          id: Date.now(),
          type: 'user_message',
          content: this.inputMessage,
          sender: this.userName,
          senderId: this.userId,
          timestamp: new Date().toISOString()
        };
        this.messages.push(userMessage);
        this.inputMessage = '';

        // SSE 요청 시작
        const response = await fetch(`/api/chat/rooms/${this.roomId}/group-sse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
          },
          body: JSON.stringify(messageData)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // SSE 스트림 처리
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  if (data === '[DONE]') {
                    this.isLoading = false;
                    return;
                  }

                  try {
                    const messageData = JSON.parse(data);
                    this.handleSSEMessage(messageData);
                  } catch (e) {
                    console.warn('JSON 파싱 실패:', data);
                  }
                }
              }
            }
          } catch (error) {
            console.error('스트림 처리 오류:', error);
            this.isLoading = false;
          }
        };

        await processStream();

      } catch (error) {
        console.error('메시지 전송 실패:', error);
        this.isLoading = false;
        alert('메시지 전송에 실패했습니다.');
      }
    },

    handleSSEMessage(data) {
      switch (data.type) {
        case 'user_message':
          // 사용자 메시지는 이미 화면에 표시했으므로 무시
          break;

        case 'ai_response':
          const aiMessage = {
            id: `ai-${data.personaId}-${Date.now()}`,
            type: 'ai_response',
            content: data.content,
            aiName: data.aiName,
            aiId: data.aiId,
            personaId: data.personaId,
            timestamp: data.timestamp,
            senderType: 'ai'
          };
          this.messages.push(aiMessage);
          break;

        case 'exp_updated':
          this.$set(this.friendships, data.personaId, {
            ...this.friendships[data.personaId],
            exp: data.newExp,
            friendship: data.newLevel,
            name: data.personaName
          });
          this.showExpNotification(data);
          break;

        case 'complete':
          console.log('모든 AI 응답 완료:', data.message);
          this.isLoading = false;
          break;

        case 'timeout':
        case 'error':
          console.error('AI 응답 오류:', data.message);
          this.isLoading = false;
          break;
      }
    },

    showExpNotification(data) {
      // 친밀도 증가 알림 구현
      this.$toast(`${data.personaName}과의 친밀도가 증가했습니다! +${data.expIncrease} EXP (Lv.${data.newLevel})`);
    },

    handleKeyPress(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString();
    }
  }
};
</script>
```

## 🔄 기존 코드 마이그레이션

### 기존 WebSocket 방식에서 SSE 방식으로 변경

```javascript
// 기존: WebSocket 그룹 채팅
const sendMessageWebSocket = (roomId, message, userName) => {
  socket.emit('sendMessage', {
    roomId,
    message,
    senderType: 'user',
    senderId: userId,
    userName
  });
};

// 변경: SSE 그룹 채팅
const sendMessageSSE = async (roomId, message, userName) => {
  const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/group-sse`, {
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

  // SSE 스트림 처리...
};
```

## 🚨 주의사항

1. **브라우저 지원**: SSE는 모든 모던 브라우저에서 지원되지만, Internet Explorer에서는 polyfill이 필요할 수 있습니다.

2. **연결 제한**: 브라우저는 같은 도메인에 대해 최대 6개의 동시 HTTP 연결을 허용합니다. SSE도 이 제한에 포함됩니다.

3. **타임아웃**: 기본적으로 30초 타임아웃이 설정되어 있습니다. 필요에 따라 조정할 수 있습니다.

4. **에러 처리**: 네트워크 오류나 서버 오류에 대한 적절한 처리가 필요합니다.

5. **메모리 관리**: 컴포넌트 언마운트 시 SSE 연결을 적절히 정리해야 합니다.

## 📈 성능 고려사항

1. **BullMQ 워커 수**: `AI_WORKER_CONCURRENCY` 환경변수로 동시 처리 수 조절
2. **Redis 최적화**: Redis 메모리 사용량 모니터링
3. **응답 캐싱**: AI 응답 캐시 활용으로 중복 요청 최적화
4. **타임아웃 조정**: 필요에 따라 SSE 타임아웃 시간 조정

이 새로운 방식을 통해 그룹 채팅도 HTTP/SSE 기반으로 더 간단하고 확장 가능한 구조로 변경되었습니다. 