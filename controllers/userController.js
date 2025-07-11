const userModel = require('../models/userModel');

exports.getUsers = async (req, res) => {
  try {
    const users = await userModel.getUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
