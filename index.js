const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
dotenv.config()

const uri = process.env.MONGODB_URI;

const app = express()
const PORT = process.env.PORT

app.use(cors())
app.use(express.json())

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const db = client.db('pawnest')
    const petCollection = db.collection('pets')

    app.get('/pet', async (req, res) => {
        const result = await petCollection.find().toArray();
        res.json(result);
    })

    app.post('/pet', async (req, res) => {
        const petData = req.body
        console.log(petData);
        const result = await petCollection.insertOne(petData)

        res.json(result)
    })

  
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('server is running fine!')
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})