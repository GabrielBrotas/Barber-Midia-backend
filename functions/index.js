// * Libraries
const app = require('express')()
const functions = require('firebase-functions')
const {db} = require('./util/admin')
const cors = require('cors')
require('dotenv/config')
const FirebaseAuth = require('./util/fbAuth')
// * Configs
app.use(cors())

// * Routes 
const {
  getAllPosts,
  addNewPost,
  getOnePost, 
  deleteOnePost, 
  likePost,
  unlikePost,
  commentOnPost
} = require('./routers/posts')

const {
  signup,
  login,
  uploadImage
} = require('./routers/users')


// *Posts router
// acessar o database e pegar todos os posts
app.get('/posts', getAllPosts)
// criar um novo post
app.post('/post', FirebaseAuth, addNewPost)
// pegar um unico post
app.get('/post/:postId', getOnePost);
// deletar post
app.delete('/post/:postId', FirebaseAuth, deleteOnePost);
// dar like
app.get('/post/:postId/like', FirebaseAuth, likePost)
// tiar o like do post
app.get('/post/:postId/unlike', FirebaseAuth, unlikePost)
// comentar em uma scream
app.post('/post/:postId/comment', FirebaseAuth, commentOnPost)

// *User Router

// registrar
app.post('/signup', signup)
// logar
app.post('/login', login)
// atualizar imagem do perfil
app.post('/user/image', FirebaseAuth, uploadImage)
// // editar descrição do user
// app.post('/user', FirebaseAuth, addUserDetails) // todo, add firebaseAuth
// // descrição do usuario atual (logado)
// app.get('/user', FirebaseAuth, getAuthenticatedUser)  // todo, add firebaseAuth
// // pegar descrição/dados de outro usuario
// app.get('/user/:handle', getUserDetails)
// // marcar notificações como lida
// app.post('/notifications', FirebaseAuth, markNotificationsRead) // todo, add firebaseAuth


exports.api = functions.https.onRequest(app)
