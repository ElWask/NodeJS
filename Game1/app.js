var express = require('express');
var app = express();
//create a server
var serv = require('http').Server(app);

//server for / nothing or /client
app.get('/',function(req,res){
    res.sendFile(__dirname + '/client/index.html')
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server started");

// socket.io library

//list of connections
var SOCKET_LIST = {};
var PLAYER_LIST = {};

//super class
var Entity = function(){
    var self = {
        x:250,
        y:250,
        spdX:0,
        spdY:0,
        id:""
    };
    self.update = function(){
      self.updatePosition();
    };
    self.updatePosition = function(){
        self.x += self.spdX;
        self.y += self.spdY;
    };
    return self;
};

var Player = function(id){
    var self = Entity();
    self.id = id;
    self.number="" + Math.floor(10 * Math.random());
    self.pressingRight=false;
    self.pressingLeft=false;
    self.pressingUp=false;
    self.pressingDown=false;
    self.maxSpd=10;

    var super_update = self.update;
    self.update = function(){
        self.updateSpd();
        super_update();
    };
    self.updateSpd = function(){
        if(self.pressingRight)
            self.spdX = self.maxSpd;
        else if(self.pressingLeft)
            self.spdX = -self.maxSpd;
        else
            self.spdX = 0;

        if(self.pressingUp)
            self.spdY = -self.maxSpd;
        else if(self.pressingDown)
            self.spdY = self.maxSpd;
        else
            self.spdY = 0;
    };

    Player.list[id] = self;
    return self;
};
Player.list = {};
Player.onConnect = function(socket){
    var player = Player(socket.id);

    //listen if press button
    socket.on('keyPress',function(data){
        if(data.inputId === 'left')
            player.pressingLeft = data.state;
        else if(data.inputId === 'right')
            player.pressingRight = data.state;
        else if(data.inputId === 'up')
            player.pressingUp = data.state;
        else if(data.inputId === 'down')
            player.pressingDown = data.state;
    });
};
Player.onDisconnect = function(socket){
    delete Player.list[socket.id];
};
Player.update = function(){
    //info about every single player
    var pack = [];

    for(var i in Player.list){
        var player = Player.list[i];

        //update pos
        player.update();
        pack.push({
            x:player.x,
            y:player.y,
            number:player.number
        })

    }
    return pack;
};

var io = require('socket.io')(serv,{});

//everytime you connect to the server
io.sockets.on('connection',function(socket){

    //new socket
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;

    Player.onConnect(socket);

    //listen if leave the connection
    socket.on('disconnect',function(){
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    });
});

// we need to send this to the message
setInterval(function(){
    var pack = Player.update();
    for(var i in SOCKET_LIST){
        var socket = SOCKET_LIST[i];
        socket.emit('newPositions',pack);
    }

},1000/25); //every 40 milliseconds
