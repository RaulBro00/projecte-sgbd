//EXPRESS: INFRAESTRUCTURA DE APLICACIONES WEB NODE.JS
const express = require('express');
const { listenerCount } = require('process');
const app = express();

//
const path = require('path');

const axios = require("axios");
const { promisify, isBuffer } = require("util");


// Puerto de escucha de node.js API (3000)      
app.listen(3000,() => console.log('listening port 3000'));

// Creación cliente redis. Conectado a docker.             
var redis = require('redis');
const { addAbortSignal } = require('stream');
var client = redis.createClient(); 


// Promisifying Get and set methods
const GET_ASYNC = promisify(client.get).bind(client);
const SET_ASYNC = promisify(client.set).bind(client);

// Conectamos con redis, automáticamente puerto 6379
client.on('connect', function() {
    console.log('connected');
});

// Flush a la base de datos cada vez que iniciamos la API
client.flushdb( function (err, succeeded) {
    console.log(succeeded); 
});


// Cargamos .html => Inicialiación de BD redis
app.get('/',function(req,res){
    cargar_personajes(); 
    f_itinerario();
    armas();
    res.sendFile(path.join(__dirname+'/index.html'));
});


///FUNCIONES PARA CARGAR REDIS AL INICIALIZARSE LA API///
///<------------------------------------------------->\\\

// Inicializamos en redis tres listas con los diferentes
// itinerarios de armas
async function f_itinerario(){
    client.rpush('itinerario:0', [1, 2, 3, 4, 5, 6]);
    client.rpush('itinerario:1', [4, 3, 6, 1, 5, 2]);
    client.rpush('itinerario:2', [6, 3, 5, 4, 2, 1]);
}

// Inicializamos en redis un bloque hash para cada arma
// con sus correspondientes atributos
async function armas(){
    for(let i=0;i<7;i++){
        var precision = Math.floor(Math.random() * (100 - 50) + 50);
        var daño = Math.floor(Math.random() * (100 - 50) + 50);
        var arma = 'arma:' + i;
        client.hset(arma, 'numero', i);
        client.hset(arma, 'precision', precision);
        client.hset(arma, 'daño', daño);
    }
}

// Carga de personajes 
async function cargar_personajes(){
    // Search Data in Redis
    const reply = await GET_ASYNC("character");

    // if exists returns from redis and finish with response
    if (reply) return res.send(JSON.parse(reply));

    // Fetching Data from Rick and Morty API
    const response = await axios.get(
        "https://rickandmortyapi.com/api/character"
    );

    // resond to client
    for(let i=0;i<20;i++){
        var name = response.data.results[i].name;
        var imagen = response.data.results[i].image;
        var itinerario = Math.floor(Math.random() * (3 - 0));
        var id = 'personaje:' + i;

        // hash para cada jugadors 
        client.hset(id, 'nombre', name);
        client.hset(id, 'vida', 100);
        client.hset(id, 'muertes', 0);
        client.hset(id, 'imagen', imagen);
        client.hset(id, 'grupo_armas', itinerario);
        client.hset(id, 'n_arma_actual', 0);
    }
}


///BUCLE PARA IR ACTUALIZANDO DE FORMA AUTOMÁTICA BD///
///<----------------------------------------------->\\\

//Cada 1s ejecuta la función especificada
var myInt = setInterval(function () {

    // pull, carga todos los datos de los jugadores de base de datos redis a proceso
    pull_datos();

    // mostramos los jugadores para ver sus armas que todo esté correcto
    showPlayers();

    // simulamos una ronda de disparos 
    simular();

    //push de los datos a la base de datos redis
    push_datos();

    // exit si gana un jugador
    //fin_partida();

}, 2000);


//Definimos clases
class Player {
    constructor(id, nombre, n_arma_actual, itinerario, vida) {
      this.id = id;
      this.nombre = nombre;
      this.n_arma_actual = n_arma_actual;
      this.itinerario = itinerario;
      this.vida = vida;
    }
}

class Arma {
    constructor(precision, daño) {
      this.precision = precision;
      this.daño = daño;
    }
}

var px = new Player('-',-1,'-',-1,100);
var ar = new Arma(0,0);
var ganador = '-';
var v_players = [px,px,px,px,px,px,px,px,px,px];
var v_armas = [ar,ar,ar,ar,ar,ar,ar,ar,ar,ar];


