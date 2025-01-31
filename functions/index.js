// * Libraries
const app = require('express')()
const functions = require('firebase-functions')
const {db} = require('./util/admin')
const cors = require('cors')
const nodemailer = require('nodemailer')
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
  commentOnPost,
  getAllComments,
  deleteComment
} = require('./routers/posts')

const {
  getAllUsers,
  signup,
  verifyAccount,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead
} = require('./routers/users')

const { 
  getAllPlaces,
  saveLocation,
  editPlaceDetails,
  deletePlace,
  deletePlaceDetail,
  getPlace,
  addPlaceExtraDetails
} = require('./routers/locations')

const {
    startChat,
    sendMessage,
    getUserChats,
    getChatMessages
} = require('./routers/chat')

// *Posts router
// acessar o database e pegar todos os posts
app.get('/posts', getAllPosts)
// criar um novo post
app.post('/post', FirebaseAuth, addNewPost)
// adicionar foto no post
app.post('/post/image/:postId', FirebaseAuth, uploadImage)
// pegar um unico post
app.get('/post/:postId', getOnePost);
// deletar post
app.delete('/post/:postId', FirebaseAuth, deleteOnePost);
// dar like
app.get('/post/:postId/like', FirebaseAuth, likePost)
// tiar o like do post
app.get('/post/:postId/unlike', FirebaseAuth, unlikePost)
// comentar em um post
app.post('/post/:postId/comment', FirebaseAuth, commentOnPost)
// pegar todos os comentarios
app.get('/comments', getAllComments)
// deletar comentario
app.delete('/comment/:commentId', FirebaseAuth, deleteComment)

// *User Router
// pegar todos os usuarios que
app.get('/users', getAllUsers)
// registrar
app.post('/signup', signup)
// logar
app.post('/login', login)
// registrar
app.post('/verify/:handleAndToken', verifyAccount)
// atualizar imagem do perfil ou adicionar foto no post
app.post('/user/image/:postPicture?', FirebaseAuth, uploadImage)
// editar descrição do user
app.post('/user', FirebaseAuth, addUserDetails) 
// descrição do usuario atual (logado)
app.get('/user', FirebaseAuth, getAuthenticatedUser) 
// pegar descrição/dados de outro usuario
app.get('/user/:handle', getUserDetails)
// marcar notificações como lida
app.post('/notifications', FirebaseAuth, markNotificationsRead)

// * Locations Router
// pegar locais
app.get('/places/?:filter?', getAllPlaces)
// pegar local
app.get('/place/:placeId', getPlace)
// registrar locaiton
app.post('/savelocation', saveLocation)
// adicionar detalhes extras
app.post('/place/:placeId', FirebaseAuth, addPlaceExtraDetails)
// deletar detalhe
app.post('/placedetail/:placeId', FirebaseAuth, deletePlaceDetail)
// editar locaiton
app.post('/editlocation/:placeId', FirebaseAuth, editPlaceDetails)
// delete place
app.delete('/deletelocation/:placeId', FirebaseAuth, deletePlace)

// * Chat Router
// pegar os chats
app.get('/chat', FirebaseAuth, getUserChats)
// pegar as mensagens de um chat
app.get('/chat/:chatId', FirebaseAuth, getChatMessages)
// criar chat
app.post('/chat', FirebaseAuth, startChat)
// enviar mensagem
app.post('/message/:chatId', FirebaseAuth, sendMessage)

exports.api = functions.https.onRequest(app)

// onCreate vai ativar um evento que nesse caso quando um novo like for criado no nosso database vai chamar essa função
exports.createNotificationOnLike = functions.firestore.document('likes/{id}').onCreate( (snapshot) => {
  // snapshot vai mandar os dados do document criado
  // pegar o post que foi dado like (o id dela tem nos dados do like)
  return db.doc(`/posts/${snapshot.data().postId}`).get()
      .then( doc => {
          // se esse post existe e não for o proprio usuario que deu like no proprio post...
          if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
              // criar um objeto dentro de 'notifications' com os dados da notificação para salvar e mandar para o recipient(dono do post) 
              return db.doc(`/notifications/${snapshot.id}`).set({
                  createdAt: new Date().toISOString(),
                  recipient: doc.data().userHandle,
                  sender: snapshot.data().userHandle,
                  type: 'like',
                  read: false,
                  postId: doc.id
              });
          }
      })
      // nao precisa retornar nada pois não faz parte da api
      .catch( err => {
          console.error(err);
      })
})

