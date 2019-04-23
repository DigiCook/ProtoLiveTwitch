// Shinobi (http://shinobi.video) - FFMPEG H.264 over HTTP Test

var child = require('child_process');
var events = require('events');
var spawn = child.spawn;
var exec = child.exec;

var config = {
    port:8001,
    url:'rtsp://192.168.1.17/11'
}

function startffmpeg(clientNum) {
    //ffmpeg
    console.log('Starting FFMPEG for client ' + clientNum)
    //var ffmpegString = '-re -i '+config.url+' -g 52 -f mp4 -c:v copy -movflags frag_keyframe+empty_moov -an -'
    var ffmpegString = '-i '+config.url+' -f webm -c:v libvpx -an -'
    if(ffmpegString.indexOf('rtsp://')>-1){
        ffmpegString='-rtsp_transport tcp '+ffmpegString
    }
    console.log('Executing : ffmpeg '+ffmpegString)
    ffmpeg = spawn('ffmpeg',ffmpegString.split(' '));
    ffmpeg.on('close', function (buffer) {
        console.log('ffmpeg died')
    })

    var emitter = new events.EventEmitter().setMaxListeners(0)
    ffmpeg.stdout.on('data', function (buffer) {
        emitter.emit('data',buffer)
    });

    return [ffmpeg,emitter];
}
//web app
console.log('Starting Express Web Server on Port '+config.port)
var express = require('express')
var app = express();
var http = require('http')
var httpServer = http.createServer(app);
var clientNum = 1

// Règle du serveur Express pour servir le flux vidéo en progressive download (WebM)
app.get('/vdo.webm', function (req, res) {
    let thisclientNum = clientNum++
    result = startffmpeg(thisclientNum);
    let ffmpeg = result[0]
    let emitter = result[1]
    var contentWriter
    var date = new Date();
    res.writeHead(200, {
        'Date': date.toUTCString(),
        'Connection': 'close',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Content-Type': 'video/webm',
        'Server': 'WebM from rtsp stream',
    });
    emitter.on('data',contentWriter=function(buffer){
        res.write(buffer)
    })
    // Gestion de la déconnexion du client
    res.on('close', function () {
        emitter.removeListener('data',contentWriter)
        console.log("Connection closed by client " + thisclientNum)
        if (ffmpeg) {
          ffmpeg.kill();
          console.log("ffmpeg being killed....")
        } else {
          console.log("no ffmpeg existing")
        }
    })
});

app.post('/setip', function(req, res) {
    let newip = req.query.newip;
    config.url =  'rtsp://' + newip  +'/11'
    console.log("New camera ip set to url : " + config.url)
//    res.send(user_id + ' ' + token + ' ' + geo);
});

// Règle du serveur Express pour servir les ressources du sous-dossier "static"
app.use(express.static('static'));

httpServer.listen(config.port);
