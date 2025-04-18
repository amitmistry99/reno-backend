export const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString()

export const sendOTP = async (phone, otp) => {
  console.log(`OTP for ${phone}: ${otp}`)
  // Replace with actual SMS service
}
