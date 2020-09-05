const firebase = require('firebase')
const bcrypt = require('bcryptjs')
const randomstring = require('randomstring')

const {admin, db} = require('../util/admin')
const config = require('../util/config')
const {validateSignupData, validateLoginData, reduceUserDetails} = require('../util/validators')
const {getTokenFromParams} = require('../util/helpers')

firebase.initializeApp(config)

// take users
exports.getAllUsers = (req, res) => {
    // db.collection(<nome da collection>) para acessá-la
    db.collection('users')
        // ordenar
        .orderBy('createdAt', 'desc')
        // .get() para pegar todos os dados da collection
        .get()
        .then( data => {
            // array para armazenar os dados
            let users = []
            data.forEach( doc => {
                // para cada documento dentro dos dados colocar deentro do array criado
                users.push({
                    userId: doc.data().userId,
                    handle: doc.data().handle,
                    category: doc.data().category,
                    email: doc.data().email,
                    imageUrl: doc.data().imageUrl,
                    createdAt: doc.data().createdAt,
                    bio: doc.data().bio
                });
            })
            // retornar em um json todos os dados da collection 'posts'
            return res.json(users);
        })
        .catch( err => console.error(err))
}

// Log user in
exports.login = async (req, res) => {
    const {email, password} = req.body
    const userData = {email, password}

    const {valid, errors} = validateLoginData(userData)

    if(!valid) return res.status(400).json(errors)
    else {
    try{ 
        let user;
        const dbUsers = await db.collection('users').get()
        dbUsers.forEach( doc => {
            if(doc.data().email === email) {
                user = doc.data();
            }
        })
        if(user) {
        bcrypt.compare(password, user.password, (err, match) => {
            if(match){
                
            var isChecked = user.confirmed
            
            if(isChecked){
                firebase.auth().signInWithEmailAndPassword(email, user.password)
                .then( data => {
                    // pegar o token
                    return data.user.getIdToken()
                })
                .then(token => {
                    // retornar o token
                    return res.json({token})
                })
                .catch(err => {
                    console.error(err);
                    // auth/wrong-password
                    return res.status(403).json({general: "Dados inválidos. Por favor tente novamente."})
                })
            } else {
                return res.status(403).json({general: "Pendente confirmar conta."})
            }
                
            } else {
                return res.status(403).json({general: "Dados inválidos. Por favor tente novamente."})
            }
        })
        } else {
            return res.status(403).json({general: "Dados inválidos. Por favor tente novamente."})
        }

    } catch (err) {
        console.log(err)
    }
    }
    
}

// Sign up new user
exports.signup = async (req, res) => {
    const {email, password, confirmPassword, handle, type, category} = req.body
    const newUser = {email, password, confirmPassword, handle, type, category}

    const {valid, errors} = validateSignupData(newUser)

    if(!valid) return res.status(400).json(errors)

    const noImg = "no-img.png"
    
    const checkIfUserExist = await db.doc(`/users/${newUser.handle}`).get()

    if(checkIfUserExist.exists){
        return res.status(400).json({ handle: 'Este usuário já existe. tente novamente!'})
    } 

    let checkIfEmailExist = false
    db.collection('/users').get()
        .then( data => {
            data.forEach( doc => {
                if (doc.data().email === email) {
                    checkIfEmailExist = true
                }
            })
        })
        .then( async () => {
        try{

            const salt = bcrypt.genSaltSync(10)
            const hash = bcrypt.hashSync(password, salt)
            const secretToken = randomstring.generate(30)
            
            // criar objeto com as credenciais
            const userCredentials = {
            handle, 
            email,
            createdAt: new Date().toISOString(),
            // url onde o firebase vai guardar as imagens
            imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
            type,
            category,
            secretToken,
            confirmed: false,
            password: hash
            }
            
            if(!checkIfEmailExist) {
                // esperar criar um novo usuario, na collection user o nome do dado vai ser o 'handle' do user, set() vai criar um novo usuario, ao inves de get que apenas pega, com os dados do objeto criado
                await db.doc(`/users/${newUser.handle}`).set(userCredentials)
                return res.status(200).json({message: "Pronto, agora confirme seu cadastro no endereço de email!"})
            } else {
                return res.status(400).json({ email: 'Este email já existe. tente novamente!'})
            }
            
        } catch(err) {
            if (err.code === 'auth/email-already-in-use'){
                return res.status(400).json({ email: 'Este email já existe. tente novamente.'})
            } else {
                return res.status(500).json({general: "Something went wrong"})
            }
        }
        })
        .catch( err => console.error(err))
    
    // feito isso vai criar uma autenticação para o usuario
}

