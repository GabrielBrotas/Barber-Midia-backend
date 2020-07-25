const {admin, db} = require('./admin')

// Middleware para verificar o token do usuario ao fazer um requisicao
module.exports = (req, res, next) => {
    let idToken;
    // se tiver autorização...
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')){
        // pegar o token
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.error('no token found')
        return res.status(403).json({ error: 'Unauthorized'})  
    }
    admin
        .auth()
        .verifyIdToken(idToken)
        .then( decodedToken => {
            // dentro do decodedToken vai ter eos dados do user, vamos adicionar os dados para o request router ter acesso
            req.user = decodedToken;

            // o user handle nao fica do decoded token entao vamos fazer uma requisicao ao database
            return db.collection('users')
                .where('userId', '==', req.user.uid)
                .limit(1)
                .get();
        })
        .then( data => {
            // adicinar ao request do user o handle que vai ser o primeiro item do array
            req.user.handle = data.docs[0].data().handle
            req.user.imageUrl = data.docs[0].data().imageUrl
            return next();
        })
        .catch( err => {
            console.error('Error while verifying token ', err)
            return res.status(403).json(err)
        })
}

// req.user = 
// {
//     iss: 'https://securetoken.google.com/barber-midia',
//     >    aud: 'barber-midia',
//     >    auth_time: 1595699829,
//     >    user_id: '3Zi7mSYxgAPZMz7OcZlfl27HlNT2',
//     >    sub: '3Zi7mSYxgAPZMz7OcZlfl27HlNT2',
//     >    iat: 1595699829,
//     >    exp: 1595703429,
//     >    email: 'user2@test.com',
//     >    email_verified: false,
//     >    firebase: { identities: { email: [Array] }, sign_in_provider: 'password' },
//     >    uid: '3Zi7mSYxgAPZMz7OcZlfl27HlNT2'
// }