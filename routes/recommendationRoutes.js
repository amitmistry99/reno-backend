import { getRecommendedProducts, } from '../controllers/productController'
import { authMiddleware } from '../middleware/authMiddleware'
  
  router.get('/recommended', authMiddleware, getRecommendedProducts)
  