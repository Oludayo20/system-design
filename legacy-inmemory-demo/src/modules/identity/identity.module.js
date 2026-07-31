/**
 * Identity module - doc.md: "Login, Registration, JWT, Roles, Permissions."
 * Owns the `users` table. No other module is allowed to touch it directly.
 */
export function createIdentityModule({ db }) {
  let nextUserId = 1;

  async function register({ email, password }) {
    const user = {
      id: nextUserId++,
      email,
      passwordHash: `hashed(${password})`,
      roles: ['customer'],
    };
    await db.insert('users', user);
    console.log(`[Identity] registered user #${user.id} (${email})`);
    return { id: user.id, email: user.email, roles: user.roles };
  }

  async function login({ email, password }) {
    const user = await db.find('users', (u) => u.email === email);
    if (!user || user.passwordHash !== `hashed(${password})`) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      throw err;
    }
    // Stand-in for a signed JWT.
    const token = `jwt.${Buffer.from(`user:${user.id}`).toString('base64url')}.signature`;
    console.log(`[Identity] issued token for user #${user.id}`);
    return { token, user: { id: user.id, email: user.email, roles: user.roles } };
  }

  return { register, login };
}
