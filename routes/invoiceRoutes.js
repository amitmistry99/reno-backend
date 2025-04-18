import express from 'express'
import {getUserInvoices, generateInvoice, emailInvoice, generateBulkInvoices } from '../controllers/invoiceController.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = express.Router()

// Protect all routes
router.use(authMiddleware)

// GET /api/v1/invoices - Get user's invoices
router.get('/', getUserInvoices)

// GET /api/v1/invoices/:orderId - Download invoice PDF
router.get('/:orderId', generateInvoice)

// POST /api/v1/invoices/:orderId/email - Email invoice
router.post('/:orderId/email', emailInvoice)

// Admin-only routes
router.use(authMiddleware)

// POST /api/v1/invoices/bulk - Generate bulk invoices (Admin)
router.post('/bulk', generateBulkInvoices)

module.exports = router