function fin_partida(){
    if(ganador!='-') console.log('Winner...player: '+ ganador +' !!!');
}

// Muestra atributos de jugadores por terminal para ver
// como evolucionan a lo largo de la partida
function showPlayers(){

    for(var i=0;i<10;i++){
        console.log('nombre ' + v_players[i].nombre);
        console.log('vida ' + v_players[i].vida);
        console.log('daño ' + v_armas[i].daño);
        console.log('precision ' + v_armas[i].precision);
    }

}


async function pull_datos() {

    //10 jugadores aleatorios colocados en el vector
    var arr = [0,1,2,3,4,5,6,7,8,9], itinerario=[0,0];
    var nombre = '-', key_arma_actual = '-';
    var n_arma_actual = -1, arma_actual=0, vida=100, daño=100, precision=100; 

    // para cada uno de ellos obttendremos sus atributos y armas 
    for (let i = 0; i < 10; i++) {

        // cada posición del vector contiene uno de los 20 posibles jugadores
        arr[i] = Math.floor(Math.random() * (20 - 0));
        var personaje = 'personaje:' + arr[i];

        // obtenemos su nombre
        await client.hget(personaje, 'nombre', function(err, reply) {
            nombre = reply;
        });

        // obtenemos su número de arma actual
        await client.hget(personaje, 'n_arma_actual', function(err, reply) {
            n_arma_actual = reply;
        });

        // obtenemos su itinerario
        await client.hget(personaje, 'grupo_armas', function(err, reply) {
            itinerario = 'itinerario:' + reply;
            
            // sabiendo su itinerario, obtenemos su arma actual
            client.lindex(itinerario,n_arma_actual,function(err, reply) {
                key_arma_actual = 'arma:' + reply;

                // obtenemos el daño de su arma actual
                client.hget(key_arma_actual, 'daño', function(err, reply) {
                    daño = reply;
                });

                // obtenemos la precision de su arma actual
                client.hget(key_arma_actual, 'precision', function(err, reply) {
                    precision = reply;
                    
                    // creamos el arma en cuestión y la guardamos temporalmente en un vector
                    var a = new Arma(precision,daño);
                    v_armas[i] = a;
                });

            });


        });

        // obtenemos su vida
        await client.hget(personaje, 'vida', function(err, reply) {
            vida = reply;

            // vida es el último atributo para generar el jugador y añadirlo
            // de forma permanente a un vector
            var p = new Player(arr[i], nombre, n_arma_actual, itinerario, vida);
            v_players[i] = p;
        });
    }
}

// Función para simular disparos entre 10 jugadores cada cierto
// periodo de tiempo.
async function simular(){
    for(let i=0;i<5;i++){
        var p1 = v_players[i*2]; var w1 = v_armas[i*2]; var prec1 = w1.precision; var daño1 = w1.daño;
        var p2 = v_players[i*2+1]; var w2 = v_armas[i*2+1]; var prec2 = w2.precision; var daño2 = w2.daño;
        var visibilidad = Math.floor(Math.random() * (100 - 0));

        //reducir código repetido -->
        if(prec1 > visibilidad){
            p2.vida = p2.vida - w1.daño;
            if(p2.vida<=0){ 
                p2.vida = 100;
                if(p1.n_arma_actual<6) p1.n_arma_actual = Number(p1.n_arma_actual) + 1;
            }
        }
        if(prec2 > visibilidad){
            p1.vida = p1.vida - w2.daño;
            if(p1.vida<=0){
                p1.vida = 100;
                if(p2.n_arma_actual<6) p2.n_arma_actual = Number(p2.n_arma_actual) + 1;
            }
        }
    }
}

// Actualizamos los valores de los jugadores a la base de datos
async function push_datos() {

    for (let i = 0; i < 10; i++) {

        // key personaje y clase personaje
        var string_personaje = 'personaje:' + v_players[i].id;
        var personaje = v_players[i];

        // push n_arma_actual 'redis'
        await client.hset(string_personaje, 'n_arma_actual', personaje.n_arma_actual, (err, res) => {})

        // push vida 'redis'
        await client.hset(string_personaje, 'vida', personaje.vida, (err, res) => {})

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
