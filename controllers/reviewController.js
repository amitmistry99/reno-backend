import { prisma } from "../config/prisma.js"

// CREATE REVIEW
export const createReview = async (req, res) => {

  const { productId, rating, review, verifiedPurchase } = req.body

  const userId = req.user.userId

  try {

    const userReview = await prisma.review.create({
      data: {
        rating,
        review,
        verifiedPurchase,
        user: {
          connect: { id: userId },
        },
        product: {
          connect: { id: productId },
        },
      },
    })
    res.status(201).json(userReview)
    console.log(userReview)
    
  } catch (err) {
    res.status(400).json({ error: 'Could not create review', detail: err.message })
  }
}

// GET REVIEWS BY PRODUCT
export const getProductReviews = async (req, res) => {

  const { productId } = req.params
  console.log(productId)

  try {
    const reviews = await prisma.review.findMany({
      where: { productId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(reviews)
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch reviews' })
  }
}

// GET REVIEWS BY USER
export const getUserReviews = async (req, res) => {

  const userId = req.user.userId

  try {
    const reviews = await prisma.review.findMany({
      where: { userId },
      include: { product: true },
    })
    res.json(reviews)
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch user reviews' })
  }
}

// UPDATE REVIEW
export const updateReview = async (req, res) => {
  const { id } = req.params
  const { rating, review } = req.body
  const userId = req.user.userId

  try {
    const existing = await prisma.review.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId)
      return res.status(403).json({ error: 'Not allowed' })

    const updated = await prisma.review.update({
      where: { id },
      data: { rating, review },
    })

    res.json(updated)
  } catch (err) {
    res.status(400).json({ error: 'Update failed' })
  }
}

// DELETE REVIEW
export const deleteReview = async (req, res) => {
  const { id } = req.params
  const userId = req.user.userId
  const userRole = req.user.role

  try {
    const existing = await prisma.review.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId && userRole !== 'ADMIN')
      return res.status(403).json({ error: 'Not allowed' })

    await prisma.review.delete({ where: { id } });
    res.sendStatus(204);
  } catch (err) {
    res.status(400).json({ error: 'Delete failed' });
  }
}

// GET AVERAGE RATING
export const getProductRatingStats = async (req, res) => {
  
  const { productId } = req.params;

  try {
    const [avg, count] = await prisma.$transaction([
      prisma.review.aggregate({
        where: { productId },
        _avg: { rating: true },
      }),
      prisma.review.count({ where: { productId } }),
    ]);

    res.json({
      average: avg._avg.rating || 0,
      total: count,
    });
  } catch (err) {
    res.status(500).json({ error: 'Rating summary failed' })
  }
}

//GET Flagged Reviews
export const getFlaggedReviews = async (req, res) => {
  try {
    const flaggedReviews = await prisma.review.findMany({
      where: {
        isFlagged: true,
      },
      include: {
        product: true, // Include product info in review
        user: true,    // Include user info in review
      },
    });

    res.status(200).json(flaggedReviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve flagged reviews', detail: error.message });
  }
}