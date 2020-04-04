var express = require('express');
var app = express();
var http = require('http');
var https = require('https');
var cfenv = require('cfenv');
var fs = require('fs');
var multer = require('multer');
var path = require('path');
var appEnv = cfenv.getAppEnv();
var sqlite3 = require('sqlite3');
var sharp = require('sharp');
var passport = require('passport')
var LocalStrategy = require('passport-local').Strategy;
var session = require('express-session');
var request = require('request');
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
require('date-utils');

//. 鍵ファイルと証明書ファイル
var options = {
    key: fs.readFileSync('files/vscode_live_server.key.pem'),
    cert: fs.readFileSync('files/vscode_live_server.cert.pem')
};

//. 鍵ファイルと証明書ファイルを指定して、https で待受け
var server = https.createServer(options, app).listen(appEnv.port, function () {
    console.log("server stating on " + appEnv.port + " ...");
});

//　静的ファイル
app.use(express.static('public'));

// データベース
var db = new sqlite3.Database('images.db');

// ejs
app.set("view engine", "ejs");

//. ドキュメントルートにリクエストがあった場合の処理
app.get('/', function (req, res) {
    fs.readFile('views/index.html', 'UTF-8',
        (error, data) => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write(data);
            res.end();
        });
});

app.get('/photo', function (req, res) {
    fs.readFile('views/photo.html', 'UTF-8',
        (error, data) => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write(data);
            res.end();
        });
});

app.get('/map', function (req, res) {
    fs.readFile('views/map.html', 'UTF-8',
        (error, data) => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write(data);
            res.end();
        });
});

function getUniqueStr(myStrong) {
    var strong = 1000;
    if (myStrong) strong = myStrong;
    return new Date().getTime().toString(16) + Math.floor(strong * Math.random()).toString(16)
}
var storage = multer.diskStorage({
    destination: './public/images/',
    filename: (req, file, cb) => {
        cb(null, getUniqueStr() + file.originalname)
    }
});
//var upload = multer({ dest: "./upload/" });
var upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
    // upload時間
    var dt = new Date();
    var uploadtime = dt.toFormat("YYYY-MM-DD HH24:MI:SS");
    // 投稿者
    var submitter = req.body.name;
    // サムネ作成
    console.log(req.file);
    var thumbpath = "public/thumbnail/" + req.file.filename;
    sharp(req.file.path).resize(null, 227).toFile(thumbpath, (err, info) =>{
        if (err) {
            throw err
        }
    });
    // publicを消す
    thumbpath = "thumbnail/" + req.file.filename;
    // ファイルパス publicを消す
    var imagepath = req.file.path.substring("public/".length);
    // gps情報
    var latitude = req.body.latitude;
    var longitude = req.body.longitude;
    // db 追加
    var query = "INSERT INTO images (uploadtime, submitter, imagepath, thumbpath, latitude, longitude) values (?, ?, ?, ?, ?, ?)";
    db.run(query, uploadtime, submitter, imagepath, thumbpath, latitude, longitude);

    console.log(uploadtime);
    console.log(submitter);
    console.log(imagepath);
    console.log(thumbpath);
    console.log(latitude);
    console.log(longitude);
    res.send("succees");
});

//投稿者一覧
app.get('/api/submitter/', (req, res) => {
    var query = "SELECT DISTINCT submitter from images;"
    res.header('Content-Type', 'application/json; charset=utf-8')
    var ret = [];
    db.all(query, (err, rows) => {
        rows.forEach(row => {
            ret.push(row["submitter"]);
        });
        res.send(ret);
    });
});

//投稿情報
app.get('/api/submitter/:name', (req, res) => {
    var name = req.params.name;
    var query = "SELECT * From images WHERE submitter = '" + name + "' ORDER BY uploadtime DESC;";

    res.header('Content-Type', 'application/json; charset=utf-8')
    var ret = [];
    db.all(query, (err, rows) => {
        if (err) return err;
        rows.forEach(row => {
            ret.push(row);
        });
        res.send(ret);
    });
});

function radians(deg){
    return deg * ( Math.PI / 180 );
}
// 距離指定
app.get('/api/:lat/:lng/:range', (req, res) => {
    var query = "SELECT * From images;";
    var lat = req.params.lat;
    var lng = req.params.lng;
    var range = req.params.range;
    res.header('Content-Type', 'application/json; charset=utf-8')
    var ret = [];
    db.all(query, (err, rows) => {
        if (err) return err;
        rows.forEach(row => {
            var lat_rad = radians(row.latitude);
            var lng_rad = radians(row.longitude); 
            var distance = 6371 * Math.acos(
                Math.cos(radians(lat)) 
                * Math.cos(lat_rad) 
                * Math.cos(lng_rad - radians(lng))
                + Math.sin(radians(lat))
                * Math.sin(lat_rad));
            console.log(distance);
            if (distance <= range){
                ret.push(row);
            }
        });
        res.send(ret);
    });
});

app.post('/api/:id', (req, res) => {
    if (req.body._method == 'DELETE') {
        var query = "DELETE From images WHERE id = '" + req.body.id + "';";
        db.run(query);
        res.sendStatus(200);
    }
    res.sendStatus(500);
})

app.get('/api/hotpepper/:lat/:lng', (req, res) => {
    var url = "http://webservice.recruit.co.jp/hotpepper/gourmet/v1/?key=0f7f5ab231adaa06&format=json&range=1";
    url += "&lat=" + req.params.lat;
    url += "&lng=" + req.params.lng;
    var options = {
        url: url,
        method: 'GET',
        json: true
    };
    request(options, function (error, response, body) {
        if (body){
            var ret = {};
            shoplist = body.results.shop;
            if (shoplist.length > 0){
                ret.name = shoplist[0].name;
                ret.address = shoplist[0].address;
                ret.url = shoplist[1].url =  shoplist[0].urls.pc;
            }
            res.header('Content-Type', 'application/json; charset=utf-8')
            res.status(200).json(ret);
        }
        if (error){
            res.status(500);
        }
    })
})