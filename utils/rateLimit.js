import rateLimit from 'express-rate-limit'

// Allow 5 OTP requests per IP every 15 minutes
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many OTP requests from this IP, please try again later.',
  },
})