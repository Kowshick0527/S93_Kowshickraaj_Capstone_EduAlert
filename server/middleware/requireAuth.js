const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requireAuth(req, res, next) {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Session expired. Please sign in again." });
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    return res.status(401).json({ message: "Account not found" });
  }

  req.authUser = user;
  next();
}

module.exports = requireAuth;