const firebase = require('firebase')

const {admin, db} = require('../util/admin')
const config = require('../util/config')
const {validateSignupData, validateLoginData, reduceUserDetails, validateLocationData} = require('../util/validators')

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
                });
            })
            // retornar em um json todos os dados da collection 'posts'
            return res.json(users);
        })
        .catch( err => console.error(err))
}

// Sign up new user
exports.signup = async (req, res) => {

    const {email, password, confirmPassword, handle, category} = req.body
    const newUser = {email, password, confirmPassword, handle, category}

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
        return res.status(400).json({ handle: 'Este usuário já existe. tente novamente!'})
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
        userId,
        category,
        }

        // esperar criar um novo usuario, na collection user o nome do dado vai ser o 'handle' do user, set() vai criar um novo usuario, ao inves de get que apenas pega, com os dados do objeto criado
        await db.doc(`/users/${newUser.handle}`).set(userCredentials)

        // retornar o token
        return res.status(201).json({ userToken} )

    } catch(err){
        console.error(err)
        if (err.code === 'auth/email-already-in-use'){
            return res.status(400).json({ email: 'Este email já existe. tente novamente.'})
        } else {
            return res.status(500).json({general: "Something went wrong"})
        }
        
    }
    // feito isso vai criar uma autenticação para o usuario
}

// Save location
exports.saveLocation = async (req, res, next) => {

    const {category, description, handle, title, lat, lng} = req.body
    const newPlace = {category, description, handle, title, lat, lng}

    // função para verificar os dados
    const {valid, errors} = validateLocationData(newPlace)
    // se nao tiver valido retornar os erros...
    if(!valid) return res.status(400).json(errors)
    
    try {
        // doc passando o caminho da collection e pegar o dado dessa collection com o nome do user handle
        const allPlaces = await db.collection('places').get()

        allPlaces.forEach( doc => {
            if (doc.data().title === title) {
                throw new Error('Essa barbearia já esta cadastrada. tente novamente!')
            }
        })
        db.collection('places')
        .add(newPlace)
        .then( (doc) => {
            const newPlaceResponse = newPlace;
            // adicionar o Id do documento criado no objeto
            newPlaceResponse.placeId = doc.id;
            res.json(newPlaceResponse)
        }).catch( err => {
            res.status(500).json({error: 'Algo deu errado ! ' + err})
            console.error(err)
        })

    } catch(err) {
        next(err)
    }

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
            return res.status(403).json({general: "Dados inválidos. Por favor tente novamente."})
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

// Add/update user place
exports.addPlaceDetails = (req, res) => {
    // vai pegar os dados formatados que o usuario passou para editar a descrição
    let placeDetails = reducePlaceDetails(req.body)
    // atualizar o dado do usuario com os dados passado

    const dbPlaces = db.collection('places')
    
    dbPlaces
        .where('handle', "==", req.user.handle)
        .get()
        .then( (doc) => {
            if(!doc.exists){
                dbPlaces.add(placeDetails)        
                return res.status(200).json(placeDetails)
            }
            return doc.update(placeDetails)
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

// take users place
exports.getAllPlaces = (req, res) => {
    // db.collection(<nome da collection>) para acessá-la
    db.collection('places')
        // .get() para pegar todos os dados da collection
        .get()
        .then( data => {
            // array para armazenar os dados
            let places = []
            data.forEach( doc => {
                // para cada documento dentro dos dados colocar deentro do array criado
                places.push({
                    handle: doc.data().handle,
                    category: doc.data().category,
                    lat: doc.data().lat,
                    lng: doc.data().lng,
                    description: doc.data().description,
                    title: doc.data().title
                });
            })
            // retornar em um json todos os dados da collection 'posts'
            return res.json(places);
        })
        .catch( err => console.error(err))
}