export const getRecommendedProducts = async (req, res, next) => {
    try {
      const userId = req.user.id
  
      // 1. Get most viewed categories by user
      const recentViews = await prisma.productView.findMany({
        where: { userId },
        select: {
          product: {
            select: { category: true }
          }
        },
        orderBy: { viewedAt: 'desc' },
        take: 10
      })
  
      const viewedCategories = [
        ...new Set(recentViews.map(v => v.product.category))
      ]
  
      // 2. Get highly-rated categories by user
      const highRated = await prisma.rating.findMany({
        where: {
          userId,
          value: { gte: 4 }
        },
        include: {
          product: true
        }
      })
  
      const ratedCategories = [
        ...new Set(highRated.map(r => r.product.category))
      ]
  
      const preferredCategories = [
        ...new Set([...viewedCategories, ...ratedCategories])
      ]
  
      let recommendedProducts = []
  
      if (preferredCategories.length > 0) {
        recommendedProducts = await prisma.product.findMany({
          where: {
            category: { in: preferredCategories }
          },
          take: 10,
          orderBy: { id: 'desc' }
        });
      } else {
        // Fallback: show best-rated products
        recommendedProducts = await prisma.product.findMany({
          orderBy: {
            ratings: {
              _avg: { value: 'desc' }
            }
          },
          take: 10
        })
      }
  
      res.status(200).json({
        status: 'success',
        data: { recommendedProducts }
      })
    } catch (err) {
      next(err)
    }
  }
  