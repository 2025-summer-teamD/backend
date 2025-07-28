import axios from 'axios';

/**
 * RunwayML API를 사용하여 비디오를 생성합니다.
 * 이미지에서 비디오 생성만 지원합니다.
 * @param {string} prompt - 비디오 생성 프롬프트
 * @param {string} imageUrl - 시작 이미지 URL (필수)
 * @returns {Promise<object>} 생성된 비디오 정보
 */
async function generateVideo(prompt, imageUrl = null) {
  try {
    console.log('🎬 RunwayML API 호출 시작...');
    console.log('🔑 API 키 상태:', process.env.RUNWAYML_API_KEY ? '설정됨' : '설정되지 않음');
    console.log('🔑 API 키 값:', process.env.RUNWAYML_API_KEY ? process.env.RUNWAYML_API_KEY.substring(0, 10) + '...' : '없음');
    
    // API 키 확인
    if (!process.env.RUNWAYML_API_KEY) {
      throw new Error('RUNWAYML_API_KEY 환경변수가 설정되지 않았습니다. .env 파일에 RUNWAYML_API_KEY를 추가해주세요.');
    }
    
    // 이미지 URL이 필수
    if (!imageUrl) {
      throw new Error('RunwayML API는 이미지 URL이 필수입니다. imageUrl을 제공해주세요.');
    }
    
    // 먼저 API 키 유효성 확인
    console.log('🔍 API 키 유효성 먼저 확인...');
    const testUrl = 'https://api.runwayml.com/v1/user';
    
    // Headers 객체 사용
    const testHeaders = new Headers();
    testHeaders.append('Authorization', `Bearer ${process.env.RUNWAYML_API_KEY}`);
    testHeaders.append('X-Runway-Version', '2024-11-06');
    
    console.log('🔍 테스트 헤더:', Object.fromEntries(testHeaders.entries()));
    
    const testResponse = await fetch(testUrl, {
      method: 'GET',
      headers: testHeaders
    });
    
    console.log('🔍 API 키 테스트 응답:', testResponse.status, testResponse.statusText);
    
    if (!testResponse.ok) {
      const testErrorData = await testResponse.text();
      console.error('❌ API 키 테스트 실패:', testErrorData);
      throw new Error(`API 키 유효성 확인 실패: ${testResponse.status} ${testResponse.statusText} - ${testErrorData}`);
    }
    
    const testData = await testResponse.json();
    console.log('✅ API 키 유효성 확인 성공!');
    console.log('💰 사용 가능한 크레딧:', testData.credits);
    
    // RunwayML API 엔드포인트 (실제 문서 기반)
    const apiUrl = 'https://api.runwayml.com/v1/image_to_video';
    
    const requestData = {
      promptImage: imageUrl,
      model: "gen3a_turbo",
      promptText: prompt,
      duration: 5,
      ratio: "1280:720",
      seed: Math.floor(Math.random() * 4294967295)
    };

    console.log('📤 요청 데이터:', JSON.stringify(requestData, null, 2));
    console.log('🌐 API URL:', apiUrl);
    console.log('⏱️ 타임아웃: 5분');

    // Headers 객체 사용
    const headers = new Headers();
    headers.append('Authorization', `Bearer ${process.env.RUNWAYML_API_KEY}`);
    headers.append('Content-Type', 'application/json');
    headers.append('X-Runway-Version', '2024-11-06');
    
    console.log('📤 요청 헤더:', Object.fromEntries(headers.entries()));
    console.log('🔍 헤더 키 확인:', Array.from(headers.keys()));
    console.log('🔍 X-Runway-Version 값:', headers.get('X-Runway-Version'));
    console.log('🔍 API 키 길이:', process.env.RUNWAYML_API_KEY?.length);
    
    // fetch를 사용하여 API 호출
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestData)
    });

    console.log('📊 응답 상태:', response.status);
    console.log('📊 응답 헤더:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ API 응답 오류:');
      console.error('   상태:', response.status);
      console.error('   상태 텍스트:', response.statusText);
      console.error('   응답 데이터:', errorData);
      
      if (response.status === 400) {
        throw new Error(`RunwayML API 요청 형식 오류: ${errorData}`);
      } else if (response.status === 401) {
        throw new Error('RunwayML API 인증 실패. API 키를 확인해주세요.');
      } else if (response.status === 404) {
        throw new Error('RunwayML API 엔드포인트를 찾을 수 없습니다.');
      } else if (response.status === 429) {
        throw new Error('RunwayML API 할당량 초과. 잠시 후 다시 시도해주세요.');
      } else if (response.status === 402) {
        throw new Error('RunwayML API 크레딧 부족. 계정에 크레딧을 추가해주세요.');
      }
    }

    const responseData = await response.json();
    console.log('✅ 비디오 생성 요청 성공!');
    console.log('🆔 작업 ID:', responseData.id);

    // 비디오 완료까지 대기
    const jobId = responseData.id;
    const statusUrl = `https://api.runwayml.com/v1/tasks/${jobId}`;
    
    let attempts = 0;
    const maxAttempts = 60; // 최대 5분 대기 (5초마다)
    
    while (attempts < maxAttempts) {
      console.log(`⏳ 비디오 상태 확인 중... (${attempts + 1}/${maxAttempts})`);
      
      // 상태 확인용 fetch
      const statusHeaders = new Headers();
      statusHeaders.append('Authorization', `Bearer ${process.env.RUNWAYML_API_KEY}`);
      statusHeaders.append('X-Runway-Version', '2024-11-06');
      
      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        headers: statusHeaders
      });
      
      if (!statusResponse.ok) {
        throw new Error(`상태 확인 실패: ${statusResponse.status} ${statusResponse.statusText}`);
      }
      
      const statusData = await statusResponse.json();
      const status = statusData.status;
      console.log('📊 현재 상태:', status);
      
      if (status === 'completed') {
        console.log('✅ 비디오 생성 완료!');
        
        const videoUrl = statusData.output.video_url;
        if (!videoUrl) {
          throw new Error('RunwayML API에서 비디오 URL을 받지 못했습니다');
        }
        
        console.log('🔗 비디오 URL:', videoUrl);
        
        // 비디오 URL에서 데이터 가져오기
        console.log('📥 비디오 다운로드 중...');
        const videoResponse = await fetch(videoUrl);
        
        if (!videoResponse.ok) {
          throw new Error('비디오 다운로드 실패');
        }
        
        const videoBuffer = await videoResponse.arrayBuffer();
        const base64Data = Buffer.from(videoBuffer).toString('base64');
        const dataUrl = `data:video/mp4;base64,${base64Data}`;
        
        console.log('✅ 비디오 다운로드 완료!');
        console.log('📊 비디오 크기:', videoBuffer.byteLength, 'bytes');
        
        return {
          videoUrl: dataUrl,
          base64: base64Data,
          originalUrl: videoUrl
        };
        
      } else if (status === 'failed') {
        console.error('❌ 비디오 생성 실패:', statusData.error);
        throw new Error(`RunwayML API 비디오 생성 실패: ${statusData.error}`);
      } else if (status === 'canceled') {
        throw new Error('RunwayML API 비디오 생성이 취소되었습니다');
      }
      
      // 5초 대기
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
    
    throw new Error('RunwayML API 비디오 생성 시간 초과');

  } catch (error) {
    console.error('❌ RunwayML 비디오 생성 실패:');
    console.error('   에러 타입:', error.constructor.name);
    console.error('   에러 메시지:', error.message);
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('   네트워크 오류 - fetch 실패');
    }
    
    throw new Error('RunwayML API를 통해 비디오를 생성하는 데 실패했습니다.');
  }
}

