import jwt from 'jsonwebtoken'

export const authMiddleware = (req, res, next) => {
  const token = req.cookies.token

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // We don't check `decoded.status` because status can change after token issuance.
    // Use DB lookups if you need dynamic validation.

    req.user = decoded
    console.log(req.user);
    
    next()
  } catch (err) {
    console.error('[AUTH ERROR]', err)
    return res.status(403).json({ message: 'Invalid or expired token' })
  }
}
