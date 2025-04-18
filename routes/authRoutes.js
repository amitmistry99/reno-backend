import { Router } from "express"
import { register, verifyRegisterOTP, login, verifyLoginOTP, refresh, logout, checkAuth } from '../controllers/authController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
// import { otpLimiter } from "../utils/rateLimit.js"

const router = Router()

router.get('/check-auth', authMiddleware, checkAuth)
router.post('/register', register)
router.post('/verify-register', verifyRegisterOTP)
router.post('/login', login)
router.post('/verify-login', verifyLoginOTP)
router.post('/logout', logout);
router.post('/refresh', refresh);

export default router