exports.verifyAccount = (req, res) => {

    var {handle} = req.body
    var urlParams = req.params.handleAndToken

    var token = getTokenFromParams(urlParams)

    db.doc(`/users/${handle}`)
        .get()
        .then( async user => {
            if(user.exists) {
                // esperar criar um usuario com o email e senha passado
                try{
                    const data = await firebase
                    // autenticar
                    .auth()
                    // criar um novo usuario que possa se autenticar
                    .createUserWithEmailAndPassword(user.data().email, user.data().password)

                // pegar o uid do usuario criado
                const userId = data.user.uid

                db.doc(`/users/${handle}`).update({confirmed: true, secretToken: "", userId})
                
                // confirmar localização
                if(user.data().type === "Profissional") {
                    let placeId;
                    const dbPlaces = await db.collection('places').get()
                   
                    dbPlaces.forEach( doc => {
                        if(doc.data().handle === handle){
                            placeId = doc.data().placeId    
                        }
                    })
                    await db.doc(`/places/${placeId}`).update({confirmed: true})
                }


                return res.redirect(`http://localhost:3000/verify/${handle}&token=${token}`)
                } catch (err) {
                    return res.status(201).json({err} )
                }
            } else {
                return res.status(400).json({error: 'Esta conta não existe'})
            }
        })
}


// Add/edit user details
exports.addUserDetails = (req, res) => {
    // vai pegar os dados formatados que o usuario passou para editar a descrição
    let userDetails = reduceUserDetails(req.body)
    // atualizar o dado do usuario com os dados passado
    db.doc(`/users/${req.user.handle}`).update(userDetails)
        .then( () => {
            return res.json({message: "Details added successfully"});
        })
        .catch( err => {
            console.error(err)
            return res.status(500).json({error: err.code})
        })
}

// Get any user's details
exports.getUserDetails = (req, res) => {
    let userData = {}

    // pegar os dados do usuario
    db.doc(`/users/${req.params.handle}`).get()
        .then( doc => {
            if(doc.exists){
                // adicionar os dados no objeto
                userData.user = doc.data();
                // pegar os posts que o usuario tem
                return db.collection("posts").where('userHandle', '==', req.params.handle)
                    .orderBy('createdAt', 'desc')
                    .get()
            }
            else{
                return res.status(404).json({error: "user not found"})
            }
        })
        .then( data => {
            userData.posts = []
            // colocar todos os posts do usuario dentro do array 'posts' no objeto
            data.forEach( doc => {
                userData.posts.push({
                    bodyText: doc.data().bodyText,
                    bodyImage: doc.data().bodyImage,
                    createdAt: doc.data().createdAt,
                    userHandle: doc.data().userHandle,
                    userImage: doc.data().userImage,
                    likeCount: doc.data().likeCount,
                    commentCount: doc.data().commentCount,
                    postId: doc.id,
                })
                return res.json(userData)
            })
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({error: err.code})
        })
}

