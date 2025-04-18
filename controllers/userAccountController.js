export const userAccountController = (req, res) => {
    return res.status(404).json({ message: 'User not found' })
}

export default userAccountController