const {db} = require('../util/admin')

exports.getAllPosts = (req, res) => {
    // db.collection(<nome da collection>) para acessá-la
    db.collection('posts')
        // ordenar
        .orderBy('createdAt', 'desc')
        // .get() para pegar todos os dados da collection
        .get()
        .then( data => {
            // array para armazenar os dados
            let posts = []
            data.forEach( doc => {
                // para cada documento dentro dos dados colocar deentro do array criado
                posts.push({
                    postId: doc.id,
                    bodyImage: doc.data().bodyImage,
                    bodyText: doc.data().bodyText,
                    userHandle: doc.data().userHandle,
                    createdAt: doc.data().createdAt,
                    commentCount: doc.data().commentCount,
                    likeCount: doc.data().likeCount,
                    userImage: doc.data().userImage,
                });
            })
            // retornar em um json todos os dados da collection 'posts'
            return res.json(posts);
        })
        .catch( err => console.error(err))
}

exports.getAllComments = (req, res) => {
    // db.collection(<nome da collection>) para acessá-la
    db.collection('comments')
        // ordenar
        .orderBy('createdAt', 'desc')
        // .get() para pegar todos os dados da collection
        .get()
        .then( data => {
            // array para armazenar os dados
            let comments = []
            data.forEach( doc => {
                // para cada documento dentro dos dados colocar deentro do array criado
                comments.push({
                    postId: doc.data().postId,
                    bodyText: doc.data().bodyText,
                    userHandle: doc.data().userHandle,
                    userImage: doc.data().userImage,
                    createdAt: doc.data().createdAt,
                });
            })
            // retornar em um json todos os dados da collection 'posts'
            return res.json(comments);
        })
        .catch( err => console.error(err))
}

exports.addNewPost = (req, res) => {
    
    // remover todos os espaços em branco para evitar mandar um post vazio
    if(req.body.bodyText.trim() === "" ){
        return res.status(400).json({general: "O conteúdo não pode estar vazio"})
    }

    const {bodyText, bodyImage = null} = req.body

    const newPost = {
        bodyImage,
        bodyText,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0
    };

    // pegar a collection 'posts'
    db.collection('posts')
        // adicionar o objeto criado
        .add(newPost)
        .then( (doc) => {
            const ResponsePostData = newPost;
            // adicionar o Id do documento criado no objeto
            ResponsePostData.postId = doc.id;
            res.json(ResponsePostData)
        })
        .catch( err => {
            res.status(500).json({error: 'Algo deu errado ! ' + err})
            console.error(err)
        })
}

exports.getOnePost = (req, res) => {
    
    // armazenar os dados do post
    let PostData = {}
    
    // db.doc pega um caminho especifico dentro da collection, nesse caso queeremos o post passado pelo id
    db.doc(`/posts/${req.params.postId}`).get()
        .then( doc => {
            // se nao exister retornar um erro 404
            if(!doc.exists){
                return res.status(404).json({error: "post não encontrado"})
            }
            // armazenar os dados dentro do objeto criado
            postData = doc.data();
            // adicionar o id do post ao objeto
            postData.postId = doc.id;
            // pegar os comentarios desse post
            return db.collection('comments')
                .orderBy('createdAt', 'desc')
                // pegar os comentarios onde o id é igual ao passado pelo parametro
                .where('postId', '==', req.params.postId)
                .get()
        })
        .then( data => {
            // adicionar os comentarios desse post dentro do objeto 'postData'
            postData.comments = [];
            data.forEach(doc => {
                postData.comments.push(doc.data())
            });
            return res.json(postData)
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({error: err.code})
        })
}

// Delete post
exports.deleteOnePost = (req, res) => {
    // pegar o post passado pelo id
    const document = db.doc(`/posts/${req.params.postId}`);

    document.get()
        .then( doc => {
            // se nao existir retornar erro 404...
            if(!doc.exists){
                return res.status(404).json({erro: "Post não encontrado"})
            }
            // se nao for o dono da Post retornar 403...
            if(doc.data().userHandle !== req.user.handle) {
                return res.status(403).json({error: "Voce nao tem permissão para fazer isso."})
            } else {
                // deletar o documento
                return document.delete();
            }
            return document.delete();
        })
        .then( () => {
            // retornar mensagem
            res.json({message: "Post deletado com sucesso"})
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({error: err.code})
        })
}

