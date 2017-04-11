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

    self.getDistance = function(pt){
        return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
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
    self.pressingAttack=false;
    self.maxSpd=10;
    self.mouseAngle=0;

    var super_update = self.update;
    self.update = function(){
        self.updateSpd();
        super_update();

        if(self.pressingAttack){
            self.shootBullet(self.mouseAngle);
        }
    };

    self.shootBullet = function(angle){
        var b = Bullet(self.id,angle);
        b.x = self.x;
        b.y = self.y;
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
        else if(data.inputId === 'attack')
            player.pressingAttack = data.state;
        else if(data.inputId === 'mouseAngle')
            player.mouseAngle = data.state;
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

var Bullet = function(parent,angle){
    var self = Entity();
    self.id = Math.random();
    self.spdX = Math.cos(angle/180*Math.PI) * 10 ;
    self.spdY = Math.sin(angle/180*Math.PI) * 10 ;
    self.parent = parent;
    self.timer = 0;
    self.toRemove = false;
    var super_update = self.update;
    self.update= function(){
        if(self.timer++ > 100)
            self.toRemove = true;
        super_update();

        for(var i in Player.list){
            var p = Player.list[i];
            if(self.getDistance(p)<32 && self.parent !== p.id){
            //    handle collision ex: hp--;
                self.toRemove = true;
            }
        }
    };
    Bullet.list[self.id] = self;
    return self;
};
Bullet.list = {};

Bullet.update = function(){
    //info about every single player
    var pack = [];

    for(var i in Bullet.list){
        var bullet = Bullet.list[i];
        //update pos
        bullet.update();

        if(bullet.toRemove){
            delete Bullet.list[i];
        }else{
            pack.push({
                x:bullet.x,
                y:bullet.y
            })
        }
    }
    return pack;
};
var DEBUG = true;

var USERS = {
    "bob":"asd",
    "bob2":"bob",
    "aaa":"sss"
};

var isValidPassword = function(data,cb){
    setTimeout(function(){
        cb(USERS[data.username] === data.password);
    },10);
};
var isUsernameTaken = function(data,cb){
    setTimeout(function(){
        cb(USERS[data.username]);
    },10);

};
var addUser = function(data,cb){
    setTimeout(function() {
        USERS[data.username] = data.password
        cb();
    },10);
};

var io = require('socket.io')(serv,{});

//everytime you connect to the server
io.sockets.on('connection',function(socket){

    //new socket
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;

    //listen if connect sign in for the connection
    socket.on('signIn',function(data){
        isValidPassword(data,function(res){
            if(res){
                Player.onConnect(socket);
                socket.emit('signInResponse',{success:true});
            }else{
                socket.emit('signInResponse',{success:false});
            }
        });
    });

    //listen if connect sign in for the connection
    socket.on('signUp',function(data){
        isUsernameTaken(data, function (res) {
            if(res){
                socket.emit('signUpResponse',{success:false});
            }else{
                addUser(data,function(){
                    socket.emit('signUpResponse',{success:true});
                });

            }
        })

    });

    //listen if leave the connection
    socket.on('disconnect',function(){
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    });

    //listen if recieved a message
    socket.on('sendMsgToServer',function(data){
        var playerName = ("" + socket.id).slice(2,7);
        for(var i in SOCKET_LIST)
        {
            SOCKET_LIST[i].emit('addToChat', playerName + ': ' + data)
        }
    });

    //listen if recieved a message to debug WITHOUT ONLINE SERVER
    socket.on('evalServer',function(data){
        if(!DEBUG)
            return;
        var res = eval(data);
        socket.emit('evalAnswer', res);
    });



});

// we need to send this to the message
setInterval(function(){
    var pack = {
        player:Player.update(),
        bullet:Bullet.update()
    };
    for(var i in SOCKET_LIST){
        var socket = SOCKET_LIST[i];
        socket.emit('newPositions',pack);
    }

},1000/25); //every 40 milliseconds