// Get own user details
exports.getAuthenticatedUser = (req, res) => {

    let userData = {likes: [], notifications: []};
    // pegar o usuario que está logado
    db.doc(`/users/${req.user.handle}`).get()
        .then( doc => {
            if(doc.exists){
                // adicionar os dados
                userData.credentials = doc.data();
                // retornar os likes que ele já deu
                return db.collection('likes').where('userHandle', '==', req.user.handle).get()
            }
        })
        .then( data => {
            // para cada like que o user já deu, adicionar no array dentro do objeto esse dado do like
            data.forEach(doc => {
                userData.likes.push(doc.data())
            })
            // pegar as 10 notificações desse usuario
            return db.collection("notifications").where('recipient', '==', req.user.handle)
                .orderBy('createdAt', 'desc').limit(10).get();
        })
        .then( data => {
            // pegar as 10 primeiras notificações do user para passar para o frontend
            // colocar as notificações no array dentro do objeto
            data.forEach(doc => {
                userData.notifications.push({
                    recipient: doc.data().recipient,
                    sender: doc.data().sender,
                    createdAt: doc.data().createdAt,
                    postId: doc.data().postId,
                    type: doc.data().type,
                    read: doc.data().read,
                    notificationId: doc.id
                })
            })
            return res.json(userData)
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({error: err.code})
        })
}


// Upload proflie image
exports.uploadImage = (req, res) => {
    // busboy é uma biblioteca que permite fazer upload de arquivos como foto
    const BusBoy = require("busboy");
    const path = require('path')
    const os =require('os')
    const fs = require('fs')

    const busboy = new BusBoy({headers: req.headers})

    // onde ficarao guardado os dados dos usuarios
    let imageFileName;
    let imageToBeUploaded = {};

    // quando mandar um 'file'...
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        const imageExtension = filename.split('.')[1]
        // validação dos tipos de arquivo
        if(mimetype !== "image/jpeg" && mimetype.type !== "image/png" && imageExtension !== 'png') return res.status(400).json({error: 'wrong file type submitted'})

        // alterar o nome da imagem e adicionar a extensao
        imageFileName = `${Math.round(Math.random()*100000000000)} - ${filename}`;

        // path vai unir as strings e formatar para um diretorio, ex: 'Users', 'Exemple' = Users\Exemple
        // os.tmpdir() vai pegar o diretorio do sistema onde guarda arquivos temporatios
        // vai salvar na pasta de arquivos temporarios com o nome do arquivo
        const filepath = path.join(os.tmpdir(), imageFileName);

        // adicionar ao objeto o arquivo e o mimetype(ex:image/jpeg)
        imageToBeUploaded = {filepath, mimetype}

        // o pipe transforma algo readable para writeable, ou seja, ele transforma um fluxo legível para um fluxo de gravação ao coletar dados.
        file.pipe(fs.createWriteStream(filepath))
    })

    // quando terminar o uplaod
    busboy.on('finish', () => {
        // fazer upload no storage/bucket do firebase
        admin.storage().bucket().upload(imageToBeUploaded.filepath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: imageToBeUploaded.mimetype
                }
            }
        })
        .then( () => {
            // alt midia visualiza no navegador, caso nao tenha vai baixar a imagem
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;

            const postIdFromUrl = req.params.postId

            // imagem para um post
            if(postIdFromUrl){
                return db.doc(`/posts/${postIdFromUrl}`).update({bodyImage: imageUrl})
            } else {
                return db.doc(`/users/${req.user.handle}`).update({imageUrl})
            } 
            
        })
        .then( () => {
            return res.json({message: "Image uploaded successfully"})
        })
        .catch(err=>{
            
            console.error(err)
            return res.status(500).json({error: err.code})
        })
    })

    busboy.end(req.rawBody);
    
}

exports.markNotificationsRead = (req, res) => {
    // batch permite multiplas operações no database
    let batch = db.batch()
    // para cada id passado pelo body
    req.body.forEach( notificationId => {
        // pegar o dado da notificação na collection
        const notification = db.doc(`/notifications/${notificationId}`);
        // atualizar a notificação para read = true
        batch.update(notification, {read: true})
        // batch vai ficar armazenando esses update
    })
    // quando der commit vai lançar todas as atualizações de vez
    batch.commit()
        .then( () => {
            return res.json({message: "Notifications marked read"})
        })
        .catch(err => {
            console.error(err)
            return res.status(500).json({error: err.code})
        })
}

