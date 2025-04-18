import { prisma } from '../config/prisma.js'
import { generateOTP, sendOTP } from '../services/otpService.js'
import { generateAccessToken, generateRefreshToken } from '../utils/tokenUtils.js'

const COOLDOWN = 30 * 1000
const MAX_ATTEMPTS = 3

export const register = async (req, res) => {
  const { phone } = req.body

  const otp = generateOTP()
  const now = new Date()
  const otpExpiry = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

  try {

    let user = await prisma.user.findUnique({ where: { phone } })

    if (user) {
      if (user.status === 'VERIFIED') {
        return res.status(400).json({ success: false, message: 'User already exists' });
      }

      // Cooldown logic
      const lastRequested = new Date(user.otpRequestedAt);
      if (now - lastRequested < COOLDOWN) {
        return res.status(429).json({ success: false, message: 'Please wait before requesting another OTP' });
      }

      // Update existing unverified user
      await prisma.user.update({
        where: { phone },
        data: { otp, otpExpiry, otpRequestedAt: now, otpAttempts: 0 },
      })

    } else {
      // Create new user
      await prisma.user.create({
        data: {
          phone,
          otp,
          otpExpiry,
          otpRequestedAt: now,
          otpAttempts: 0,
          status: 'PENDING',
          role: 'USER',
        },
      })
    }

    await sendOTP(phone, otp);
    res.status(200).json({ success: true, message: 'OTP sent' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Could not register user' });
  }
}


export const verifyRegisterOTP = async (req, res) => {

  const { phone, otp } = req.body

  try {

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone and OTP are required' });
    }
  
    const user = await prisma.user.findUnique({ where: { phone } })

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if account is blocked
    if (user.status === 'BLOCKED') {
      return res.status(403).json({ message: 'Account is blocked. Please contact support.' })
    }

    const now = new Date();

    const isOTPExpired = user.otpExpiry && user.otpExpiry < now;
    const isOTPInvalid = user.otp !== otp;

    if (isOTPInvalid || isOTPExpired) {
      const updatedUser = await prisma.user.update({
        where: { phone },
        data: { otpAttempts: { increment: 1 } },
    });

    if (updatedUser.otpAttempts >= MAX_ATTEMPTS) {
      await prisma.user.update({
        where: { phone },
        data: { status: 'BLOCKED' },
      })

      return res.status(403).json({ message: 'Account temporarily blocked due to too many failed attempts' })
    }

    return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // OTP is valid
    await prisma.user.update({
      where: { phone },
      data: {
        status: 'VERIFIED',
        otp: null,
        otpExpiry: null,
        otpAttempts: 0, // Reset attempts
      },
    });

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Set cookies (secure + sameSite for production)
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    })

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({ message: 'Registered successfully', token: accessToken })

  } catch {
    console.error('[VERIFY REGISTER OTP ERROR]', error);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

export const login = async (req, res) => {

  const { phone } = req.body

    // Basic input validation
    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }

  const user = await prisma.user.findUnique({ where: { phone } })

  if (!user || user.status !== 'VERIFIED') return res.status(403).json({ message: 'Inactive or blocked user' })

  const now = new Date()
  const COOLDOWN = 60 * 1000; // 1 minute cooldown
  const otpExpiry = new Date(now.getTime() + 5 * 60 * 1000)

  if (user.otpRequestedAt && now - user.otpRequestedAt < COOLDOWN) {
      return res.status(429).json({ success: false, message: 'Please wait before requesting another OTP' })
  }
    
  const otp = generateOTP()

  await prisma.user.update({ where: { phone }, data: { otp, otpExpiry, otpAttempts: 0, otpRequestedAt: now } })

  await sendOTP(phone, otp)
  res.status(200).json({success: true, message: 'OTP sent for login' })
}


export const verifyLoginOTP = async (req, res) => {

  const { phone, otp } = req.body;

  try {
    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone and OTP are required' });
    }

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.status === 'BLOCKED') {
      return res.status(403).json({ message: 'Account is blocked. Please contact support.' });
    }

    const now = new Date();
    const isOTPExpired = !user.otpExpiry || user.otpExpiry < now;
    const isOTPInvalid = user.otp !== otp;

    if (isOTPInvalid || isOTPExpired) {
      const updatedUser = await prisma.user.update({
        where: { phone },
        data: { otpAttempts: { increment: 1 } },
      });

      // Optional: block user after N failed login attempts
      const MAX_LOGIN_ATTEMPTS = 5;
      if (updatedUser.otpAttempts >= MAX_LOGIN_ATTEMPTS) {
        await prisma.user.update({
          where: { phone },
          data: { status: 'BLOCKED' },
        });

        return res.status(403).json({ message: 'Account blocked due to repeated failed attempts' });
      }

      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // OTP is valid
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    await prisma.user.update({
      where: { phone },
      data: {
        otp: null,
        otpExpiry: null,
        otpAttempts: 0, // Reset attempts
        refreshToken,
      },
    });

    // Set cookies
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({ message: 'Login successful', token: accessToken });

  } catch (error) {
    console.error('[VERIFY LOGIN OTP ERROR]', error);
    return res.status(500).json({ message: 'Something went wrong. Please try again later.' });
  }
}

export const refresh = async (req, res) => {

  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(403).json({ message: 'No refresh token provided' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.status === 'BLOCKED') {
      return res.status(403).json({ message: 'User not found or blocked' });
    }

    // Validate that the token matches what's stored
    if (user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Optionally: rotate refresh token
    const newAccessToken = generateAccessToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.cookie('token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    return res.status(200).json({ message: 'Access token refreshed', token: newAccessToken })

  } catch (error) {
    console.error('[REFRESH TOKEN ERROR]', error);
    return res.status(401).json({ message: 'Invalid or expired refresh token' })
  }
}

export const logout = async (req, res) => {

  const { refreshToken } = req.cookies;

  try {
    // Optional: Invalidate the refresh token in DB if it exists
    if (refreshToken) {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
      await prisma.user.update({
        where: { id: decoded.userId },
        data: { refreshToken: null },
      });
    }
  } catch (err) {
    console.warn('[LOGOUT WARNING] Refresh token invalid or already cleared');
  }

  // Clear cookies with same options as when they were set
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
  });

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
  })

  res.status(200).json({ message: 'Logged out successfully' })
}


export const checkAuth = async (req, res) => {

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        // Add any other public-safe fields
      },
    })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.status(200).json({ user })

  } catch (error) {
    console.error('[GET ME ERROR]', error);
    res.status(500).json({ message: 'Something went wrong' })
  }
}