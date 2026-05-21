const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config()

const uri = process.env.MONGODB_URI;

const app = express()
const PORT = process.env.PORT || 5000; // PORT না থাকলে ডিফল্ট ৫০০০ পাবে

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

        // ১. অল পেটস রাউট (সার্চ, ফিল্টার এবং শর্টিং সহ)
        app.get('/pet', async (req, res) => {
            try {
                const { search, species, sort } = req.query; // sort প্যারামিটার যুক্ত করা হয়েছে

                const query = {};

                if (search) {
                    query.petName = {
                        $regex: search,
                        $options: 'i',
                    };
                }

                if (species) {
                    const speciesArray = species.split(',').map((s) => s.trim());
                    query.species = { $in: speciesArray };
                }

                // শর্টিং অবজেক্ট তৈরি
                let sortObj = {};
                if (sort === 'low-to-high') {
                    sortObj.adoptionFee = 1; // কম থেকে বেশি দাম
                } else if (sort === 'high-to-low') {
                    sortObj.adoptionFee = -1; // বেশি থেকে কম দাম
                }

                // find() এর পর sort() মেথড যুক্ত করা হয়েছে
                const result = await petCollection.find(query).sort(sortObj).toArray();
                res.json(result);
            } catch (error) {
                console.error('Error fetching pets:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        app.get('/pet/:id', async (req, res) => {
            try {
                const { id } = req.params;

                // ১. প্রথমে সাধারণ স্ট্রিং আইডি হিসেবে ডাটাবেজে খোঁজা
                let result = await petCollection.findOne({ _id: id });

                // ২. যদি স্ট্রিং আইডি দিয়ে ডাটা না পাওয়া যায় এবং আইডিটি ভ্যালিড ObjectId ফরম্যাট হয়
                if (!result && ObjectId.isValid(id)) {
                    result = await petCollection.findOne({ _id: new ObjectId(id) });
                }

                if (!result) {
                    return res.status(404).json(null);
                }

                res.json(result);
            } catch (error) {
                console.error('Error fetching pet details:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });


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