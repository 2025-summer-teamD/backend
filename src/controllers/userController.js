// 나중에 데이터베이스 로직을 위해 service를 가져올 수 있습니다.
// import * as UserService from '../services/user.service.js';

const getUserProfile = async (req, res) => {
    try {
      // requireAuth 미들웨어를 통과했기 때문에 req.auth는 항상 존재합니다.
      const { userId } = req.auth;
  
      console.log(`컨트롤러에서 받아온 Clerk User ID: ${userId}`);
  
      // 예를 들어, 이 userId를 사용하여 데이터베이스에서 사용자 정보를 조회합니다.
      // const user = await UserService.findUserByClerkId(userId);
      // if (!user) {
      //   return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
      // }
  
      res.status(200).json({
        message: '성공적으로 프로필 정보를 가져왔습니다.',
        clerk_id: userId,
        // dbUserData: user
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  };
  
  export { getUserProfile };