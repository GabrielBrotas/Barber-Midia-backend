// * Libraries
const app = require('express')()
const functions = require('firebase-functions')
const {db} = require('./util/admin')
const cors = require('cors')
require('dotenv/config')

// * Configs
app.use(cors())

// * Routes 
const {
  getAllPosts,
  addNewPost,
  getOnePost, 
  deleteOnePost, 
  likePost,
  unlikePost
} = require('./routers/posts')

// *Posts router
// acessar o database e pegar todos os posts
app.get('/posts', getAllPosts)
// criar um novo post
app.post('/post', addNewPost)
// pegar um unico post
app.get('/post/:postId', getOnePost);
// deletar post
app.delete('/post/:postId', deleteOnePost);
// dar like
app.get('/post/:postId/like', likePost)
// tiar o like do post
app.get('/post/:postId/unlike', unlikePost)
// comentar em uma scream
app.post('/post/:postId/comment', commentOnScream)

// *User Router

// registrar
app.post('/signup', signup)
// logar
app.post('/login', login)
// atualizar imagem do perfil
app.post('/user/image', uploadImage) // todo, add firebaseAuth
// editar descrição do user
app.post('/user', addUserDetails) // todo, add firebaseAuth
// descrição do usuario atual (logado)
app.get('/user', getAuthenticatedUser)  // todo, add firebaseAuth
// pegar descrição/dados de outro usuario
app.get('/user/:handle', getUserDetails)
// marcar notificações como lida
app.post('/notifications',  markNotificationsRead) // todo, add firebaseAuth


exports.api = functions.https.onRequest(app)
