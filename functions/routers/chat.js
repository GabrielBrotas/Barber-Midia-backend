const firebase = require('firebase')
const {db} = require('../util/admin');
const admin = require('firebase-admin')

exports.createChat = async (req, res) => {

    const {userOne, userTwo} = req.body
    
    try{
        let checkIfChatExist = false;
        let chatId;

        await db.collection('/chats').get()
        .then( data => {
            data.forEach( doc => {
                if ((doc.data().userOne === userOne && doc.data().userTwo === userTwo) || doc.data().userTwo === userOne && doc.data().userOne === userTwo) {
                    checkIfChatExist = true;
                    chatId = doc.id
                }
            })
        })

        if(!checkIfChatExist) {
            const chat = await db.collection('chats').add({userOne, userTwo})
            return res.status(200).json({chat: chat.id})
        } else {
            return res.json({chat: chatId})
        }
        
    } catch (err) {
        console.log('error' + err)
    }
    
}

exports.sendMessage = async (req, res) => {

    const {message} = req.body
    const {roomId} = req.params

    try{
        console.log(req.user.handle)
        await db.collection('chats').doc(roomId).collection('messages').add({
            message,
            name: req.user.handle,
            timestamp: admin.firestore.Timestamp.now()
        })
        res.status(200).json({message: "mensagem enviada"})

    } catch (err) {
        res.status(500).json({error: "Something went wrong"})
    }
    
}