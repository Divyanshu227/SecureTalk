import jwt from "jsonwebtoken";
// explanation: This middleware function checks for a JWT token in the Authorization header of incoming requests. If a valid token is found, it decodes the token to extract user information and attaches it to the request object for use in subsequent handlers. If no token is found or if the token is invalid, it responds with a 401 Unauthorized status.
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token" });

  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;
  next();
};

export default authMiddleware;
