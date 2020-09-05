const {db} = require('../util/admin')
const {validateLocationData, reducePlaceDetails} = require('../util/validators')


exports.saveLocation = async (req, res, next) => {

    const {category, description, handle, lat, lng} = req.body
    const newPlace = {category, description, handle, lat, lng, details: []}

    const {valid, errors} = validateLocationData(newPlace)

    if(!valid) return res.status(400).json(errors)
    
    try {
        db.collection('places')
            .add(newPlace)
            .then( (doc) => {
                const newPlaceResponse = newPlace;
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

exports.addPlaceExtraDetails = (req, res) => {
    const placeId = req.params.placeId
    const {detail} = req.body

    if(detail.trim() === '') {
        return res.status(403).json({error: 'Digite algo'})
    } else {
        db.doc(`/places/${placeId}`).get()
        .then( async (doc) => {
            details = doc.data().details
            details.push(detail)
            if (doc.data().handle === req.user.handle) {
                await db.doc(`/places/${placeId}`).update({details})
                return res.json({message: "Details added successfully"});
            } else {
                return res.status(403).json({error: "voce nao tem autorização para fazer isso"})
            }
            
        })
        .catch( err => {
            console.error(err)
            return res.status(500).json({error: err.code})
        })
    }

}

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
                    placeId: doc.data().placeId,
                    details: doc.data().details
                })
            })
            // retornar em um json todos os dados da collection 'posts'
            return res.json(places);
        })
        .catch( err => console.error(err))
}