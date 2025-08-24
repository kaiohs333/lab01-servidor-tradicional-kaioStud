module.exports = {
    port: process.env.PORT || 3000,
    jwtSecret: process.env.JWT_SECRET || 'seu-secret-aqui',
    jwtExpiration: '24h',
};