// Like a post, checar se o usuario já deu like e pegar a quantidadee, caso o post exista
exports.likePost = (req, res) => {
    // pegar a collection 'likes' e verificar se existe um like desse usuario para esse post
    const likeDocument = db.collection('likes')
        // onde o usuario que deu like é igual ao usuario que tentou da like
        .where('userHandle', '==', req.user.handle)
        // e o postId é igual ao passado pelo parametro
        .where('postId', '==', req.params.postId)
        .limit(1);
    
    // vai pegar o post do id passado
    const postDocument = db.doc(`/posts/${req.params.postId}`);

    // para adicionar os dados do post
    let postData = {};

    postDocument.get()
        // doc vai ter todas as informações da post passada
        .then( doc => {
            // caso a post exista
            if(doc.exists){
                // adicionar os dados da post
                postData = doc.data();
                // colocar nos dados o id do documento que esta dando like
                postData.postId = doc.id;
                // e retonar o documento que verificou se o usuario ja deu like nessa post
                return likeDocument.get()
            } else {
                return res.status(404).json({error: 'post not found'})
            }
        })
        .then( data => {

            // se esses dados estiverem vazio, ou seja, se o usuario nao deu like na post
            if(data.empty){
                // adicionar na collection 'likes' um novo like com o id do post e o nome do user
                return db.collection('likes').add({
                    postId: req.params.postId,
                    userHandle: req.user.handle
                })
                .then( () => {
                    // aumentar o numero de likes do post no objeto criado
                    postData.likeCount++
                    // atualizar no banco de dados real do firebase com o numero de likes
                    return postDocument.update({likeCount: postData.likeCount});
                })
                .then( () => {
                    return res.json(postData)
                })
            } else {
                return res.status(400).json({error: "Voce já deu like nesse post"})
            }
        })
        .catch( err => {
            console.error(err)
            res.status(500).json({error: err.code})
        })

}

exports.unlikePost = (req, res) => {
    // verificar se o usuario tem um like no db para o post passado
    const likeDocument = db.collection('likes')
        .where('userHandle', '==', req.user.handle)
        .where('postId', '==', req.params.postId)
        .limit(1);
    
    const postDocument = db.doc(`/posts/${req.params.postId}`);

    let postData = {};

    postDocument.get()
        .then( doc => {
            if(doc.exists){
                // pegar os dados da screeam
                postData = doc.data();
                // e o id
                postData.postId = doc.id;
                return likeDocument.get()
            } else {
                return res.status(404).json({error: 'Post nao encontrado'})
            }
        })
        .then( data => {
            if(data.empty){
                return res.status(400).json({error: "Voce nao tem like nesse post"})
            } else {
                return db.doc(`likes/${data.docs[0].id}`).delete()
                    .then( () => {
                        // nos objeto do post subtrair a qtd de likes
                        postData.likeCount--;
                        // atualizar os dados do db
                        return postDocument.update({likeCount: postData.likeCount})
                    })
                    .then( () => {
                        res.json(postData)
                    })
            }
        })
        .catch( err => {
            console.error(err)
            res.status(500).json({error: err.code})
        })

}

// comment on a post, os comentarios vao ficar salvos em outra collection para tornar o app mais eficiente, caso seja um grande app com mais de 1k de comments para requisitar um post demoraria bastante e causaria mais por conta do trafego pelo request.
exports.commentOnPost = (req, res) => {
    // verificar se o comentario é nulo
    if(req.body.bodyText.trim() === "") return res.status(400).json({comment: "Comentario vazio"})

    // objeto para o comentario
    const newComment = {
        bodyText: req.body.bodyText,
        createdAt: new Date().toISOString(),
        postId: req.params.postId,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl
    }

    // pegar o post
    db.doc(`/posts/${req.params.postId}`).get()
        .then( doc => {
            if(!doc.exists){
                return res.status(404).json({error: 'Post nao encontrado'})
            }
            // atualizar a quantidade de comentarios no db
            return doc.ref.update({commentCount: doc.data().commentCount + 1})
        })
        .then(() => {
            // na collection('comments) adicionar um novo comentario com o objeto que criamos que tem os dados do post
            return db.collection('comments').add(newComment)
        })
        .then( () => {
            res.json(newComment)
        })
        .catch( err => {
            console.log(err)
            res.status(500).json({error: "Something went wrong"})
        })
}

