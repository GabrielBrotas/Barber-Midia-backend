const firebase = require('firebase')

const {admin, db} = require('../util/admin')
const config = require('../util/config')
const {validateSignupData, validateLoginData, reduceUserDetails} = require('../util/validators')

firebase.initializeApp(config)

// Sign up new user
exports.signup = async (req, res) => {

    const {email, password, confirmPassword, handle} = req.body
    const newUser = {email, password, confirmPassword, handle}

    // função para verificar os dados
    const {valid, errors} = validateSignupData(newUser)
    // se nao tiver valido retornar os erros...
    if(!valid) return res.status(400).json(errors)

    // imagem default para todos os usuarios(essa imagem já foi dada upload no db)
    const noImg = "no-img.png"
    
    // doc passando o caminho da collection e pegar o dado dessa collection com o nome do user handle
    const checkIfUserExist = await db.doc(`/users/${newUser.handle}`).get()

    // se existir um usuario com o handle(nick/name)...
    if(checkIfUserExist.exists){
        // nao vai cadastrar
        return res.status(400).json({ handle: 'this handle is already taken'})
    } 
    
    try{
        // esperar criar um usuario com o email e senha passado
        const data = await firebase
            // autenticar
            .auth()
            // criar um novo usuario que possa se autenticar
            .createUserWithEmailAndPassword(newUser.email, newUser.password)

        // pegar o uid do usuario criado
        const userId = data.user.uid

        // pegar o token gerado para esse usuario
        const userToken = data.user.getIdToken()
        
        // criar objeto com as credenciais
        const userCredentials = {
        handle, 
        email,
        createdAt: new Date().toISOString(),
        // url onde o firebase vai guardar as imagens
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
        userId
        }

        // esperar criar um novo usuario, na collection user o nome do dado vai ser o 'handle' do user, set() vai criar um novo usuario, ao inves de get que apenas pega, com os dados do objeto criado
        await db.doc(`/users/${newUser.handle}`).set(userCredentials)

        // retornar o token
        return res.status(201).json({ userToken} )

    } catch(err){
        console.error(err)
        if (err.code === 'auth/email-already-in-use'){
            return res.status(400).json({ email: 'Email already in use'})
        } else {
            return res.status(500).json({general: "Something went wrong"})
        }
        
    }
    // feito isso vai criar uma autenticação para o usuario
}

// Log user in
exports.login = (req, res) => {
    const {email, password} = req.body
    const user = {email, password}

    const {valid, errors} = validateLoginData(user)

    if(!valid) return res.status(400).json(errors)

    // autenticar o usuario com o email e a senha
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then( data => {
            // pegear o token
            return data.user.getIdToken()

        })
        .then(token => {

            // retornar o token
            return res.json({token})
        })
        .catch(err => {
            console.error(err);
            // auth/wrong-password
            return res.status(403).json({general: "Wrong credentials. Please try again."})
        })
}


// Add user details
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

// Get any useer's details
exports.getUserDetails = (req, res) => {
    let userData = {}
    console.log('okaa')
    // pegar os dados do usuario
    db.doc(`/users/${req.params.handle}`).get()
        .then( doc => {
            if(doc.exists){
                // adicionar os dados no objeto
                userData.user = doc.data();
                // pegar as screams que o usuario tem
                return db.collection("screams").where('userHandle', '==', req.params.handle)
                    .orderBy('createdAt', 'desc')
                    .get()
            }
            else{
                return res.status(404).json({error: "user not found"})
            }
        })
        .then( data => {
            userData.screams = []
            // colocar todas as scream do usuario dentro do array 'screams' no objeto
            data.forEach( doc => {
                userData.screams.push({
                    body: doc.data().body,
                    createdAt: doc.data().createdAt,
                    userHandle: doc.data().userHandle,
                    userImage: doc.data().userImage,
                    likeCount: doc.data().likeCount,
                    commentCount: doc.data().commentCount,
                    screamId: doc.id,
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
                    screamId: doc.data().screamId,
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
        // validação dos tipos de arquivo
        if(mimetype !== "image/jpeg" && mimetype.type !== "image/png") return status(400).json({error: 'wrong file type submitted'})

        // pegar a extensão do arquivo
        const imageExtension = filename.split('.')[filename.split('.').length - 1]
        // alterar o nome da imagem e adicionar a extensao
        imageFileName = `${Math.round(Math.random()*100000000000)}.${imageExtension}`;

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

            return db.doc(`/users/${req.user.handle}`).update({imageUrl})
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