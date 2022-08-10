const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
const port = 2000;
const YoutubeMp3Downloader = require("youtube-mp3-downloader");

const users = {};
let allFiles = [];

const directoryPath = path.join(__dirname, 'music');

function setFiles() {
    fs.readdir(directoryPath, (err, files) => {
        if (!err) {
            files = files.map(fileName => {
                return {
                    name: fileName,
                    time: fs.statSync(`${directoryPath}/${fileName}`).mtime.getTime()
                }
            })
                .sort((a, b) => b.time - a.time)
                .map(v => v.name)
            allFiles = files;
            io.emit('getFiles', allFiles)

            // allFiles = files;
        }
    })
};
setFiles()
fs.watch(directoryPath, (eventType, fileName) => {
    // console.log(`File ${fileName} event: ${eventType}`);
    setFiles()
})

http.listen(port, () => {
    console.log(`App is running on port ${port}`)
})

io.on('connection', (socket) => {
    users[socket.id] = socket.id;
    socket.on("getFile", (id) => {
        const YD = new YoutubeMp3Downloader({
            "ffmpegPath": "/usr/bin/ffmpeg",        // FFmpeg binary location
            "outputPath": "music",                  // Output file location (default: the home directory)
            "youtubeVideoQuality": "highestaudio",  // Desired video quality (default: highestaudio)
            "queueParallelism": 2,                  // Download parallelism (default: 1)
            "progressTimeout": 500,                // Interval in ms for the progress reports (default: 1000)
            "allowWebm": false                      // Enable download from WebM sources (default: false)
        });

        YD.download(id);

        YD.on("progress", progress => {
            // console.log(Math.round(progress.progress.percentage));
            // const processProgress = progress.progress.percentage.toFixed(2)
            const processProgress = Math.round(progress.progress.percentage);
            io.to(socket.id).emit("processProgress", processProgress);
        })
        YD.on('finished', (err, data) => {
            if (!err) {
                io.to(socket.id).emit('data', data);
            }
        })
        YD.on('error', error => {
            io.to(socket.id).emit('error', "Error.. :(")
            console.log("Error - broken link. User: " + socket.id)
        })
    })
    socket.on('disconnect', () => {
        delete users[socket.id]
    })
    socket.on('getFiles', () => {
        io.emit('getFiles', allFiles)
        console.log("getFiles event triggered")
    })
});

app.get('/music/:file', cors(), (req, res) => {
    const file = req.params.file;
    res.download("music/" + file + '.mp3');
})