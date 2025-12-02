const User = require('./User');

module.exports = {
  /**
   * Fetch a normalized profile by user id.
   */
  async getById(id) {
    if (!id) return null;
    const row = await User.findById(id);
    return row ? User.normalizeUser(row) : null;
  },

  /**
   * Update profile fields (username, email, contact, address).
   */
  async update(id, { username, email, contact, address }) {
    if (!id) return;
    return User.updateProfile(id, { username, email, contact, address });
  },

  /**
   * Change password after verifying the current password.
   */
  async changePassword(id, currentPassword, newPassword) {
    if (!id || !newPassword) {
      throw new Error('Invalid password change request');
    }
    const user = await User.findById(id);
    if (!user || !User.verifyPassword(currentPassword, user.password)) {
      throw new Error('Current password is incorrect');
    }
    await User.setPassword(id, newPassword);
    return true;
  }
};
