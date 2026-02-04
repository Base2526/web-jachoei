import jwt from "jsonwebtoken";
export const JWT_SECRET = process.env.JWT_SECRET || "changeme_secret";

export function signUserToken(user: any) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}
