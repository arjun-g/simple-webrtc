const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

app.use(express.static('static'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + `/index.html`);
});


io.on('connection', (socket) => {
    console.log('a user connected');
    if(io.engine.clientsCount == 1){
        socket.emit("new room", {
            id: socket.id
        });
    }
    else{
        socket.emit("existing room", {
            id: socket.id
        });
        setTimeout(() => {
            socket.broadcast.emit('joined room', socket.id);
        }, 1000);
    }

    socket.on('offer', (offer, callback) => {
        io.sockets.sockets.get(offer.toId).emit('offer', offer);
        io.sockets.sockets.get(offer.toId).on('answer', answer => {
            console.log("GOT ASNWER", answer);
            if(answer.toId === offer.fromId){
                callback(answer);
            }
        })
    });

    socket.on('candidate', candidate => {
        socket.broadcast.emit('candidate', candidate);
    });

    socket.on('disconnect', () => {
        socket.broadcast.emit('left room', socket.id);
    });

});

server.listen(process.env.PORT || 3000, () => {
    console.log('Server started');
});