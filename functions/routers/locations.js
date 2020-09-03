const firebase = require('firebase')

const {db} = require('../util/admin')
const config = require('../util/config')
const {reduceUserDetails, validateLocationData, reducePlaceDetails} = require('../util/validators')


// Add new location
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
            if (doc.data().title === title && doc.data().handle !== handle) {
                throw new Error('Essa barbearia já esta cadastrada. tente novamente!')
            }
        })

        db.collection('places')
        .add(newPlace)
        .then( (doc) => {
            const newPlaceResponse = newPlace;
            // adicionar o Id do documento criado no objeto
            newPlaceResponse.placeId = doc.id;
            doc.update(newPlaceResponse)
            res.json(newPlaceResponse)
        }).catch( err => {
            res.status(500).json({error: 'Algo deu errado ! ' + err})
            console.error(err)
        })

    } catch(err) {
        next(err)
    }

}

// Add/update user place
exports.editPlaceDetails = async (req, res) => {
    // vai pegar os dados formatados que o usuario passou para editar a descrição
    let placeDetails = reducePlaceDetails(req.body)
    // atualizar o dado do usuario com os dados passado
    placeDetails.handle = req.user.handle

    if(req.params.placeId) {
        await db.doc(`/places/${req.params.placeId}`).update(placeDetails)
        return res.status(200).json(placeDetails)
    } else {
        return res.status(500).json({error: "Something went wrong"})
    }
}

// Add/edit user details
exports.addPlaceExtraDetails = (req, res) => {

    const detail = req.body
    console.log(detail)
    // if(details.trim() === '') {
    //     return res.status(403).json({error: 'Digite algo'})
    // } else {
    //     db.doc(`/users/${req.user.handle}`).get()
    //     .then( (doc) => {
    //         console.log(doc)
    //         return res.json({message: "Details added successfully"});
    //     })
    //     .catch( err => {
    //         console.error(err)
    //         return res.status(500).json({error: err.code})
    //     })
    // }

}

// delete place
exports.deletePlace = async (req, res) => {
    const document = db.doc(`/places/${req.params.placeId}`);

    document.get()
        .then( doc => {
            // se nao existir retornar erro 404...
            if(!doc.exists){
                return res.status(404).json({erro: "Local não encontrado"})
            }
            // se nao for o dono da Post retornar 403...
            if(doc.data().handle !== req.user.handle) {
                return res.status(403).json({error: "Voce nao tem permissão para fazer isso."})
            } else {
                // deletar o documento
                return document.delete();
            }
            return document.delete();
        })
        .then( () => {
            // retornar mensagem
            res.json({message: "Local deletado com sucesso"})
        })
        .catch(err => {
            console.error(err);
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
                    title: doc.data().title,
                    placeId: doc.data().placeId
                })
            })
            // retornar em um json todos os dados da collection 'posts'
            return res.json(places);
        })
        .catch( err => console.error(err))
}