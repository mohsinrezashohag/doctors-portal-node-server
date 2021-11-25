const express = require('express')
const app = express();
const cors = require('cors')
const { MongoClient } = require('mongodb');
require('dotenv').config()
const ObjectId = require('mongodb').ObjectId
const port = process.env.PORT || 5000;

// stripe related require
const stripe = require("stripe")(process.env.STRIPE_SECRET);



//middleware
app.use(cors())
app.use(express.json())



app.get('/', (req, res) => {
    res.send("Okay !!Doctor Portal Server Running Well ✅")
})

// firebase admin facility require

const admin = require("firebase-admin");
const serviceAccount = require('./doctorsportalfull-firebase-adminsdk-rgddx-39b8cf04bd.json');
// const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK)
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {

        const token = req.headers.authorization.split(' ')[1];
        try {
            const decodeUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodeUser.email;

        }

        catch {


        }

    }
    next();
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g008r.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

console.log(uri);



async function run() {

    try {
        await client.connect();
        const database = client.db("DoctorsPortalFull");
        const appointmentsCollection = database.collection("appointments");
        const usersCollection = database.collection("users");

        // post api
        app.post('/addAppointments', async (req, res) => {
            const newAppointment = req.body;
            const result = await appointmentsCollection.insertOne(newAppointment);
            res.json(newAppointment)
        })

        // get appointments by filter email
        app.get('/appointments', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = req.query.date;
            const query = { email: email, date: date }
            const appointments = await appointmentsCollection.find(query).toArray();
            res.json(appointments)
        })

        // load appointments base on appointment id
        app.get('/appointments/:appointmentId', async (req, res) => {
            const id = req.params.appointmentId;
            const filter = { _id: ObjectId(id) }
            const result = await appointmentsCollection.findOne(filter)
            res.send(result)


        })




        // saving the users  
        app.post('/addUser', async (req, res) => {
            const user = req.body;
            console.log('POST Working', user);
            const result = await usersCollection.insertOne(user);
            console.log(user);
            console.log(result);
        })



        // cheeking user is admin or not 

        app.get('/users/:email', async (req, res) => {

            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true
            }

            res.json({ isAdmin })
        })


        // saving the user when google sign in 
        app.put('/addUser', async (req, res) => {

            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            console.log(result);
            res.json(result)
        })


        // make admin to an existing user
        app.put('/makeAdmin', verifyToken, async (req, res) => {
            const user = req.body;
            // console.log("make admin put : ", req.headers.authorization);
            const requestMaker = req.decodedEmail;

            if (requestMaker) {
                const requesterAccount = await usersCollection.findOne({ email: requestMaker });

                if (requesterAccount.role === 'admin') {

                    const filter = { email: user.email };
                    const updateDoc = {
                        $set: {
                            role: `admin`
                        },
                    };


                    const result = await usersCollection.updateOne(filter, updateDoc);
                    console.log(result);
                    res.send(result)

                }

                else {

                    res.status(403).json({ message: "You Cant Make Anyone Admin" })
                }
            }



        })


        app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                payment_method_types: ['card']
            })
            res.send({ clientSecret: paymentIntent.clientSecret })

        })





        // change check 




    }

    finally {
        // await client.close();

    }

}

run().catch(console.dir);











app.listen(port, () => {
    console.log('Listening to port : ', port);
})