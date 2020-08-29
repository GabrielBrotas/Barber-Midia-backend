exports.getTokenFromParams = (params) => {
    let token = params.split('&token=')[1]
    return token
}
