const updateUserAvatar = (userId, avatarUrl) => {
  return {
    userId,
    avatarUrl,
    updatedAt: new Date()
  };
};

const getUserInfo = (userId) => {
  return {
    userId,
    username: `User${Math.floor(Math.random() * 1000)}`,
    avatar: null,
    joinedAt: new Date()
  };
};

module.exports = {
  updateUserAvatar,
  getUserInfo
};
