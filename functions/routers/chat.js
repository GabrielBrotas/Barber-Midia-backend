const {db} = require('../util/admin');
const admin = require('firebase-admin')

exports.startChat = async (req, res) => {

    const {userTwoId} = req.body
    const userOneId = req.user.uid

    try{
        let checkIfChatExist = false;
        let chatId;

        await db.collection('/chats').get()
        .then( data => {
            data.forEach( doc => {
                if ((doc.data().userOneId  === userOneId  && doc.data().userTwoId === userTwoId) || doc.data().userTwoId === userOneId  && doc.data().userOneId  === userTwoId) {
                    checkIfChatExist = true;
                    chatId = doc.id
                }
            })
        })
        
        if(!checkIfChatExist) {
            const updatedAt = admin.firestore.Timestamp.now()
            const chat = await db.collection('chats').add({userOneId, userTwoId, updatedAt})
            return res.status(200).json({chatId: chat.id, messages: []})
        } else {
            db.collection('chats').doc(chatId)
                .collection('messages')
                .orderBy('timestamp', 'asc')
                .get()
                .then( data => {
                    const messages = []
                    data.forEach( doc => {
                        messages.push({
                            userId: doc.data().userId,
                            message: doc.data().message,
                            timestamp: doc.data().timestamp,
                        })
                    })
                    return res.json({chatId, messages})
                }).catch( err => console.log(err))
        }
        
    } catch (err) {
        console.log('error' + err)
    }
    
}

exports.sendMessage = async (req, res) => {

    const {message} = req.body
    const {chatId} = req.params

    try{
        const userId = req.user.uid 
        const timestamp = admin.firestore.Timestamp.now()
        await db.collection('chats').doc(chatId).update({updatedAt: admin.firestore.Timestamp.now()})
        await db.collection('chats').doc(chatId).collection('messages').add({
            message,
            userId,
            timestamp 
        })
        res.status(200).json({userId, message, timestamp})
    } catch (err) {
        res.status(500).json({error: "Something went wrong"})
    }
    
}

exports.getUserChats = async (req, res) => {
    
    let chats = [];
    let userOneId, userTwoId, userOneHandle, userTwoHandle; 
    try{
        const chatsDB = await db.collection('chats').orderBy("updatedAt", 'desc').get()
        const dbUsers = await db.collection('users').get()
        chatsDB.forEach( async doc => {
            userOneId = doc.data().userOneId
            userTwoId = doc.data().userTwoId
    
            if( userOneId === req.user.uid || userTwoId === req.user.uid) {
      
                dbUsers.forEach( doc => {
                    if(doc.data().userId === userOneId){
                        userOneHandle = doc.data().handle
                    } else if (doc.data().userId === userTwoId) {
                        userTwoHandle = doc.data().handle
                    }
                })
    
                chats.push({
                    chatId: doc.id,
                    userOne: userOneHandle,
                    userTwo: userTwoHandle
                })
  
        }})
        return res.json([...chats])
    } catch (err) {
        res.json({err})
    }
}

exports.getChatMessages = (req, res) => {
    const {chatId} = req.params

    db.collection('chats').doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .get()
        .then( data => {
            const messages = []
            data.forEach( doc => {
                messages.push({
                    userId: doc.data().userId,
                    message: doc.data().message,
                    timestamp: doc.data().timestamp,
                })
            })
            return res.json({chatId, messages})
        })
        .catch( err => console.log(err))
}