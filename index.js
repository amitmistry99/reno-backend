import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import cookieParser from'cookie-parser'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
// import csrf from 'csurf'

//Routes
import authRoutes from './routes/authRoutes.js'
import productRoutes from './routes/productRoutes.js'
import reviewRoutes from './routes/reviewRoutes.js'
import couponRoutes from './routes/couponRoutes.js'
import cartRoutes from './routes/cartRoutes.js'
import userDashboard from './controllers/userDashboard.js'
import './cron/flagLowReviews.js'
import { errorHandler } from './middleware/errorHandler.js'

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // max 100 requests per IP
    message: { message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
})

// const csrfProtection = csrf({
//     cookie: {
//       httpOnly: true,
//       sameSite: 'Strict', // or 'Lax' depending on your use case
//       secure: process.env.NODE_ENV === 'production',
//     },
// })

const app = express()

const PORT = process.env.PORT || 3000

app.use(helmet())
app.use(compression())
app.use(cors({ credentials: true, origin: process.env.FRONTEND_URL }))
app.use(express.json())
app.use(cookieParser())
app.use(globalLimiter)
// app.use(csrfProtection)

app.use('/auth', authRoutes)

app.use('/products', productRoutes)

app.use('/products', couponRoutes)

app.use('/reviews', reviewRoutes)

app.use('/cart', cartRoutes)

app.get('/dashboard', userDashboard)

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Route not found' }))

//Set up pino for logging

// Global error handler
app.use(errorHandler)

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})