exports.sendEmailToVerifyAccountNewUser = functions
    .firestore.document('users/{handle}')
    .onCreate( (snapshot, context) => {

    const data = snapshot.data()

    let authData = nodemailer.createTransport({
        host: 'smtp.umbler.com',
        port: 587,
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASSWORD
        }
    });

    authData.sendMail({
        from: process.env.EMAIL,
        to: data.email,
        subject: 'Confirmação de conta',
        html: `
            <h2>Muito muito obrigado por se cadastrar no nosso app</h2>
            <h2>Agora o ultimo passo é confirmar seu email clicando no link abaixo</h2>
            <br />
            <form action="${process.env.APP_FRONTEND_URL}/verify/${data.handle}&token=${data.secretToken}" method="post">
                <input name='handle' type='hidden' value='${data.handle}' />
                <input type='submit' value="Confirmar" />
            </form>
        `
    }).then( info => {
            return res.send(info)
    }).catch( err => {
        return res.send(err)
    })

})


// caso o usuario removar o like vai tirar a notificação
exports.deleteNotificationOnUnlike = functions
    .firestore.document('likes/{id}')
    .onDelete( (snapshot) => {
        // pegar o id da notificação que foi retirado o like e deletar essa notificação
        return db.doc(`/notifications/${snapshot.id}`)
            .delete()
            .catch( err =>{
                console.error(err)
                return
            })
})

// Quando criar um novo comentario
exports.createNotificationOnComment = functions
    .firestore.document('comments/{id}')
    .onCreate( (snapshot) => {
        // vai pegar o id atraves do snapshot do post que foi direcionada o comentario
        return db.doc(`/posts/${snapshot.data().postId}`)
            .get()
            .then( doc => {
                // se nao foi o proprio usuario que comentou no proprio post
                if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
                    // criar um objeto com os dados da notificação para salvar e mandar para o recipient(dono do post)
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        type: 'comment',
                        read: false,
                        postId: doc.id
                    });
                }
            })
            // nao precisa retornar nada pois não faz parte da api
            .catch( err => {
                console.error(err);
                return;
            })
})

// Quando o usuario mudar a imagem dele...
exports.onUserImageChange = functions.firestore.document('/users/{userId}')
    .onUpdate( change => {
        // change tem dois valores 'change.before.data()' e 'change.after.data()'
        // se o usuario mudou a imagem, ou seja, a de antes é diferente da atual
        if(change.before.data().imageUrl !== change.after.data().imageUrl){
            // criar um batch(armazenar os commits)
            const batch = db.batch();
            // para todos os posts que pertence ao usuario...
            return db.collection('posts')
                .where('userHandle', '==', change.before.data().handle)
                .get()
                .then( data => {
                    data.forEach( doc => {
                        // para todos os posts e atualizar a imagem do usuario para a atual
                        const posts = db.doc(`/posts/${doc.id}`);
                        batch.update(posts, {userImage: change.after.data().imageUrl})
                    })
                    // commit nas atualizações
                    return batch.commit()
                })
        } else {
            return true
        }
})

// Quando deletar um post
exports.onPostDelete = functions.firestore.document("/posts/{postId}")
    .onDelete( (snapshot, context) => {
        // no context vamos pegar os dados passados pelo parametro na url
        const postId = context.params.postId;
        // armazenar os commit
        const batch = db.batch();
 
        // pegar todos os comentarios que são do post
        return db.collection('comments').where('postId', '==', postId).get()
            .then( data => {
                // para cada comentario desse post
                data.forEach(doc => {
                    // deletar ela
                    batch.delete(db.doc(`/comments/${doc.id}`))
                    // armazenar os delete no batch
                })
                // pegar os likes desse post
                return db.collection('likes').where('postId', '==', postId).get()
            })
            .then( data => {
                // para cada like do post deletar
                data.forEach(doc => {
                    // armazenar no batch
                    batch.delete(db.doc(`/likes/${doc.id}`))
                })
                // pegar as notificações do post
                return db.collection('notifications').where('postId', '==', postId).get()
            })
            .then( data => {
                // para cada notificação, deletar.
                data.forEach(doc => {
                    batch.delete(db.doc(`/notifications/${doc.id}`))
                })
                // commit em tudo
                return batch.commit()
            })
            .catch( err => {console.error(err)})
})
