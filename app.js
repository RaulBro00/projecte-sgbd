//EXPRESS: INFRAESTRUCTURA DE APLICACIONES WEB NODE.JS
const express = require('express');
const { listenerCount } = require('process');
const app = express();

//
const path = require('path');

const axios = require("axios");
const { promisify } = require("util");


//PUERTO DE ESCUCHA DE NODE.JS API
app.listen(3000,() => console.log('listening port 3000'));

//REDIS: CREACIÓN DE UN CLIENTE REDIS -> CONECTADO A DOCKER
var redis = require('redis');
var client = redis.createClient(); //creates a new client

//
// Promisifying Get and set methods
const GET_ASYNC = promisify(client.get).bind(client);
const SET_ASYNC = promisify(client.set).bind(client);


client.on('connect', function() {
    console.log('connected');
});



//IMPORTAR HTML
app.get('/',function(req,res){
    cargar_personajes();
    res.sendFile(path.join(__dirname+'/index.html'));
});


async function cargar_personajes(){
    // Search Data in Redis
    const reply = await GET_ASYNC("character");

    // if exists returns from redis and finish with response
    if (reply) return res.send(JSON.parse(reply));

    // Fetching Data from Rick and Morty API
    const response = await axios.get(
        "https://rickandmortyapi.com/api/character"
    );

    // Saving the results in Redis. The "EX" and 10, sets an expiration of 10 Seconds
    const saveResult = await SET_ASYNC(
        "character",
        JSON.stringify(response.data),
        "EX",
        10
    );

    // resond to client
    for(let i=0;i<20;i++){
    var name = response.data.results[i].name;
    var imagen = response.data.results[i].image;
    var numero_random = Math.floor(Math.random() * (3 - 0));
    var id = 'presonaje:' + i;

    //HASH 
    client.hset(id, 'nombre', name);
    client.hset(id, 'vida', 100);
    client.hset(id, 'muertes', 0);
    client.hset(id, 'imagen', imagen);
    client.hset(id, 'grupo_armas', numero_random);
    client.hset(id, 'arma_catual', 0);
    }
}

//INICIALIZACIÓN BASE DE DATOS RICKY MORTY
// Get all characters
app.get("/character", async (req, res, next) => {
    try {
      // Search Data in Redis
      const reply = await GET_ASYNC("character");
  
      // if exists returns from redis and finish with response
      if (reply) return res.send(JSON.parse(reply));
  
      // Fetching Data from Rick and Morty API
      const response = await axios.get(
        "https://rickandmortyapi.com/api/character"
      );
  
      // Saving the results in Redis. The "EX" and 10, sets an expiration of 10 Seconds
      const saveResult = await SET_ASYNC(
        "character",
        JSON.stringify(response.data),
        "EX",
        10
      );
  
      // resond to client
      for(let i=0;i<20;i++){
        var name = response.data.results[i].name;
        var imagen = response.data.results[i].image;
        var numero_random = Math.floor(Math.random() * (3 - 0));
        var id = 'presonaje:' + i;
        //client.sadd('rickymorty',response.data.results[i].name);
        //HASH 
        client.hset(id, 'nombre', name);
        client.hset(id, 'vida', 100);
        client.hset(id, 'muertes', 0);
        client.hset(id, 'imagen', imagen);
        client.hset(id, 'grupo_armas', numero_random);
        client.hset(id, 'arma_catual', 0);
      }
      res.send(response.data);
    } catch (error) {
      res.send(error.message);
    }
  });

//INICIALIZAR ARMAS
for(var i=0;i<7;i++){
    var arma = 'arma:' + i;
    client.hset(arma, 'name', 'perfectchuck');
}


//HASH 
client.hset('player1', 'name', 'perfectchuck');
client.hset('player1', 'email', 'perfecthuck@gmail.com');
client.hset('player1', 'kills', 10);
client.hset('player1', 'assists', 10);
client.hset('player1', 'weapons', 'weapons_player1');

//SET PARA UNA DE LAS CLAVES DEL HASH
client.sadd('weapons_player1', 'weapon1', 'weapon2', 'weapon3');

//

//EXISTS
app.get('/exists/:id', function(req, res) {
    if (client.exists(req.params.id,  function(err, reply) {
        if (reply == 1) {
            res.send('exists');
        } else {
            res.send('doesn\'t exist');
        }
    }));
});

//EXISTS, CREACIÓN DE JSON COMO RESPUESTA
app.get('/exists/json/:id', function(req, res) {
    if (client.exists(req.params.id,  function(err, reply) {
        if (reply == 1) {
            res.json({respuesta:'exists',
                      codigo_respuesta: 1});
        } else {
            res.json({respuesta:'doesn\'t exist'});
        }
    }));
});



//GET HASH, KILLS
app.get('/player/kills/:id', function(req, res) {
    client.hget(req.params.id,'kills',(err, reply) => {
        if (err) throw err;
        res.send('kills: ' + reply);
    });
});

//GET WEAPONS
app.get('/player/weapons/:id', function(req, res) {
    client.hget(req.params.id,'weapons',(err, reply) => {
        if (err) throw err;
        //ahora accedo a la key de weapons del user
        client.smembers(reply, function(err2, reply2) {
            if (err2) throw err2;
            res.send(reply2);
        });
    });
});
