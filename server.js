const dotenv = require('dotenv');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const cors = require('cors');
const mongoose = require('mongoose');
const GameData = require('./models/gameData');
// const RoundData = require('./models/roundData');
const userRoutes = require('./routes/actions');
const bodyParser = require('body-parser');

const io = require('socket.io')(server, {
    cors: {
        origin: "*",
    }
});

dotenv.config();
let port = process.env.PORT || 5000;
app.use(bodyParser.json());

app.use(cors());
app.use('/', userRoutes);
app.get("/", (req, res) => res.send('HEllo from  new express'));
app.all("*", (req, res) => res.send("This doesn't exist!"));

mongoose.connect(process.env.MONGO_DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Database connected');
}).catch(err => console.log(err));

let round_id;
let count = 15;

gameSocket = null;
gameSocket = io.on('connection', function (socket) {
    console.log('socket connected: with an user id ' + socket.id);

    console.log('a user is connected');


    socket.on('disconnect', function () {
        console.log('socket disconnected: ' + socket.id);
    });
})



//Create GameData In DB on first time server start
async function checkIfCollectionExists() {
    let collectionExit = await GameData.findOne({ gameID: "coinToss" });

    if (collectionExit === null) {
        const Data = new GameData({
            gameID: "coinToss",
        });

        Data.save().then(() => {
            StartRound();

        }).catch(err => console.log(err))
    } else {
        StartRound();
    }
}
checkIfCollectionExists();

//function start game  and creating new round id and emiting it
const StartRound = async () => {

    let date = new Date();
    round_id = "cT" + date.getDate().toString() + (date.getMonth() + 1).toString() + date.getFullYear().toString() + "-" + date.getHours().toString() + date.getMinutes().toString() + date.getSeconds().toString();

    io.emit("RoundId", round_id);
    io.emit("Round_Status", "ROUND_START");

    await GameData.updateOne({ gameID: "coinToss" },
        {
            $set: {
                currentRoundID: round_id
            }
        }).then(() => {
            console.log("new roundid-------------     " + round_id);
        });

    interval = setInterval(() => {
        let p = 5;
        io.emit("Counter", count--);
        if (count === 0) {
            clearInterval(interval);
            io.emit("Round_Status", "NO_MORE_BETS");
            let toss = GetRandomInteger(0, 1);

            // Storing result in DB
            GameData.updateOne(
                {
                    $push: {
                        previousResults: {
                            "roundId": round_id,
                            "tossResult": (toss === 1)?"Head":"Tail",
                        }
                    }
                },
                async function (error, success) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log("preResult updated");
                        let response = await GameData.findOne({ gameID: "coinToss" });
                        io.emit('PrevResults', JSON.stringify(response.previousResults));

                    }
                });


            io.emit("Result", tossResult);
            setTimeout(() => {
                newInterval = setInterval(() => {
                    count = 15;
                    io.emit("nextRoundCounter", p--);
                    if (p === 0) {
                        clearInterval(newInterval);
                        io.emit("Round_Status", "ROUND_END");
                        p = 5;
                        setTimeout(() => {
                            StartRound();
                        }, 3000);
                    }
                }, 1000);
            }, 5000);
        }
    }, 1000);
}


//Generate a random number between range
function GetRandomInteger(min, max,) {
    return (Math.floor(Math.random() * (max - min + 1)) + min);
}

server.listen(port, () => {
    console.log("listening to port : ", port);
});