/**
 * RunwayML API 연결을 테스트합니다.
 * @returns {Promise<boolean>} 연결 성공 여부
 */
async function testConnection() {
  try {
    console.log('🧪 RunwayML API 연결 테스트 중...');
    console.log('🔑 API 키 상태:', process.env.RUNWAYML_API_KEY ? '설정됨' : '설정되지 않음');
    
    if (!process.env.RUNWAYML_API_KEY) {
      throw new Error('RUNWAYML_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    
    // API 키 유효성 검사
    const testUrl = 'https://api.runwayml.com/v1/user';
    console.log('🔍 API 키 유효성 확인 중...');
    
    const testHeaders = new Headers();
    testHeaders.append('Authorization', `Bearer ${process.env.RUNWAYML_API_KEY}`);
    testHeaders.append('X-Runway-Version', '2024-11-06');
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: testHeaders
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API 키 유효성 확인 실패: ${response.status} ${response.statusText} - ${errorData}`);
    }
    
    const responseData = await response.json();
    console.log('✅ API 키 유효성 확인 성공!');
    console.log('📊 응답 상태:', response.status);
    
    if (responseData && responseData.credits) {
      console.log('💰 사용 가능한 크레딧:', responseData.credits);
    }
    
    return true;
  } catch (error) {
    console.error('❌ RunwayML API 연결 테스트 실패:');
    console.error('   에러:', error.message);
    if (error.response) {
      console.error('   HTTP 상태:', error.response.status);
      console.error('   응답 데이터:', error.response.data);
    }
    return false;
  }
}

export default {
  generateVideo,
  testConnection
}; 