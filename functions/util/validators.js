const { user } = require("firebase-functions/lib/providers/auth");

// check is the string is empty
const isEmpty = (string) => {
    // trim para tirar os espaços
    if(string.trim() === '') return true
    else return false;
}

// validate email
const isEmail = (email) => {
    // regular expression for a email
    const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    if(email.match(emailRegEx)) return true
    else return false
}


exports.validateSignupData = (data) => {
    // check erros...
    let errors = {}

    // checar se email vazio
    if(isEmpty(data.email)) errors.email = "Email inválido." 
    // checar se é um email valido
    else if (!isEmail(data.email)) errors.email = 'Digite um email valido'

    // checar se a senha esta vazia
    if(isEmpty(data.password)) errors.password = "Senha inválida."
 
    if(data.password !== data.confirmPassword) errors.confirmPassword = "As senhas estão divergentes"

    if(isEmpty(data.handle)) errors.handle = "Nome inválido"

    if(isEmpty(data.type)) errors.type = "Selecione uma classificação"

    if(data.type !== "Usuario") {
        if(isEmpty(data.category)) errors.category = "Selecione uma categoria"
    }

    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.validateLocationData = (data) => {

    // check erros...
    let errors = {}

    // checar se email vazio
    if(isEmpty(data.category)) errors.category = "Categoria inválida."
    // checar desecrição da localização
    else if (isEmpty(data.description)) errors.title = 'Localização invalida'

    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}


exports.validateLoginData = (data) => {
    let errors = {};

    if(isEmpty(data.email)) errors.email = "Must not be empty"
    if(isEmpty(data.password)) errors.password = "Must not be empty"

    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.reduceUserDetails = (data) => {
    let userDetails = {};

    // se tiver mandado uma bio adicionar ela no objeto
    if(!isEmpty(data.bio.trim())) userDetails.bio = data.bio

    // se tiver adicionado link para o ig https://www.instagram.com/jovemcoder/
    if(!isEmpty(data.instagram.trim())){
        // https://website.com <- modelo padrao de website
        // caso o inicio nao começe com http.. vamos adicioná-lo
        if(data.instagram.trim().substring(0, 26) !== 'https://www.instagram.com/'){
            // https://www.instagram.com/ + o nome do ig
            userDetails.instagram = `https://www.instagram.com/${data.instagram.trim()}`
        } else userDetails.instagram = data.instagram;
    }

    if(!isEmpty(data.category.trim())) userDetails.category = data.category

    // retornar os dados formatados
    return userDetails
}

exports.reducePlaceDetails = (data) => {
    let placeDetails = {};

    if(!isEmpty(data.category.trim())) placeDetails.category = data.category
    if(!isEmpty(data.description.trim())) placeDetails.description = data.description

    if(data.lat) placeDetails.lat  = data.lat
    if(data.lng) placeDetails.lng = data.lng

    return placeDetails
}


