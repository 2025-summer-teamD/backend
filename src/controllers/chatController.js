import services from '../services/_index.js';
const { chatService } = services;
/**
 * 나의 채팅 목록을 조회하는 컨트롤러
 */
const getMyChats = async (req, res, next) => {
  try {
    // 미들웨어가 인증과 페이지네이션 정보를 준비해 줌
    const { userId } = req.auth;
    const pagination = req.pagination;

    // 서비스 호출
    const { chatList, totalElements, totalPages } = await chatService.getMyChatList(userId, pagination);
    
    // 서비스 결과가 비어있는 경우에 대한 처리 (선택적)
    if (chatList.length === 0 && pagination.page === 1) {
        return res.status(200).json({ 
            message: "채팅한 캐릭터가 없습니다.",
            data: [],
            page_info: {
                current_page: 1,
                total_pages: 0,
                total_elements: 0,
            }
        });
    }

    // 성공 응답 구성
    res.status(200).json({
      data: chatList,
      page_info: {
        current_page: pagination.page,
        total_pages: totalPages,
        total_elements: totalElements,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 내가 찜한(좋아요한) 캐릭터 삭제 (내 목록에서만 삭제)
 */
const deleteLikedCharacter = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const characterId = parseInt(req.params.characterId, 10);
    const deleted = await chatService.deleteLikedCharacter(userId, characterId);
    res.status(200).json({ message: '찜한 캐릭터가 내 목록에서 성공적으로 삭제되었습니다.', data: deleted });
  } catch (error) {
    next(error);
  }
};

const chatController = {
  getMyChats,
  deleteLikedCharacter,
};

export default chatController;